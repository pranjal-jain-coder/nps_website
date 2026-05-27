require('dotenv').config();
const { google } = require('googleapis');

function getAuthClient() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !key) {
        throw new Error('Missing Google Service Account credentials');
    }

    // Replace escaped newlines if they exist
    const formattedKey = key.replace(/\\n/g, '\n');

    return new google.auth.JWT(
        email,
        null,
        formattedKey,
        ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    );
}

module.exports = { getAuthClient };
