import { courseData } from './courseData.js';
// ВАЖНО: Удалена некорректная строка "import Chart from '...';"

let dashboardChart = null;

export function showAuthContent() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('main-container').classList.add('hidden');
}

export function showMainContent(username) {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('main-container').classList.remove('hidden');
    document.getElementById('username-display').textContent = username;
}

export function renderUI(progress, onLectureClick, onNoteChange) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';

    Object.keys(courseData).forEach(courseId => {
        const course = courseData[courseId];
        const courseProgress = progress.lectures?.[courseId] || {};

        const courseElement = document.createElement('div');
        courseElement.className = 'bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-md';
        courseElement.innerHTML = `
            <h3 class="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">${course.name}</h3>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                <div id="progress-${courseId}" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
            <div id="lectures-${courseId}" class="grid grid-cols-5 md:grid-cols-10 lg:grid-cols-15 gap-2"></div>
        `;
        mainContent.appendChild(courseElement);

        const lecturesContainer = document.getElementById(`lectures-${courseId}`);
        for (let i = 1; i <= course.lectures; i++) {
            const lectureState = courseProgress[i] || { vod: false, test: false, note: '' };
            const lectureButton = document.createElement('button');
            lectureButton.className = `lecture-btn p-2 rounded text-white font-bold transition-colors duration-300`;
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
        vodCheckbox.onchange = null;
        testCheckbox.onchange = null;
        noteTextarea.oninput = null;
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
    if (vod && test) {
        lectureButton.className = lectureButton.className.replace(/bg-\S+/g, 'bg-green-600 hover:bg-green-700');
    } else if (vod || test) {
        lectureButton.className = lectureButton.className.replace(/bg-\S+/g, 'bg-yellow-500 hover:bg-yellow-600');
    } else {
        lectureButton.className = lectureButton.className.replace(/bg-\S+/g, 'bg-gray-500 hover:bg-gray-600');
    }
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
    document.getElementById('overall-progress-bar').style.width = `${percentage}%`;
    document.getElementById('overall-progress-text').textContent = `${percentage.toFixed(1)}%`;

    const ctx = document.getElementById('progress-chart').getContext('2d');

    if(dashboardChart) {
        dashboardChart.destroy();
    }

    // Используем глобальный объект Chart, который доступен благодаря тегу <script> в index.html
    dashboardChart = new Chart(ctx, {
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
                borderColor: '#1f2937', // gray-800
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
                }
            }
        }
    });
}