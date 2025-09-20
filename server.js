// 必要なライブラリをインポートします
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Парольдерді хэштеу үшін
const jwt = require('jsonwebtoken'); // JWT токендері үшін

const app = express();
const port = process.env.PORT || 3000;

// Railway ортасында JWT_SECRET орнатылуы керек
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key';

// CORSミドルウェアを使用します
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// データベース接続プールを作成
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // егер токен болмаса

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // егер токен жарамсыз болса
        req.user = user;
        next();
    });
};


// --- APIエンドポイント ---

// POST: Жаңа пайдаланушыны тіркеу
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
            [username, hashedPassword]
        );

        // Жаңа пайдаланушы үшін бос прогресс жазбасын жасау
        await pool.query(
            "INSERT INTO progress (user_id, data) VALUES ($1, $2)",
            [newUser.rows[0].id, {}]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Username already exists or server error.' });
    }
});

// POST: Пайдаланушының жүйеге кіруі
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

    if (rows.length === 0) {
        return res.status(400).json({ error: 'Cannot find user' });
    }

    const user = rows[0];
    try {
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ accessToken: accessToken });
        } else {
            res.status(401).json({ error: 'Not Allowed' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// GET: 保存された進捗データを取得する (қорғалған)
app.get('/api/progress', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM progress WHERE user_id = $1', [req.user.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].data);
        } else {
            res.json({});
        }
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST: 進捗データを保存する (қорғалған)
app.post('/api/progress', authenticateToken, async (req, res) => {
    const { progressData } = req.body;
    try {
        await pool.query(
            `INSERT INTO progress (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = $2`,
            [req.user.id, progressData]
        );
        res.status(200).json({ success: true, message: 'Progress saved.' });
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const initializeDatabase = async () => {
    try {
        // Пайдаланушылар кестесін жасау
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database table "users" is ready.');

        // Прогресс кестесін жасау (users кестесіне сілтемемен)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS progress (
                user_id INTEGER PRIMARY KEY,
                data JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        console.log('Database table "progress" is ready.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    initializeDatabase();
});

