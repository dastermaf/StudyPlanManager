import { SUBJECTS } from './studyPlan.js';
import * as api from './api.js';
import * as theme from './theme.js';

let SCRIPT_URL = null;
let progress = {};
let chapterProgress = {}; // Локальный объект для удобства
let subjectId, chapterNo; // ID текущей главы
let saveTimeout;

function log(message, ...details) { /* ... */ }
async function fetchConfig() { /* ... */ }

// --- Рендеринг контента ---
function renderContent(container, data) {
    container.innerHTML = '';
    // ... (старый код рендеринга без изменений)
}

function renderError(container, message) { /* ... */ }

// --- Функции для работы с прогрессом и задачами ---
function saveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await api.saveProgress(progress);
            log("進捗がサーバーに保存されました。");
        } catch (error) {
            console.error('進捗の保存中にエラーが発生しました:', error);
        }
    }, 1000);
}

function renderTasks() {
    const todoList = document.getElementById('todo-list');
    if (!todoList) return;
    todoList.innerHTML = '';
    if (!chapterProgress.tasks || chapterProgress.tasks.length === 0) {
        todoList.innerHTML = `<p class="text-xs text-gray-400">タスクはありません。</p>`;
        return;
    }
    chapterProgress.tasks.forEach((task, index) => {
        const taskEl = document.createElement('div');
        taskEl.className = 'flex items-center bg-gray-50 dark:bg-gray-700 p-2 rounded';
        taskEl.innerHTML = `
            <input type="checkbox" data-task-index="${index}" class="h-4 w-4" ${task.completed ? 'checked' : ''}>
            <span class="ml-2 text-sm flex-grow ${task.completed ? 'line-through text-gray-500' : 'dark:text-gray-200'}">${task.text}</span>
            <button data-task-index="${index}" class="text-red-500 hover:text-red-700 text-xs">削除</button>
        `;
        todoList.appendChild(taskEl);
    });
}

function setupProgressTracker() {
    // ... (инициализация chapterProgress)

    // --- Обработчики событий ---
    document.getElementById('task-vod').addEventListener('change', (e) => {
        chapterProgress.vod.checked = e.target.checked;
        chapterProgress.vod.timestamp = e.target.checked ? new Date().toISOString() : null;
        saveProgress();
    });
    // ... (аналогично для task-test и note-textarea)

    // --- Логика To-Do листа ---
    document.getElementById('add-task-btn').addEventListener('click', () => {
        const input = document.getElementById('new-task-input');
        if (input.value.trim()) {
            chapterProgress.tasks.push({ text: input.value.trim(), completed: false });
            input.value = '';
            saveProgress();
            renderTasks();
        }
    });

    document.getElementById('todo-list').addEventListener('click', (e) => {
        const index = e.target.dataset.taskIndex;
        if (index === undefined) return;

        if (e.target.type === 'checkbox') { // Клик по чекбоксу
            chapterProgress.tasks[index].completed = e.target.checked;
        } else if (e.target.tagName === 'BUTTON') { // Клик по кнопке "Удалить"
            chapterProgress.tasks.splice(index, 1);
        }
        saveProgress();
        renderTasks();
    });

    renderTasks(); // Первоначальный рендеринг задач
}

async function initialize() {
    // ... (старый код инициализации)

    try {
        progress = await api.getProgress();
        // Устанавливаем chapterProgress для удобной работы
        if (!progress.lectures?.[subjectId]?.[chapterNo]) {
            // Создаем новую структуру, если ее нет
            if(!progress.lectures) progress.lectures = {};
            if(!progress.lectures[subjectId]) progress.lectures[subjectId] = {};
            progress.lectures[subjectId][chapterNo] = {
                vod: { checked: false, timestamp: null },
                test: { checked: false, timestamp: null },
                note: '',
                tasks: []
            };
        }
        chapterProgress = progress.lectures[subjectId][chapterNo];

        setupProgressTracker();
        theme.applyTheme(progress.settings?.theme || 'light');
        theme.init((key, value) => {
            if (progress.settings) progress.settings[key] = value;
            saveProgress();
        });
    } catch (e) {
        console.error("進捗データの読み込みに失敗しました:", e);
    }

    // ... (загрузка материалов из CMS без изменений)
}

document.addEventListener('DOMContentLoaded', initialize);