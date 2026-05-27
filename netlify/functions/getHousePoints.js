const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'House Points System!A2:D', 
        });

        const rows = response.data.values || [];
        
        // Ledger format: Date, House, Points Changed, Reason
        const history = rows.map(row => ({
            Date: row[0] || '',
            House: row[1] || '',
            Points: parseInt(row[2]) || 0,
            Reason: row[3] || ''
        }));

        // Aggregate scores
        const scores = {
            'Challengers': 0,
            'Explorers': 0,
            'Pioneers': 0,
            'Voyagers': 0
        };

        history.forEach(item => {
            if (scores[item.House] !== undefined) {
                scores[item.House] += item.Points;
            }
        });

        // Format for frontend
        const leaderboard = Object.keys(scores).map(house => ({
            House_Name: house,
            Current_Score: scores[house],
            Last_Updated: history.length > 0 ? history[history.length - 1].Date : new Date().toISOString()
        }));

        // Sort descending
        leaderboard.sort((a, b) => b.Current_Score - a.Current_Score);

        return {
            statusCode: 200,
            body: JSON.stringify({ leaderboard, history: history.reverse() }) // newest history first
        };
    } catch (error) {
        console.error('Error fetching house points:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch house points' })
        };
    }
};
