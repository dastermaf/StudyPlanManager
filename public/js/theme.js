import { state } from './app.js';
import { debouncedSave } from './app.js';

const themeToggle = document.getElementById('theme-toggle');
const themeIconLight = document.getElementById('theme-icon-light');
const themeIconDark = document.getElementById('theme-icon-dark');

export function initTheme() {
    themeToggle.addEventListener('click', toggleTheme);
    // Применяем тему при загрузке, если она уже есть в данных
    const initialTheme = (state.progressData.settings && state.progressData.settings.theme) || 'light';
    applyTheme(initialTheme);
}

function toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);

    // Сохраняем выбор темы в состоянии и отправляем на сервер
    if (!state.progressData.settings) {
        state.progressData.settings = {};
    }
    state.progressData.settings.theme = newTheme;
    debouncedSave();
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIconLight.classList.toggle('hidden', theme === 'dark');
    themeIconDark.classList.toggle('hidden', theme === 'light');
    // Обновляем графики, если они уже отрисованы
    if (state.isDataLoaded && document.getElementById('dashboard-view').classList.contains('hidden') === false) {
        // Небольшая задержка, чтобы DOM успел обновиться
        setTimeout(() => {
            const uiModule = import('./ui.js');
            uiModule.then(ui => ui.renderDashboard());
        }, 50);
    }
}
