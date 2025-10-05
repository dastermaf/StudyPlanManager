import { SUBJECTS } from './studyPlan.js';
import * as api from './api.js';
import * as theme from './theme.js';
import { triggerConfetti, fadeInPage } from './utils.js'; // fadeOutPageのインポートを削除

let progress = {};
let chapterProgress = {};
let subjectId, chapterNo;
let saveTimeout;

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- Показ поздравительного окна ---
function showCompletionModal() {
    triggerConfetti();
    const modal = document.getElementById('completion-modal-overlay');
    modal?.classList.add('show');
}

function hideCompletionModal() {
    const modal = document.getElementById('completion-modal-overlay');
    modal?.classList.remove('show');
}


function renderContent(container, data) {
    container.innerHTML = '';
    if (Object.keys(data).length === 0) {
        container.innerHTML = `<div class="text-center py-16 text-gray-500 dark:text-gray-400">この章に登録された教材はありません。</div>`;
        return;
    }
    for (const lessonTitle in data) {
        const lessonElement = document.createElement('section');
        lessonElement.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-8';
        let contentHtml = `<h2 class="text-2xl font-bold text-indigo-800 dark:text-indigo-300 mb-4">${lessonTitle}</h2><div class="space-y-3">`;
        data[lessonTitle].forEach(item => {
            switch (item.type) {
                case 'header':
                    contentHtml += `<h3 class="text-xl font-semibold mt-6 mb-2 border-b-2 border-gray-200 dark:border-gray-700 pb-1">${item.content_1}</h3>`;
                    break;
                case 'text':
                    contentHtml += `<p class="dark:text-gray-300 whitespace-pre-wrap">${item.content_1}</p>`;
                    break;
                case 'image':
                    contentHtml += `<div><img src="/api/image?url=${encodeURIComponent(item.content_1)}" alt="${item.content_2 || '教材画像'}" class="my-2 rounded-lg shadow-md max-w-full h-auto"></div>`;
                    break;
                case 'link': case 'video':
                    const icon = item.type === 'video' ? '▶️' : '🔗';
                    contentHtml += `<a href="${item.content_1}" target="_blank" rel="noopener noreferrer" class="block p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">${icon} <span class="underline">${item.content_2 || item.content_1}</span></a>`;
                    break;
            }
        });
        contentHtml += `</div>`;
        lessonElement.innerHTML = contentHtml;
        container.appendChild(lessonElement);
    }
}

function renderError(container, message) {
    container.innerHTML = `<div class="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded-md"><h4>教材の読み込みに失敗しました。</h4><p>${message}</p></div>`;
}

function saveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await api.saveProgress(progress);
            localStorage.setItem('progress-updated', Date.now());
        } catch (error) {
            console.error('進捗の保存中にエラーが発生しました:', error);
        }
    }, 1000);
}

function saveSettings(key, value) {
    if (!progress.settings) progress.settings = {};
    progress.settings[key] = value;
    saveProgress();
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
        taskEl.innerHTML = `<input type="checkbox" data-task-index="${index}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" ${task.completed ? 'checked' : ''}><span class="ml-2 text-sm flex-grow ${task.completed ? 'line-through text-gray-500' : 'dark:text-gray-200'}">${task.text}</span><button data-task-index="${index}" class="text-red-500 hover:text-red-700 text-xs px-1">削除</button>`;
        todoList.appendChild(taskEl);
    });
}

function updateChapterProgressUI() {
    try {
        const bar = document.getElementById('chapter-progress-bar');
        const text = document.getElementById('chapter-progress-text');
        if (!bar || !text) return;
        const vod = chapterProgress?.vod?.checked ? 1 : 0;
        const test = chapterProgress?.test?.checked ? 1 : 0;
        const percent = Math.round(((vod + test) / 2) * 100);
        bar.style.width = `${percent}%`;
        bar.textContent = percent > 10 ? `${percent}%` : '';
        text.textContent = `${percent}%`;
    } catch {}
}

