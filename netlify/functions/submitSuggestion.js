const { google } = require('googleapis');
const { getAuthClient } = require('./googleClient');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { category, title, description } = JSON.parse(event.body);

        if (!category || !title || !description) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
        }

        const sanitizedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const sanitizedDescription = description.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const status = 'Submitted';

        // Schema: ID(A), Timestamp(B), Category(C), Title(D), Description(E), Status(F)
        const row = [id, timestamp, category, sanitizedTitle, sanitizedDescription, status];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Suggestions Ledger!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row]
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, id })
        };
    } catch (error) {
        console.error('Error submitting suggestion:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to submit suggestion' })
        };
    }
};
