import * as api from './api.js';
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as theme from './theme.js';
import { fadeInPage } from './utils.js';

async function initialize() {
    // 変更: ページコンテナを即座に表示
    const container = document.getElementById('page-container');
    if (container) {
        container.style.opacity = '1';
    }

    try {
        const user = await api.getCurrentUser();
        if (!user) {
            window.location.href = '/';
            return;
        }

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

        fadeInPage();

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
    }
}

document.addEventListener('DOMContentLoaded', initialize);