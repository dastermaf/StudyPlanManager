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
// リバースプロксиの背後で動作させるための設定
app.set('trust proxy', 1);

// --- セキュリティと互換性を両立させる最終的なCSP設定 ---
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            // デフォルトでは、自分自身のドメインからのリソースのみを許可
            defaultSrc: ["'self'"],
            // スクリプトは自分自身のドメインと信頼できるCDNから許可
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            // スタイルシートは自分自身のドメイン、Google Fonts、インラインスタイルを許可
            styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
            // 画像は自分自身のドメイン、データURI、任意のHTTPSソースから許可
            imgSrc: ["'self'", "data:", "https:"],
            // 接続先は自分自身のドメインとGoogle Apps Scriptを許可
            connectSrc: ["'self'", "https://script.google.com", "https://script.googleusercontent.com"],
            // フォントは自分自身のドメインとGoogle Fontsから許可
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
        },
    })
);


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