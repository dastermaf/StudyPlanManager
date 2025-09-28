import { SUBJECTS, WEEKLY_NOTES } from './studyPlan.js';
import { animateValue } from './utils.js';

export const WEEKS_COUNT = 15;

let progressRef = null;
let onSaveProgress = null;
let currentWeekIdx = 0;

export function configureProgress(progress, saveCb) {
    progressRef = progress;
    onSaveProgress = saveCb;
}

const MOTIVATIONAL_QUOTES = [
    "「学び続ける者は、常に若い。」- ソクラテス", "「今日の小さな一歩が、明日の大きな飛躍になる。」", "「成功の秘訣は、目標に向かって着実に進むことだ。」", "「困難は、成長の機会である。」", "「知識への投資は、常に最高のリターンをもたらす。」- ベンジャミン・フランクリン", "「完了！」"
];

function getChapterStatus(chapterProgress) {
    if (!chapterProgress || typeof chapterProgress !== 'object') return 'incomplete';
    if (chapterProgress.vod?.checked && chapterProgress.test?.checked) return 'completed';
    if (chapterProgress.vod?.checked || chapterProgress.test?.checked) return 'in-progress';
    return 'incomplete';
}

export function showMainContent(username) {
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) usernameDisplay.textContent = `ようこそ、${username}さん`;
}

export function renderWeek(weekIndex, progressData) {
    currentWeekIdx = weekIndex;
    const planContainer = document.getElementById('plan-container');
    const finalPrepContainer = document.getElementById('final-prep-container');
    const weekTitle = document.getElementById('week-title');
    const weekPeriod = document.getElementById('week-period');
    if (!planContainer) return;
    planContainer.innerHTML = '';

    const sortedSubjects = [...SUBJECTS].sort((a, b) => {
        const aIsPinned = progressData?.[a.id]?._subjectPinned === true;
        const bIsPinned = progressData?.[b.id]?._subjectPinned === true;
        if (aIsPinned && !bIsPinned) return -1; if (!aIsPinned && bIsPinned) return 1; return 0;
    });

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

        sortedSubjects.forEach((subject) => {
            const card = document.createElement('div');
            const hasImportantNote = WEEKLY_NOTES[currentWeek]?.[subject.name];
            const isPinned = progressData?.[subject.id]?._subjectPinned === true;
            card.className = `bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg flex flex-col justify-between ${hasImportantNote ? 'border-2 border-yellow-400' : ''}`;
            let lecturesHtml = '';
            for (let i = 1; i <= subject.totalLectures; i++) {
                const status = getChapterStatus(progressData?.[subject.id]?.[i]);
                let lectureClass = (status === 'completed') ? 'completed' : (status === 'in-progress') ? 'in-progress' : (i === currentWeek) ? 'recommended' : 'optional';
                lecturesHtml += `<a href="/materials/${subject.id}/${i}" class="lecture-box ${lectureClass}">第${i}章</a>`;
            }
            const pinBtn = `<button type="button" class="pin-subject-btn ml-2 text-gray-400 hover:text-yellow-500 transition-colors ${isPinned ? 'text-yellow-500' : ''}" data-subject-id="${subject.id}" title="この科目をピン留め">★</button>`;
            const noteHtml = hasImportantNote ? `<div class="important-note p-3 mt-4 text-sm rounded-r-lg"><p class="whitespace-pre-line">${WEEKLY_NOTES[currentWeek][subject.name]}</p></div>` : '';
            card.innerHTML = `<div><h3 class="font-bold text-lg text-indigo-800 dark:text-indigo-300 flex items-center">${subject.name} ${pinBtn}</h3><p class="text-xs text-gray-500 dark:text-gray-400 mb-4">総進捗 (完了したタスク数)</p><div class="w-full progress-bar-bg rounded-full h-2.5 mb-4"><div id="progress-${subject.id}" class="progress-bar-fg h-2.5 rounded-full"></div></div><div class="lecture-grid">${lecturesHtml}</div>${noteHtml}</div>`;
            planContainer.appendChild(card);
        });
    }
    updateWeeklyProgress(weekIndex, progressData);
    updateNavButtons(weekIndex);
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest?.('button.pin-subject-btn');
        if (!btn || !progressRef || !onSaveProgress) return;
        const subjectId = btn.dataset.subjectId;
        if (!progressRef.lectures) progressRef.lectures = {};
        if (!progressRef.lectures[subjectId]) progressRef.lectures[subjectId] = {};
        progressRef.lectures[subjectId]._subjectPinned = !progressRef.lectures[subjectId]._subjectPinned;
        onSaveProgress();
        renderWeek(currentWeekIdx, progressRef.lectures);
    });

    // --- НОВАЯ ЛОГИКА: Слушаем изменения из других вкладок ---
    window.addEventListener('storage', (e) => {
        if (e.key === 'progress-updated') {
            // Перезагружаем прогресс и плавно анимируем до нового значения
            api.getProgress().then(newProgress => {
                progressRef = newProgress;
                updateOverallProgress(newProgress, true); // true = animate
            });
        }
    });
}

