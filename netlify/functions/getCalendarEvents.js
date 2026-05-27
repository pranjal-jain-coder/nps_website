const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Calendar Deadlines!A2:D', 
        });

        const rows = response.data.values || [];
        
        const events = rows.map(row => ({
            ID: row[0] || '',
            Date: row[1] || '',
            Name: row[2] || '',
            Type: row[3] || 'Academic'
        }));

        // Sort by date ascending
        events.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        return { statusCode: 200, body: JSON.stringify(events) };
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch calendar' }) };
    }
};
