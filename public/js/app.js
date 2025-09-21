import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

console.log("LOG: app.js модуль загружен.");

let progress = {};

async function initialize() {
    console.log("LOG: app.js: initialize() вызвана.");
    auth.init(onLoginSuccess, onLogout);
    theme.init(saveSettings);

    const token = localStorage.getItem('accessToken');
    if (token) {
        console.log("LOG: app.js: Найден токен в localStorage.");
        const user = auth.parseJwt(token);
        if (user) {
            console.log("LOG: app.js: Токен успешно расшифрован, пользователь:", user.username);
            onLoginSuccess(user.username);
        } else {
            console.log("LOG: app.js: Не удалось расшифровать токен.");
            onLogout();
        }
    } else {
        console.log("LOG: app.js: Токен в localStorage не найден.");
        onLogout();
    }
}

async function onLoginSuccess(username) {
    console.log(`LOG: app.js: onLoginSuccess() вызвана для пользователя ${username}.`);
    ui.showMainContent(username);
    await loadUserProgress();
    theme.applyTheme(progress.settings?.theme || 'light');
}

function onLogout() {
    console.log("LOG: app.js: onLogout() вызвана.");
    localStorage.removeItem('accessToken');
    localStorage.removeItem('deviceId');
    progress = {};
    ui.showAuthContent();
}

async function loadUserProgress() {
    console.log("LOG: app.js: loadUserProgress() - Запрашиваем прогресс пользователя.");
    try {
        const data = await api.getProgress();
        console.log("LOG: app.js: Получены данные о прогрессе с сервера:", data);
        progress = data || { settings: { theme: 'light' }, lectures: {} };
        if (!progress.settings) progress.settings = { theme: 'light' };
        if (!progress.lectures) progress.lectures = {};
        console.log("LOG: app.js: Прогресс готов к отрисовке:", progress);
        ui.renderUI(progress, handleLectureClick, handleNoteChange);
    } catch (error) {
        console.error('LOG: app.js: ОШИБКА при загрузке прогресса:', error);
        auth.logout();
    }
}

function handleLectureClick(courseId, lectureId, task) {
    console.log(`LOG: app.js: handleLectureClick() - курс: ${courseId}, лекция: ${lectureId}, задача: ${task}`);
    const lecture = progress.lectures[courseId]?.[lectureId] || { vod: false, test: false, note: '' };
    lecture[task] = !lecture[task];

    if (!progress.lectures[courseId]) {
        progress.lectures[courseId] = {};
    }
    progress.lectures[courseId][lectureId] = lecture;

    ui.updateLectureState(courseId, lectureId, lecture);
    ui.updateCourseProgress(courseId, progress.lectures[courseId]);
    ui.updateDashboard(progress.lectures);
    saveProgress();
}

function handleNoteChange(courseId, lectureId, note) {
    console.log(`LOG: app.js: handleNoteChange() - курс: ${courseId}, лекция: ${lectureId}`);
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
    console.log(`LOG: app.js: saveSettings() - ключ: ${key}, значение: ${value}`);
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
        console.log("LOG: app.js: saveProgress() - Отправляем обновленный прогресс на сервер.");
        try {
            await api.saveProgress(progress);
            console.log("LOG: app.js: Прогресс успешно сохранен на сервере.");
        } catch (error) {
            console.error('LOG: app.js: ОШИБКА при сохранении прогресса:', error);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initialize);

