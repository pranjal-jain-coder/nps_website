const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const {
    MAX_UPLOAD_BYTES,
    GRADE_FOLDER_IDS,
    normalizeDriveFolderId,
    sanitizeFilePart,
    buildPaperFileName,
    bufferToStream,
    googleErrorMessage
} = require('./driveUtils');

const VALID_GRADES    = new Set(['9', '10', '11', '12']);
const VALID_SUBJECTS  = new Set([
    'English','Hindi','French','Sanskrit','Kannada','Math','Science','Social Science',
    'Physics','Chemistry','Biology','Computer Science','Economics','Psychology',
    'Accountancy','Business Studies','Applied Mathematics','Entrepreneurship',
    'Informatics Practices','History'
]);
const VALID_EXAM_TYPES = new Set([
    'PT 1','Half-Yearly','PT 3','Annual-Exam',
    'Pre-board 1','Pre-board 2',
    'UT 1','UT 2','UT 3','UT 4'
]);

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const folderId = normalizeDriveFolderId(process.env.PENDING_DRIVE_FOLDER_ID);
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        if (!folderId) return { statusCode: 500, body: JSON.stringify({ error: 'PENDING_DRIVE_FOLDER_ID env var is not set.' }) };
        if (!spreadsheetId) return { statusCode: 500, body: JSON.stringify({ error: 'MASTER_SPREADSHEET_ID env var is not set.' }) };

        const { fileName, mimeType, base64, subject, year, grade, type } = JSON.parse(event.body);

        if (!base64 || mimeType !== 'application/pdf') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid file type. Must be PDF.' }) };
        }

        // Validate magic bytes — a real PDF starts with %PDF
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== '%PDF') {
            return { statusCode: 400, body: JSON.stringify({ error: 'File does not appear to be a valid PDF.' }) };
        }

        if (buffer.length > MAX_UPLOAD_BYTES) {
            return { statusCode: 413, body: JSON.stringify({ error: 'File size exceeds 4.5MB limit.' }) };
        }

        // Server-side field validation
        const gradeStr = String(grade || '').trim();
        const subjectStr = String(subject || '').trim();
        const typeStr = String(type || '').trim();
        const yearStr = String(year || '').trim();

        if (!VALID_GRADES.has(gradeStr)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid grade.' }) };
        }
        if (!VALID_SUBJECTS.has(subjectStr)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid subject.' }) };
        }
        if (!VALID_EXAM_TYPES.has(typeStr)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid exam type.' }) };
        }
        if (!/^\d{4}$/.test(yearStr)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid year.' }) };
        }

        const auth = getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        const suffix = sanitizeFilePart(fileName, 'Paper');
        const driveFileName = buildPaperFileName({ year: yearStr, grade: gradeStr, subject: subjectStr, type: typeStr, suffix });

        // --- Duplicate detection ---
        // 1. Check pending Submissions sheet for an identical entry
        const rowsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Submissions!A2:G',
        });
        const existingRows = rowsResponse.data.values || [];
        const pendingDuplicate = existingRows.find(row =>
            String(row[2] || '').trim() === subjectStr &&
            String(row[3] || '').trim() === yearStr &&
            String(row[4] || '').trim() === gradeStr &&
            String(row[5] || '').trim() === typeStr &&
            String(row[6] || '').trim() === suffix
        );
        if (pendingDuplicate) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: 'A paper with this exact combination (grade, subject, year, exam type, and file name) is already pending review. Please wait for it to be approved or contact an admin.',
                    duplicateIn: 'pending'
                })
            };
        }

        // 2. Check approved destination Drive folder for the same filename
        const destinationFolderId = GRADE_FOLDER_IDS[gradeStr];
        if (destinationFolderId) {
            const escapedName = driveFileName.replace(/'/g, "\\'");
            const searchResponse = await drive.files.list({
                q: `name = '${escapedName}' and '${destinationFolderId}' in parents and trashed = false`,
                fields: 'files(id,name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                corpora: 'allDrives'
            });
            const found = searchResponse.data.files || [];
            if (found.length > 0) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: `This paper ("${driveFileName}") has already been published in the Grade ${gradeStr} folder. If you believe this is an error, contact an admin.`,
                        duplicateIn: 'approved'
                    })
                };
            }
        }
        // --- End duplicate detection ---

        const driveResponse = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [folderId]
            },
            media: {
                mimeType,
                body: bufferToStream(buffer)
            },
            fields: 'id',
            supportsAllDrives: true
        });

        const fileId = driveResponse.data.id;

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Submissions!A:G',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[fileId, new Date().toISOString(), subjectStr, yearStr, gradeStr, typeStr, suffix]]
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, fileId })
        };
    } catch (error) {
        console.error('Error uploading resource:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: googleErrorMessage(error, 'Failed to upload resource') })
        };
    }
};
