import { SUBJECTS, WEEKLY_NOTES, WEEKS_COUNT } from './studyPlan.js';

let activeModalKey = null;
let handleTaskChangeCallback = null;

function getLectureStatus(lectureProgress) {
    if (!lectureProgress) return 'incomplete';
    if (lectureProgress.vod && lectureProgress.test) return 'completed';
    if (lectureProgress.vod || lectureProgress.test) return 'in-progress';
    return 'incomplete';
}

export function showMainContent(username) {
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) usernameDisplay.textContent = `ようこそ、${username}さん`;
}

export function renderWeek(weekIndex, progressData, onLectureClick, onNoteChange) {
    handleTaskChangeCallback = (type, value) => {
        if (!activeModalKey) return;
        const [subjectId, lectureId] = activeModalKey.split('-');
        if (type === 'task') {
            onLectureClick(subjectId, lectureId, value);
        } else if (type === 'note') {
            onNoteChange(subjectId, lectureId, value);
        }
    };

    const planContainer = document.getElementById('plan-container');
    const finalPrepContainer = document.getElementById('final-prep-container');
    const weekTitle = document.getElementById('week-title');
    const weekPeriod = document.getElementById('week-period');

    if (!planContainer || !finalPrepContainer || !weekTitle || !weekPeriod) return;

    planContainer.innerHTML = '';

    if (weekIndex >= WEEKS_COUNT) {
        planContainer.classList.add('hidden');
        finalPrepContainer.classList.remove('hidden');
        weekTitle.textContent = '最終準備期間';
        weekPeriod.textContent = '1/5～2/1';
        return;
    }

    planContainer.classList.remove('hidden');
    finalPrepContainer.classList.add('hidden');

    const currentWeek = weekIndex + 1;
    weekTitle.textContent = `第 ${currentWeek} 週`;
    const startDate = new Date(2025, 8, 22 + weekIndex * 7);
    const endDate = new Date(2025, 8, 22 + weekIndex * 7 + 6);
    weekPeriod.textContent = `${startDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric'})}～${endDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric'})}`;

    SUBJECTS.forEach((subject) => {
        const card = document.createElement('div');
        const hasImportantNote = WEEKLY_NOTES[currentWeek] && WEEKLY_NOTES[currentWeek][subject.name];
        card.className = `bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg flex flex-col justify-between transition-transform transform hover:scale-105 ${hasImportantNote ? 'border-2 border-yellow-400' : ''}`;

        let lecturesHtml = '';
        for (let i = 1; i <= subject.totalLectures; i++) {
            const key = `${subject.id}-${i}`;
            const lectureProgress = progressData[subject.id]?.[i];
            const status = getLectureStatus(lectureProgress);
            const isRecommended = i === currentWeek;

            let lectureClass = 'optional';
            if (status === 'completed') lectureClass = 'completed';
            else if (status === 'in-progress') lectureClass = 'in-progress';
            else if (isRecommended) lectureClass = 'recommended';

            lecturesHtml += `<div class="lecture-box ${lectureClass}" data-key="${key}">${i}</div>`;
        }

        let noteHtml = hasImportantNote ? `<div class="important-note border-l-4 p-3 mt-4 text-sm rounded-r-lg"><p>${WEEKLY_NOTES[currentWeek][subject.name]}</p></div>` : '';

        card.innerHTML = `
            <div>
                <h3 class="font-bold text-lg text-indigo-800 dark:text-indigo-300">${subject.name}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">総進捗 (完了した講義数)</p>
                <div class="w-full progress-bar-bg rounded-full h-2.5 mb-4">
                    <div id="progress-${subject.id}" class="progress-bar-fg h-2.5 rounded-full"></div>
                </div>
                <div class="lecture-grid">${lecturesHtml}</div>
                ${noteHtml}
            </div>
        `;
        planContainer.appendChild(card);
    });

    document.querySelectorAll('.lecture-box').forEach(box => {
        box.addEventListener('click', () => showModal(box.dataset.key, progressData));
    });

    updateProgress(weekIndex, progressData);
}

export function updateProgress(weekIndex, progressData) {
    const weeklyProgressBar = document.getElementById('weekly-progress-bar');
    const weeklyProgressText = document.getElementById('weekly-progress-text');
    if (!weeklyProgressBar || !weeklyProgressText) return;

    const currentWeek = weekIndex + 1;
    let recommendedTotal = 0;
    let recommendedCompleted = 0;

    SUBJECTS.forEach((subject) => {
        let subjectCompleted = 0;
        const subjectProgressData = progressData[subject.id] || {};
        for (let i = 1; i <= subject.totalLectures; i++) {
            const status = getLectureStatus(subjectProgressData[i]);
            if (status === 'completed') {
                subjectCompleted++;
            }
        }

        if (currentWeek <= WEEKS_COUNT) {
            recommendedTotal++;
            const recommendedStatus = getLectureStatus(subjectProgressData[currentWeek]);
            if (recommendedStatus === 'completed') {
                recommendedCompleted++;
            }
        }

        const subjectProgressBar = document.getElementById(`progress-${subject.id}`);
        const subjectProgress = subject.totalLectures > 0 ? (subjectCompleted / subject.totalLectures) * 100 : 0;
        if(subjectProgressBar) {
            subjectProgressBar.style.width = `${subjectProgress}%`;
        }
    });

    const weeklyProgress = recommendedTotal > 0 ? (recommendedCompleted / recommendedTotal) * 100 : 0;
    weeklyProgressBar.style.width = `${weeklyProgress}%`;
    weeklyProgressBar.textContent = `${Math.round(weeklyProgress)}%`;
    weeklyProgressText.textContent = `${Math.round(weeklyProgress)}%`;
}


function showModal(key, progressData) {
    activeModalKey = key;
    const [subjectId, lectureId] = key.split('-');
    const subject = SUBJECTS.find(s => s.id === subjectId);
    if (!subject) return;

    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const taskVodCheckbox = document.getElementById('task-vod');
    const taskTestCheckbox = document.getElementById('task-test');
    const noteTextarea = document.getElementById('note-textarea');

    modalTitle.textContent = `${subject.name} - 第${lectureId}回`;

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
}

function closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    modalOverlay.classList.add('opacity-0');
    modalContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        modalContent.classList.add('hidden');
        activeModalKey = null;
    }, 300);
}

export function initModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalCloseBtn = document.getElementById('modal-close');
    const taskVodCheckbox = document.getElementById('task-vod');
    const taskTestCheckbox = document.getElementById('task-test');
    const noteTextarea = document.getElementById('note-textarea');

    if (!modalOverlay || !modalCloseBtn) return;

    modalOverlay.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);

    taskVodCheckbox.addEventListener('change', () => handleTaskChangeCallback('task', 'vod'));
    taskTestCheckbox.addEventListener('change', () => handleTaskChangeCallback('task', 'test'));

    let noteTimeout;
    noteTextarea.addEventListener('input', (e) => {
        clearTimeout(noteTimeout);
        noteTimeout = setTimeout(() => {
            handleTaskChangeCallback('note', e.target.value);
        }, 500);
    });
}