const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { id, date, name, type } = JSON.parse(event.body);
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        // ID is in column A
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Calendar Deadlines!A2:A',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);
        if (rowIndex === -1) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

        const sheetRow = rowIndex + 2;

        // Update Date(B), Name(C), Type(D)
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Calendar Deadlines!B${sheetRow}:D${sheetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[date, name, type]] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error editing calendar event:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to edit event' }) };
    }
};
