import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';

let progress = {};

async function initialize() {
    auth.init(onLoginSuccess, onLogout);
    theme.init(saveSettings);

    const token = localStorage.getItem('accessToken');
    if (token) {
        const user = auth.parseJwt(token);
        if (user) {
            onLoginSuccess(user.username);
        } else {
            onLogout();
        }
    } else {
        onLogout();
    }
}

async function onLoginSuccess(username) {
    ui.showMainContent(username);
    await loadUserProgress();
    theme.applyTheme(progress.settings.theme || 'light');
}

function onLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('deviceId');
    progress = {};
    ui.showAuthContent();
}

async function loadUserProgress() {
    try {
        const data = await api.getProgress();
        progress = data || { settings: { theme: 'light' }, lectures: {} };
        if (!progress.settings) progress.settings = { theme: 'light' };
        if (!progress.lectures) progress.lectures = {};
        ui.renderUI(progress, handleLectureClick, handleNoteChange);
    } catch (error) {
        console.error('進捗の読み込みに失敗しました:', error);
        auth.logout();
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
    ui.updateDashboard(progress.lectures);
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
            console.log("進捗が正常に保存されました。");
        } catch (error) {
            console.error('進捗の保存に失敗しました:', error);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initialize);

