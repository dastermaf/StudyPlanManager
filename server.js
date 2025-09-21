const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet'); // Импортируем helmet
const { initializeDatabase } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

// --- КРИТИЧЕСКАЯ ПРОВЕРКА БЕЗОПАСНОСТИ ---
const DEFAULT_JWT_SECRET = 'your-default-jwt-secret-key-for-planner';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET не установлен или используется небезопасное значение по умолчанию.');
    console.error('Пожалуйста, установите надежную секретную строку в переменной окружения JWT_SECRET.');
    process.exit(1); // Аварийный выход из приложения
}

const app = express();
const port = process.env.PORT || 3000;

console.log("LOG: server.js: Запуск сервера...");

app.set('trust proxy', 1);

// --- НАСТРОЙКА ЗАГОЛОВКОВ БЕЗОПАСНОСТИ ---
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"], // По умолчанию разрешаем загрузку только со своего домена
            scriptSrc: ["'self'"], // Скрипты только со своего домена
            styleSrc: ["'self'", "fonts.googleapis.com"], // Стили со своего домена и Google Fonts
            fontSrc: ["fonts.gstatic.com"], // Шрифты с домена Google
            connectSrc: ["'self'", "script.google.com", "https://script.googleusercontent.com"], // Разрешаем API-запросы на свой домен и Google Scripts
            imgSrc: ["'self'", "data:", "lh3.googleusercontent.com"], // Картинки со своего домена, встроенные (data:) и из Google
            frameSrc: ["'self'"],
        },
    })
);


// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
    console.log(`INCOMING: ${req.method} ${req.originalUrl}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Маршруты
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