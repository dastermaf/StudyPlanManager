const API_URL = '';

console.log("LOG: api.js модуль загружен.");

async function request(endpoint, options = {}) {
    console.log(`LOG: api.js: Отправка запроса на ${endpoint}`, options.body ? `с телом: ${options.body}` : '');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Cookie теперь отправляются браузером автоматически, поэтому заголовок Authorization больше не нужен

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        console.log(`LOG: api.js: Получен ответ от ${endpoint} со статусом ${response.status}`);

        if (response.redirected) {
            window.location.href = response.url;
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Не удалось прочитать тело ошибки' }));
            console.error(`LOG: api.js: Ошибка ответа сервера для ${endpoint}:`, errorData);
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            console.log(`LOG: api.js: Ответ JSON от ${endpoint}:`, data);
            return data;
        }
        console.log(`LOG: api.js: Ответ от ${endpoint} не содержит JSON.`);
        return null;
    } catch (error) {
        console.error(`LOG: api.js: Сетевая ошибка или сбой при запросе к ${endpoint}:`, error);
        throw error;
    }
}

export function register(username, password, deviceId) {
    return request('/api/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, deviceId }),
    });
}

// Эта функция больше не используется для входа в систему, но может быть полезна для других целей
export function login(username, password) {
    return request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export function logout() {
    return request('/api/logout', {
        method: 'POST',
    });
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