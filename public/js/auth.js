import * as api from './api.js';

let onLoginCallback;
let onLogoutCallback;

function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

export function init(onLogin, onLogout) {
    onLoginCallback = onLogin;
    onLogoutCallback = onLogout;

    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');

    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-form-container');
    const registerContainer = document.getElementById('register-form-container');

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginContainer.classList.add('hidden');
        registerContainer.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        const deviceId = getDeviceId();

        try {
            await api.register(username, password, deviceId);
            alert('登録が成功しました！ログインしてください。');
            e.target.reset();
            registerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        } catch (error) {
            alert(`登録エラー: ${error.message}`);
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        try {
            const data = await api.login(username, password);
            localStorage.setItem('accessToken', data.accessToken);
            onLoginCallback(username);
        } catch (error) {
            alert(`ログインエラー: ${error.message}`);
        }
    });

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    window.addEventListener('logout', () => {
        logout();
    });
}

export function logout() {
    onLogoutCallback();
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
        return null;
    }
}

