import * as api from './api.js';

export async function logout() {
    try {
        // Отправляем запрос на выход; сервер очистит cookie и сделает редирект
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
        // На случай, если сервер не выполнит редирект
        window.location.href = '/';
    } catch (error) {
        console.error("ログアウトエラー:", error);
        window.location.href = '/';
    }
}

// Возвращает текущего пользователя через API или выбрасывает ошибку, если не авторизован
export async function getUser() {
    return api.getCurrentUser();
}