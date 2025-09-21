import { courseData } from './courseData.js';

let dashboardChart = null;

export function showAuthContent() {
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');

    // ИСПРАВЛЕНИЕ: Проверяем, существует ли элемент, перед изменением класса
    if (authContainer) authContainer.classList.remove('hidden');
    if (mainContainer) mainContainer.classList.add('hidden');
}

export function showMainContent(username) {
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const usernameDisplay = document.getElementById('username-display');

    // ИСПРАВЛЕНИЕ: Проверяем, существует ли элемент, перед изменением класса
    if (authContainer) authContainer.classList.add('hidden');
    if (mainContainer) mainContainer.classList.remove('hidden');
    if (usernameDisplay) usernameDisplay.textContent = username;
}

export function renderUI(progress, onLectureClick, onNoteChange) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return; // Выходим, если не на главной странице
    mainContent.innerHTML = ''; // Очищаем содержимое перед рендерингом

    // Добавляем контейнер для дашборда
    const dashboardElement = document.createElement('div');
    dashboardElement.className = 'bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8';
    dashboardElement.innerHTML = `
        <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Общий прогресс</h2>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
            <div id="overall-progress-bar" class="bg-indigo-600 h-4 rounded-full transition-all duration-500" style="width: 0%;"></div>
        </div>
        <p id="overall-progress-text" class="text-right font-bold text-lg text-indigo-600 dark:text-indigo-400">0%</p>
        <div class="mt-6 h-64 md:h-80 relative">
            <canvas id="progress-chart"></canvas>
        </div>
    `;
    mainContent.appendChild(dashboardElement);


    Object.keys(courseData).forEach(courseId => {
        const course = courseData[courseId];
        const courseProgress = progress.lectures?.[courseId] || {};

        const courseElement = document.createElement('div');
        courseElement.className = 'bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6'; // Добавлен mb-6
        courseElement.innerHTML = `
            <h3 class="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">${course.name}</h3>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                <div id="progress-${courseId}" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
            <div id="lectures-${courseId}" class="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-15 gap-2"></div>
        `;
        mainContent.appendChild(courseElement);

        const lecturesContainer = document.getElementById(`lectures-${courseId}`);
        for (let i = 1; i <= course.lectures; i++) {
            const lectureState = courseProgress[i] || { vod: false, test: false, note: '' };
            const lectureButton = document.createElement('button');
            lectureButton.className = `lecture-btn p-2 rounded text-white font-bold transition-colors duration-300 w-10 h-10 flex items-center justify-center`;
            lectureButton.textContent = i;
            lectureButton.dataset.courseId = courseId;
            lectureButton.dataset.lectureId = i;

            lectureButton.addEventListener('click', () => showLectureModal(courseId, i, lectureState, onLectureClick, onNoteChange));

            lecturesContainer.appendChild(lectureButton);
            updateLectureState(courseId, i, lectureState);
        }
        updateCourseProgress(courseId, courseProgress);
    });
    updateDashboard(progress.lectures);
}

function showLectureModal(courseId, lectureId, lectureState, onLectureClick, onNoteChange) {
    const course = courseData[courseId];
    const modal = document.getElementById('lecture-modal');
    document.getElementById('modal-title').textContent = `${course.name} - 第${lectureId}回`;

    const vodCheckbox = document.getElementById('vod-checkbox');
    const testCheckbox = document.getElementById('test-checkbox');
    const noteTextarea = document.getElementById('note-textarea');

    vodCheckbox.checked = lectureState.vod;
    testCheckbox.checked = lectureState.test;
    noteTextarea.value = lectureState.note || '';

    // Удаляем старые обработчики, чтобы избежать дублирования
    vodCheckbox.onchange = null;
    testCheckbox.onchange = null;
    noteTextarea.oninput = null;

    const handleVodChange = () => onLectureClick(courseId, lectureId, 'vod');
    const handleTestChange = () => onLectureClick(courseId, lectureId, 'test');

    let noteTimeout;
    const handleNoteInput = (e) => {
        clearTimeout(noteTimeout);
        noteTimeout = setTimeout(() => {
            onNoteChange(courseId, lectureId, e.target.value);
        }, 500);
    };

    vodCheckbox.onchange = handleVodChange;
    testCheckbox.onchange = handleTestChange;
    noteTextarea.oninput = handleNoteInput;

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    document.getElementById('close-modal-btn').onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    modal.classList.remove('hidden');
}


export function updateLectureState(courseId, lectureId, lectureState) {
    const lectureButton = document.querySelector(`[data-course-id="${courseId}"][data-lecture-id="${lectureId}"]`);
    if (!lectureButton) return;

    const { vod, test } = lectureState;
    let colorClasses = '';
    if (vod && test) {
        colorClasses = 'bg-green-600 hover:bg-green-700';
    } else if (vod || test) {
        colorClasses = 'bg-yellow-500 hover:bg-yellow-600';
    } else {
        colorClasses = 'bg-gray-500 hover:bg-gray-600';
    }
    // Заменяем только классы цвета, сохраняя остальные
    lectureButton.className = lectureButton.className.replace(/bg-\S+/g, '').replace(/hover:bg-\S+/g, '') + ' ' + colorClasses;
}

export function updateCourseProgress(courseId, courseProgress) {
    const course = courseData[courseId];
    const progressBar = document.getElementById(`progress-${courseId}`);
    if (!progressBar) return;

    const completed = Object.values(courseProgress).filter(l => l.vod && l.test).length;
    const percentage = (completed / course.lectures) * 100;
    progressBar.style.width = `${percentage}%`;
}


export function updateDashboard(allLecturesProgress) {
    const overallProgressBar = document.getElementById('overall-progress-bar');
    const overallProgressText = document.getElementById('overall-progress-text');
    const chartCtx = document.getElementById('progress-chart')?.getContext('2d');

    if (!overallProgressBar || !overallProgressText || !chartCtx) {
        console.warn("LOG: ui.js: Элементы дашборда не найдены, обновление отменено.");
        return;
    }

    const totalLectures = Object.values(courseData).reduce((sum, course) => sum + course.lectures, 0);
    let completedLectures = 0;
    let partiallyCompletedLectures = 0;

    if (allLecturesProgress) {
        Object.values(allLecturesProgress).forEach(course => {
            Object.values(course).forEach(lecture => {
                if (lecture.vod && lecture.test) {
                    completedLectures++;
                } else if (lecture.vod || lecture.test) {
                    partiallyCompletedLectures++;
                }
            });
        });
    }

    const uncompletedLectures = totalLectures - completedLectures - partiallyCompletedLectures;

    const percentage = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
    overallProgressBar.style.width = `${percentage}%`;
    overallProgressText.textContent = `${percentage.toFixed(1)}%`;


    if(dashboardChart) {
        dashboardChart.destroy();
    }

    dashboardChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: ['完了', '進行中', '未完了'],
            datasets: [{
                data: [completedLectures, partiallyCompletedLectures, uncompletedLectures],
                backgroundColor: [
                    '#16a34a', // green-600
                    '#f59e0b', // amber-500
                    '#6b7280'  // gray-500
                ],
                borderColor: document.body.classList.contains('dark') ? '#1f2937' : '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.body.classList.contains('dark') ? '#d1d5db' : '#374151',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    bodyFont: {
                        size: 14
                    },
                    titleFont: {
                        size: 16
                    }
                }
            }
        }
    });
}