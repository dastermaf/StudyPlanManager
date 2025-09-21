const express = require('express');
const path = require('path');
const cors = require('cors');
const { initializeDatabase } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

const app = express();
const port = process.env.PORT || 3000;

console.log("LOG: server.js: Запуск сервера...");

// Настройка для корректной работы за прокси (например, на Railway)
app.set('trust proxy', 1);

// Основные middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Middleware для удаления заголовка CSP
app.use((req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
});

// Раздача статических файлов из папки 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Подключение маршрутов
app.use('/', pageRoutes);
app.use('/api', apiRoutes);

console.log("LOG: server.js: Middleware и маршруты настроены.");

// Запуск сервера и инициализация БД
app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました。`);
    initializeDatabase();
});