function setupProgressTracker() {
    const vodCheckbox = document.getElementById('task-vod');
    const testCheckbox = document.getElementById('task-test');

    // ИСПРАВЛЕНИЕ: Логика для однократного показа анимации
    const handleCheckboxChange = () => {
        const wasCompleted = (chapterProgress.vod.checked && chapterProgress.test.checked);

        chapterProgress.vod.checked = vodCheckbox.checked;
        chapterProgress.vod.timestamp = vodCheckbox.checked ? new Date().toISOString() : null;

        chapterProgress.test.checked = testCheckbox.checked;
        chapterProgress.test.timestamp = testCheckbox.checked ? new Date().toISOString() : null;

        const isNowCompleted = chapterProgress.vod.checked && chapterProgress.test.checked;

        // Показываем анимацию только в момент первого завершения
        if (isNowCompleted && !wasCompleted && !chapterProgress.celebrationShown) {
            showCompletionModal();
            chapterProgress.celebrationShown = true;
        }

        saveProgress();
        updateChapterProgressUI();
    };

    vodCheckbox.addEventListener('change', () => {
        if (vodCheckbox.checked) showToast('VOD視聴 完了！');
        handleCheckboxChange();
    });

    testCheckbox.addEventListener('change', () => {
        if (testCheckbox.checked) showToast('テスト 完了！');
        handleCheckboxChange();
    });

    document.getElementById('note-textarea').addEventListener('input', (e) => {
        chapterProgress.note = e.target.value;
        saveProgress();
    });

    document.getElementById('add-task-btn').addEventListener('click', () => {
        const input = document.getElementById('new-task-input');
        if (input.value.trim()) {
            if(!chapterProgress.tasks) chapterProgress.tasks = [];
            chapterProgress.tasks.push({ text: input.value.trim(), completed: false });
            input.value = '';
            saveProgress();
            renderTasks();
        }
    });

    document.getElementById('todo-list').addEventListener('click', (e) => {
        const index = e.target.dataset.taskIndex;
        if (index === undefined) return;
        if (e.target.type === 'checkbox') chapterProgress.tasks[index].completed = e.target.checked;
        else if (e.target.tagName === 'BUTTON') chapterProgress.tasks.splice(index, 1);
        saveProgress();
        renderTasks();
    });

    document.getElementById('close-modal-btn')?.addEventListener('click', hideCompletionModal);
}

async function initialize() {
    try {
        await api.getCurrentUser();
    } catch (e) {
        window.location.href = '/';
        return;
    }

    const titleElement = document.getElementById('materials-title');
    const container = document.getElementById('materials-container');

    const pathParts = window.location.pathname.split('/').filter(p => p);
    subjectId = pathParts[1];
    chapterNo = pathParts[2];
    titleElement.textContent = `${SUBJECTS.find(s => s.id === subjectId)?.name || ''} - 第${chapterNo}章`;

    // --- 変更: 不安定なクリックハンドラを完全に削除 ---
    fadeInPage();

    try {
        progress = await api.getProgress();
        if (!progress.lectures) progress.lectures = {};
        if (!progress.lectures[subjectId]) progress.lectures[subjectId] = {};
        // ИСПРАВЛЕНИЕ: Добавляем celebrationShown при создании новой главы
        if (!progress.lectures[subjectId][chapterNo] || typeof progress.lectures[subjectId][chapterNo].vod !== 'object') {
            progress.lectures[subjectId][chapterNo] = {
                vod: { checked: false, timestamp: null },
                test: { checked: false, timestamp: null },
                note: '', tasks: [], pinned: false, celebrationShown: false
            };
        }
        chapterProgress = progress.lectures[subjectId][chapterNo];

        document.getElementById('task-vod').checked = chapterProgress.vod.checked;
        document.getElementById('task-test').checked = chapterProgress.test.checked;
        document.getElementById('note-textarea').value = chapterProgress.note;

        setupProgressTracker();
        renderTasks();
        updateChapterProgressUI();

        theme.init(saveSettings);

        const response = await fetch(`/api/materials?subject=${encodeURIComponent(subjectId)}&chapter=${encodeURIComponent(chapterNo)}`, { credentials: 'include' });
        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        const data = await response.json();
        if (data && data.error && !data.content) throw new Error(`API error: ${data.details || data.error}`);
        renderContent(container, data);

    } catch (error) {
        renderError(container, error.message);
    }
}

document.addEventListener('DOMContentLoaded', initialize);