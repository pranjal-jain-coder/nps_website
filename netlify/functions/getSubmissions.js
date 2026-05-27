const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Submissions!A2:F', 
        });

        const rows = response.data.values || [];
        
        const submissions = rows.map(row => ({
            FileID: row[0] || '',
            Date: row[1] || '',
            Subject: row[2] || '',
            Year: row[3] || '',
            Grade: row[4] || '',
            Type: row[5] || ''
        }));

        submissions.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Newest first

        return { statusCode: 200, body: JSON.stringify(submissions) };
    } catch (error) {
        console.error('Error fetching submissions:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch submissions' }) };
    }
};
