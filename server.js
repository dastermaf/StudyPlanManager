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

// Проверка безопасности MASTER_ENCRYPTION_KEY
if (!process.env.MASTER_ENCRYPTION_KEY || process.env.MASTER_ENCRYPTION_KEY.length < 32) {
    logger.error('КРИТИЧЕСКАЯ ОШИБКА: MASTER_ENCRYPTION_KEY не установлен или имеет недостаточную длину (требуется >= 32 символов).', { src: 'server.js' });
    process.exit(1);
}


const app = express();
const port = process.env.PORT || 3000;

logger.info('Запуск сервера...', { src: 'server.js' });
app.set('trust proxy', 1);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://cdn.jsdelivr.net"],
                "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
                "img-src": ["'self'", "data:", "https:"],
                "connect-src": ["'self'", "https://script.google.com", "https://script.googleusercontent.com"],
                "font-src": ["'self'", "https://fonts.gstatic.com"],
            },
        },
    })
);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.get('/favicon.ico', (req, res) => res.redirect('/image/favicon.png'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', pageRoutes);
app.use('/api', apiRoutes);

logger.info('Middleware и маршруты настроены.', { src: 'server.js' });

app.listen(port, '0.0.0.0', () => {
    // ИЗМЕНЕНИЕ: Лог теперь показывает правильный хост для контейнера
    logger.info(`Сервер запущен и слушает на 0.0.0.0:${port}`, { src: 'server.js' });
    initializeDatabase().catch(err => {
        logger.error('Не удалось инициализировать базу данных', { src: 'server.js', err: String(err && err.message || err) });
        try { markDbDown(err); } catch {}
    });
});
