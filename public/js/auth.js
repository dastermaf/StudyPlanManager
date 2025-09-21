import * as api from './api.js';

export async function logout() {
    try {
        await api.logout();
        window.location.href = '/';
    } catch (error) {
        console.error("ログアウトエラー:", error);
        window.location.href = '/';
    }
}

export function getToken() { return null; }
export function parseJwt(token) { return null; }
export function getUser() { return null; }