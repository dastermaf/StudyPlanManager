import { SUBJECTS } from './studyPlan.js';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjcgqUg4cbmiEeHII7pltwttIECuT9eoUZurUDGx2KW4j_gP1jPOKO2wkLYCaXoow6/exec";

let activeModalKey = null;
let handleTaskChangeCallback = null;

const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const taskVodCheckbox = document.getElementById('task-vod');
const taskTestCheckbox = document.getElementById('task-test');
const noteTextarea = document.getElementById('note-textarea');
const closeXButton = document.getElementById('modal-close-x');

// --- ЛОГИРОВАНИЕ ---
function log(message, ...details) {
    console.log(`[Modal LOG] ${message}`, ...details);
}

// --- Управление модальным окном ---
function openModal() {
    modalOverlay.classList.remove('hidden');
    modalContent.classList.remove('hidden');
    setTimeout(() => {
        modalOverlay.classList.remove('opacity-0');
        modalContent.classList.remove('opacity-0', 'scale-95');
    }, 10);
}

function closeModal() {
    modalOverlay.classList.add('opacity-0');
    modalContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        modalContent.classList.add('hidden');
        activeModalKey = null;
    }, 300);
}

// --- Рендеринг контента ---
function renderModalContent(data) {
    modalBody.innerHTML = '';

    if (Object.keys(data).length === 0) {
        log("Данные для этой главы не найдены в таблице.");
        modalBody.innerHTML = `<div class="text-center p-8 text-gray-500 dark:text-gray-400">この章に登録された教材はありません。</div>`;
        return;
    }

    log(`Рендеринг ${Object.keys(data).length} уроков.`);
    for (const lessonTitle in data) {
        const lessonContainer = document.createElement('div');
        lessonContainer.className = 'mb-6';

        data[lessonTitle].forEach(item => {
            let element;
            // ... (switch-case остается без изменений)
            switch (item.type) {
                case 'header':
                    element = document.createElement('h4');
                    element.textContent = item.content_1;
                    element.className = 'text-xl font-bold mt-4 mb-2 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-200 dark:border-indigo-800 pb-1';
                    break;
                case 'text':
                    element = document.createElement('p');
                    element.textContent = item.content_1;
                    element.className = 'my-2 dark:text-gray-300 whitespace-pre-wrap';
                    break;
                case 'image':
                    element = document.createElement('img');
                    element.src = item.content_1;
                    element.alt = item.content_2 || '教材画像';
                    element.className = 'my-2 rounded-lg shadow-md max-w-full h-auto';
                    break;
                case 'link':
                case 'video':
                    element = document.createElement('a');
                    element.href = item.content_1;
                    element.target = '_blank';
                    element.rel = 'noopener noreferrer';
                    element.className = 'my-2 block p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
                    const icon = item.type === 'video' ? '▶️' : '🔗';
                    element.innerHTML = `${icon} <span class="underline">${item.content_2 || item.content_1}</span>`;
                    break;
            }
            if (element) lessonContainer.appendChild(element);
        });
        modalBody.appendChild(lessonContainer);
    }
}

