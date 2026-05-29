const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        // Still run the comparison to avoid length-based timing leak
        crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { password } = JSON.parse(event.body);
        const correctPassword = process.env.ADMIN_PASSWORD;
        const jwtSecret = process.env.JWT_SECRET;

        if (!correctPassword) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration: No ADMIN_PASSWORD set.' }) };
        }
        if (!jwtSecret) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration: No JWT_SECRET set.' }) };
        }

        if (timingSafeEqual(password, correctPassword)) {
            const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '24h' });
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, token })
            };
        } else {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid password' }) };
        }
    } catch (error) {
        console.error('Error during auth:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
