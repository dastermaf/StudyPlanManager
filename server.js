const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
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

// --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
// HelmetのデフォルトCSPを無効にし、railway.tomlのCSP設定のみが使われるようにします。
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
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