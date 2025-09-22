const API_URL = '';

async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const config = {
        ...options,
        headers,
        credentials: 'include'
    };

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, config);
    } catch (e) {
        const msg = encodeURIComponent(String(e && e.message || 'ネットワークエラー'));
        window.location.href = `/error?code=GENERIC&msg=${msg}`;
        throw e;
    }

    if (!response.ok) {
        let payload = {};
        try { payload = await response.json(); } catch {}
        const msg = encodeURIComponent(payload.error || payload.message || `HTTPエラー！ステータス: ${response.status}`);
        if (response.status === 401 || response.status === 403) {
            window.location.href = `/error?code=UNAUTHORIZED&msg=${msg}`;
            throw new Error('UNAUTHORIZED');
        }
        if (response.status === 503 || payload.code === 'DB_DOWN') {
            window.location.href = `/error?code=DB_DOWN&msg=${msg}`;
            throw new Error('DB_DOWN');
        }
        window.location.href = `/error?code=GENERIC&msg=${msg}`;
        throw new Error(payload.error || `HTTPエラー！ステータス: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    const notice = (response.headers.get('x-notice') || response.headers.get('X-Notice'));
    if (notice === 'DATA_INITIALIZED') {
        // Inform user that default data was auto-created
        window.location.href = '/error?code=DATA_INITIALIZED';
    }
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }
    return null;
}

export function register(username, password, deviceId) {
    return request('/api/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, deviceId }),
    });
}

export function login(username, password) {
    return request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export function logout() {
    return request('/api/logout', { method: 'POST' });
}

export function getCurrentUser() {
    return request('/api/user');
}

export function getProgress() {
    return request('/api/progress');
}

export function saveProgress(progress) {
    return request('/api/progress', {
        method: 'POST',
        body: JSON.stringify(progress),
    });
}