import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

console.log("LOG: app.js модуль загружен.");

let progress = {};

async function initialize() {
    console.log("LOG: app.js: initialize() вызвана.");
    // ИСПРАВЛЕНИЕ: Передаем функцию onLogout, которая будет перенаправлять на главную
    auth.init(onLoginSuccess, onLogout);
    theme.init(saveSettings);

    const token = localStorage.getItem('accessToken');
    if (token) {
        console.log("LOG: app.js: Найден токен в localStorage.");
        const user = auth.parseJwt(token);
        if (user && (user.exp * 1000 > Date.now())) { // Проверяем, что токен не истек
            console.log("LOG: app.js: Токен валиден, пользователь:", user.username);
            onLoginSuccess(user.username);
        } else {
            console.log("LOG: app.js: Токен невалиден или истек.");
            onLogout(); // Выходим, если токен недействителен
        }
    } else {
        console.log("LOG: app.js: Токен в localStorage не найден.");
        // Если токена нет, а мы не на странице входа, перенаправляем
        if (window.location.pathname !== '/' && window.location.pathname !== '/layout/login.html') {
            onLogout();
        }
    }
}

async function onLoginSuccess(username) {
    console.log(`LOG: app.js: onLoginSuccess() вызвана для пользователя ${username}.`);
    // Проверяем, что мы на главной странице приложения перед тем как рендерить UI
    if (document.getElementById('main-container')) {
        ui.showMainContent(username);
        await loadUserProgress();
        if (progress.settings) {
            theme.applyTheme(progress.settings.theme || 'light');
        }
    }
}

function onLogout() {
    console.log("LOG: app.js: onLogout() вызвана. Очистка localStorage и перенаправление на /");
    localStorage.removeItem('accessToken');
    localStorage.removeItem('deviceId');
    progress = {};
    // ИСПРАВЛЕНИЕ: Перенаправляем на страницу входа
    window.location.href = '/';
}


async function loadUserProgress() {
    console.log("LOG: app.js: loadUserProgress() - Запрашиваем прогресс пользователя.");
    try {
        const data = await api.getProgress();
        progress = data || { settings: { theme: 'light' }, lectures: {} };
        if (!progress.settings) progress.settings = { theme: 'light' };
        if (!progress.lectures) progress.lectures = {};
        ui.renderUI(progress, handleLectureClick, handleNoteChange);
    } catch (error) {
        console.error('LOG: app.js: ОШИБКА при загрузке прогресса:', error);
        onLogout(); // Выходим, если не можем загрузить данные
    }
}

function handleLectureClick(courseId, lectureId, task) {
    const lecture = progress.lectures[courseId]?.[lectureId] || { vod: false, test: false, note: '' };
    lecture[task] = !lecture[task];

    if (!progress.lectures[courseId]) {
        progress.lectures[courseId] = {};
    }
    progress.lectures[courseId][lectureId] = lecture;

    ui.updateLectureState(courseId, lectureId, lecture);
    ui.updateCourseProgress(courseId, progress.lectures[courseId]);
    // Проверяем наличие элемента перед обновлением
    if (document.getElementById('progress-chart')) {
        ui.updateDashboard(progress.lectures);
    }
    saveProgress();
}

function handleNoteChange(courseId, lectureId, note) {
    if (!progress.lectures[courseId]) {
        progress.lectures[courseId] = {};
    }
    if (!progress.lectures[courseId][lectureId]) {
        progress.lectures[courseId][lectureId] = { vod: false, test: false, note: '' };
    }
    progress.lectures[courseId][lectureId].note = note;
    saveProgress();
}

function saveSettings(key, value) {
    if (!progress.settings) {
        progress.settings = {};
    }
    progress.settings[key] = value;
    saveProgress();
}

let saveTimeout;
function saveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await api.saveProgress(progress);
        } catch (error) {
            console.error('LOG: app.js: ОШИБКА при сохранении прогресса:', error);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initialize);