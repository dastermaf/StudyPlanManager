const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { initializeDatabase } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

// JWT_SECRETの安全性を確認
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-default-jwt-secret-key-for-planner') {
    console.error('FATAL ERROR: JWT_SECRET не установлен или используется небезопасное значение по умолчанию.');
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

console.log("LOG: server.js: Запуск сервера...");
// リバースプロキシの背後で動作させるための設定
app.set('trust proxy', 1);

// helmetのCSP機能のみを無効化
app.use(
    helmet({
        contentSecurityPolicy: false,
    })
);

// カスタムCSPミドルウェアで問題を最終解決
app.use((req, res, next) => {
    const scriptSrcHash = "'sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM='";
    const styleSrcHash = "'sha256-+OsIn6RhyCZCUkkvtHxFtP0kU3CGdGeLjDd9Fzqdl3o='";

    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        `script-src 'self' https://cdn.jsdelivr.net ${scriptSrcHash}; ` + // エラーログのハッシュを追加
        `style-src 'self' https://fonts.googleapis.com 'unsafe-inline' ${styleSrcHash}; ` + // エラーログのハッシュを追加
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://script.google.com https://script.googleusercontent.com; " +
        "font-src 'self' https://fonts.gstatic.com;"
    );
    next();
});


app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', pageRoutes);
app.use('/api', apiRoutes);

console.log("LOG: server.js: Middleware и маршруты настроены.");

app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました。`);
    initializeDatabase().catch(err => {
        console.error("Не удалось инициализировать базу данных:", err);
        process.exit(1);
    });
});