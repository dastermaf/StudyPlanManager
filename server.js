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

// --- ОКОНЧАТЕЛЬНО ИСПРАВЛЕННАЯ ПОЛИТИКА CSP С ИСПОЛЬЗОВАНИЕМ ХЭШЕЙ ---
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                // Хэш для инлайн-скрипта, взятый из вашей ошибки
                "'sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM='"
            ],
            styleSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                // Хэш для инлайн-стиля, взятый из вашей ошибки
                "'sha256-+OsIn6RhyCZCUkkvtHxFtP0kU3CGdGeLjDd9Fzqdl3o='",
                // Дополнительно разрешаем 'unsafe-inline' для стилей, так как Tailwind может его требовать
                "'unsafe-inline'"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            connectSrc: [
                "'self'",
                "https://script.google.com",
                "https://script.googleusercontent.com"
            ],
            // Явно разрешаем загрузку иконок (favicon) и других изображений
            imgSrc: [
                "'self'",
                "data:",
                "https:" // Разрешает загрузку с любого HTTPS источника
            ],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
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