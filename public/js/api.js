const API_URL = '';

async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/';
        }
        const errorData = await response.json().catch(() => ({ error: 'エラー応答の読み取りに失敗しました' }));
        throw new Error(errorData.error || `HTTPエラー！ステータス: ${response.status}`);
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