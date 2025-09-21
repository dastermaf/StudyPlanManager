import { SUBJECTS } from './studyPlan.js';
import * as api from './api.js'; // Импортируем API для сохранения прогресса

let SCRIPT_URL = null;
let progress = {};
let saveTimeout;

// --- Логирование ---
function log(message, ...details) {
    console.log(`[Materials LOG] ${message}`, ...details);
}

// --- Получение конфигурации ---
async function fetchConfig() {
    if (SCRIPT_URL) return SCRIPT_URL;
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('サーバーから設定を取得できませんでした。');
        const config = await response.json();
        if (config.cms_link) {
            SCRIPT_URL = config.cms_link;
            log("CMSの設定が正常に読み込まれました。");
            return SCRIPT_URL;
        } else {
            throw new Error('サーバーの応答にCMSのリンクが含まれていません。');
        }
    } catch (error) {
        console.error("[FATAL] CMS設定の読み込みエラー:", error);
        return null;
    }
}

// --- Рендеринг контента ---
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
                    contentHtml += `<div><img src="${item.content_1}" alt="${item.content_2 || '教材画像'}" class="my-2 rounded-lg shadow-md max-w-full h-auto"></div>`;
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
    container.innerHTML = `<div class="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded-md">
        <h4 class="font-bold">教材の読み込みに失敗しました。</h4>
        <p>${message}</p>
    </div>`;
}

// --- Функции для работы с прогрессом ---
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

function setupProgressTracker(subjectId, chapterNo) {
    const vodCheckbox = document.getElementById('task-vod');
    const testCheckbox = document.getElementById('task-test');
    const noteTextarea = document.getElementById('note-textarea');

    if (!vodCheckbox || !testCheckbox || !noteTextarea) return;

    // Инициализация
    if (!progress.lectures) progress.lectures = {};
    if (!progress.lectures[subjectId]) progress.lectures[subjectId] = {};
    if (!progress.lectures[subjectId][chapterNo]) {
        progress.lectures[subjectId][chapterNo] = { vod: false, test: false, note: '' };
    }
    const lectureProgress = progress.lectures[subjectId][chapterNo];

    vodCheckbox.checked = lectureProgress.vod;
    testCheckbox.checked = lectureProgress.test;
    noteTextarea.value = lectureProgress.note;

    // Обработчики событий
    vodCheckbox.addEventListener('change', () => {
        lectureProgress.vod = vodCheckbox.checked;
        saveProgress();
    });
    testCheckbox.addEventListener('change', () => {
        lectureProgress.test = testCheckbox.checked;
        saveProgress();
    });
    noteTextarea.addEventListener('input', () => {
        lectureProgress.note = noteTextarea.value;
        saveProgress();
    });
}

// --- Основная функция ---
async function initialize() {
    // 1. Проверяем, авторизован ли пользователь
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '/'; // Если нет, перенаправляем на логин
        return;
    }

    const titleElement = document.getElementById('materials-title');
    const container = document.getElementById('materials-container');

    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length < 3) {
        renderError(container, "URLが無効です。");
        return;
    }
    const subjectId = pathParts[1];
    const chapterNo = pathParts[2];

    const subject = SUBJECTS.find(s => s.id === subjectId);
    if (subject) {
        titleElement.textContent = `${subject.name} - 第${chapterNo}章`;
    }

    // 2. Загружаем весь прогресс пользователя
    try {
        progress = await api.getProgress();
        setupProgressTracker(subjectId, chapterNo);
    } catch (e) {
        console.error("進捗データの読み込みに失敗しました:", e);
    }


    // 3. Загружаем материалы
    const url = await fetchConfig();
    if (!url) {
        renderError(container, "CMSの設定を読み込めませんでした。");
        return;
    }

    try {
        const requestUrl = `${url}?subject=${subjectId}&chapter=${chapterNo}`;
        log(`リクエストを送信します: ${requestUrl}`);
        const response = await fetch(requestUrl);
        if (!response.ok) throw new Error(`ネットワークエラー (ステータス: ${response.status})`);
        const data = await response.json();
        if (data.error) throw new Error(`スクリプトエラー: ${data.details || data.error}`);

        renderContent(container, data);
        log("コンテンツが正常に表示されました。");

    } catch (error) {
        log("致命的なエラー：教材の読み込み中:", error);
        renderError(container, error.message);
    }
}

document.addEventListener('DOMContentLoaded', initialize);