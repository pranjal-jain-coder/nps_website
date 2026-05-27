const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { id } = JSON.parse(event.body);
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const linkedAnnouncementsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Announcements Board!C2:G',
        });
        const linkedAnnouncements = (linkedAnnouncementsResponse.data.values || [])
            .map(row => ({
                title: row[0] || 'Untitled announcement',
                eventIds: row[3] ? row[3].split(',').map(value => value.trim()).filter(Boolean) : [],
                id: row[4] || ''
            }))
            .filter(announcement => announcement.eventIds.includes(id));

        if (linkedAnnouncements.length > 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: 'This calendar event is still linked to announcements.',
                    linkedAnnouncements: linkedAnnouncements.map(({ title, id }) => ({ title, id }))
                })
            };
        }

        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Calendar Deadlines');
        if (!sheet) return { statusCode: 404, body: JSON.stringify({ error: 'Sheet not found' }) };
        const sheetId = sheet.properties.sheetId;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Calendar Deadlines!A2:A',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);
        if (rowIndex === -1) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

        const startIndex = rowIndex + 1;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 }
                    }
                }]
            }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to delete event' }) };
    }
};
