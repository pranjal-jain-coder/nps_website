const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { date, name, type } = JSON.parse(event.body);

        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const id = crypto.randomUUID();
        const row = [id, date, name, type];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Calendar Deadlines!A:D',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true, id }) };
    } catch (error) {
        console.error('Error adding event:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to add event' }) };
    }
};
