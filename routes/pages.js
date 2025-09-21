const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'login.html'));
});

router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'layout', 'index.html'));
});

module.exports = router;