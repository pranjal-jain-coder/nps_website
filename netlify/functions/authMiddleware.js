const jwt = require('jsonwebtoken');

function verifyAdmin(event) {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return false;
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, jwtSecret);
        return decoded.role === 'admin';
    } catch (error) {
        return false;
    }
}

module.exports = { verifyAdmin };
