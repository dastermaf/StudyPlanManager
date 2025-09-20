const API_URL = '';

async function request(endpoint, options = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            window.dispatchEvent(new CustomEvent('logout'));
        }
        const errorData = await response.json().catch(() => ({ error: '不明なエラー' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
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

export function getProgress() {
    return request('/api/progress');
}

export function saveProgress(progress) {
    return request('/api/progress', {
        method: 'POST',
        body: JSON.stringify(progress),
    });
}

