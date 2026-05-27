const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'House Points System!A2:C', 
        });

        const rows = response.data.values || [];
        
        const housePoints = rows.map(row => ({
            House_Name: row[0] || '',
            Current_Score: parseInt(row[1]) || 0,
            Last_Updated: row[2] || ''
        }));

        // Sort by score descending
        housePoints.sort((a, b) => b.Current_Score - a.Current_Score);

        return {
            statusCode: 200,
            body: JSON.stringify(housePoints)
        };
    } catch (error) {
        console.error('Error fetching house points:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch house points' })
        };
    }
};
