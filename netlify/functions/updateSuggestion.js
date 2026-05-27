const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { id, status } = JSON.parse(event.body);
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Suggestions Ledger!A2:A',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);
        if (rowIndex === -1) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

        const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-based index

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Suggestions Ledger!F${sheetRow}`, // Status is column F in new schema
            valueInputOption: 'RAW',
            requestBody: { values: [[status]] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error updating suggestion:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to update suggestion' }) };
    }
};
