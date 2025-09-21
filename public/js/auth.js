import * as api from './api.js';

function log(message, ...details) {
    console.log(`[Auth LOG] ${message}`, ...details);
}

export async function logout() {
    log("ユーザーをログアウトし、ログインページにリダイレクトします。");
    try {
        await api.logout();
        window.location.href = '/';
    } catch (error) {
        console.error("ログアウトエラー:", error);
        // В случае ошибки просто перезагружаем страницу, чтобы выйти
        window.location.href = '/';
    }
}

// Поскольку токен теперь находится в httpOnly cookie, эти функции больше не могут использоваться на клиенте.
export function getToken() {
    log("getTokenは非推奨になりました。");
    return null;
}

export function parseJwt(token) {
    log("parseJwtは非推奨になりました。");
    return null;
}

export function getUser() {
    log("getUserは非推奨になりました。代わりにapi.getCurrentUserを使用してください。");
    return null;
}