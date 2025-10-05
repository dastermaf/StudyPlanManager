import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';
import { fadeInPage } from './utils.js'; // fadeOutPageのインポートを削除

async function initialize() {
    try {
        const user = await api.getCurrentUser();
        if (!user) {
            window.location.href = '/';
            return;
        }

        document.getElementById('main-container')?.classList.remove('hidden');

        const progress = await api.getProgress() || { settings: { theme: 'light', currentWeekIndex: 0 }, lectures: {} };
        if (!progress.settings) progress.settings = { theme: 'light', currentWeekIndex: 0 };
        if (!progress.lectures) progress.lectures = {};

        let currentWeekIndex = progress.settings?.currentWeekIndex || 0;
        let saveTimeout;

        function saveProgress() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                try {
                    await api.saveProgress(progress);
                } catch (error) {
                    console.error('Ошибка сохранения прогресса:', error);
                }
            }, 1000);
        }

        function saveSettings(key, value) {
            if (!progress.settings) progress.settings = {};
            progress.settings[key] = value;
            if (key === 'theme') {
                localStorage.setItem('theme', value);
            }
            saveProgress();
        }

        function handleWeekChange(direction) {
            const newIndex = currentWeekIndex + direction;
            if (newIndex >= 0 && newIndex <= ui.WEEKS_COUNT) {
                currentWeekIndex = newIndex;
                if(progress.settings) progress.settings.currentWeekIndex = currentWeekIndex;
                saveProgress();
                ui.renderWeek(currentWeekIndex, progress.lectures);
            }
        }

        // --- 変更: 不安定なクリックハンドラを完全に削除 ---
        fadeInPage(); // Появление страницы при загрузке

        document.getElementById('logout-button')?.addEventListener('click', auth.logout);
        theme.init(saveSettings);
        ui.initNavigation(handleWeekChange);

        ui.configureProgress(progress, saveProgress);
        ui.showMainContent(user.username);
        theme.applyTheme(progress.settings?.theme || 'light');
        ui.renderWeek(currentWeekIndex, progress.lectures);
        ui.updateOverallProgress(progress.lectures);

    } catch (e) {
        console.error("Критическая ошибка инициализации:", e);
        // window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', initialize);