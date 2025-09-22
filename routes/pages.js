const express = require('express');
const path = require('path');
const { ensureDbForPages } = require('../middleware/dbHealth');
const router = express.Router();

// Apply DB health guard for all pages except the error page itself
router.use((req, res, next) => {
    if (req.path && req.path.startsWith('/error')) return next();
    return ensureDbForPages(req, res, next);
});

// Главный маршрут "/" теперь всегда отдает login.html
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'login.html'));
});

// Главная страница приложения
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'index.html'));
});

// Страница материалов
router.get('/materials/:subjectId/:chapterNo', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'materials.html'));
});

// Страница дашборда
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'dashboard.html'));
});

// Страница "О сайте"
router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'about.html'));
});

// Страница ошибок
router.get('/error', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'error.html'));
});

module.exports = router;