// --- ОБРАБОТКА ОШИБОК ---
function renderError(message) {
    modalBody.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400">
        <h4 class="font-bold text-lg mb-2">教材の読み込みに失敗しました。</h4>
        <p class="text-sm">${message}</p>
        <p class="text-xs mt-4">時間をおいて再試行するか、Google Sheetsの構成を確認してください。</p>
    </div>`;
}


// --- ПУБЛИЧНЫЕ ФУНКЦИИ ---

export async function show(key, progressData) {
    activeModalKey = key;
    const [subjectId, lectureId] = key.split('-');
    const subject = SUBJECTS.find(s => s.id === subjectId);
    if (!subject) {
        log("Критическая ошибка: не найден предмет с ID:", subjectId);
        return;
    }

    log(`Открытие модального окна для: ${subject.name} - Глава ${lectureId}`);
    modalTitle.textContent = `${subject.name} - 第${lectureId}章`;
    modalBody.innerHTML = `<div class="text-center p-8 text-gray-500 dark:text-gray-400">読み込み中...</div>`;

    const lectureProgress = progressData[subjectId]?.[lectureId] || {vod: false, test: false, note: ''};
    taskVodCheckbox.checked = lectureProgress.vod;
    taskTestCheckbox.checked = lectureProgress.test;
    noteTextarea.value = lectureProgress.note || '';

    openModal();


// --- ПУБЛИЧНЫЕ ФУНКЦИИ ---

    export async function show(key, progressData) {
        activeModalKey = key;
        const [subjectId, lectureId] = key.split('-');
        const subject = SUBJECTS.find(s => s.id === subjectId);
        if (!subject) {
            log("Критическая ошибка: не найден предмет с ID:", subjectId);
            return;
        }

        log(`Открытие модального окна для: ${subject.name} - Глава ${lectureId}`);
        modalTitle.textContent = `${subject.name} - 第${lectureId}章`;
        modalBody.innerHTML = `<div class="text-center p-8 text-gray-500 dark:text-gray-400">読み込み中...</div>`;

        const lectureProgress = progressData[subjectId]?.[lectureId] || {vod: false, test: false, note: ''};
        taskVodCheckbox.checked = lectureProgress.vod;
        taskTestCheckbox.checked = lectureProgress.test;
        noteTextarea.value = lectureProgress.note || '';

        openModal();

        // --- НАДЕЖНАЯ ЗАГРУЗКА ДАННЫХ ---
        try {
            // Проверяем, что SCRIPT_URL был получен
            if (!SCRIPT_URL) {
                // Пытаемся получить его снова
                await fetchConfig();
                if (!SCRIPT_URL) {
                    throw new Error("Не удалось получить конфигурацию CMS с сервера.");
                }
            }

            const requestUrl = `${SCRIPT_URL}?subject=${subjectId}&chapter=${lectureId}`;
            log(`Отправка запроса на: ${requestUrl}`);

            const response = await fetch(requestUrl);
            log(`Получен ответ со статусом: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Ошибка сети или сервера скрипта (статус: ${response.status}).`);
            }

            const data = await response.json();
            log("Ответ успешно получен и распарсен в JSON:", data);

            if (data.error) {
                throw new Error(`Ошибка от Apps Script: ${data.details || data.error}`);
            }

            renderModalContent(data);
            log("Контент успешно отображен.");

        } catch (error) {
            log("КРИТИЧЕСКАЯ ОШИБКА при загрузке материалов:", error);
            renderError(error.message);
        }
    }

// Новая функция для получения SCRIPT_URL с нашего бэкенда
    async function fetchConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Не удалось получить конфигурацию с сервера.');
            }
            const config = await response.json();
            if (config.cms_link) {
                SCRIPT_URL = config.cms_link;
                log("Конфигурация CMS успешно загружена.");
            } else {
                throw new Error('Ссылка на CMS отсутствует в ответе сервера.');
            }
        } catch (error) {
            console.error("[Modal FATAL] Ошибка загрузки конфигурации CMS:", error);
            SCRIPT_URL = null;
        }
    }

// Инициализация модуля
    export async function init(onTaskChange) {
        // Инициализируем переменные DOM только когда страница загружена
        modalOverlay = document.getElementById('modal-overlay');
        modalContent = document.getElementById('modal-content');
        modalTitle = document.getElementById('modal-title');
        modalBody = document.getElementById('modal-body');
        taskVodCheckbox = document.getElementById('task-vod');
        taskTestCheckbox = document.getElementById('task-test');
        noteTextarea = document.getElementById('note-textarea');
        closeXButton = document.getElementById('modal-close-x');

        handleTaskChangeCallback = onTaskChange;

        // Загружаем конфигурацию при инициализации
        await fetchConfig();

        modalOverlay?.addEventListener('click', closeModal);
        closeXButton?.addEventListener('click', closeModal);
        taskVodCheckbox?.addEventListener('change', () => {
            if (activeModalKey) handleTaskChangeCallback(activeModalKey, 'task', 'vod');
        });
        taskTestCheckbox?.addEventListener('change', () => {
            if (activeModalKey) handleTaskChangeCallback(activeModalKey, 'task', 'test');
        });

        let noteTimeout;
        noteTextarea?.addEventListener('input', (e) => {
            clearTimeout(noteTimeout);
            noteTimeout = setTimeout(() => {
                if (activeModalKey) handleTaskChangeCallback(activeModalKey, 'note', e.target.value);
            }, 500);
        });
    }
}