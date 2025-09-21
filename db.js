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
            console.log("LOG: db.js: Попытка подключения к базе данных...");
            const client = await pool.connect();
            console.log("LOG: db.js: Успешное подключение к базе данных.");

            // ... (остальной код инициализации без изменений)
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
                console.log('LOG: db.js: Обнаружена устаревшая структура "progress". Пересоздание...');
                await client.query('DROP TABLE IF EXISTS progress;');
                await client.query(`
                     CREATE TABLE progress (
                        user_id INTEGER PRIMARY KEY,
                        data JSONB,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    );
                `);
                console.log('LOG: db.js: Таблица "progress" успешно создана.');
            } else {
                console.log('LOG: db.js: Таблица "progress" уже имеет правильную структуру.');
            }

            client.release();
            console.log("LOG: db.js: Инициализация базы данных успешно завершена.");
            return; // Выходим из цикла и функции при успехе
        } catch (error) {
            // Код '57P03' означает, что база данных все еще запускается
            if (error.code === '57P03' && retries > 0) {
                console.warn(`LOG: db.js: База данных еще не готова. Осталось попыток: ${retries - 1}. Повтор через 5 секунд...`);
                await wait(5000); // Ждем 5 секунд
                retries--;
            } else {
                console.error('LOG: db.js: КРИТИЧЕСКАЯ ОШИБКА при инициализации базы данных:', error);
                throw error; // Если ошибка другая или попытки кончились, выбрасываем ее
            }
        }
    }
};

module.exports = { pool, initializeDatabase };