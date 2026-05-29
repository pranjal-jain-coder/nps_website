const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');
const {
    GRADE_FOLDER_IDS,
    buildPaperFileName,
    googleErrorMessage
} = require('./driveUtils');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { fileId, suffix, forceOverwrite } = JSON.parse(event.body);
        if (!fileId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fileId' }) };

        const auth = getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        if (!spreadsheetId) return { statusCode: 500, body: JSON.stringify({ error: 'MASTER_SPREADSHEET_ID env var is not set.' }) };

        const rowsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Submissions!A2:G',
        });

        const rows = rowsResponse.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === fileId);
        if (rowIndex === -1) return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };

        const row = rows[rowIndex];
        const [, , subject, year, grade, type, storedSuffix] = row;
        const destinationFolderId = GRADE_FOLDER_IDS[String(grade || '').trim()];
        if (!destinationFolderId) {
            return { statusCode: 400, body: JSON.stringify({ error: `No destination folder configured for Grade ${grade || '(blank)'}` }) };
        }

        const finalSuffix = suffix || storedSuffix;
        if (!String(finalSuffix || '').trim()) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Enter a suffix before approving.' }) };
        }

        const finalName = buildPaperFileName({ year, grade, subject, type, suffix: finalSuffix });

        // --- Conflict detection: check if a file with the same name already exists in the destination ---
        const escapedName = finalName.replace(/'/g, "\\'");
        const searchResponse = await drive.files.list({
            q: `name = '${escapedName}' and '${destinationFolderId}' in parents and trashed = false`,
            fields: 'files(id,name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives'
        });
        const conflictingFiles = searchResponse.data.files || [];

        if (conflictingFiles.length > 0) {
            if (!forceOverwrite) {
                // Warn the admin and return conflict details
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        conflict: true,
                        existingFileName: finalName,
                        existingFileIds: conflictingFiles.map(f => f.id),
                        grade: String(grade || '').trim(),
                        message: `A file named "${finalName}" already exists in the Grade ${grade} folder.`
                    })
                };
            }

            // forceOverwrite: trash all conflicting files before moving the new one
            await Promise.all(
                conflictingFiles.map(f =>
                    drive.files.update({
                        fileId: f.id,
                        requestBody: { trashed: true },
                        supportsAllDrives: true
                    })
                )
            );
        }
        // --- End conflict detection ---

        const fileResponse = await drive.files.get({
            fileId,
            fields: 'parents',
            supportsAllDrives: true
        });
        const currentParents = fileResponse.data.parents || [];
        const removeParents = currentParents.filter(parentId => parentId !== destinationFolderId).join(',');

        await drive.files.update({
            fileId,
            requestBody: { name: finalName },
            addParents: destinationFolderId,
            ...(removeParents ? { removeParents } : {}),
            fields: 'id,name,parents',
            supportsAllDrives: true
        });

        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Submissions');
        if (!sheet) return { statusCode: 404, body: JSON.stringify({ error: 'Submissions sheet not found' }) };

        const startIndex = rowIndex + 1;
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'ROWS',
                            startIndex,
                            endIndex: startIndex + 1
                        }
                    }
                }]
            }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true, fileName: finalName }) };
    } catch (error) {
        console.error('Error approving submission:', error);
        return { statusCode: 500, body: JSON.stringify({ error: googleErrorMessage(error, 'Failed to approve submission') }) };
    }
};
