const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            // Schema: ID(A), Timestamp(B), Category(C), Title(D), Description(E), Status(F)
            range: 'Suggestions Ledger!A2:F',
        });

        const rows = response.data.values || [];

        const suggestions = rows.map(row => ({
            ID: row[0] || '',
            Timestamp: row[1] || '',
            Category: row[2] || '',
            Title: row[3] || '(No title)',
            Description: row[4] || row[3] || '', // fallback: old rows had description at index 3
            Status: row[5] || row[4] || 'Submitted' // fallback for old rows
        }));

        // Sort by Timestamp descending
        suggestions.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

        return {
            statusCode: 200,
            body: JSON.stringify(suggestions)
        };
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch suggestions' })
        };
    }
};
