const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { title, content, type, eventIds, attachmentUrl } = JSON.parse(event.body);

        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const date = new Date().toISOString().split('T')[0];
        const eventIdsStr = Array.isArray(eventIds) ? eventIds.join(',') : (eventIds || '');
        const id = crypto.randomUUID();

        // Schema: Date(A), Type(B), Title(C), Content(D), Attachment_URL(E), Event_IDs(F), ID(G)
        const row = [date, type || 'General', title, content, attachmentUrl || '', eventIdsStr, id];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Announcements Board!A:G',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error adding announcement:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to add announcement' }) };
    }
};
