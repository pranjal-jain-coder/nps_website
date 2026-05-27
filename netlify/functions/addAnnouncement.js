const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { title, content, priority, eventId, url } = JSON.parse(event.body);

        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const row = [date, priority, title, content, url || '', eventId || ''];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Announcements Board!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error adding announcement:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to add announcement' }) };
    }
};
