import { SUBJECTS, WEEKLY_NOTES } from './studyPlan.js';

export const WEEKS_COUNT = 15;

// --- 内部状態（進捗参照と保存関数、現在の週） ---
let progressRef = null; // 参照用（app.jsから受け取る）
let onSaveProgress = null; // デバウンス保存関数（app.jsから受け取る）
let currentWeekIdx = 0; // 直近で描画した週

// app.jsから進捗参照と保存関数を受け取り、UIイベントから保存できるようにする
export function configureProgress(progress, saveCb) {
    progressRef = progress;
    onSaveProgress = saveCb;
}

const MOTIVATIONAL_QUOTES = [
    "「学び続ける者は、常に若い。」- ソクラテス",
    "「今日の小さな一歩が、明日の大きな飛躍になる。」",
    "「成功の秘訣は、目標に向かって着実に進むことだ。」",
    "「困難は、成長の機会である。」",
    "「知識への投資は、常に最高のリターンをもたらす。」- ベンジャミン・フランクリン",
    "「完了！」"
];

function getChapterStatus(chapterProgress) {
    if (!chapterProgress) return 'incomplete';
    if (chapterProgress.vod?.checked && chapterProgress.test?.checked) return 'completed';
    if (chapterProgress.vod?.checked || chapterProgress.test?.checked) return 'in-progress';
    return 'incomplete';
}

export function showMainContent(username) {
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) usernameDisplay.textContent = `ようこそ、${username}さん`;
}

export function renderWeek(weekIndex, progressData) {
    // 現在の週を保持（ピン変更後の再描画に使用）
    currentWeekIdx = weekIndex;
    const planContainer = document.getElementById('plan-container');
    const finalPrepContainer = document.getElementById('final-prep-container');
    const weekTitle = document.getElementById('week-title');
    const weekPeriod = document.getElementById('week-period');

    // Надежная проверка: если мы не на главной странице, ничего не делаем
    if (!planContainer || !finalPrepContainer || !weekTitle || !weekPeriod) {
        console.warn("UI: Элементы для рендеринга недели не найдены. Операция отменена.");
        return;
    }

    planContainer.innerHTML = '';

    const sortedSubjects = [...SUBJECTS].sort((a, b) => {
        const isAPinned = (progressData[a.id] || {})._subjectPinned === true;
        const isBPinned = (progressData[b.id] || {})._subjectPinned === true;
        if (isAPinned && !isBPinned) return -1;
        if (!isAPinned && isBPinned) return 1;
        return 0;
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
            const hasImportantNote = WEEKLY_NOTES[currentWeek] && WEEKLY_NOTES[currentWeek][subject.name];
            const isPinned = (progressData[subject.id] || {})._subjectPinned === true;

            card.className = `bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg flex flex-col justify-between ${hasImportantNote ? 'border-2 border-yellow-400' : ''}`;

            let lecturesHtml = '';
            // 章の並び順：章ピン機能は廃止。通常順で表示
            for (let i = 1; i <= subject.totalLectures; i++) {
                const chapterProgress = progressData[subject.id]?.[i];
                const status = getChapterStatus(chapterProgress);
                const isRecommended = i === currentWeek;

                let lectureClass = 'optional';
                if (status === 'completed') lectureClass = 'completed';
                else if (status === 'in-progress') lectureClass = 'in-progress';
                else if (isRecommended) lectureClass = 'recommended';

                lecturesHtml += `<a href="/materials/${subject.id}/${i}" class="lecture-box ${lectureClass}">第${i}章</a>`;
            }

            const pinBtn = `<button type=\"button\" class=\"pin-subject-btn ml-2 text-gray-400 hover:text-yellow-500 transition-colors ${isPinned ? 'text-yellow-500' : ''}\" data-subject=\"${subject.id}\" title=\"この科目をピン留め\" aria-label=\"この科目をピン留め\">★</button>`;

            let noteHtml = hasImportantNote ? `<div class=\"important-note p-3 mt-4 text-sm rounded-r-lg\"><p class=\"whitespace-pre-line\">${WEEKLY_NOTES[currentWeek][subject.name]}</p></div>` : '';

            card.innerHTML = `
                <div>
                    <h3 class=\"font-bold text-lg text-indigo-800 dark:text-indigo-300 flex items-center\">${subject.name} ${pinBtn}</h3>
                    <p class=\"text-xs text-gray-500 dark:text-gray-400 mb-4\">総進捗 (完了した講義数)</p>
                    <div class=\"w-full progress-bar-bg rounded-full h-2.5 mb-4\">
                        <div id=\"progress-${subject.id}\" class=\"progress-bar-fg h-2.5 rounded-full\"></div>
                    </div>
                    <div class=\"lecture-grid\">${lecturesHtml}</div>
                    ${noteHtml}
                </div>
            `;
            planContainer.appendChild(card);
        });
    }

    updateWeeklyProgress(weekIndex, progressData);
    updateNavButtons(weekIndex);
}

