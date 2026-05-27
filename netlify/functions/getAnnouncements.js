const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        // Schema: Date(A), Type(B), Title(C), Content(D), Attachment_URL(E), Event_IDs(F), ID(G)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Announcements Board!A2:G',
        });

        const rows = response.data.values || [];

        const announcements = rows.map(row => ({
            Date: row[0] || '',
            Type: row[1] || 'General',
            Title: row[2] || '',
            Content: row[3] || '',
            Attachment_URL: row[4] || '',
            Event_IDs: row[5] ? row[5].split(',').map(s => s.trim()).filter(Boolean) : [],
            ID: row[6] || ''
        }));

        announcements.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        return { statusCode: 200, body: JSON.stringify(announcements) };
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch announcements' }) };
    }
};
