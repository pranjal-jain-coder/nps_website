const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');
const {
    MAX_UPLOAD_BYTES,
    normalizeDriveFolderId,
    sanitizeDriveFileName,
    bufferToStream,
    googleErrorMessage
} = require('./driveUtils');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { fileName, mimeType, base64 } = JSON.parse(event.body);

        if (!base64) return { statusCode: 400, body: JSON.stringify({ error: 'No file data' }) };

        const buffer = Buffer.from(base64, 'base64');
        if (buffer.length > MAX_UPLOAD_BYTES) {
            return { statusCode: 413, body: JSON.stringify({ error: 'File exceeds 4.5MB limit' }) };
        }

        const auth = getAuthClient();
        const drive = google.drive({ version: 'v3', auth });
        const folderId = normalizeDriveFolderId(process.env.ATTACHMENTS_DRIVE_FOLDER_ID);

        const driveResponse = await drive.files.create({
            requestBody: {
                name: sanitizeDriveFileName(fileName, 'Attachment'),
                parents: folderId ? [folderId] : []
            },
            media: { mimeType: mimeType || 'application/octet-stream', body: bufferToStream(buffer) },
            fields: 'id',
            supportsAllDrives: true
        });

        const fileId = driveResponse.data.id;

        // Make file publicly viewable
        await drive.permissions.create({
            fileId,
            requestBody: { role: 'reader', type: 'anyone' },
            supportsAllDrives: true
        });

        const url = `https://drive.google.com/file/d/${fileId}/view`;
        return { statusCode: 200, body: JSON.stringify({ success: true, fileId, url }) };
    } catch (error) {
        console.error('Error uploading attachment:', error);
        return { statusCode: 500, body: JSON.stringify({ error: googleErrorMessage(error, 'Failed to upload attachment') }) };
    }
};
