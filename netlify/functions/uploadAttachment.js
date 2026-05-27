const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');
const { Readable } = require('stream');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { fileName, mimeType, base64 } = JSON.parse(event.body);

        if (!base64) return { statusCode: 400, body: JSON.stringify({ error: 'No file data' }) };

        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length > 20 * 1024 * 1024) {
            return { statusCode: 413, body: JSON.stringify({ error: 'File exceeds 20MB limit' }) };
        }

        const auth = getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const folderId = process.env.ATTACHMENTS_DRIVE_FOLDER_ID;

        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        const driveResponse = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: folderId ? [folderId] : []
            },
            media: { mimeType: mimeType || 'application/octet-stream', body: stream },
            fields: 'id'
        });

        const fileId = driveResponse.data.id;

        // Make file publicly viewable
        await drive.permissions.create({
            fileId,
            requestBody: { role: 'reader', type: 'anyone' }
        });

        const url = `https://drive.google.com/file/d/${fileId}/view`;
        return { statusCode: 200, body: JSON.stringify({ success: true, fileId, url }) };
    } catch (error) {
        console.error('Error uploading attachment:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to upload attachment' }) };
    }
};
