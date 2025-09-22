// Simple structured logger for server-side
// Outputs line-delimited JSON with consistent fields

const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const levelNames = Object.keys(levels);

const envLevel = process.env.LOG_LEVEL || 'info';
const minLevel = levels[envLevel] ?? levels.info;

function timeISO() {
  return new Date().toISOString();
}

function serialize(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    // Fallback if circular
    return JSON.stringify({ error: 'log_serialize_failed', message: String(e) });
  }
}

function baseRecord(level, msg, extra) {
  const rec = {
    t: timeISO(),
    level,
    msg: typeof msg === 'string' ? msg : String(msg),
    ...extra,
  };
  return rec;
}

function print(level, msg, extra) {
  if ((levels[level] ?? 100) < minLevel) return;
  const rec = baseRecord(level, msg, extra);
  const line = serialize(rec);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function fromRequest(req) {
  const ua = req.get && req.get('user-agent');
  const ip = (req.ip || req.connection?.remoteAddress || '').toString();
  return { ip, ua };
}

module.exports = {
  debug: (msg, extra = {}) => print('debug', msg, extra),
  info: (msg, extra = {}) => print('info', msg, extra),
  warn: (msg, extra = {}) => print('warn', msg, extra),
  error: (msg, extra = {}) => print('error', msg, extra),
  fromRequest,
  level: envLevel,
};