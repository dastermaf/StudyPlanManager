const API_URL = '';

async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
    // Добавляем эту опцию, чтобы браузер принудительно отправлял cookie
    // с каждым запросом к API. Это решит проблему с аутентификацией.
    const config = {
        ...options,
        headers,
        credentials: 'include' // <--- ДОБАВИТЬ ЭТУ СТРОКУ
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Если сервер вернул ошибку авторизации, перенаправляем на главную
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