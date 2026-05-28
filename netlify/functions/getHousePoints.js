const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');

exports.handler = async (event, context) => {
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'House Points System!A2:F',
        });

        const rows = response.data.values || [];
        const houses = ['Challengers', 'Explorers', 'Pioneers', 'Voyagers'];
        const emptyPoints = () => Object.fromEntries(houses.map(house => [house, 0]));

        const history = rows.map(row => {
            const oldFormatHouse = row[1] || '';
            const isOldFormat = houses.includes(oldFormatHouse);
            const PointsByHouse = emptyPoints();

            if (isOldFormat) {
                PointsByHouse[oldFormatHouse] = Number.parseInt(row[2], 10) || 0;
                return {
                    Date: row[0] || '',
                    House: oldFormatHouse,
                    Points: PointsByHouse[oldFormatHouse],
                    Reason: row[3] || '',
                    PointsByHouse
                };
            }

            houses.forEach((house, index) => {
                PointsByHouse[house] = Number.parseInt(row[index + 2], 10) || 0;
            });

            return {
                Date: row[0] || '',
                House: '',
                Points: 0,
                Reason: row[1] || '',
                PointsByHouse
            };
        });

        // Aggregate scores
        const scores = {
            'Challengers': 0,
            'Explorers': 0,
            'Pioneers': 0,
            'Voyagers': 0
        };

        history.forEach(item => {
            houses.forEach(house => {
                scores[house] += item.PointsByHouse[house] || 0;
            });
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
