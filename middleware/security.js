const rateLimit = require('express-rate-limit');

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'このIPアドレスから作成されたアカウントが多すぎます。1時間後にもう一度お試しください。' },
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'このIPアドレスからのログイン試行が多すぎます。15分後にもう一度お試しください。' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { registerLimiter, loginLimiter };