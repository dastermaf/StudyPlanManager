const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const initializeDatabase = async () => {
    console.log("LOG: db.js: initializeDatabase() - Начало инициализации базы данных.");
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
        console.log('LOG: db.js: Таблица "users" готова.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS device_registrations (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log('LOG: db.js: Таблица "device_registrations" готова.');

        const res = await client.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name='progress' AND column_name='data';
        `);

        if (res.rowCount === 0 || res.rows[0].data_type.toLowerCase().includes('text')) {
            console.log('LOG: db.js: Обнаружена устаревшая или отсутствующая структура "progress". Пересоздание...');
            await client.query('DROP TABLE IF EXISTS progress;');
            await client.query(`
                 CREATE TABLE progress (
                    user_id INTEGER PRIMARY KEY,
                    data JSONB,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                );
            `);
            console.log('LOG: db.js: Таблица "progress" успешно создана с новой структурой JSONB.');
        } else {
            console.log('LOG: db.js: Таблица "progress" уже имеет правильную структуру.');
        }

    } catch (error) {
        console.error('LOG: db.js: КРИТИЧЕСКАЯ ОШИБКА при инициализации базы данных:', error);
    } finally {
        client.release();
        console.log("LOG: db.js: Соединение с базой данных для инициализации закрыто.");
    }
};

module.exports = { pool, initializeDatabase };