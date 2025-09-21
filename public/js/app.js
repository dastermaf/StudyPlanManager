import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

let progress = {};
let currentWeekIndex = 0;
let saveTimeout;

// Функция обратного вызова для смены недели
function handleWeekChange(direction) {
    const newIndex = currentWeekIndex + direction;
    if (newIndex >= 0 && newIndex <= ui.WEEKS_COUNT) {
        currentWeekIndex = newIndex;
        progress.settings.currentWeekIndex = currentWeekIndex;
        saveProgress();
        ui.renderWeek(currentWeekIndex, progress.lectures, handleLectureClick, handleNoteChange);
    }
}

async function initialize() {
    auth.init(onLoginSuccess, onLogout);
    theme.init(saveSettings);
    ui.initModal();
    ui.initNavigation(handleWeekChange); // Инициализируем навигацию

    const token = localStorage.getItem('accessToken');
    if (token) {
        const user = auth.parseJwt(token);
        if (user && (user.exp * 1000 > Date.now())) {
            await onLoginSuccess(user.username);
        } else {
            onLogout();
        }
    } else {
        // Если не на странице входа, но токена нет - разлогиниваем
        if (!window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('login.html')) {
            onLogout();
        }
    }
}

async function onLoginSuccess(username) {
    ui.showMainContent(username);
    await loadUserProgress();
    theme.applyTheme(progress.settings?.theme || 'light');
    currentWeekIndex = progress.settings?.currentWeekIndex || 0;
    ui.renderWeek(currentWeekIndex, progress.lectures, handleLectureClick, handleNoteChange);
    ui.updateOverallProgress(progress.lectures); // Обновляем общий прогресс
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
        console.error('Ошибка при загрузке прогресса:', error);
        onLogout();
    }
}

function handleLectureClick(subjectId, lectureId, task) {
    if (!progress.lectures[subjectId]) progress.lectures[subjectId] = {};
    if (!progress.lectures[subjectId][lectureId]) {
        progress.lectures[subjectId][lectureId] = { vod: false, test: false, note: '' };
    }
    const lecture = progress.lectures[subjectId][lectureId];
    lecture[task] = !lecture[task];

    saveProgress();
    ui.updateWeeklyProgress(currentWeekIndex, progress.lectures);
    ui.updateOverallProgress(progress.lectures); // Обновляем общий прогресс
}

function handleNoteChange(subjectId, lectureId, note) {
    if (!progress.lectures[subjectId]) progress.lectures[subjectId] = {};
    if (!progress.lectures[subjectId][lectureId]) {
        progress.lectures[subjectId][lectureId] = { vod: false, test: false, note: '' };
    }
    progress.lectures[subjectId][lectureId].note = note;
    saveProgress();
}

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
            console.error('Ошибка при сохранении прогресса:', error);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initialize);