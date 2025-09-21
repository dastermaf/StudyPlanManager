import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';
import { WEEKS_COUNT } from './studyPlan.js';

let progress = {};
let currentWeekIndex = 0;
let saveTimeout;

async function initialize() {
    auth.init(onLoginSuccess, onLogout);
    theme.init(saveSettings);
    ui.initModal();

    const token = localStorage.getItem('accessToken');
    if (token) {
        const user = auth.parseJwt(token);
        if (user && (user.exp * 1000 > Date.now())) {
            await onLoginSuccess(user.username);
        } else {
            onLogout();
        }
    } else {
        onLogout();
    }
    setupNavButtons();
}

async function onLoginSuccess(username) {
    ui.showMainContent(username);
    await loadUserProgress();
    theme.applyTheme(progress.settings?.theme || 'light');
    currentWeekIndex = progress.settings?.currentWeekIndex || 0;
    ui.renderWeek(currentWeekIndex, progress.lectures, handleLectureClick, handleNoteChange);
    updateNavButtons();
}

function onLogout() {
    if (window.location.pathname.startsWith('/app')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('deviceId');
        window.location.href = '/';
    }
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
    if (!progress.lectures[subjectId]) {
        progress.lectures[subjectId] = {};
    }
    if (!progress.lectures[subjectId][lectureId]) {
        progress.lectures[subjectId][lectureId] = { vod: false, test: false, note: '' };
    }
    const lecture = progress.lectures[subjectId][lectureId];
    lecture[task] = !lecture[task];

    saveProgress();
    ui.updateProgress(currentWeekIndex, progress.lectures);
}

function handleNoteChange(subjectId, lectureId, note) {
    if (!progress.lectures[subjectId]) {
        progress.lectures[subjectId] = {};
    }
    if (!progress.lectures[subjectId][lectureId]) {
        progress.lectures[subjectId][lectureId] = { vod: false, test: false, note: '' };
    }
    progress.lectures[subjectId][lectureId].note = note;
    saveProgress();
}

function saveSettings(key, value) {
    if (!progress.settings) {
        progress.settings = {};
    }
    progress.settings[key] = value;
    saveProgress();
}

function saveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await api.saveProgress(progress);
            console.log("Прогресс сохранен.");
        } catch (error) {
            console.error('Ошибка при сохранении прогресса:', error);
        }
    }, 1000);
}

function setupNavButtons() {
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            if (currentWeekIndex > 0) {
                currentWeekIndex--;
                progress.settings.currentWeekIndex = currentWeekIndex;
                saveProgress();
                ui.renderWeek(currentWeekIndex, progress.lectures, handleLectureClick, handleNoteChange);
                updateNavButtons();
            }
        });
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            if (currentWeekIndex < WEEKS_COUNT) {
                currentWeekIndex++;
                progress.settings.currentWeekIndex = currentWeekIndex;
                saveProgress();
                ui.renderWeek(currentWeekIndex, progress.lectures, handleLectureClick, handleNoteChange);
                updateNavButtons();
            }
        });
    }
}

function updateNavButtons() {
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    if(prevWeekBtn) prevWeekBtn.disabled = currentWeekIndex === 0;
    if(nextWeekBtn) nextWeekBtn.disabled = currentWeekIndex >= WEEKS_COUNT;
}


document.addEventListener('DOMContentLoaded', initialize);