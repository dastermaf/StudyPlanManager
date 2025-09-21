import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

let progress = {};
let currentWeekIndex = 0;
let saveTimeout;

function handleWeekChange(direction) {
    const newIndex = currentWeekIndex + direction;
    if (newIndex >= 0 && newIndex <= ui.WEEKS_COUNT) {
        currentWeekIndex = newIndex;
        if(progress.settings) progress.settings.currentWeekIndex = currentWeekIndex;
        saveProgress();
        ui.renderWeek(currentWeekIndex, progress.lectures);
    }
}

function onLogout() {
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('deviceId');
    window.location.href = '/'; // Перенаправляем на страницу входа
}

async function loadUserProgress() {
    try {
        const data = await api.getProgress();
        progress = data || { settings: { theme: 'light', currentWeekIndex: 0 }, lectures: {} };
        if (!progress.settings) progress.settings = { theme: 'light', currentWeekIndex: 0 };
        if (!progress.lectures) progress.lectures = {};
    } catch (error) {
        console.error('進捗の読み込み中にエラーが発生しました:', error);
        onLogout();
    }
}

function saveSettings(key, value) {
    if (!progress.settings) progress.settings = {};
    progress.settings[key] = value;
    // Сохраняем тему в localStorage для страницы входа
    if (key === 'theme') {
        localStorage.setItem('theme', value);
    }
    saveProgress();
}

function saveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await api.saveProgress(progress);
        } catch (error) {
            console.error('進捗の保存中にエラーが発生しました:', error);
        }
    }, 1000);
}

async function initialize() {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        onLogout(); // Если токена нет, отправляем на логин
        return;
    }

    const user = auth.parseJwt(token);
    if (!user || (user.exp * 1000 < Date.now())) {
        onLogout(); // Если токен невалиден, отправляем на логин
        return;
    }

    // Если все в порядке, продолжаем инициализацию
    auth.init(null, onLogout); // onLoginSuccess здесь не нужен
    theme.init(saveSettings);
    ui.initNavigation(handleWeekChange);

    ui.showMainContent(user.username);
    await loadUserProgress();
    theme.applyTheme(progress.settings?.theme || 'light');
    currentWeekIndex = progress.settings?.currentWeekIndex || 0;
    ui.renderWeek(currentWeekIndex, progress.lectures);
    ui.updateOverallProgress(progress.lectures);
}

document.addEventListener('DOMContentLoaded', initialize);