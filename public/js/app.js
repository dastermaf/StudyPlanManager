import { initAuth, showAuth, showPlanner, logout } from './auth.js';
import { initUI, renderWeek, updateNavButtons } from './ui.js';
import { loadProgress, saveProgress } from './api.js';
import { applyTheme, initTheme } from './theme.js';
import { initializeCrypto, encryptData, decryptData } from './crypto-utils.js';

// --- Глобальное состояние приложения ---
export const state = {
    currentWeekIndex: 0,
    progressData: {},
    userToken: null,
    charts: {},
    isDataLoaded: false,
    encryptionKey: null
};

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initUI();
    initTheme();
    initializeApp();
});

async function initializeApp() {
    state.userToken = localStorage.getItem('accessToken');
    if (state.userToken) {
        // Если есть токен, сразу показываем планировщик, пока грузятся данные
        const decodedToken = JSON.parse(atob(state.userToken.split('.')[1]));
        document.getElementById('welcome-user').textContent = `ようこそ、${decodedToken.username}さん`;
        showPlanner();
        await loadInitialData();
        renderWeek(state.currentWeekIndex);
    } else {
        showAuth();
    }
}

export async function loadInitialData() {
    if (!state.userToken) return;
    try {
        const encryptedData = await loadProgress();
        if (encryptedData && encryptedData.encrypted) {
            progressData = await decryptData(encryptedData.encrypted);
            // Применяем сохраненную тему
            if (progressData.settings && progressData.settings.theme) {
                applyTheme(progressData.settings.theme);
            }
        } else {
            // Инициализация для нового пользователя
            progressData = { settings: { theme: 'light' }, lectures: {} };
        }
        state.progressData = progressData;
        state.isDataLoaded = true;
    } catch (error) {
        console.error("Failed to load or decrypt data:", error);
        // Если расшифровка не удалась (например, из-за смены пароля), выходим
        logout();
    }
}

let saveTimeout;
export function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        if (!state.userToken || !state.isDataLoaded) return;
        try {
            const encryptedString = await encryptData(state.progressData);
            await saveProgress({ encrypted: encryptedString });
        } catch (error) {
            console.error("Failed to encrypt or save data:", error);
        }
    }, 1500);
}
