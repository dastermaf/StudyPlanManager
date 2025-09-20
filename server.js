// --- Импорт библиотек ---
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto'); // Встроенный модуль для шифрования

const app = express();
const port = process.env.PORT || 3000;

// Секретные ключи должны храниться в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // 32 байта для AES-256

// --- НАСТРОЙКА БЕЗОПАСНОСТИ ---
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Слишком много аккаунтов создано с этого IP, пожалуйста, попробуйте снова через час.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Слишком много попыток входа с этого IP, пожалуйста, попробуйте снова через 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cors());
app.use(express.json({limit: '2mb'})); // Увеличиваем лимит, т.к. шифрованные данные могут быть большими
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- API Маршруты ---

app.post('/api/register', registerLimiter, async (req, res) => {
    try {
        const { username, password, deviceId } = req.body;
        if (!username || !password || !deviceId) {
            return res.status(400).json({ error: 'Имя пользователя, пароль и ID устройства обязательны.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const deviceCheck = await client.query('SELECT * FROM device_registrations WHERE device_id = $1', [deviceId]);
            if (deviceCheck.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'С этого устройства уже был зарегистрирован аккаунт.' });
            }
            const newUserRes = await client.query(
                "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
                [username, hashedPassword]
            );
            const newUser = newUserRes.rows[0];
            await client.query('INSERT INTO device_registrations (device_id, user_id) VALUES ($1, $2)', [deviceId, newUser.id]);

            // Создаем пустую зашифрованную запись о прогрессе
            const emptyProgress = { settings: { theme: 'light' }, lectures: {} };
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
            let encrypted = cipher.update(JSON.stringify(emptyProgress), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();

            const encryptedDataForDb = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

            await client.query(
                "INSERT INTO progress (user_id, data) VALUES ($1, $2)",
                [newUser.id, encryptedDataForDb]
            );

            await client.query('COMMIT');
            res.status(201).json(newUser);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'Пользователь с таким именем уже существует.' });
        res.status(500).json({ error: 'Ошибка на сервере.' });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (rows.length === 0) return res.status(400).json({ error: 'Пользователь не найден' });

        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ accessToken: accessToken });
        } else {
            res.status(401).json({ error: 'Неверный пароль' });
        }
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.status(500).json({ error: 'Ошибка на сервере.' });
    }
});

app.get('/api/progress', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM progress WHERE user_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            const encryptedData = result.rows[0].data;
            // Отправляем зашифрованные данные как есть
            res.json({ encrypted: encryptedData });
        } else {
            res.json({}); // Если данных нет
        }
    } catch (error) {
        console.error('Ошибка при загрузке прогресса:', error);
        res.status(500).json({ error: 'Ошибка на сервере' });
    }
});

app.post('/api/progress', authenticateToken, async (req, res) => {
    try {
        const { encrypted } = req.body; // Получаем зашифрованные данные
        if (!encrypted) return res.status(400).json({error: "Нет данных для сохранения"});

        await pool.query(
            `INSERT INTO progress (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, encrypted]
        );
        res.status(200).json({ success: true, message: 'Прогресс сохранен.' });
    } catch (error) {
        console.error('Ошибка при сохранении прогресса:', error);
        res.status(500).json({ error: 'Ошибка на сервере.' });
    }
});


const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Таблица "users" готова.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS device_registrations (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log('Таблица "device_registrations" готова.');

        // Проверяем тип данных колонки data
        const res = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name='progress' AND column_name='data';
        `);

        // Если таблицы progress нет или тип колонки data - JSONB, пересоздаем ее
        if (res.rowCount === 0 || res.rows[0].data_type.toLowerCase().includes('json')) {
            console.log('Обнаружена устаревшая или отсутствующая структура "progress". Пересоздание...');
            await client.query('DROP TABLE IF EXISTS progress;');
            await client.query(`
                CREATE TABLE progress (
                    user_id INTEGER PRIMARY KEY,
                    data TEXT, -- Меняем JSONB на TEXT для хранения шифрованных данных
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);
            console.log('Таблица "progress" успешно создана с текстовым полем для шифрованных данных.');
        } else {
            console.log('Таблица "progress" готова.');
        }

    } catch (error) {
        console.error('Ошибка при инициализации базы данных:', error);
    } finally {
        client.release();
    }
};

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
    initializeDatabase();
});

