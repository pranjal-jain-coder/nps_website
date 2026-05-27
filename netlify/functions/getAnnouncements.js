const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Announcements Board!A2:E', // Assuming headers are in row 1
        });

        const rows = response.data.values || [];
        
        // Map rows to objects
        const announcements = rows.map(row => ({
            Date: row[0] || '',
            Priority: row[1] || '',
            Title: row[2] || '',
            Content: row[3] || '',
            Attachment_URL: row[4] || ''
        }));

        // Sort by Date descending (most recent first)
        announcements.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        return {
            statusCode: 200,
            body: JSON.stringify(announcements)
        };
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch announcements' })
        };
    }
};
