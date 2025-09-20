import { state, loadInitialData } from './app.js';
import { initializeCrypto } from './crypto-utils.js';
import { loginUser, registerUser } from './api.js';
import { renderWeek } from './ui.js';

const authContainer = document.getElementById('auth-container');
const plannerApp = document.getElementById('planner-app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const welcomeUser = document.getElementById('welcome-user');

export function initAuth() {
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutBtn.addEventListener('click', logout);
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms(false); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleForms(true); });
}

async function handleLogin(e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    const username = e.target.elements['login-username'].value;
    const password = e.target.elements['login-password'].value;

    try {
        const data = await loginUser(username, password);
        state.userToken = data.accessToken;
        localStorage.setItem('accessToken', state.userToken);

        await initializeCrypto(password); // Инициализируем ключ шифрования

        await loadInitialData();
        welcomeUser.textContent = `ようこそ、${username}さん`;
        showPlanner();
        renderWeek(state.currentWeekIndex);
    } catch (error) {
        loginError.textContent = error.message || 'Неверные данные для входа.';
        loginError.classList.remove('hidden');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    registerError.classList.add('hidden');
    try {
        await registerUser(
            e.target.elements['register-username'].value,
            e.target.elements['register-password'].value,
            getOrSetDeviceId()
        );
        toggleForms(true);
        alert('Регистрация успешна! Теперь вы можете войти.');
    } catch (error) {
        registerError.textContent = error.message || 'Ошибка регистрации.';
        registerError.classList.remove('hidden');
    }
}

export function logout() {
    state.userToken = null;
    state.progressData = {};
    state.currentWeekIndex = 0;
    state.isDataLoaded = false;
    state.encryptionKey = null;
    localStorage.removeItem('accessToken');
    showAuth();
}

export function showPlanner() {
    authContainer.classList.add('hidden');
    plannerApp.classList.remove('hidden');
}

export function showAuth() {
    authContainer.classList.remove('hidden');
    plannerApp.classList.add('hidden');
    toggleForms(true);
}

function toggleForms(showLogin) {
    loginForm.classList.toggle('hidden', !showLogin);
    registerForm.classList.toggle('hidden', showLogin);
}

function getOrSetDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}
