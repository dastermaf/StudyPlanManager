function log(message, ...details) {
    console.log(`[Auth LOG] ${message}`, ...details);
}

export function logout() {
    log("ユーザーをログアウトし、ログインページにリダイレクトします。");
    sessionStorage.removeItem('accessToken');
    window.location.href = '/';
}

export function getToken() {
    return sessionStorage.getItem('accessToken');
}

export function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        log("JWTの解析中にエラーが発生しました:", e);
        return null;
    }
}

export function getUser() {
    const token = getToken();
    if (token) {
        const user = parseJwt(token);
        if (user && (user.exp * 1000 > Date.now())) {
            return user;
        }
    }
    return null;
}