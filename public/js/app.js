import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

// modal.js больше не импортируется

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

// handleModalUpdate больше не нужен

async function initialize() {
    auth.init(onLoginSuccess, onLogout);
    theme.init(saveSettings);
    ui.initNavigation(handleWeekChange);
    // modal.init больше не вызывается

    const token = localStorage.getItem('accessToken');
    if (token) {
        const user = auth.parseJwt(token);
        if (user && (user.exp * 1000 > Date.now())) {
            await onLoginSuccess(user.username);
        } else {
            onLogout();
        }
    } else {
        if (window.location.pathname.startsWith('/app')) {
            onLogout();
        }
    }
}

async function onLoginSuccess(username) {
    ui.showMainContent(username);
    await loadUserProgress();
    theme.applyTheme(progress.settings?.theme || 'light');
    currentWeekIndex = progress.settings?.currentWeekIndex || 0;
    ui.renderWeek(currentWeekIndex, progress.lectures);
    ui.updateOverallProgress(progress.lectures);
}

function onLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('deviceId');
    window.location.href = '/';
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

// Функции handleLectureClick и handleNoteChange больше не нужны в этом файле,
// так как прогресс теперь отмечается на странице материалов.
// Но мы оставим их на случай, если Вы захотите добавить чекбоксы прямо в главный экран.

function saveSettings(key, value) {
    if (!progress.settings) progress.settings = {};
    progress.settings[key] = value;
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

document.addEventListener('DOMContentLoaded', initialize);