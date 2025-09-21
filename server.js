const express = require('express');
const path = require('path');
const cors = require('cors');
const { initializeDatabase } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

const app = express();
const port = process.env.PORT || 3000;

console.log("LOG: server.js: Запуск сервера...");

app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
});

// --- НОВЫЙ ЛОГГЕР ЗАПРОСОВ ---
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
    initializeDatabase();
});