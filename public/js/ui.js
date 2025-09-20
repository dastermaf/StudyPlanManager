import { state, debouncedSave } from './app.js';
import { applyTheme } from './theme.js';

// --- Константы и DOM элементы ---
const WEEKS_COUNT = 15;
const SUBJECTS = [
    { name: '情報基礎数学2', totalLectures: 15 }, { name: '情報システム概論', totalLectures: 15 },
    { name: 'ゲームシステム概論', totalLectures: 15 }, { name: '応用プログラミング', totalLectures: 15 },
    { name: 'AI概論', totalLectures: 15 }, { name: 'コミュニケーション2', totalLectures: 15 },
    { name: '文化を読みとくB', totalLectures: 15 }, { name: '基盤英語2', totalLectures: 15 },
    { name: 'メディアリテラシ', totalLectures: 15 },
];
const WEEKLY_NOTES = {
    8: { 'コミュニケーション2': '【重要】第8回レポートの提出週です！' },
    15: { 'コミュニケーション2': '【重要】第15回の最終レポートを提出します。', '文化を読みとくB': '【重要】最終課題の提出週です。'}
};

const plannerView = document.getElementById('planner-view');
const dashboardView = document.getElementById('dashboard-view');
const navPlanner = document.getElementById('nav-planner');
const navDashboard = document.getElementById('nav-dashboard');
const planContainer = document.getElementById('plan-container');
const finalPrepContainer = document.getElementById('final-prep-container');
const weekTitle = document.getElementById('week-title');
const weekPeriod = document.getElementById('week-period');
const prevWeekBtn = document.getElementById('prev-week');
const nextWeekBtn = document.getElementById('next-week');
const weeklyProgressBar = document.getElementById('weekly-progress-bar');
const weeklyProgressText = document.getElementById('weekly-progress-text');

// モーダルウィンドウ
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalCloseBtn = document.getElementById('modal-close');
const taskVodCheckbox = document.getElementById('task-vod');
const taskTestCheckbox = document.getElementById('task-test');
const taskNotesTextarea = document.getElementById('task-notes');
let activeModalKey = null;

// --- UIの初期化 ---
export function initUI() {
    navPlanner.addEventListener('click', () => switchView(true));
    navDashboard.addEventListener('click', () => switchView(false));
    prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
    nextWeekBtn.addEventListener('click', () => navigateWeek(1));

    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    modalCloseBtn.addEventListener('click', closeModal);

    taskVodCheckbox.addEventListener('change', handleModalTaskChange);
    taskTestCheckbox.addEventListener('change', handleModalTaskChange);
    taskNotesTextarea.addEventListener('input', handleModalTaskChange);
}

function switchView(isPlanner) {
    plannerView.classList.toggle('hidden', !isPlanner);
    dashboardView.classList.toggle('hidden', isPlanner);
    navPlanner.classList.toggle('nav-active', isPlanner);
    navDashboard.classList.toggle('nav-active', !isPlanner);
    if (!isPlanner) {
        renderDashboard();
    }
}

function navigateWeek(direction) {
    const newIndex = state.currentWeekIndex + direction;
    if (newIndex >= 0 && newIndex <= WEEKS_COUNT) {
        state.currentWeekIndex = newIndex;
        renderWeek(state.currentWeekIndex);
    }
}

// --- レンダリング ---
export function renderWeek(weekIndex) {
    if (!state.isDataLoaded) return;
    planContainer.innerHTML = '';

    if (weekIndex >= WEEKS_COUNT) {
        planContainer.classList.add('hidden');
        finalPrepContainer.classList.remove('hidden');
        weekTitle.textContent = '最終準備期間';
        weekPeriod.textContent = '1/5～2/1';
    } else {
        planContainer.classList.remove('hidden');
        finalPrepContainer.classList.add('hidden');
        const currentWeek = weekIndex + 1;
        weekTitle.textContent = `第 ${currentWeek} 週`;
        const startDate = new Date(2025, 8, 22 + weekIndex * 7);
        const endDate = new Date(2025, 8, 22 + weekIndex * 7 + 6);
        weekPeriod.textContent = `${startDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric'})}～${endDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric'})}`;

        SUBJECTS.forEach((subject, subjectIdx) => {
            const card = createSubjectCard(subject, subjectIdx, currentWeek);
            planContainer.appendChild(card);
        });

        planContainer.querySelectorAll('.lecture-box').forEach(box => {
            box.addEventListener('click', () => showModal(box.dataset.key));
        });
    }
    updateNavButtons();
    updateProgressBars();
}

