const express = require('express');
const path = require('path');
const router = express.Router();

// Маршрут для страницы входа
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'login.html'));
});

// Маршрут для главной страницы приложения
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'index.html'));
});

// Новый маршрут для страницы материалов
router.get('/materials/:subjectId/:chapterNo', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'materials.html'));
});

// Маршрут для страницы "О сайте"
router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'about.html'));
});

module.exports = router;