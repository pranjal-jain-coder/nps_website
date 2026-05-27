const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const {
    MAX_UPLOAD_BYTES,
    normalizeDriveFolderId,
    sanitizeFilePart,
    buildPaperFileName,
    bufferToStream,
    googleErrorMessage
} = require('./driveUtils');

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

        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length > MAX_UPLOAD_BYTES) {
            return { statusCode: 413, body: JSON.stringify({ error: 'File size exceeds 4.5MB limit.' }) };
        }

        const auth = getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        const suffix = sanitizeFilePart(fileName, 'Paper');
        const driveFileName = buildPaperFileName({ year, grade, subject, type, suffix });

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
                values: [[fileId, new Date().toISOString(), subject, year, grade, type, suffix]]
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