// --- ピンボタンのイベント処理（イベントデリゲーション） ---
// 科目単位でピンを1つだけ保持（他の科目をピンすると置き換え）
if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('button.pin-subject-btn');
        if (!btn) return;
        if (!progressRef || !onSaveProgress) return;
        const subjectId = btn.dataset.subject;
        if (!progressRef.lectures) progressRef.lectures = {};
        // すべての科目のピンを外す
        SUBJECTS.forEach(s => {
            if (!progressRef.lectures[s.id]) progressRef.lectures[s.id] = {};
            progressRef.lectures[s.id]._subjectPinned = false;
        });
        // トグル: すでにピンされていれば全解除、未ピンならこの科目をピン
        const wasPinned = progressRef.lectures[subjectId]._subjectPinned === true;
        progressRef.lectures[subjectId]._subjectPinned = !wasPinned;
        if (progressRef.lectures[subjectId]._subjectPinned) {
            // 他は全て false にしたので単一ピン状態
        }
        try { onSaveProgress && onSaveProgress(); } catch {}
        try { renderWeek(currentWeekIdx, progressRef.lectures); } catch {}
    });
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
            if (getChapterStatus(subjectProgressData[i]) === 'completed') {
                subjectCompleted++;
            }
        }

        if (currentWeek <= WEEKS_COUNT) {
            recommendedTotal++;
            if (getChapterStatus(subjectProgressData[currentWeek]) === 'completed') {
                recommendedCompleted++;
            }
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
        completedLectures += Object.values(subjectProgress).filter(l => l.vod?.checked && l.test?.checked).length;
    });

    const percentage = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = percentage > 10 ? `${percentage.toFixed(1)}%` : '';
    progressText.textContent = `${percentage.toFixed(1)}%`;

    let quoteIndex = Math.floor(percentage / 20);
    quoteText.textContent = MOTIVATIONAL_QUOTES[quoteIndex];
}

export function initNavigation(onWeekChange) {
    // 週移動ボタンの視認性改善（アイコンとARIAラベル設定）
    const prev = document.getElementById('prev-week');
    const next = document.getElementById('next-week');
    if (prev) {
        prev.setAttribute('aria-label', '前の週');
        prev.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>';
    }
    if (next) {
        next.setAttribute('aria-label', '次の週');
        next.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';
    }
    document.getElementById('prev-week')?.addEventListener('click', () => onWeekChange(-1));
    document.getElementById('next-week')?.addEventListener('click', () => onWeekChange(1));
}

function updateNavButtons(currentWeekIndex) {
    // ボタンの無効化状態に応じて透明度も調整し、視覚的に分かりやすくする
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    if(prevWeekBtn) {
        prevWeekBtn.disabled = currentWeekIndex === 0;
        prevWeekBtn.classList.toggle('opacity-60', prevWeekBtn.disabled);
    }
    if(nextWeekBtn) {
        nextWeekBtn.disabled = currentWeekIndex >= WEEKS_COUNT;
        nextWeekBtn.classList.toggle('opacity-60', nextWeekBtn.disabled);
    }
}