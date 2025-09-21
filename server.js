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

app.set('trust proxy', 1);

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
// Обслуживаем всю папку public
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

// --- Маршрут для корневого URL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'layout', 'login.html'));
});

// --- API Маршруты ---
app.post('/api/register', registerLimiter, async (req, res) => {
    try {
        const { username, password, deviceId } = req.body;
        if (!username || !password || !deviceId) {
            return res.status(400).json({ error: 'ユーザー名、パスワード、デバイスIDは必須です。' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const deviceCheck = await client.query('SELECT * FROM device_registrations WHERE device_id = $1', [deviceId]);
            if (deviceCheck.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'このデバイスからはすでにアカウントが登録されています。' });
            }
            const newUserRes = await client.query(
                "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
                [username, hashedPassword]
            );
            const newUser = newUserRes.rows[0];
            await client.query('INSERT INTO device_registrations (device_id, user_id) VALUES ($1, $2)', [deviceId, newUser.id]);

            const emptyProgress = { settings: { theme: 'light' }, lectures: {} };

            await client.query(
                "INSERT INTO progress (user_id, data) VALUES ($1, $2)",
                [newUser.id, emptyProgress]
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
        if (error.code === '23505') return res.status(409).json({ error: 'このユーザー名はすでに存在します。' });
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (rows.length === 0) return res.status(400).json({ error: 'ユーザーが見つかりません。' });

        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ accessToken: accessToken });
        } else {
            res.status(401).json({ error: 'パスワードが正しくありません。' });
        }
    } catch (error) {
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.get('/api/progress', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM progress WHERE user_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].data);
        } else {
            res.json({ settings: { theme: 'light' }, lectures: {} });
        }
    } catch (error) {
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
    }
});

app.post('/api/progress', authenticateToken, async (req, res) => {
    try {
        const progressData = req.body;
        if (!progressData) return res.status(400).json({error: "保存するデータがありません。"});

        await pool.query(
            `INSERT INTO progress (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, progressData]
        );
        res.status(200).json({ success: true, message: '進捗が保存されました。' });
    } catch (error) {
        res.status(500).json({ error: 'サーバーエラーが発生しました。' });
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

        await client.query(`
            CREATE TABLE IF NOT EXISTS device_registrations (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        const res = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name='progress' AND column_name='data';
        `);

        if (res.rowCount === 0 || res.rows[0].data_type.toLowerCase().includes('text')) {
            await client.query('DROP TABLE IF EXISTS progress;');
            await client.query(`
                 CREATE TABLE progress (
                    user_id INTEGER PRIMARY KEY,
                    data JSONB,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);
        }
    } catch (error) {
        console.error('データベースの初期化中にエラーが発生しました:', error);
    } finally {
        client.release();
    }
};

app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました。`);
    initializeDatabase();
});

