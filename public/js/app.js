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

async function loadUserProgress() {
    try {
        const data = await api.getProgress();
        progress = data || { settings: { theme: 'light', currentWeekIndex: 0 }, lectures: {} };
        if (!progress.settings) progress.settings = { theme: 'light', currentWeekIndex: 0 };
        if (!progress.lectures) progress.lectures = {};
    } catch (error) {
        console.error('進捗の読み込み中にエラーが発生しました:', error);
        // Если загрузка прогресса не удалась, выходим из системы
        auth.logout();
    }
}

function saveSettings(key, value) {
    if (!progress.settings) progress.settings = {};
    progress.settings[key] = value;
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
    let user;
    try {
        // Запрашиваем информацию о текущем пользователе с сервера
        user = await api.getCurrentUser();
    } catch (e) {
        // Если не удалось получить пользователя (например, невалидный cookie), перенаправляем на страницу входа
        console.error("ユーザー情報の取得に失敗しました:", e);
        window.location.href = '/';
        return;
    }

    if (!user) {
        // Если пользователь не определен, перенаправляем на страницу входа
        window.location.href = '/';
        return;
    }

    document.getElementById('logout-button')?.addEventListener('click', auth.logout);
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