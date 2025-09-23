const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { initializeDatabase, markDbDown } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');
const logger = require('./logger');

// Проверка безопасности JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-default-jwt-secret-key-for-planner') {
    logger.error('КРИТИЧЕСКАЯ ОШИБКА: JWT_SECRET не установлен или используется небезопасное значение по умолчанию.', { src: 'server.js' });
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

logger.info('Запуск сервера...', { src: 'server.js' });
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.get('/favicon.ico', (req, res) => res.redirect('/image/favicon.png'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', pageRoutes);
app.use('/api', apiRoutes);

logger.info('Middleware и маршруты настроены.', { src: 'server.js' });

app.listen(port, () => {
    logger.info(`Сервер запущен на http://localhost:${port}`, { src: 'server.js' });
    initializeDatabase().catch(err => {
        logger.error('Не удалось инициализировать базу данных', { src: 'server.js', err: String(err && err.message || err) });
        // Не завершаем процесс: включаем graceful degradation через страницу ошибок
        try { markDbDown(err); } catch {}
    });
});