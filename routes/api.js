const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, wrapClient } = require('../db');
const authenticateToken = require('../middleware/authenticateToken');
const { registerLimiter, loginLimiter } = require('../middleware/security');
const { ensureDbForApi } = require('../middleware/dbHealth');

const router = express.Router();
router.use(ensureDbForApi);
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key-for-planner';
const MASTER_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'utf8');

// --- Crypto Module ---
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

function encrypt(text, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

function decrypt(encryptedText, key) {
    try {
        const data = Buffer.from(encryptedText, 'base64');
        const iv = data.slice(0, IV_LENGTH);
        const encrypted = data.slice(IV_LENGTH, data.length - TAG_LENGTH);
        const tag = data.slice(data.length - TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        const decrypted = decipher.update(encrypted, 'binary', 'utf8') + decipher.final('utf8');
        return decrypted;
    } catch (e) {
        // Если расшифровка не удалась, возвращаем исходный (вероятно, незашифрованный) текст
        return encryptedText;
    }
}

function deriveKeyFromMaster(salt) {
    return crypto.pbkdf2Sync(MASTER_KEY, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

// --- Data Traversal for Encryption/Decryption ---
function traverseNotes(progressData, operation) {
    if (!progressData || !progressData.lectures) return progressData;
    const key = progressData.encryptionKey; // Ключ добавляется временно
    if (!key) return progressData;

    for (const subjectId in progressData.lectures) {
        for (const chapterNo in progressData.lectures[subjectId]) {
            const chapter = progressData.lectures[subjectId][chapterNo];
            if (chapter && typeof chapter.note === 'string' && chapter.note) {
                chapter.note = operation(chapter.note, key);
            }
        }
    }
    return progressData;
}
// ---- Client log intake endpoint ----
const serverLogger = require('../logger');
const logRate = new Map(); // ip -> { count, reset }
const LOG_LIMIT_PER_MIN = 120;

router.post('/log', (req, res) => {
    try {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = logRate.get(ip) || { count: 0, reset: now + 60_000 };
        if (now > entry.reset) { entry.count = 0; entry.reset = now + 60_000; }
        entry.count += 1;
        logRate.set(ip, entry);
        if (entry.count > LOG_LIMIT_PER_MIN) {
            return res.status(429).json({ ok: true }); // silently drop to not spam client
        }

        const { level = 'info', message = '', args = [], page = '', ts, ua } = req.body || {};
        const allowed = ['debug', 'info', 'warn', 'error'];
        const lvl = allowed.includes(level) ? level : 'info';

        // Try to detect user from cookie token (optional)
        let user = undefined;
        try {
            const token = req.cookies?.accessToken;
            if (token) {
                const payload = jwt.verify(token, JWT_SECRET);
                user = { id: payload.id, username: payload.username };
            }
        } catch {}

        const ctx = serverLogger.fromRequest(req);
        const extra = {
            src: 'client',
            page,
            ua: ua || ctx.ua,
            ip: ctx.ip,
            user,
            args: Array.isArray(args) ? args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).slice(0, 10) : undefined,
            clientTs: ts,
        };
        serverLogger[lvl](`client:${lvl} ${typeof message === 'string' ? message : String(message)}`, extra);
        return res.json({ ok: true });
    } catch (e) {
        serverLogger.warn('failed to ingest client log', { src: 'api.log', err: String(e && e.message || e) });
        return res.json({ ok: true });
    }
});

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

        // --- Создание ключа шифрования ---
        const userKey = crypto.randomBytes(KEY_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        const masterDerivedKey = deriveKeyFromMaster(salt);
        const encryptedUserKey = encrypt(userKey.toString('hex'), masterDerivedKey);
        const finalKeyToStore = `${salt.toString('hex')}:${encryptedUserKey}`;

        const rawClient = await pool.connect();
        const client = wrapClient(rawClient);
        try {
            await client.query('BEGIN');
            const deviceCheck = await client.query('SELECT * FROM device_registrations WHERE device_id = $1', [deviceId]);
            if (deviceCheck.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'このデバイスからはすでにアカウントが登録されています。' });
            }
            const newUserRes = await client.query("INSERT INTO users (username, password, encryption_key_encrypted) VALUES ($1, $2, $3) RETURNING id, username", [username, hashedPassword, finalKeyToStore]);
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
        const { rows } = await pool.query("SELECT id, username, password, encryption_key_encrypted FROM users WHERE username = $1", [username]);
        if (rows.length === 0) {
            return res.status(401).send("ユーザー名またはパスワードが正しくありません。");
        }
        const user = rows[0];
        if (await bcrypt.compare(password, user.password)) {
            // --- Расшифровка ключа и добавление в JWT ---
            const [saltHex, encryptedKey] = user.encryption_key_encrypted.split(':');
            const salt = Buffer.from(saltHex, 'hex');
            const masterDerivedKey = deriveKeyFromMaster(salt);
            const userKeyHex = decrypt(encryptedKey, masterDerivedKey);

            const accessToken = jwt.sign({ id: user.id, username: user.username, key: userKeyHex }, JWT_SECRET, { expiresIn: '7d' });

            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
            });
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
    // Не отправляем ключ на клиент
    const { key, ...user } = req.user;
    res.json(user);
});

