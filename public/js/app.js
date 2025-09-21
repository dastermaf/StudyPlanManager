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
    // Эта функция теперь просто загружает данные, обработка ошибок вынесена выше.
    const data = await api.getProgress();
    progress = data || { settings: { theme: 'light', currentWeekIndex: 0 }, lectures: {} };
    if (!progress.settings) progress.settings = { theme: 'light', currentWeekIndex: 0 };
    if (!progress.lectures) progress.lectures = {};
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
            // Здесь можно показать пользователю уведомление, что сохранить не удалось
        }
    }, 1000);
}

// --- ИЗМЕНЕНА ВСЯ ФУНКЦИЯ INITIALIZE ---
async function initialize() {
    try {
        // 1. Сначала проверяем, есть ли активная сессия
        const user = await api.getCurrentUser();
        if (!user) {
            // Если сессии нет, немедленно перенаправляем на страницу входа
            window.location.href = '/';
            return;
        }

        // 2. Если пользователь есть, загружаем его прогресс
        await loadUserProgress();

        // 3. Только после успешной загрузки всего, настраиваем и отрисовываем интерфейс
        document.getElementById('logout-button')?.addEventListener('click', auth.logout);
        theme.init(saveSettings);
        ui.initNavigation(handleWeekChange);

        ui.showMainContent(user.username);
        theme.applyTheme(progress.settings?.theme || 'light');
        currentWeekIndex = progress.settings?.currentWeekIndex || 0;
        ui.renderWeek(currentWeekIndex, progress.lectures);
        ui.updateOverallProgress(progress.lectures);

    } catch (e) {
        // Если на любом из этапов (проверка юзера, загрузка прогресса) произошла ошибка,
        // это значит, что сессия недействительна. Перенаправляем на страницу входа.
        console.error("初期化中に致命的なエラーが発生しました:", e);
        window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', initialize);