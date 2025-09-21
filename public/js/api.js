const API_URL = '';

console.log("LOG: api.js модуль загружен.");

async function request(endpoint, options = {}) {
    console.log(`LOG: api.js: Отправка запроса на ${endpoint}`, options.body ? `с телом: ${options.body}` : '');
    // ИЗМЕНЕНИЕ: Используем sessionStorage
    const token = sessionStorage.getItem('accessToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        console.log(`LOG: api.js: Получен ответ от ${endpoint} со статусом ${response.status}`);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.warn("LOG: api.js: Токен недействителен или отсутствует. Выполняется выход.");
                window.dispatchEvent(new CustomEvent('logout'));
            }
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
        throw error; // Передаем ошибку дальше
    }
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