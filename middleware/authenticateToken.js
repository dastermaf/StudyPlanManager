const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';

const authenticateToken = (req, res, next) => {
    const token = req.cookies.accessToken;

    if (token == null) {
        console.log("LOG: authenticateToken: トークンが見つかりません。ログインページにリダイレクトします。");
        return res.redirect('/');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log("LOG: authenticateToken: トークンの検証エラー。アクセスを禁止します(403)。", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        console.log("LOG: authenticateToken: トークンがユーザー '" + user.username + "' のために検証されました。");
        next();
    });
};

module.exports = authenticateToken;