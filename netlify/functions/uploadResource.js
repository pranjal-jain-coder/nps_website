const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { Readable } = require('stream');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { fileName, mimeType, base64, subject, year, grade, type } = JSON.parse(event.body);

        if (!base64 || mimeType !== 'application/pdf') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid file type. Must be PDF.' }) };
        }

        // Validate size (20MB limit)
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length > 20 * 1024 * 1024) {
            return { statusCode: 413, body: JSON.stringify({ error: 'File size exceeds 20MB limit.' }) };
        }

        const auth = getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });
        const folderId = process.env.PENDING_DRIVE_FOLDER_ID;
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        // Convert buffer to stream for upload
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // Upload to Drive
        const driveResponse = await drive.files.create({
            requestBody: {
                name: `${year}_Grade${grade}_${subject}_${type}_${fileName}`,
                parents: [folderId]
            },
            media: {
                mimeType,
                body: stream
            },
            fields: 'id'
        });

        const fileId = driveResponse.data.id;

        // Log to spreadsheet (assuming a 'Submissions' tab exists)
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Submissions!A:F', // ID, Timestamp, Subject, Year, Grade, Type
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[fileId, new Date().toISOString(), subject, year, grade, type]]
                }
            });
        } catch (sheetError) {
            console.error('Warning: Failed to log submission to sheets, but file uploaded:', sheetError);
            // Non-fatal error if sheet doesn't exist
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, fileId })
        };
    } catch (error) {
        console.error('Error uploading resource:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to upload resource' })
        };
    }
};
