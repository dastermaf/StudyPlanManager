document.addEventListener('DOMContentLoaded', () => {
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

    let currentWeekIndex = 0;
    let progressData = {};
    const storageKey = 'studentStudyPlanProgress_v3_C251147';

    // DOM Elements
    const planContainer = document.getElementById('plan-container');
    const finalPrepContainer = document.getElementById('final-prep-container');
    const weekTitle = document.getElementById('week-title');
    const weekPeriod = document.getElementById('week-period');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const weeklyProgressBar = document.getElementById('weekly-progress-bar');
    const weeklyProgressText = document.getElementById('weekly-progress-text');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalCloseBtn = document.getElementById('modal-close');
    const taskVodCheckbox = document.getElementById('task-vod');
    const taskTestCheckbox = document.getElementById('task-test');
    let activeModalKey = null;

    function saveProgress() {
        localStorage.setItem(storageKey, JSON.stringify(progressData));
    }

    function loadProgress() {
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
            progressData = JSON.parse(savedData);
        } else {
            SUBJECTS.forEach(subject => {
                for (let i = 1; i <= subject.totalLectures; i++) {
                    progressData[`${subject.name}-${i}`] = { vod: false, test: false };
                }
            });
        }
    }

    function getLectureStatus(lectureProgress) {
        if (!lectureProgress) return 'incomplete';
        if (lectureProgress.vod && lectureProgress.test) return 'completed';
        if (lectureProgress.vod || lectureProgress.test) return 'in-progress';
        return 'incomplete';
    }

    function updateProgress() {
        const currentWeek = currentWeekIndex + 1;
        let recommendedTotal = 0;
        let recommendedCompleted = 0;

        SUBJECTS.forEach((subject, subjectIdx) => {
            let subjectCompleted = 0;
            for (let i = 1; i <= subject.totalLectures; i++) {
                const status = getLectureStatus(progressData[`${subject.name}-${i}`]);
                if (status === 'completed') {
                    subjectCompleted++;
                }
            }

            if (currentWeek <= WEEKS_COUNT) {
                recommendedTotal++;
                const recommendedStatus = getLectureStatus(progressData[`${subject.name}-${currentWeek}`]);
                if (recommendedStatus === 'completed') {
                    recommendedCompleted++;
                }
            }

            const subjectProgressBar = document.getElementById(`progress-${subjectIdx}`);
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

    function renderWeek(weekIndex) {
        planContainer.innerHTML = '';

        if (weekIndex >= WEEKS_COUNT) {
            planContainer.classList.add('hidden');
            finalPrepContainer.classList.remove('hidden');
            weekTitle.textContent = '最終準備期間';
            weekPeriod.textContent = '1/5～2/1';
            updateNavButtons();
            return;
        }

        planContainer.classList.remove('hidden');
        finalPrepContainer.classList.add('hidden');

        const currentWeek = weekIndex + 1;
        weekTitle.textContent = `第 ${currentWeek} 週`;
        const startDate = new Date(2025, 8, 22 + weekIndex * 7);
        const endDate = new Date(2025, 8, 22 + weekIndex * 7 + 6);
        weekPeriod.textContent = `${startDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric'})}～${endDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric'})}`;

        SUBJECTS.forEach((subject, subjectIdx) => {
            const card = document.createElement('div');
            const hasImportantNote = WEEKLY_NOTES[currentWeek] && WEEKLY_NOTES[currentWeek][subject.name];
            card.className = `bg-white p-5 rounded-xl shadow-lg flex flex-col justify-between transition-transform transform hover:scale-105 ${hasImportantNote ? 'border-2 border-yellow-400' : ''}`;

            let lecturesHtml = '';
            for (let i = 1; i <= subject.totalLectures; i++) {
                const key = `${subject.name}-${i}`;
                const lectureProgress = progressData[key];
                const status = getLectureStatus(lectureProgress);
                const isRecommended = i === currentWeek;

                let lectureClass = 'optional';
                if (status === 'completed') lectureClass = 'completed';
                else if (status === 'in-progress') lectureClass = 'in-progress';
                else if (isRecommended) lectureClass = 'recommended';

                lecturesHtml += `<div class="lecture-box ${lectureClass}" data-key="${key}" data-subject="${subject.name}" data-lecture="${i}">${i}</div>`;
            }

            let noteHtml = hasImportantNote ? `<div class="important-note border-l-4 p-3 mt-4 text-sm rounded-r-lg"><p>${WEEKLY_NOTES[currentWeek][subject.name]}</p></div>` : '';

            card.innerHTML = `
                <div>
                    <h3 class="font-bold text-lg text-indigo-800">${subject.name}</h3>
                    <p class="text-xs text-gray-500 mb-4">総進捗 (完了した講義数)</p>
                    <div class="w-full progress-bar-bg rounded-full h-2.5 mb-4">
                        <div id="progress-${subjectIdx}" class="progress-bar-fg h-2.5 rounded-full"></div>
                    </div>
                    <div class="lecture-grid">${lecturesHtml}</div>
                    ${noteHtml}
                </div>
            `;
            planContainer.appendChild(card);
        });

        document.querySelectorAll('.lecture-box').forEach(box => {
            box.addEventListener('click', () => showModal(box.dataset.key));
        });

        updateNavButtons();
        updateProgress();
    }

    function showModal(key) {
        activeModalKey = key;
        const [subject, lecture] = key.split('-');
        modalTitle.textContent = `${subject} - 第${lecture}回`;

        const lectureProgress = progressData[key];
        taskVodCheckbox.checked = lectureProgress.vod;
        taskTestCheckbox.checked = lectureProgress.test;

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
        progressData[activeModalKey] = {
            vod: taskVodCheckbox.checked,
            test: taskTestCheckbox.checked
        };
        saveProgress();

        // Live update the box color without a full re-render
        const box = document.querySelector(`.lecture-box[data-key="${activeModalKey}"]`);
        if (box) {
            const status = getLectureStatus(progressData[activeModalKey]);
            const isRecommended = parseInt(box.dataset.lecture) === (currentWeekIndex + 1);

            box.className = 'lecture-box'; // Reset classes
            if (status === 'completed') box.classList.add('completed');
            else if (status === 'in-progress') box.classList.add('in-progress');
            else if (isRecommended) box.classList.add('recommended');
            else box.classList.add('optional');
        }
        updateProgress();
    }

    modalOverlay.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    taskVodCheckbox.addEventListener('change', handleModalTaskChange);
    taskTestCheckbox.addEventListener('change', handleModalTaskChange);

    function updateNavButtons() {
        prevWeekBtn.disabled = currentWeekIndex === 0;
        nextWeekBtn.disabled = currentWeekIndex >= WEEKS_COUNT;
    }

    function showNextWeek() {
        if (currentWeekIndex < WEEKS_COUNT) { currentWeekIndex++; renderWeek(currentWeekIndex); }
    }

    function showPrevWeek() {
        if (currentWeekIndex > 0) { currentWeekIndex--; renderWeek(currentWeekIndex); }
    }

    prevWeekBtn.addEventListener('click', showPrevWeek);
    nextWeekBtn.addEventListener('click', showNextWeek);

    // Initial Load
    loadProgress();
    renderWeek(currentWeekIndex);
});
