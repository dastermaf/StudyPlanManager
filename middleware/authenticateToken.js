const jwt = require('jsonwebtoken');
const logger = require('../logger');
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';

const authenticateToken = (req, res, next) => {
    const token = req.cookies.accessToken;

    if (token == null) {
        // For API routes return 401 so client can redirect; avoid noisy logs
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Do not spam logs; only warn with minimal context
            logger.debug('authenticateToken: token verification failed', { src: 'authenticateToken', ip: req.ip });
            return res.sendStatus(403);
        }
        req.user = user;
        // Reduce noise: debug level only
        logger.debug(`authenticateToken: verified for user ${user.username}`, { src: 'authenticateToken' });
        next();
    });
};

module.exports = authenticateToken;