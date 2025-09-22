const { isDbHealthy, getDbLastError } = require('../db');

// For page routes: redirect to pretty error page if DB is down
function ensureDbForPages(req, res, next) {
  try {
    if (isDbHealthy()) return next();
    const msg = encodeURIComponent(getDbLastError() || 'データベースに接続できません');
    // Allow error page itself to be displayed
    if (req.path && req.path.startsWith('/error')) return next();
    return res.redirect(`/error?code=DB_DOWN&msg=${msg}`);
  } catch (e) {
    return res.redirect('/error?code=DB_DOWN');
  }
}

// For API routes: return JSON 503 in a standardized way
function ensureDbForApi(req, res, next) {
  try {
    if (isDbHealthy()) return next();
    return res.status(503).json({ error: 'データベースに接続できません', code: 'DB_DOWN', details: getDbLastError() || undefined });
  } catch (e) {
    return res.status(503).json({ error: 'データベースに接続できません', code: 'DB_DOWN' });
  }
}

module.exports = { ensureDbForPages, ensureDbForApi };