router.get('/progress', authenticateToken, async (req, res) => {
    try {
        const uid = req.user.id;
        const result = await pool.query('SELECT data FROM progress WHERE user_id = $1', [uid]);
        if (result.rows.length > 0) {
            const progressData = result.rows[0].data;
            // --- Расшифровка заметок ---
            progressData.encryptionKey = Buffer.from(req.user.key, 'hex');
            const decryptedData = traverseNotes(progressData, decrypt);
            delete decryptedData.encryptionKey;

            return res.json(decryptedData);
        }
        // Auto-create default progress if missing
        const empty = { settings: { theme: 'light', currentWeekIndex: 0 }, lectures: {} };
        await pool.query('INSERT INTO progress (user_id, data) VALUES ($1, $2)', [uid, empty]);
        res.setHeader('X-Notice', 'DATA_INITIALIZED');
        return res.status(200).json(empty);
    } catch (error) {
        // If table or other schema missing, let client know
        return res.status(500).json({ error: '進捗データの取得に失敗しました。', code: 'PROGRESS_LOAD_FAILED' });
    }
});

router.post('/progress', authenticateToken, async (req, res) => {
    try {
        const progressData = req.body;
        if (!progressData) {
            return res.status(400).json({error: "保存するデータがありません。"});
        }
        // --- Шифрование заметок ---
        progressData.encryptionKey = Buffer.from(req.user.key, 'hex');
        const encryptedData = traverseNotes(progressData, encrypt);
        delete encryptedData.encryptionKey;

        await pool.query(
            `INSERT INTO progress (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, encryptedData]
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
        if (!raw) return res.status(400).send('url パラメータが必要です');

        let urlObj;
        try { urlObj = new URL(raw); } catch { return res.status(400).send('無効なURL'); }

        const ALLOWED_IMAGE_HOSTS = [
            'pub-8e1f6da67eed4033b14228e6b9e1393c.r2.dev',
            'googleusercontent.com'
        ];
        const isAllowedHost = (hostname) => {
            return ALLOWED_IMAGE_HOSTS.some(allowedHost =>
                hostname === allowedHost || hostname.endsWith('.' + allowedHost)
            );
        };
        if (urlObj.protocol !== 'https:' || !isAllowedHost(urlObj.hostname)) {
            return res.status(400).send(`許可されていないホストです: ${urlObj.hostname}`);
        }

        const COMMON = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.9',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Dest': 'image',
            'Connection': 'keep-alive'
        };
        const trials = [
            { headers: { ...COMMON, 'Referer': 'https://sites.google.com/', 'Origin': 'https://sites.google.com' } },
            { headers: { ...COMMON } },
            { headers: { ...COMMON, 'Referer': urlObj.origin + '/', 'Origin': urlObj.origin } }
        ];

        let lastStatus = 0;
        let lastBody = '';
        for (const t of trials) {
            try {
                const upstream = await fetch(urlObj.toString(), { method: 'GET', headers: t.headers, redirect: 'follow' });
                if (upstream.ok) {
                    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    const ab = await upstream.arrayBuffer();
                    return res.status(200).send(Buffer.from(ab));
                } else {
                    lastStatus = upstream.status;
                    lastBody = await upstream.text().catch(() => '');
                }
            } catch (e) {
                lastStatus = 0;
                lastBody = String(e && e.message || 'fetch error');
            }
        }
        res.setHeader('X-Upstream-Status', String(lastStatus));
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#eef2ff"/>
      <stop offset="100%" stop-color="#e0e7ff"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g fill="#6366f1">
    <circle cx="80" cy="80" r="28" fill="#a5b4fc"/>
    <rect x="130" y="60" width="240" height="16" rx="8"/>
    <rect x="130" y="86" width="180" height="12" rx="6" fill="#818cf8"/>
  </g>
  <g transform="translate(60,180)" fill="#334155">
    <rect x="0" y="0" width="680" height="14" rx="7" fill="#c7d2fe"/>
    <rect x="0" y="26" width="620" height="14" rx="7" fill="#c7d2fe"/>
    <rect x="0" y="52" width="540" height="14" rx="7" fill="#c7d2fe"/>
  </g>
  <text x="50%" y="88%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-size="14">画像を取得できませんでした (status: ${lastStatus}). オリジナルへのアクセスが制限されている可能性があります。</text>
</svg>`;
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        return res.status(200).send(svg);
    } catch (err) {
        return res.status(500).send('画像プロキシエラー');
    }
});

module.exports = router;