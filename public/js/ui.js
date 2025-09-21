import { SUBJECTS, WEEKLY_NOTES } from './studyPlan.js';
import * as modal from './modal.js'; // Импортируем новый модуль

export const WEEKS_COUNT = 15;

const MOTIVATIONAL_QUOTES = [
    "「学び続ける者は、常に若い。」- ソクラテス",
    "「今日の小さな一歩が、明日の大きな飛躍になる。」",
    "「成功の秘訣は、目標に向かって着実に進むことだ。」",
    "「困難は、成長の機会である。」",
    "「知識への投資は、常に最高のリターンをもたらす。」- ベンジャミン・フランクリン",
    "「完了！」"
];

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

export function renderWeek(weekIndex, progressData) {
    const planContainer = document.getElementById('plan-container');
    const finalPrepContainer = document.getElementById('final-prep-container');
    const weekTitle = document.getElementById('week-title');
    const weekPeriod = document.getElementById('week-period');

    if (!planContainer) return;
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
                lecturesHtml += `<div class="lecture-box ${lectureClass}" data-key="${key}">第${i}章</div>`;
            }

            let noteHtml = hasImportantNote ? `<div class="important-note p-3 mt-4 text-sm rounded-r-lg"><p class="whitespace-pre-line">${WEEKLY_NOTES[currentWeek][subject.name]}</p></div>` : '';

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
            // При клике теперь вызывается функция из модуля modal
            box.addEventListener('click', () => modal.show(box.dataset.key, progressData));
        });
    }

    updateWeeklyProgress(weekIndex, progressData);
    updateNavButtons(weekIndex);
}

export function updateWeeklyProgress(weekIndex, progressData) {
    const weeklyProgressBar = document.getElementById('weekly-progress-bar');
    const weeklyProgressText = document.getElementById('weekly-progress-text');
    if (!weeklyProgressBar) return;

    const currentWeek = weekIndex + 1;
    let recommendedTotal = 0;
    let recommendedCompleted = 0;

    SUBJECTS.forEach((subject) => {
        let subjectCompleted = 0;
        const subjectProgressData = progressData[subject.id] || {};
        for (let i = 1; i <= subject.totalLectures; i++) {
            if (getLectureStatus(subjectProgressData[i]) === 'completed') subjectCompleted++;
        }

        if (currentWeek <= WEEKS_COUNT) {
            recommendedTotal++;
            if (getLectureStatus(subjectProgressData[currentWeek]) === 'completed') recommendedCompleted++;
        }

        const subjectProgressBar = document.getElementById(`progress-${subject.id}`);
        if (subjectProgressBar) {
            const subjectProgress = subject.totalLectures > 0 ? (subjectCompleted / subject.totalLectures) * 100 : 0;
            subjectProgressBar.style.width = `${subjectProgress}%`;
        }
    });

    const weeklyProgress = recommendedTotal > 0 ? (recommendedCompleted / recommendedTotal) * 100 : 0;
    weeklyProgressBar.style.width = `${weeklyProgress}%`;
    weeklyProgressBar.textContent = `${Math.round(weeklyProgress)}%`;
    weeklyProgressText.textContent = `${Math.round(weeklyProgress)}%`;
}

export function updateOverallProgress(progressData) {
    const progressBar = document.getElementById('overall-progress-bar');
    const progressText = document.getElementById('overall-progress-text');
    const quoteText = document.getElementById('motivational-quote');
    if (!progressBar || !progressText || !quoteText) return;

    let totalLectures = 0;
    let completedLectures = 0;
    SUBJECTS.forEach(subject => {
        totalLectures += subject.totalLectures;
        const subjectProgress = progressData[subject.id] || {};
        completedLectures += Object.values(subjectProgress).filter(l => l.vod && l.test).length;
    });

    const percentage = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = percentage > 10 ? `${percentage.toFixed(1)}%` : '';
    progressText.textContent = `${percentage.toFixed(1)}%`;

    let quoteIndex = Math.floor(percentage / 20);
    quoteText.textContent = MOTIVATIONAL_QUOTES[quoteIndex];
}

export function initNavigation(onWeekChange) {
    document.getElementById('prev-week')?.addEventListener('click', () => onWeekChange(-1));
    document.getElementById('next-week')?.addEventListener('click', () => onWeekChange(1));
}

function updateNavButtons(currentWeekIndex) {
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    if(prevWeekBtn) prevWeekBtn.disabled = currentWeekIndex === 0;
    if(nextWeekBtn) nextWeekBtn.disabled = currentWeekIndex >= WEEKS_COUNT;
}