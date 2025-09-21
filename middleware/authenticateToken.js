const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.log("LOG: authenticateToken: Токен не найден, доступ запрещен (401).");
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log("LOG: authenticateToken: Ошибка верификации токена, доступ запрещен (403).", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        console.log("LOG: authenticateToken: Токен верифицирован для пользователя:", user.username);
        next();
    });
};

module.exports = authenticateToken;