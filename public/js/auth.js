import * as api from './api.js';

export async function logout() {
    try {
        // Просто отправляем запрос, сервер сам сделает перенаправление
        await fetch('/api/logout', { method: 'POST' });
        // На всякий случай, если сервер не ответит, перенаправляем вручную
        window.location.href = '/';
    } catch (error) {
        console.error("ログアウトエラー:", error);
        window.location.href = '/';
    }
}

export function getToken() { return null; }
export function parseJwt(token) { return null; }
export function getUser() { return null; }