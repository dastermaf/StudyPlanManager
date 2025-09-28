const { Pool } = require('pg');
const logger = require('./logger'); // ИСПРАВЛЕНИЕ: Путь изменен с '../logger' на './logger'

// DB health state (shared module scope)
let dbState = { healthy: false, lastError: null };

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Wrap pool.query to log SQL + params and track health
const originalQuery = pool.query.bind(pool);
pool.query = async (text, params) => {
    const started = Date.now();
    try {
        const res = await originalQuery(text, params);
        const duration = Date.now() - started;
        logger.debug('db.query ok', { src: 'db.js', sql: trimSql(text), params: safeParams(params), rows: res?.rowCount ?? 0, ms: duration });
        markDbHealthy();
        return res;
    } catch (err) {
        const duration = Date.now() - started;
        logger.error('db.query fail', { src: 'db.js', sql: trimSql(text), params: safeParams(params), ms: duration, code: err && err.code, err: String(err && err.message || err) });
        markDbDown(err);
        throw err;
    }
};

// Helper to wrap client.query for transactions with logging
function wrapClient(client) {
    const orig = client.query.bind(client);
    client.query = async (text, params) => {
        const started = Date.now();
        try {
            const res = await orig(text, params);
            const duration = Date.now() - started;
            logger.debug('db.client.query ok', { src: 'db.js', sql: trimSql(text), params: safeParams(params), rows: res?.rowCount ?? 0, ms: duration });
            markDbHealthy();
            return res;
        } catch (err) {
            const duration = Date.now() - started;
            logger.error('db.client.query fail', { src: 'db.js', sql: trimSql(text), params: safeParams(params), ms: duration, code: err && err.code, err: String(err && err.message || err) });
            markDbDown(err);
            throw err;
        }
    };
    return client;
}

function trimSql(sql) {
    try { return (sql || '').toString().trim().replace(/\s+/g, ' ').slice(0, 500); } catch { return 'unknown-sql'; }
}
function safeParams(p) {
    if (!Array.isArray(p)) return undefined;
    return p.map(v => (typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v));
}

function markDbHealthy() {
    dbState.healthy = true;
    dbState.lastError = null;
}
function markDbDown(err) {
    dbState.healthy = false;
    dbState.lastError = err ? (err.message || String(err)) : 'unknown error';
}
function isDbHealthy() { return !!dbState.healthy; }
function getDbLastError() { return dbState.lastError; }

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runDataMigration = async (client) => {
    logger.info('db.js: データ移行チェックを開始します...', { src: 'db.js' });
    const res = await client.query("SELECT user_id, data FROM progress");

    for (const row of res.rows) {
        const { user_id, data } = row;
        let needsUpdate = false;

        if (data && data.lectures) {
            for (const subjectKey in data.lectures) {
                const subjectData = data.lectures[subjectKey];
                if (!subjectData) continue;

                // Удаляем поврежденные данные, если они существуют
                if (subjectData.hasOwnProperty('_subjectPinned') && typeof subjectData._subjectPinned !== 'boolean') {
                    delete subjectData._subjectPinned;
                    needsUpdate = true;
                }

                for (const chapterKey in subjectData) {
                    if (isNaN(parseInt(chapterKey, 10))) {
                        continue; // Пропускаем нечисловые ключи, такие как _subjectPinned
                    }
                    const chapterData = subjectData[chapterKey];

                    // --- ИСПРАВЛЕНИЕ: Добавлена проверка, что chapterData является объектом ---
                    const isObject = chapterData !== null && typeof chapterData === 'object';

                    // Мигрируем, если это не объект или если у него нет дочернего объекта 'vod'
                    if (!isObject || typeof chapterData.vod !== 'object' || chapterData.vod === null) {
                        needsUpdate = true;

                        // Безопасно получаем старые значения
                        const oldVodChecked = isObject ? chapterData.vod : !!chapterData;
                        const oldTestChecked = isObject ? chapterData.test : false;
                        const oldNote = isObject ? chapterData.note : '';
                        const oldTasks = isObject ? chapterData.tasks : [];
                        const oldPinned = isObject ? chapterData.pinned : false;

                        const newChapterData = {
                            vod: {
                                checked: oldVodChecked,
                                timestamp: oldVodChecked ? new Date().toISOString() : null
                            },
                            test: {
                                checked: oldTestChecked,
                                timestamp: oldTestChecked ? new Date().toISOString() : null
                            },
                            note: oldNote,
                            tasks: oldTasks,
                            pinned: oldPinned
                        };
                        subjectData[chapterKey] = newChapterData;
                    }
                }
            }
        }

        if (needsUpdate) {
            logger.info(`db.js: ユーザー ${user_id} のデータを更新しています...`, { src: 'db.js' });
            await client.query("UPDATE progress SET data = $1 WHERE user_id = $2", [data, user_id]);
        }
    }
    logger.info('db.js: データ移行チェックが完了しました。', { src: 'db.js' });
};

const initializeDatabase = async (retries = 5) => {
    while (retries) {
        try {
            logger.info('db.js: データベースへの接続を試行しています...', { src: 'db.js' });
            const rawClient = await pool.connect();
            const client = wrapClient(rawClient);
            logger.info('db.js: データベースへの接続に成功しました。', { src: 'db.js' });

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

            await client.query(`
                CREATE TABLE IF NOT EXISTS progress (
                    user_id INTEGER PRIMARY KEY,
                    data JSONB,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);

            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_key_encrypted TEXT;`);

            await client.query(`ALTER TABLE progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`);

            await runDataMigration(client);

            client.release();
            markDbHealthy();
            logger.info('db.js: データベースの初期化が正常に完了しました。', { src: 'db.js' });
            return;
        } catch (error) {
            retries--;
            const code = error && error.code;
            const isStarting = code === '57P03';
            const level = isStarting ? 'warn' : 'error';
            const left = retries;
            const msg = `db.js: データベース初期化中にエラーが発生しました。残り試行回数: ${left}`;
            if (level === 'warn') {
                logger.warn(`${msg} ${error.message || error}`, { src: 'db.js', code });
            } else {
                logger.error(msg, { src: 'db.js', code, err: String(error && error.message || error) });
            }
            markDbDown(error);
            if (retries === 0) {
                throw new Error("データベースに接続できませんでした。");
            }
            await wait(5000);
        }
    }
};

module.exports = { pool, initializeDatabase, isDbHealthy, getDbLastError, markDbDown, markDbHealthy, wrapClient };