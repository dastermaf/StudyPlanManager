// Client-side logger: forwards logs to server and suppresses browser console noise
// Only critical() will print to the user's console; others go to server only.

(function(){
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const endpoint = '/api/log';
  const ua = navigator.userAgent;

  function nowIso(){ return new Date().toISOString(); }

  function payload(level, message, args){
    return {
      level,
      message: toStringSafe(message),
      args: (args || []).map(toStringSafe).slice(0, 10),
      page: location.pathname + location.search,
      ts: nowIso(),
      ua,
    };
  }

  function toStringSafe(x){
    try {
      if (x === undefined) return 'undefined';
      if (x === null) return 'null';
      if (typeof x === 'string') return x;
      if (typeof x === 'number' || typeof x === 'boolean') return String(x);
      if (x instanceof Error) return `${x.name}: ${x.message}\n${x.stack || ''}`;
      return JSON.stringify(x);
    } catch (e) {
      return '[unserializable]';
    }
  }

  function send(level, message, args){
    const data = payload(level, message, args);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // fire and forget
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true,
          credentials: 'include'
        }).catch(()=>{});
      }
    } catch(_e){ /* ignore */ }
  }

  // Public API
  const Logger = {
    debug: (msg, ...args) => send('debug', msg, args),
    info: (msg, ...args) => send('info', msg, args),
    warn: (msg, ...args) => send('warn', msg, args),
    error: (msg, ...args) => send('error', msg, args),
    // Critical: also shows in user console (rare)
    critical: (msg, ...args) => {
      send('error', msg, args);
      try { original.error('[重要]', msg, ...args); } catch {}
    }
  };

  // Override console methods to forward and suppress output in browser
  console.log = (msg, ...args) => { send('info', msg, args); };
  console.info = (msg, ...args) => { send('info', msg, args); };
  console.warn = (msg, ...args) => { send('warn', msg, args); };
  console.error = (msg, ...args) => { send('error', msg, args); };

  // Helper: ignore known noisy extension errors
  function isIgnorableErrorText(text){
    if (!text) return false;
    const s = String(text);
    return s.includes('Could not establish connection. Receiving end does not exist');
  }

  // Capture uncaught errors and unhandled promise rejections (and prevent default console output)
  window.addEventListener('error', (event) => {
    try {
      const err = event.error || event.message;
      const txt = typeof err === 'string' ? err : (err && (err.message || err.toString())) || '';
      if (!isIgnorableErrorText(txt)) {
        send('error', 'uncaught_error', [err]);
      }
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
    } catch {}
  });
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const txt = typeof reason === 'string' ? reason : (reason && (reason.message || reason.toString())) || '';
      if (!isIgnorableErrorText(txt)) {
        send('error', 'unhandled_rejection', [reason]);
      }
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
    } catch {}
  });

  // Expose
  window.Logger = Logger;
})();
