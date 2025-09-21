const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runDataMigration = async (client) => {
    console.log('LOG: db.js: データ移行チェックを開始します...');
    const res = await client.query("SELECT user_id, data FROM progress");

    for (const row of res.rows) {
        const { user_id, data } = row;
        let needsUpdate = false;

        if (data.lectures) {
            for (const subjectKey in data.lectures) {
                for (const chapterKey in data.lectures[subjectKey]) {
                    const chapterData = data.lectures[subjectKey][chapterKey];
                    if (typeof chapterData.vod !== 'object' || chapterData.vod === null) {
                        needsUpdate = true;

                        const newChapterData = {
                            vod: {
                                checked: chapterData.vod || false,
                                timestamp: chapterData.vod ? new Date().toISOString() : null
                            },
                            test: {
                                checked: chapterData.test || false,
                                timestamp: chapterData.test ? new Date().toISOString() : null
                            },
                            note: chapterData.note || '',
                            tasks: chapterData.tasks || [],
                            pinned: chapterData.pinned || false
                        };
                        data.lectures[subjectKey][chapterKey] = newChapterData;
                    }
                }
            }
        }

        if (needsUpdate) {
            console.log(`LOG: db.js: ユーザー ${user_id} のデータを更新しています...`);
            await client.query("UPDATE progress SET data = $1 WHERE user_id = $2", [data, user_id]);
        }
    }
    console.log('LOG: db.js: データ移行チェックが完了しました。');
};

const initializeDatabase = async (retries = 5) => {
    while (retries) {
        try {
            console.log("LOG: db.js: データベースへの接続を試行しています...");
            const client = await pool.connect();
            console.log("LOG: db.js: データベースへの接続に成功しました。");

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

            await runDataMigration(client);

            client.release();
            console.log("LOG: db.js: データベースの初期化が正常に完了しました。");
            return; // 成功したらループを抜ける
        } catch (error) {
            retries--;
            console.error(`LOG: db.js: データベース初期化中にエラーが発生しました。残り試行回数: ${retries}`, error);
            if (retries === 0) {
                // 最終的に失敗した場合はエラーをスロー
                throw new Error("データベースに接続できませんでした。");
            }
            // 5秒待ってから再試行
            await wait(5000);
        }
    }
};

module.exports = { pool, initializeDatabase };