export function updateWeeklyProgress(weekIndex, progressData) {
    const weeklyProgressBar = document.getElementById('weekly-progress-bar');
    const weeklyProgressText = document.getElementById('weekly-progress-text');
    if (!weeklyProgressBar) return;
    const currentWeek = weekIndex + 1;
    let recommendedTotal = 0, recommendedCompleted = 0;

    SUBJECTS.forEach((subject) => {
        let completedTasks = 0;
        const subjectProgressData = progressData?.[subject.id] || {};
        for (let i = 1; i <= subject.totalLectures; i++) {
            if (subjectProgressData[i]?.vod?.checked) completedTasks++;
            if (subjectProgressData[i]?.test?.checked) completedTasks++;
        }
        if (currentWeek <= subject.totalLectures) {
            recommendedTotal++;
            if (getChapterStatus(subjectProgressData[currentWeek]) === 'completed') recommendedCompleted++;
        }
        const subjectProgressBar = document.getElementById(`progress-${subject.id}`);
        if (subjectProgressBar) {
            const totalTasks = subject.totalLectures * 2;
            subjectProgressBar.style.width = `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`;
        }
    });
    const weeklyProgress = recommendedTotal > 0 ? (recommendedCompleted / recommendedTotal) * 100 : 0;
    weeklyProgressBar.style.width = `${weeklyProgress}%`;
    weeklyProgressBar.textContent = `${Math.round(weeklyProgress)}%`;
    weeklyProgressText.textContent = `${Math.round(weeklyProgress)}%`;
}

// --- ИЗМЕНЕНИЕ: Анимация прогресс-бара с искрами ---
export function updateOverallProgress(progressData, shouldAnimate = false) {
    const bar = document.getElementById('overall-progress-bar');
    const text = document.getElementById('overall-progress-text');
    const quote = document.getElementById('motivational-quote');
    const sparkleContainer = document.getElementById('sparkle-container');
    if (!bar || !text || !quote) return;

    let totalPossibleTasks = 0, completedTasks = 0;
    SUBJECTS.forEach(subject => {
        totalPossibleTasks += subject.totalLectures * 2;
        const subjectProgress = progressData?.[subject.id] || {};
        for (const chapterKey in subjectProgress) {
            if(isNaN(parseInt(chapterKey, 10))) continue;
            if (subjectProgress[chapterKey]?.vod?.checked) completedTasks++;
            if (subjectProgress[chapterKey]?.test?.checked) completedTasks++;
        }
    });
    const finalPercentage = totalPossibleTasks > 0 ? (completedTasks / totalPossibleTasks) * 100 : 0;
    const currentPercentage = parseFloat(bar.style.width) || 0;

    if (shouldAnimate && finalPercentage > currentPercentage) {
        let start = null;
        const duration = 1200; // 1.2 секунды
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            const current = Math.min(currentPercentage + (finalPercentage - currentPercentage) * progress, finalPercentage);
            bar.style.width = `${current}%`;
            text.textContent = `${current.toFixed(1)}%`;
            if (progress < 1) {
                // Добавляем искры
                if (Math.random() < 0.4) {
                    const sparkle = document.createElement('div');
                    sparkle.className = 'sparkle';
                    const size = Math.random() * 3 + 2;
                    sparkle.style.width = `${size}px`;
                    sparkle.style.height = `${size}px`;
                    sparkle.style.left = `calc(${current}% - ${size/2}px)`;
                    sparkle.style.bottom = `${Math.random() * 20 - 10}px`;
                    sparkleContainer.appendChild(sparkle);
                    setTimeout(() => sparkle.remove(), 700);
                }
                requestAnimationFrame(animate);
            } else {
                bar.style.width = `${finalPercentage}%`;
                text.textContent = `${finalPercentage.toFixed(1)}%`;
            }
        }
        requestAnimationFrame(animate);
    } else {
        bar.style.width = `${finalPercentage}%`;
        text.textContent = `${finalPercentage.toFixed(1)}%`;
    }
    bar.textContent = finalPercentage > 10 ? `${finalPercentage.toFixed(1)}%` : '';
    let quoteIndex = Math.floor(finalPercentage / 20);
    quote.textContent = MOTIVATIONAL_QUOTES[Math.min(quoteIndex, MOTIVATIONAL_QUOTES.length - 1)];
}

export function initNavigation(onWeekChange) {
    const prev = document.getElementById('prev-week');
    const next = document.getElementById('next-week');
    if (prev) { prev.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>'; }
    if (next) { next.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>'; }
    prev?.addEventListener('click', () => onWeekChange(-1));
    next?.addEventListener('click', () => onWeekChange(1));
}

function updateNavButtons(currentWeekIndex) {
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    if(prevWeekBtn) { prevWeekBtn.disabled = currentWeekIndex === 0; prevWeekBtn.classList.toggle('opacity-60', prevWeekBtn.disabled); }
    if(nextWeekBtn) { nextWeekBtn.disabled = currentWeekIndex >= WEEKS_COUNT; nextWeekBtn.classList.toggle('opacity-60', nextWeekBtn.disabled); }
}

