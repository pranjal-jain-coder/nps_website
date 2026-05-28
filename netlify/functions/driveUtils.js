const { Readable } = require('stream');

const MAX_UPLOAD_BYTES = Math.floor(4.5 * 1024 * 1024);

function normalizeDriveFolderId(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];

    const idMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];

    return raw.split('?')[0].trim();
}

function sanitizeFilePart(value, fallback = 'file') {
    const sanitized = String(value || '')
        .trim()
        .replace(/\.[^.\\/]+$/, '')
        .replace(/[\\/<>:"|?*#%{}^~[\]`]/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return sanitized || fallback;
}

function sanitizeDriveFileName(value, fallback = 'file') {
    const sanitized = String(value || '')
        .trim()
        .replace(/[\\/<>:"|?*#%{}^~[\]`]/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return sanitized || fallback;
}

function buildPaperFileName({ year, grade, subject, type, suffix }) {
    return [
        sanitizeFilePart(year, 'Year'),
        `Grade${sanitizeFilePart(grade, 'Grade')}`,
        sanitizeFilePart(subject, 'Subject'),
        sanitizeFilePart(type, 'Type'),
        sanitizeFilePart(suffix, 'Paper')
    ].join('_') + '.pdf';
}

function bufferToStream(buffer) {
    return Readable.from(buffer);
}

function googleErrorMessage(error, fallback) {
    const message = error?.response?.data?.error?.message
        || error?.errors?.[0]?.message
        || error?.message
        || fallback;

    if (/invalid_grant|invalid_client|unauthorized_client/i.test(message)) {
        return `Google OAuth rejected the saved credentials: ${message}. Regenerate the refresh token with Drive and Sheets scopes, then update the Netlify OAuth env vars.`;
    }

    return message;
}

module.exports = {
    MAX_UPLOAD_BYTES,
    normalizeDriveFolderId,
    sanitizeFilePart,
    sanitizeDriveFileName,
    buildPaperFileName,
    bufferToStream,
    googleErrorMessage
};