function createSubjectCard(subject, subjectIdx, currentWeek) {
    const card = document.createElement('div');
    const hasImportantNote = WEEKLY_NOTES[currentWeek] && WEEKLY_NOTES[currentWeek][subject.name];
    card.className = `bg-white p-5 rounded-xl shadow-lg flex flex-col justify-between transition-transform transform hover:scale-105 ${hasImportantNote ? 'border-2 border-yellow-400' : ''}`;

    let lecturesHtml = '';
    for (let i = 1; i <= subject.totalLectures; i++) {
        const key = `${subject.name}-${i}`;
        const lectureProgress = state.progressData.lectures[key] || {};
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
            <h3 class="font-bold text-lg text-indigo-800">${subject.name}</h3>
            <p class="text-xs text-gray-500 mb-4">全体の進捗</p>
            <div class="w-full progress-bar-bg rounded-full h-2.5 mb-4">
                <div id="progress-${subjectIdx}" class="progress-bar-fg h-2.5 rounded-full"></div>
            </div>
            <div class="lecture-grid">${lecturesHtml}</div>
            ${noteHtml}
        </div>
    `;
    return card;
}


// --- モーダルウィンドウのロジック ---
function showModal(key) {
    activeModalKey = key;
    const [subject, lecture] = key.split('-');
    modalTitle.textContent = `${subject} - 第${lecture}回`;

    const lectureProgress = state.progressData.lectures[key] || { vod: false, test: false, note: '' };
    taskVodCheckbox.checked = lectureProgress.vod;
    taskTestCheckbox.checked = lectureProgress.test;
    taskNotesTextarea.value = lectureProgress.note || '';

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

function handleModalTaskChange() {
    if (!activeModalKey) return;
    if (!state.progressData.lectures[activeModalKey]) {
        state.progressData.lectures[activeModalKey] = {};
    }
    state.progressData.lectures[activeModalKey] = {
        vod: taskVodCheckbox.checked,
        test: taskTestCheckbox.checked,
        note: taskNotesTextarea.value,
    };
    debouncedSave();
    updateLectureBoxAppearance(activeModalKey);
    updateProgressBars();
}

// --- UI要素の更新 ---
export function updateNavButtons() {
    prevWeekBtn.disabled = state.currentWeekIndex === 0;
    nextWeekBtn.disabled = state.currentWeekIndex >= WEEKS_COUNT;
}

function updateLectureBoxAppearance(key) {
    const box = document.querySelector(`.lecture-box[data-key="${key}"]`);
    if (!box) return;

    const lectureProgress = state.progressData.lectures[key] || {};
    const status = getLectureStatus(lectureProgress);
    const [, lectureNumStr] = key.split('-');
    const isRecommended = parseInt(lectureNumStr) === (state.currentWeekIndex + 1);

    box.className = 'lecture-box';
    if (status === 'completed') box.classList.add('completed');
    else if (status === 'in-progress') box.classList.add('in-progress');
    else if (isRecommended) box.classList.add('recommended');
    else box.classList.add('optional');
}

function getLectureStatus(lectureProgress) {
    if (!lectureProgress) return 'incomplete';
    if (lectureProgress.vod && lectureProgress.test) return 'completed';
    if (lectureProgress.vod || lectureProgress.test) return 'in-progress';
    return 'incomplete';
}

function updateProgressBars() {
    const currentWeek = state.currentWeekIndex + 1;
    let recommendedTotal = 0;
    let recommendedCompleted = 0;

    SUBJECTS.forEach((subject, subjectIdx) => {
        let subjectCompleted = 0;
        for (let i = 1; i <= subject.totalLectures; i++) {
            if (getLectureStatus(state.progressData.lectures[`${subject.name}-${i}`]) === 'completed') {
                subjectCompleted++;
            }
        }

        if (currentWeek <= WEEKS_COUNT) {
            recommendedTotal++;
            if (getLectureStatus(state.progressData.lectures[`${subject.name}-${currentWeek}`]) === 'completed') {
                recommendedCompleted++;
            }
        }

        const subjectProgressBar = document.getElementById(`progress-${subjectIdx}`);
        const subjectProgress = subject.totalLectures > 0 ? (subjectCompleted / subject.totalLectures) * 100 : 0;
        if (subjectProgressBar) subjectProgressBar.style.width = `${subjectProgress}%`;
    });

    const weeklyProgress = recommendedTotal > 0 ? (recommendedCompleted / recommendedTotal) * 100 : 0;
    weeklyProgressBar.style.width = `${weeklyProgress}%`;
    weeklyProgressText.textContent = `${Math.round(weeklyProgress)}%`;
}

// --- ダッシュボードのロジック ---
function renderDashboard() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = theme === 'dark' ? '#d1d5db' : '#1f2937';

    if (state.charts.overall) state.charts.overall.destroy();
    if (state.charts.subjects) state.charts.subjects.destroy();

    let totalLecturesCount = 0;
    let completedLecturesCount = 0;
    if (state.progressData.lectures) {
        Object.values(state.progressData.lectures).forEach(lecture => {
            if (lecture.vod && lecture.test) completedLecturesCount++;
        });
        totalLecturesCount = SUBJECTS.length * SUBJECTS[0].totalLectures;
    }
    const remainingLectures = totalLecturesCount - completedLecturesCount;

    const overallCtx = document.getElementById('overall-progress-chart').getContext('2d');
    state.charts.overall = new Chart(overallCtx, {
        type: 'doughnut',
        data: {
            labels: ['完了', '残り'],
            datasets: [{ data: [completedLecturesCount, remainingLectures], backgroundColor: ['#22c55e', '#ef4444'], borderColor: theme === 'dark' ? '#1f2937' : '#ffffff', borderWidth: 4 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: textColor } } }, cutout: '70%' }
    });

    const subjectLabels = SUBJECTS.map(s => s.name);
    const subjectData = SUBJECTS.map(subject => {
        let completed = 0;
        for (let i = 1; i <= subject.totalLectures; i++) {
            if (getLectureStatus(state.progressData.lectures[`${subject.name}-${i}`]) === 'completed') completed++;
        }
        return (completed / subject.totalLectures) * 100;
    });

    const subjectsCtx = document.getElementById('subjects-progress-chart').getContext('2d');
    state.charts.subjects = new Chart(subjectsCtx, {
        type: 'bar',
        data: {
            labels: subjectLabels,
            datasets: [{ label: '完了率', data: subjectData, backgroundColor: 'rgba(79, 70, 229, 0.8)', borderRadius: 5 }]
        },
        options: {
            indexAxis: 'y', responsive: true, plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (value) => value + '%' } },
                y: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

