import * as api from './api.js';
import * as theme from './theme.js';
import * as auth from './auth.js';

function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

function initialize() {
    if (auth.getUser()) {
        window.location.href = '/app';
        return;
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    theme.applyTheme(savedTheme);
    theme.init(() => {});

    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-form-container');
    const registerContainer = document.getElementById('register-form-container');

    showRegisterLink?.addEventListener('click', (e) => {
        e.preventDefault();
        loginContainer.classList.add('hidden');
        registerContainer.classList.remove('hidden');
    });

    showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        registerContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });

    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.elements.username.value;
        const password = e.target.elements.password.value;
        try {
            await api.register(username, password, getDeviceId());
            alert('登録が成功しました！ログインしてください。');
            e.target.reset();
            registerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        } catch (error) {
            alert(`登録エラー: ${error.message}`);
        }
    });

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.elements.username.value;
        const password = e.target.elements.password.value;
        try {
            const data = await api.login(username, password);
            sessionStorage.setItem('accessToken', data.accessToken);
            window.location.href = '/app';
        } catch (error) {
            alert(`ログインエラー: ${error.message}`);
        }
    });
}

document.addEventListener('DOMContentLoaded', initialize);