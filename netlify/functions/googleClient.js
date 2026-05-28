require('dotenv').config();
const { google } = require('googleapis');

const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
];

function getAuthClient() {
    const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
    const oauthRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;

    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
        throw new Error('Missing OAuth credentials. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.');
    }

    const oauth2Client = new google.auth.OAuth2(
        oauthClientId,
        oauthClientSecret,
        oauthRedirectUri || undefined
    );
    oauth2Client.setCredentials({
        refresh_token: oauthRefreshToken,
        scope: GOOGLE_SCOPES.join(' ')
    });
    return oauth2Client;
}

module.exports = { getAuthClient };
