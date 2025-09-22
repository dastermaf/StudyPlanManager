const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authenticateToken = require('../middleware/authenticateToken');
const { registerLimiter, loginLimiter } = require('../middleware/security');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';

router.get('/config', (req, res) => {
    if (process.env.CMS_LINK) {
        res.json({ cms_link: process.env.CMS_LINK });
    } else {
        res.status(500).json({ error: 'サーバーに環境変数 CMS_LINK が設定されていません。' });
    }
});

router.post('/register', registerLimiter, async (req, res) => {
    const { username, password, deviceId } = req.body;
    try {
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
            const newUserRes = await client.query("INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username", [username, hashedPassword]);
            const newUser = newUserRes.rows[0];
            await client.query('INSERT INTO device_registrations (device_id, user_id) VALUES ($1, $2)', [deviceId, newUser.id]);
            const emptyProgress = { settings: { theme: 'light' }, lectures: {} };
            await client.query("INSERT INTO progress (user_id, data) VALUES ($1, $2)", [newUser.id, emptyProgress]);
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

router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (rows.length === 0) {
            return res.status(401).send("ユーザー名またはパスワードが正しくありません。");
        }
        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
            });
            // ГЛАВНОЕ ИЗМЕНЕНИЕ: ВЫПОЛНЯЕМ ПЕРЕНАПРАВЛЕНИЕ
            res.redirect('/app');
        } else {
            res.status(401).send("ユーザー名またはパスワードが正しくありません。");
        }
    } catch (error) {
        res.status(500).send("サーバーエラーが発生しました。");
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.redirect('/');
});

router.get('/user', authenticateToken, (req, res) => {
    res.json(req.user);
});

router.get('/progress', authenticateToken, async (req, res) => {
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

router.post('/progress', authenticateToken, async (req, res) => {
    try {
        const progressData = req.body;
        if (!progressData) {
            return res.status(400).json({error: "保存するデータがありません。"});
        }
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

// 教材CMSへのサーバーサイドプロキシ（CSP回避のため、同一オリジン経由で取得）
router.get('/materials', authenticateToken, async (req, res) => {
    try {
        const subject = (req.query.subject || '').toString();
        const chapterRaw = (req.query.chapter || '').toString();

        // 入力検証（SSRF対策: 許可された形式のみ）
        if (!/^[A-Z0-9]{10}$/.test(subject)) {
            return res.status(400).json({ error: '無効なパラメータ: subject' });
        }
        const chapter = parseInt(chapterRaw, 10);
        if (!Number.isInteger(chapter) || chapter < 1 || chapter > 50) {
            return res.status(400).json({ error: '無効なパラメータ: chapter' });
        }

        const baseUrl = process.env.CMS_LINK;
        if (!baseUrl) {
            return res.status(500).json({ error: 'CMS_LINK が未設定です。' });
        }

        const url = `${baseUrl}?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`;

        // Node.js 18+ のグローバル fetch を想定
        const upstream = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            return res.status(502).json({ error: '上流の取得に失敗しました。', status: upstream.status, details: text.slice(0, 300) });
        }

        // JSONとして返す（もしJSONでなければエラーメッセージを生成）
        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await upstream.text().catch(() => '');
            return res.status(502).json({ error: '上流の応答がJSONではありません。', details: text.slice(0, 300) });
        }

        const data = await upstream.json();
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: 'サーバープロキシエラー', details: err.message });
    }
});

// 画像プロキシ（CSP対応のため、同一オリジン経由で取得）
router.get('/image', authenticateToken, async (req, res) => {
    try {
        const raw = (req.query.url || '').toString();
        if (!raw) {
            return res.status(400).send('url パラメータが必要です');
        }
        let urlObj;
        try {
            urlObj = new URL(raw);
        } catch (e) {
            return res.status(400).send('無効なURL');
        }
        // 許可するホストをホワイトリストで制限（CSP回避目的のため）
        const allowedHosts = new Set(['lh3.googleusercontent.com']);
        if (urlObj.protocol !== 'https:' || !allowedHosts.has(urlObj.hostname)) {
            return res.status(400).send('許可されていないホストです');
        }

        const upstream = await fetch(urlObj.toString(), { method: 'GET' });
        if (!upstream.ok) {
            return res.status(502).send('上流からの取得に失敗しました');
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const ab = await upstream.arrayBuffer();
        res.status(200).send(Buffer.from(ab));
    } catch (err) {
        res.status(500).send('画像プロキシエラー');
    }
});

module.exports = router;