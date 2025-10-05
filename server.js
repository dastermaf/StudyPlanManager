const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { initializeDatabase, markDbDown } = require('./db');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');
const logger = require('./logger');

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

    // --- 変更開始: helmetのCSP設定を修正 ---
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    "default-src": ["'self'"],
                    // ログで特定された2つのハッシュをscript-srcに追加
                    "script-src": ["'self'", "https://cdn.jsdelivr.net", "'sha256-ZswfTY7H35rbv8WC7NXBoiC7WNu86vSzCDChNWwZZDM='", "'sha256-UyMWDlOGeCJ35SOPqVr+NfGfCYjIzihHd/kKZTbj+DY='"],
                    "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
                    "img-src": ["'self'", "data:", "https:"],
                    "connect-src": ["'self'", "https://script.google.com", "https://script.googleusercontent.com"],
                    "font-src": ["'self'", "https://fonts.gstatic.com"],
                },
            },
        })
    );
    // --- 変更終了 ---

    app.use(cors());
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.get('/favicon.ico', (req, res) => res.redirect('/image/favicon.png'));

    app.use(express.static(path.join(__dirname, 'public')));

    app.use('/', pageRoutes);
    app.use('/api', apiRoutes);

    logger.info('ミドルウェアとルートが設定されました。', { src: 'server.js' });

    try {
        await initializeDatabase();
        app.listen(port, '0.0.0.0', () => {
            logger.info(`サーバーが起動し、0.0.0.0:${port}でリッスンしています`, { src: 'server.js' });
        });
    } catch (err) {
        logger.error('すべての試行の後、データベースの初期化に失敗しました。サーバーは起動しません。', { src: 'server.js', err: String(err && err.message || err) });
        process.exit(1);
    }
}

startServer();