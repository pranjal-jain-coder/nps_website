const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { password } = JSON.parse(event.body);
        const correctPassword = process.env.ADMIN_PASSWORD;

        if (!correctPassword) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration: No ADMIN_PASSWORD set.' }) };
        }

        if (password === correctPassword) {
            // Create a token valid for 24 hours
            const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '24h' });
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
