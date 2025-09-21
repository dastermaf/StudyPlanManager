import { SUBJECTS } from './studyPlan.js';

let SCRIPT_URL = null;
let activeModalKey = null;
let handleTaskChangeCallback = null;

function log(message, ...details) {
    console.log(`[Modal LOG] ${message}`, ...details);
}

function renderModalContent(data) {
    const modalBody = document.getElementById('modal-body');
    if (!modalBody) return;
    modalBody.innerHTML = '';

    if (Object.keys(data).length === 0) {
        log("この章のデータはスプレッドシートに見つかりませんでした。");
        modalBody.innerHTML = `<div class="text-center p-8 text-gray-500 dark:text-gray-400">この章に登録された教材はありません。</div>`;
        return;
    }

    log(`${Object.keys(data).length}個のレッスンをレンダリングします。`);
    for (const lessonTitle in data) {
        const lessonContainer = document.createElement('div');
        lessonContainer.className = 'mb-6';

        data[lessonTitle].forEach(item => {
            let element;
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

function renderError(message) {
    const modalBody = document.getElementById('modal-body');
    if (!modalBody) return;
    modalBody.innerHTML = `<div class="text-center p-8 text-red-500 dark:text-red-400">
        <h4 class="font-bold text-lg mb-2">教材の読み込みに失敗しました。</h4>
        <p class="text-sm">${message}</p>
        <p class="text-xs mt-4">時間をおいて再試行するか、Google Sheetsの構成を確認してください。</p>
    </div>`;
}

async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('サーバーから設定を取得できませんでした。');
        const config = await response.json();
        if (config.cms_link) {
            SCRIPT_URL = config.cms_link;
            log("CMSの設定が正常に読み込まれました。");
        } else {
            throw new Error('サーバーの応答にCMSのリンクが含まれていません。');
        }
    } catch (error) {
        console.error("[Modal FATAL] CMS設定の読み込みエラー:", error);
        SCRIPT_URL = null;
    }
}

function closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    if (!modalOverlay || !modalContent) return;

    modalOverlay.classList.add('opacity-0');
    modalContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        modalContent.classList.add('hidden');
        activeModalKey = null;
    }, 300);
}

// --- 公開関数 ---

export async function show(key, progressData) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const taskVodCheckbox = document.getElementById('task-vod');
    const taskTestCheckbox = document.getElementById('task-test');
    const noteTextarea = document.getElementById('note-textarea');

    if (!modalOverlay || !modalContent || !modalTitle || !modalBody) {
        console.error("致命的なエラー: モーダル要素がDOMに見つかりません。");
        return;
    }

    activeModalKey = key;
    const [subjectId, lectureId] = key.split('-');
    const subject = SUBJECTS.find(s => s.id === subjectId);
    if (!subject) {
        log("致命的なエラー: IDを持つ科目が見つかりません:", subjectId);
        return;
    }

    log(`モーダルを開きます: ${subject.name} - 第${lectureId}章`);
    modalTitle.textContent = `${subject.name} - 第${lectureId}章`;
    modalBody.innerHTML = `<div class="text-center p-8 text-gray-500 dark:text-gray-400">読み込み中...</div>`;

    const lectureProgress = progressData[subjectId]?.[lectureId] || { vod: false, test: false, note: '' };
    taskVodCheckbox.checked = lectureProgress.vod;
    taskTestCheckbox.checked = lectureProgress.test;
    noteTextarea.value = lectureProgress.note || '';

    modalOverlay.classList.remove('hidden');
    modalContent.classList.remove('hidden');
    setTimeout(() => {
        modalOverlay.classList.remove('opacity-0');
        modalContent.classList.remove('opacity-0', 'scale-95');
    }, 10);

    try {
        if (!SCRIPT_URL) await fetchConfig();
        if (!SCRIPT_URL) throw new Error("サーバーからCMS設定を取得できませんでした。");

        const requestUrl = `${SCRIPT_URL}?subject=${subjectId}&chapter=${lectureId}`;
        log(`リクエストを送信します: ${requestUrl}`);
        const response = await fetch(requestUrl);
        log(`ステータス ${response.status} の応答を受信しました。`);

        if (!response.ok) throw new Error(`ネットワークまたはスクリプトサーバーのエラー（ステータス: ${response.status}）。`);

        const data = await response.json();
        log("応答は正常にJSONとして解析されました:", data);

        if (data.error) throw new Error(`Apps Scriptからのエラー: ${data.details || data.error}`);

        renderModalContent(data);
        log("コンテンツが正常に表示されました。");

    } catch (error) {
        log("致命的なエラー：教材の読み込み中:", error);
        renderError(error.message);
    }
}

export async function init(onTaskChange) {
    handleTaskChangeCallback = onTaskChange;

    const modalOverlay = document.getElementById('modal-overlay');
    const closeXButton = document.getElementById('modal-close-x');
    const taskVodCheckbox = document.getElementById('task-vod');
    const taskTestCheckbox = document.getElementById('task-test');
    const noteTextarea = document.getElementById('note-textarea');

    modalOverlay?.addEventListener('click', closeModal);
    closeXButton?.addEventListener('click', closeModal);

    taskVodCheckbox?.addEventListener('change', () => {
        if(activeModalKey) handleTaskChangeCallback(activeModalKey, 'task', 'vod');
    });

    taskTestCheckbox?.addEventListener('change', () => {
        if(activeModalKey) handleTaskChangeCallback(activeModalKey, 'task', 'test');
    });

    let noteTimeout;
    noteTextarea?.addEventListener('input', (e) => {
        clearTimeout(noteTimeout);
        noteTimeout = setTimeout(() => {
            if(activeModalKey) handleTaskChangeCallback(activeModalKey, 'note', e.target.value);
        }, 500);
    });

    await fetchConfig();
}