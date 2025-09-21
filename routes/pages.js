const express = require('express');
const path = require('path');
const router = express.Router();

// Маршрут для страницы входа
router.get('/', (req, res) => {
    // __dirname - это текущая папка (routes), '..' - подняться на уровень выше
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'login.html'));
});

// Маршрут для главной страницы приложения
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'index.html'));
});

// ИСПРАВЛЕНИЕ: Новый маршрут для страницы "О сайте"
router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'about.html'));
});

module.exports = router;