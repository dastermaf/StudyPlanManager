// 必要なライブラリをインポートします
const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQLに接続するためのライブラリ

const app = express();
// Railwayが提供するポート番号を使用するか、なければ3000番ポートを使用します
const port = process.env.PORT || 3000;

// データベース接続プールを作成
// DATABASE_URLはRailwayが自動で環境変数として設定します
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // RailwayなどのクラウドDB接続にはSSLが必要
    }
});

// JSON形式のリクエストボディを解析するためのミドルウェア
app.use(express.json());
// 'public' ディレクトリ内の静的ファイル（HTML, CSS, JS）を配信します
app.use(express.static(path.join(__dirname, 'public')));

// --- APIエンドポイント ---

// GET: 保存された進捗データを取得する
app.get('/api/progress', async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM progress WHERE id = 1');
        if (result.rows.length > 0) {
            res.json(result.rows[0].data);
        } else {
            // データがない場合は空のオブジェクトを返す
            res.json({});
        }
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST: 進捗データを保存する
app.post('/api/progress', async (req, res) => {
    const { progressData } = req.body;
    try {
        // UPSERT処理: id=1の行があればUPDATE、なければINSERTする
        await pool.query(
            `INSERT INTO progress (id, data) VALUES (1, $1)
             ON CONFLICT (id) DO UPDATE SET data = $1`,
            [progressData]
        );
        res.status(200).json({ success: true, message: 'Progress saved.' });
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// サーバー起動時にデータベースのテーブルが存在するか確認し、なければ作成する
const initializeDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS progress (
                id INT PRIMARY KEY,
                data JSONB
            );
        `);
        console.log('Database table "progress" is ready.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// サーバーを起動します
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    initializeDatabase(); // データベースの初期化を実行
});

