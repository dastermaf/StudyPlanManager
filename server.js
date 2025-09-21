const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser'); // 追加
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
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// カスタムCSPミドルウェア
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://script.google.com https://script.googleusercontent.com; font-src 'self' https://fonts.gstatic.com;"
    );
    next();
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true })); // フォームデータの解析用
app.use(cookieParser()); // 追加
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