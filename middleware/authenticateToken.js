const jwt = require('jsonwebtoken');
const logger =require('../logger');
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
            logger.warn('authenticateToken: проверка токена не удалась', { src: 'authenticateToken', ip: req.ip, error: err.message });
            return res.sendStatus(403);
        }
        req.user = user;
        // --- ТОЧКА ДЕБАГА: Логирование полезной нагрузки из токена ---
        // Проверяем, что ключ шифрования (user.key) успешно извлечен из токена.
        const userPayloadForLog = { ...user };
        if (userPayloadForLog.key) {
            userPayloadForLog.key = `(присутствует, длина: ${userPayloadForLog.key.length})`;
        }
        logger.info(`[DEBUG] authenticateToken: токен успешно верифицирован. Payload: ${JSON.stringify(userPayloadForLog)}`, { src: 'authenticateToken' });

        next();
    });
};

module.exports = authenticateToken;
