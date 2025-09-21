const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Функция миграции данных ---
// Эта функция будет проверять и обновлять структуру данных пользователя
const runDataMigration = async (client) => {
    console.log('LOG: db.js: Запуск проверки миграции данных...');
    const res = await client.query("SELECT user_id, data FROM progress");

    for (const row of res.rows) {
        const { user_id, data } = row;
        let needsUpdate = false;

        // Проверяем, есть ли у пользователя лекции
        if (data.lectures) {
            for (const subjectKey in data.lectures) {
                for (const chapterKey in data.lectures[subjectKey]) {
                    const chapterData = data.lectures[subjectKey][chapterKey];
                    // Проверяем, что это старый формат (например, vod: true/false, а не объект)
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
                            tasks: chapterData.tasks || []
                            // pinned для уроков будет храниться на клиенте, в данных CMS
                        };
                        data.lectures[subjectKey][chapterKey] = newChapterData;
                    }
                }
            }
        }

        if (needsUpdate) {
            console.log(`LOG: db.js: Обновление данных для пользователя ${user_id}`);
            await client.query("UPDATE progress SET data = $1 WHERE user_id = $2", [data, user_id]);
        }
    }
    console.log('LOG: db.js: Проверка миграции данных завершена.');
};


const initializeDatabase = async (retries = 5) => {
    while (retries) {
        try {
            console.log("LOG: db.js: データベースへの接続を試行しています...");
            const client = await pool.connect();
            console.log("LOG: db.js: データベースへの接続に成功しました。");

            // ... (создание таблиц без изменений)
            await client.query(`CREATE TABLE IF NOT EXISTS users (...)`);
            await client.query(`CREATE TABLE IF NOT EXISTS device_registrations (...)`);
            await client.query(`CREATE TABLE IF NOT EXISTS progress (...)`);

            // Запускаем миграцию после инициализации таблиц
            await runDataMigration(client);

            client.release();
            console.log("LOG: db.js: データベースの初期化が正常に完了しました。");
            return;
        } catch (error) {
            if (error.code === '57P03' && retries > 0) {
                console.warn(`LOG: db.js: データベースの準備がまだできていません。残り試行回数: ${retries - 1}。5秒後に再試行します...`);
                await wait(5000);
                retries--;
            } else {
                console.error('LOG: db.js: データベース初期化中に致命的なエラーが発生しました:', error);
                throw error;
            }
        }
    }
};

module.exports = { pool, initializeDatabase };