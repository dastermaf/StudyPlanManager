// --- Импорт библиотек ---
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

console.log("LOG: server.js: Запуск сервера...");

// --- ВАЖНОЕ ИСПРАВЛЕНИЕ ДЛЯ RAILWAY ---
app.set('trust proxy', 1);
console.log("LOG: server.js: Установлено 'trust proxy' для Railway.");

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';

// --- НАСТРОЙКА БЕЗОПАСНОСТИ ---
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'このIPアドレスから作成されたアカウントが多すぎます。1時間後にもう一度お試しください。' },
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'このIPアドレスからのログイン試行が多すぎます。15分後にもう一度お試しください。' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cors());
app.use(express.json({limit: '2mb'}));
app.use(express.static(path.join(__dirname, 'public')));
console.log("LOG: server.js: Middleware настроены.");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const authenticateToken = (req, res, next) => {
    console.log(`LOG: server.js: authenticateToken для запроса на ${req.path}`);
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.log("LOG: server.js: Токен не найден, доступ запрещен (401).");
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log("LOG: server.js: Ошибка верификации токена, доступ запрещен (403).", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        console.log("LOG: server.js: Токен верифицирован для пользователя:", user.username);
        next();
    });
};

// --- API Маршруты ---

app.post('/api/register', registerLimiter, async (req, res) => {
    console.log("LOG: server.js: Получен запрос на /api/register");
    try {
        const { username, password, deviceId } = req.body;
        if (!username || !password || !deviceId) {
            console.log("LOG: server.js: Ошибка регистрации - не все поля заполнены.");
            return res.status(400).json({ error: 'ユーザー名、パスワード、デバイスIDは必須です。' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            console.log("LOG: server.js: Начало транзакции регистрации.");

            const deviceCheck = await client.query('SELECT * FROM device_registrations WHERE device_id = $1', [deviceId]);
            if (deviceCheck.rowCount > 0) {
                await client.query('ROLLBACK');
                console.log("LOG: server.js: Регистрация отклонена - deviceId уже существует.");
                return res.status(403).json({ error: 'このデバイスからはすでにアカウントが登録されています。' });
            }

            const newUserRes = await client.query(
                "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
                [username, hashedPassword]
            );
            const newUser = newUserRes.rows[0];
            console.log(`LOG: server.js: Пользователь ${newUser.username} создан с ID ${newUser.id}.`);

            await client.query('INSERT INTO device_registrations (device_id, user_id) VALUES ($1, $2)', [deviceId, newUser.id]);
            console.log(`LOG: server.js: DeviceId для пользователя ${newUser.username} зарегистрирован.`);

            const emptyProgress = { settings: { theme: 'light' }, lectures: {} };

            await client.query(
                "INSERT INTO progress (user_id, data) VALUES ($1, $2)",
                [newUser.id, emptyProgress]
            );
            console.log(`LOG: server.js: Начальный прогресс для пользователя ${newUser.username} создан.`);

            await client.query('COMMIT');
            console.log("LOG: server.js: Транзакция регистрации успешно завершена.");
            res.status(201).json(newUser);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('LOG: server.js: КРИТИЧЕСКАЯ ОШИБКА при регистрации:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'このユーザー名はすでに存在します。' });
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    console.log("LOG: server.js: Получен запрос на /api/login");
    try {
        const { username, password } = req.body;
        const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (rows.length === 0) {
            console.log(`LOG: server.js: Попытка входа для несуществующего пользователя: ${username}`);
            return res.status(400).json({ error: 'ユーザーが見つかりません。' });
        }

        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            console.log(`LOG: server.js: Пользователь ${username} успешно вошел в систему.`);
            res.json({ accessToken: accessToken });
        } else {
            console.log(`LOG: server.js: Неудачная попытка входа для пользователя: ${username} - неверный пароль.`);
            res.status(401).json({ error: 'パスワードが正しくありません。' });
        }
    } catch (error) {
        console.error('LOG: server.js: КРИТИЧЕСКАЯ ОШИБКА при входе:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.get('/api/progress', authenticateToken, async (req, res) => {
    console.log(`LOG: server.js: Получен запрос на /api/progress от пользователя ${req.user.username}`);
    try {
        const result = await pool.query('SELECT data FROM progress WHERE user_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            console.log(`LOG: server.js: Прогресс для пользователя ${req.user.username} найден и отправлен.`);
            res.json(result.rows[0].data);
        } else {
            console.log(`LOG: server.js: Прогресс для пользователя ${req.user.username} не найден, отправлен пустой объект.`);
            res.json({ settings: { theme: 'light' }, lectures: {} });
        }
    } catch (error) {
        console.error('LOG: server.js: КРИТИЧЕСКАЯ ОШИБКА при получении прогресса:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.post('/api/progress', authenticateToken, async (req, res) => {
    console.log(`LOG: server.js: Получен запрос на сохранение прогресса от ${req.user.username}`);
    try {
        const progressData = req.body;
        if (!progressData) {
            console.log(`LOG: server.js: Попытка сохранить пустые данные от ${req.user.username}`);
            return res.status(400).json({error: "保存するデータがありません。"});
        }

        await pool.query(
            `INSERT INTO progress (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, progressData]
        );
        console.log(`LOG: server.js: Прогресс для пользователя ${req.user.username} успешно сохранен.`);
        res.status(200).json({ success: true, message: '進捗が保存されました。' });
    } catch (error) {
        console.error('LOG: server.js: КРИТИЧЕСКАЯ ОШИБКА при сохранении прогресса:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

// ... (остальной код server.js, включая initializeDatabase)
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        console.log("LOG: server.js: initializeDatabase() - Начало инициализации базы данных.");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('LOG: server.js: Таблица "users" готова.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS device_registrations (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log('LOG: server.js: Таблица "device_registrations" готова.');

        const res = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name='progress' AND column_name='data';
        `);

        if (res.rowCount === 0 || res.rows[0].data_type.toLowerCase().includes('text')) {
            console.log('LOG: server.js: Обнаружена устаревшая или отсутствующая структура "progress". Пересоздание...');
            await client.query('DROP TABLE IF EXISTS progress;');
            await client.query(`
                 CREATE TABLE progress (
                    user_id INTEGER PRIMARY KEY,
                    data JSONB,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);
            console.log('LOG: server.js: Таблица "progress" успешно создана с новой структурой (JSONB).');
        } else {
            console.log('LOG: server.js: Таблица "progress" уже имеет правильную структуру.');
        }

    } catch (error) {
        console.error('LOG: server.js: КРИТИЧЕСКАЯ ОШИБКА при инициализации базы данных:', error);
    } finally {
        client.release();
        console.log("LOG: server.js: Соединение с базой данных для инициализации закрыто.");
    }
};

app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました。`);
    initializeDatabase();
});

