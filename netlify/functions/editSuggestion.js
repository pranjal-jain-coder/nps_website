const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { id, category, title, description } = JSON.parse(event.body);
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

        const sheetRow = rowIndex + 2;
        const sanitizedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const sanitizedDescription = description.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Update Category(C), Title(D), Description(E)
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Suggestions Ledger!C${sheetRow}:E${sheetRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[category, sanitizedTitle, sanitizedDescription]] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error editing suggestion:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to edit suggestion' }) };
    }
};
