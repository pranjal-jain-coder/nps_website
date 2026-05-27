const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const { verifyAdmin } = require('./authMiddleware');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!verifyAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    try {
        const { id, title, content, type, eventIds, attachmentUrl } = JSON.parse(event.body);
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Announcements Board!G2:G',
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === id);
        if (rowIndex === -1) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

        const sheetRow = rowIndex + 2;
        const eventIdsStr = Array.isArray(eventIds) ? eventIds.join(',') : (eventIds || '');

        // Update Type(B), Title(C), Content(D), Attachment_URL(E), Event_IDs(F)
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Announcements Board!B${sheetRow}:F${sheetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[type || 'General', title, content, attachmentUrl || '', eventIdsStr]] }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error('Error editing announcement:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to edit announcement' }) };
    }
};
