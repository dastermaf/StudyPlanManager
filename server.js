const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { initializeDatabase, markDbDown } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');
const logger = require('./logger');

// --- 変更開始: サーバーを起動するための関数 ---
async function startServer() {
    // JWT_SECRETのセキュリティチェック
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-default-jwt-secret-key-for-planner') {
        logger.error('致命的なエラー: JWT_SECRETが設定されていないか、安全でないデフォルト値が使用されています。', { src: 'server.js' });
        process.exit(1);
    }

    // MASTER_ENCRYPTION_KEYのセキュリティチェック
    if (!process.env.MASTER_ENCRYPTION_KEY || process.env.MASTER_ENCRYPTION_KEY.length < 32) {
        logger.error('致命的なエラー: MASTER_ENCRYPTION_KEYが設定されていないか、長さが不足しています（32文字以上が必要です）。', { src: 'server.js' });
        process.exit(1);
    }

    const app = express();
    const port = process.env.PORT || 3000;

    logger.info('サーバーを起動しています...', { src: 'server.js' });
    app.set('trust proxy', 1);

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    "default-src": ["'self'"],
                    "script-src": ["'self'", "https://cdn.jsdelivr.net"],
                    "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
                    "img-src": ["'self'", "data:", "https:"],
                    "connect-src": ["'self'", "https://script.google.com", "https://script.googleusercontent.com"],
                    "font-src": ["'self'", "https://fonts.gstatic.com"],
                },
            },
        })
    );

    app.use(cors());
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.get('/favicon.ico', (req, res) => res.redirect('/image/favicon.png'));

    app.use(express.static(path.join(__dirname, 'public')));

    app.use('/', pageRoutes);
    app.use('/api', apiRoutes);

    logger.info('ミドルウェアとルートが設定されました。', { src: 'server.js' });

    // データベースを初期化し、準備が整うまで待機します
    try {
        await initializeDatabase();

        // データベースの初期化が成功した後にのみ、サーバーを起動します
        app.listen(port, '0.0.0.0', () => {
            logger.info(`サーバーが起動し、0.0.0.0:${port}でリッスンしています`, { src: 'server.js' });
        });

    } catch (err) {
        logger.error('すべての試行の後、データベースの初期化に失敗しました。サーバーは起動しません。', { src: 'server.js', err: String(err && err.message || err) });
        // 致命的なDBエラーの場合、アプリケーションは終了し、
        // Railwayが再起動を試みます。
        process.exit(1);
    }
}
// --- 変更終了 ---

// 非同期の起動関数を実行します
startServer();