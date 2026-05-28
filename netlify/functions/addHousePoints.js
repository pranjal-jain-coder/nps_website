const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { house, points, reason, pointsByHouse } = JSON.parse(event.body);

        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const houses = ['Challengers', 'Explorers', 'Pioneers', 'Voyagers'];
        const housePoints = pointsByHouse && typeof pointsByHouse === 'object'
            ? pointsByHouse
            : { [house]: points };

        const date = new Date().toISOString();
        const row = [
            date,
            reason,
            ...houses.map(h => Number.parseInt(housePoints[h], 10) || 0)
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'House Points System!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error adding house points:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to add points' }) };
    }
};
