const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { id } = JSON.parse(event.body);
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Suggestions Ledger');
        if (!sheet) return { statusCode: 404, body: JSON.stringify({ error: 'Sheet not found' }) };
        const sheetId = sheet.properties.sheetId;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Suggestions Ledger!A2:A',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);
        if (rowIndex === -1) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

        // rowIndex is 0-based from data rows; actual sheet row = rowIndex + 2 (1-based with header)
        // deleteDimension startIndex is 0-based: header = 0, first data row = 1
        const startIndex = rowIndex + 1;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex,
                            endIndex: startIndex + 1
                        }
                    }
                }]
            }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error deleting suggestion:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to delete suggestion' }) };
    }
};
