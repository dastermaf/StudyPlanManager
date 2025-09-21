const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'login.html'));
});

router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'index.html'));
});

router.get('/materials/:subjectId/:chapterNo', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'materials.html'));
});

// Новый маршрут для дашборда
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'dashboard.html'));
});

router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'about.html'));
});

module.exports = router;