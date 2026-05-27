const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Suggestions Ledger!A2:E', // Do not fetch column F (Admin_Notes)
        });

        const rows = response.data.values || [];
        
        // Map rows to objects
        const suggestions = rows.map(row => ({
            ID: row[0] || '',
            Timestamp: row[1] || '',
            Category: row[2] || '',
            Description: row[3] || '',
            Status: row[4] || 'Submitted' // default to submitted if blank
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
