const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Функция для задержки
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            console.log('LOG: db.js: テーブル "users" の準備が完了しました。');

            await client.query(`
                CREATE TABLE IF NOT EXISTS device_registrations (
                    id SERIAL PRIMARY KEY,
                    device_id VARCHAR(255) UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            `);
            console.log('LOG: db.js: テーブル "device_registrations" の準備が完了しました。');

            const res = await client.query(`
                SELECT data_type FROM information_schema.columns
                WHERE table_name='progress' AND column_name='data';
            `);

            if (res.rowCount === 0 || res.rows[0].data_type.toLowerCase().includes('text')) {
                console.log('LOG: db.js: 古い、または存在しない "progress" の構造が検出されました。再作成します...');
                await client.query('DROP TABLE IF EXISTS progress;');
                await client.query(`
                     CREATE TABLE progress (
                        user_id INTEGER PRIMARY KEY,
                        data JSONB,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    );
                `);
                console.log('LOG: db.js: テーブル "progress" が正常に作成されました。');
            } else {
                console.log('LOG: db.js: テーブル "progress" はすでに正しい構造です。');
            }

            client.release();
            console.log("LOG: db.js: データベースの初期化が正常に完了しました。");
            return; // Успех, выходим из цикла
        } catch (error) {
            if (error.code === '57P03' && retries > 0) {
                console.warn(`LOG: db.js: データベースの準備がまだできていません。残り試行回数: ${retries - 1}。5秒後に再試行します...`);
                await wait(5000); // Ждем 5 секунд
                retries--;
            } else {
                console.error('LOG: db.js: データベース初期化中に致命的なエラーが発生しました:', error);
                throw error; // Другая ошибка, пробрасываем ее
            }
        }
    }
};

module.exports = { pool, initializeDatabase };