const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authenticateToken = require('../middleware/authenticateToken');
const { registerLimiter, loginLimiter } = require('../middleware/security');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';

// Register
router.post('/register', registerLimiter, async (req, res) => {
    const { username, password, deviceId } = req.body;
    console.log(`LOG: /api/register: Получен запрос на регистрацию для пользователя '${username}'.`);
    try {
        if (!username || !password || !deviceId) {
            console.log("LOG: /api/register: Ошибка - не все поля заполнены.");
            return res.status(400).json({ error: 'ユーザー名、パスワード、デバイスIDは必須です。' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const deviceCheck = await client.query('SELECT * FROM device_registrations WHERE device_id = $1', [deviceId]);
            if (deviceCheck.rowCount > 0) {
                await client.query('ROLLBACK');
                console.log(`LOG: /api/register: Регистрация отклонена - deviceId '${deviceId}' уже существует.`);
                return res.status(403).json({ error: 'このデバイスからはすでにアカウントが登録されています。' });
            }

            const newUserRes = await client.query("INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username", [username, hashedPassword]);
            const newUser = newUserRes.rows[0];

            await client.query('INSERT INTO device_registrations (device_id, user_id) VALUES ($1, $2)', [deviceId, newUser.id]);
            const emptyProgress = { settings: { theme: 'light' }, lectures: {} };
            await client.query("INSERT INTO progress (user_id, data) VALUES ($1, $2)", [newUser.id, emptyProgress]);

            await client.query('COMMIT');
            console.log(`LOG: /api/register: Пользователь '${username}' успешно зарегистрирован.`);
            res.status(201).json(newUser);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`LOG: /api/register: КРИТИЧЕСКАЯ ОШИБКА для пользователя '${username}':`, error);
        if (error.code === '23505') return res.status(409).json({ error: 'このユーザー名はすでに存在します。' });
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    console.log(`LOG: /api/login: Получен запрос на вход для пользователя '${username}'.`);
    try {
        const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (rows.length === 0) {
            console.log(`LOG: /api/login: Пользователь '${username}' не найден.`);
            return res.status(400).json({ error: 'ユーザーが見つかりません。' });
        }

        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            console.log(`LOG: /api/login: Пользователь '${username}' успешно вошел в систему.`);
            res.json({ accessToken: accessToken });
        } else {
            console.log(`LOG: /api/login: Неверный пароль для пользователя '${username}'.`);
            res.status(401).json({ error: 'パスワードが正しくありません。' });
        }
    } catch (error) {
        console.error(`LOG: /api/login: КРИТИЧЕСКАЯ ОШИБКА для пользователя '${username}':`, error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

// Progress GET
router.get('/progress', authenticateToken, async (req, res) => {
    console.log(`LOG: /api/progress (GET): Запрос на получение прогресса от пользователя '${req.user.username}'.`);
    try {
        const result = await pool.query('SELECT data FROM progress WHERE user_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].data);
        } else {
            res.json({ settings: { theme: 'light' }, lectures: {} });
        }
    } catch (error) {
        console.error(`LOG: /api/progress (GET): КРИТИЧЕСКАЯ ОШИБКА для '${req.user.username}':`, error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

// Progress POST
router.post('/progress', authenticateToken, async (req, res) => {
    console.log(`LOG: /api/progress (POST): Запрос на сохранение прогресса от '${req.user.username}'.`);
    try {
        const progressData = req.body;
        if (!progressData) {
            console.log("LOG: /api/progress (POST): Ошибка - отсутствуют данные для сохранения.");
            return res.status(400).json({error: "Сохраняемые данные отсутствуют."});
        }
        await pool.query(
            `INSERT INTO progress (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, progressData]
        );
        res.status(200).json({ success: true, message: '進捗が保存されました。' });
    } catch (error) {
        console.error(`LOG: /api/progress (POST): КРИТИЧЕСКАЯ ОШИБКА для '${req.user.username}':`, error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});


module.exports = router;