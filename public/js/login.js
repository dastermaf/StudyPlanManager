import * as api from './api.js';
import * as theme from './theme.js'; // Мы можем управлять темой даже на странице входа

// --- Вспомогательные функции ---
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// --- Основная логика ---
function initialize() {
    // Применяем сохраненную тему, если она есть
    // Мы не можем получить ее из progress, поэтому ищем в localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    theme.applyTheme(savedTheme);
    // Инициализируем переключатель, но без сохранения (он тут не нужен)
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

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.elements.username.value;
        const password = e.target.elements.password.value;
        try {
            const data = await api.login(username, password);
            sessionStorage.setItem('accessToken', data.accessToken);
            window.location.href = '/app'; // Перенаправляем на главную страницу
        } catch (error) {
            alert(`ログインエラー: ${error.message}`);
        }
    });

    // Проверяем, не залогинен ли пользователь уже
    const token = sessionStorage.getItem('accessToken');
    if (token) {
        // Если да, сразу отправляем на главную
        window.location.href = '/app';
    }
}

document.addEventListener('DOMContentLoaded', initialize);