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

// --- 修正済みのコンテンツセキュリティポリシー(CSP) ---
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            // デフォルトのソースを自己オリジンに設定
            defaultSrc: ["'self'"],
            // スクリプトのソースを自己オリジンと許可されたCDNに設定
            scriptSrc: [
                "'self'",
                "https://cdn.jsdelivr.net"
            ],
            // スタイルのソースを自己オリジン、Google Fonts、インラインスタイルに設定
            styleSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                "'unsafe-inline'" // Tailwind CSS との互換性のために必要
            ],
            // フォントのソースをGoogle Fontsに設定
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            // API接続先を自己オリジンとGoogle Apps Scriptに設定
            connectSrc: [
                "'self'",
                "https://script.google.com",
                "https://script.googleusercontent.com"
            ],
            // 画像ソースを自己オリジン、データURI、任意のHTTPSソースに設定
            imgSrc: [
                "'self'",
                "data:",
                "https:"
            ],
            // フレームのソースを自己オリジンに設定
            frameSrc: ["'self'"],
            // object-srcを無効化
            objectSrc: ["'none'"],
        },
    })
);

app.use(cors());
// JSONボディのサイズ制限を2MBに設定
app.use(express.json({ limit: '2mb' }));
// 静적ファイルを提供
app.use(express.static(path.join(__dirname, 'public')));

// ルートを設定
app.use('/', pageRoutes);
app.use('/api', apiRoutes);

console.log("LOG: server.js: Middleware и маршруты настроены.");

// サーバーを起動
app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました。`);
    // データベースを初期化
    initializeDatabase().catch(err => {
        console.error("Не удалось инициализировать базу данных:", err);
        process.exit(1);
    });
});