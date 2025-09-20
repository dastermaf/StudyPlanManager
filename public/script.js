document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let currentWeekIndex = 0;
    let progressData = {};
    let userToken = null;

    // --- Constants ---
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

    // --- DOM Elements ---
    const authContainer = document.getElementById('auth-container');
    const plannerApp = document.getElementById('planner-app');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const welcomeUser = document.getElementById('welcome-user');

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

    // --- Debounce function for saving ---
    let saveTimeout;
    const debounce = (func, delay) => {
        return (...args) => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- API Calls ---
    const apiFetch = async (endpoint, options = {}) => {
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (userToken) {
            defaultHeaders['Authorization'] = `Bearer ${userToken}`;
        }
        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        };
        const response = await fetch(`/api${endpoint}`, config);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    };

    const saveProgress = async () => {
        if (!userToken) return;
        try {
            await apiFetch('/progress', {
                method: 'POST',
                body: JSON.stringify({ progressData })
            });
            console.log('Progress saved to database.');
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    };
    const debouncedSaveProgress = debounce(saveProgress, 1500);

    const loadProgress = async () => {
        if (!userToken) return;
        try {
            const data = await apiFetch('/progress');
            if (Object.keys(data).length === 0) {
                console.log('No progress found in DB, initializing fresh data.');
                SUBJECTS.forEach(subject => {
                    for (let i = 1; i <= subject.totalLectures; i++) {
                        progressData[`${subject.name}-${i}`] = { vod: false, test: false };
                    }
                });
            } else {
                progressData = data;
            }
        } catch (error) {
            console.error('Failed to load progress:', error);
            // On failure, initialize empty progress
            SUBJECTS.forEach(subject => {
                for (let i = 1; i <= subject.totalLectures; i++) {
                    progressData[`${subject.name}-${i}`] = { vod: false, test: false };
                }
            });
        }
    };

    // --- UI Logic ---
    const showPlanner = async () => {
        const token = localStorage.getItem('accessToken');
        const decodedToken = token ? JSON.parse(atob(token.split('.')[1])) : null;
        if (decodedToken) {
            welcomeUser.textContent = `ようこそ、${decodedToken.username}さん`;
            authContainer.classList.add('hidden');
            plannerApp.classList.remove('hidden');
            await loadProgress();
            renderWeek(currentWeekIndex);
        }
    };

    const showAuth = () => {
        authContainer.classList.remove('hidden');
        plannerApp.classList.add('hidden');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    };

    const getLectureStatus = (lectureProgress) => {
        if (!lectureProgress) return 'incomplete';
        if (lectureProgress.vod && lectureProgress.test) return 'completed';
        if (lectureProgress.vod || lectureProgress.test) return 'in-progress';
        return 'incomplete';
    };

    const updateProgress = () => {
        const currentWeek = currentWeekIndex + 1;
        let recommendedTotal = 0;
        let recommendedCompleted = 0;

        SUBJECTS.forEach((subject, subjectIdx) => {
            let subjectCompleted = 0;
            for (let i = 1; i <= subject.totalLectures; i++) {
                if (getLectureStatus(progressData[`${subject.name}-${i}`]) === 'completed') {
                    subjectCompleted++;
                }
            }

            if (currentWeek <= WEEKS_COUNT) {
                recommendedTotal++;
                if (getLectureStatus(progressData[`${subject.name}-${currentWeek}`]) === 'completed') {
                    recommendedCompleted++;
                }
            }

            const subjectProgressBar = document.getElementById(`progress-${subjectIdx}`);
            const subjectProgress = subject.totalLectures > 0 ? (subjectCompleted / subject.totalLectures) * 100 : 0;
            if(subjectProgressBar) subjectProgressBar.style.width = `${subjectProgress}%`;
        });

        const weeklyProgress = recommendedTotal > 0 ? (recommendedCompleted / recommendedTotal) * 100 : 0;
        weeklyProgressBar.style.width = `${weeklyProgress}%`;
        weeklyProgressText.textContent = `${Math.round(weeklyProgress)}%`;
    };

    const renderWeek = (weekIndex) => {
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
                const card = document.createElement('div');
                const hasImportantNote = WEEKLY_NOTES[currentWeek] && WEEKLY_NOTES[currentWeek][subject.name];
                card.className = `bg-white p-5 rounded-xl shadow-lg flex flex-col justify-between transition-transform transform hover:scale-105 ${hasImportantNote ? 'border-2 border-yellow-400' : ''}`;

                let lecturesHtml = '';
                for (let i = 1; i <= subject.totalLectures; i++) {
                    const key = `${subject.name}-${i}`;
                    const status = getLectureStatus(progressData[key]);
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

            planContainer.querySelectorAll('.lecture-box').forEach(box => {
                box.addEventListener('click', () => showModal(box.dataset.key));
            });
        }

        updateNavButtons();
        updateProgress();
    };

    const showModal = (key) => {
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
    };

    const closeModal = () => {
        modalOverlay.classList.add('opacity-0');
        modalContent.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            modalOverlay.classList.add('hidden');
            modalContent.classList.add('hidden');
            activeModalKey = null;
        }, 300);
    };

    // --- Event Listeners ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        try {
            const data = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: e.target.elements['login-username'].value,
                    password: e.target.elements['login-password'].value,
                }),
            });
            userToken = data.accessToken;
            localStorage.setItem('accessToken', userToken);
            await showPlanner();
        } catch (error) {
            loginError.textContent = 'ユーザー名またはパスワードが正しくありません。';
            loginError.classList.remove('hidden');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.classList.add('hidden');
        try {
            await apiFetch('/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: e.target.elements['register-username'].value,
                    password: e.target.elements['register-password'].value,
                }),
            });
            // Switch to login form after successful registration
            showAuth();
            alert('登録が成功しました！ログインしてください。');
        } catch (error) {
            registerError.textContent = 'このユーザー名はすでに使用されています。';
            registerError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        userToken = null;
        localStorage.removeItem('accessToken');
        progressData = {};
        currentWeekIndex = 0;
        showAuth();
    });

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    const updateNavButtons = () => {
        prevWeekBtn.disabled = currentWeekIndex === 0;
        nextWeekBtn.disabled = currentWeekIndex >= WEEKS_COUNT;
    };

    prevWeekBtn.addEventListener('click', () => { if (currentWeekIndex > 0) { currentWeekIndex--; renderWeek(currentWeekIndex); }});
    nextWeekBtn.addEventListener('click', () => { if (currentWeekIndex < WEEKS_COUNT) { currentWeekIndex++; renderWeek(currentWeekIndex); }});

    modalOverlay.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);

    const handleModalTaskChange = () => {
        if (!activeModalKey) return;
        progressData[activeModalKey] = {
            vod: taskVodCheckbox.checked,
            test: taskTestCheckbox.checked
        };
        debouncedSaveProgress();

        const box = document.querySelector(`.lecture-box[data-key="${activeModalKey}"]`);
        if (box) {
            const status = getLectureStatus(progressData[activeModalKey]);
            const [ , lectureNumStr ] = activeModalKey.split('-');
            const isRecommended = parseInt(lectureNumStr) === (currentWeekIndex + 1);

            box.className = 'lecture-box'; // Reset classes
            if (status === 'completed') box.classList.add('completed');
            else if (status === 'in-progress') box.classList.add('in-progress');
            else if (isRecommended) box.classList.add('recommended');
            else box.classList.add('optional');
        }
        updateProgress();
    };
    taskVodCheckbox.addEventListener('change', handleModalTaskChange);
    taskTestCheckbox.addEventListener('change', handleModalTaskChange);

    // --- Initial Load ---
    const initializeApp = () => {
        userToken = localStorage.getItem('accessToken');
        if (userToken) {
            showPlanner();
        } else {
            showAuth();
        }
    };

    initializeApp();
});

