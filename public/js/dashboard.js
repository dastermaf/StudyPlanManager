import * as api from './api.js';
import * as theme from './theme.js';
import { SUBJECTS } from './studyPlan.js';

// Глобальные переменные для хранения инстансов графиков, чтобы избежать дублирования
let activityChartInstance = null;
let subjectsChartInstance = null;

// --- ИСПРАВЛЕНИЕ: Более надежная функция для расчета ключевых показателей ---
function calculateKpiData(progress) {
    let totalTasks = 0;
    let completedLectures = 0;
    let totalPossibleLectures = 0;
    const subjectProgress = {};

    // 1. Сначала подсчитываем общее количество возможных лекций из статического списка
    for (const subject of SUBJECTS) {
        totalPossibleLectures += subject.totalLectures || 0;
    }

    // 2. Итерируемся по РЕАЛЬНЫМ данным о прогрессе пользователя
    if (progress && progress.lectures) {
        for (const subjectId in progress.lectures) {
            const subjectData = progress.lectures[subjectId];
            if (!subjectData || typeof subjectData !== 'object') continue;

            const subjectInfo = SUBJECTS.find(s => s.id === subjectId);
            if (!subjectInfo) continue; // Пропускаем, если предмет не найден в основном списке

            let subjectCompletedCount = 0;
            for (const chapterKey in subjectData) {
                if (isNaN(parseInt(chapterKey, 10))) continue; // Пропускаем служебные поля

                const chapter = subjectData[chapterKey];
                if (chapter?.vod?.checked) totalTasks++;
                if (chapter?.test?.checked) totalTasks++;

                if (chapter?.vod?.checked && chapter?.test?.checked) {
                    subjectCompletedCount++;
                }
            }
            completedLectures += subjectCompletedCount;
            subjectProgress[subjectInfo.name] = subjectInfo.totalLectures > 0
                ? (subjectCompletedCount / subjectInfo.totalLectures) * 100
                : 0;
        }
    }

    const overallCompletion = totalPossibleLectures > 0 ? (completedLectures / totalPossibleLectures) * 100 : 0;

    let bestSubject = '...';
    let maxProgress = -1;
    for (const name in subjectProgress) {
        if (subjectProgress[name] > maxProgress) {
            maxProgress = subjectProgress[name];
            bestSubject = name;
        }
    }
    // Если прогресса нет, оставляем значение по умолчанию
    if (maxProgress < 0 || bestSubject === '...') {
        bestSubject = '未開始'; // "Еще не начато"
    }


    return { totalTasks, overallCompletion, bestSubject, subjectProgress };
}


// --- Функции отрисовки ---

function renderKpiCards({ totalTasks, overallCompletion, bestSubject }) {
    const totalTasksEl = document.getElementById('total-tasks-stat');
    const overallCompletionEl = document.getElementById('overall-completion-stat');
    const bestSubjectEl = document.getElementById('best-subject-stat');

    if (totalTasksEl) totalTasksEl.textContent = totalTasks;
    if (overallCompletionEl) overallCompletionEl.textContent = `${overallCompletion.toFixed(1)}%`;
    if (bestSubjectEl) bestSubjectEl.textContent = bestSubject;
}

function renderActivityChart(progress) {
    const activityByDay = {};
    const ninetyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 90));

    if (progress && progress.lectures) {
        for (const subjectId in progress.lectures) {
            const subject = progress.lectures[subjectId];
            for (const chapterKey in subject) {
                if (isNaN(parseInt(chapterKey, 10))) continue;
                const chapter = subject[chapterKey];
                ['vod', 'test'].forEach(taskType => {
                    if (chapter[taskType]?.checked && chapter[taskType].timestamp) {
                        const date = new Date(chapter[taskType].timestamp);
                        if (date >= ninetyDaysAgo) {
                            const day = date.toISOString().split('T')[0];
                            activityByDay[day] = (activityByDay[day] || 0) + 1;
                        }
                    }
                });
            }
        }
    }

    const labels = Object.keys(activityByDay).sort();
    const data = labels.map(day => activityByDay[day]);

    const ctx = document.getElementById('activity-chart')?.getContext('2d');
    if (!ctx) return;

    if (activityChartInstance) {
        activityChartInstance.destroy();
    }
    activityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '完了したタスク',
                data: data,
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { type: 'time', time: { unit: 'week' }, adapters: { date: { locale: dateFns.ja } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderSubjectsChart({ subjectProgress }) {
    const labels = Object.keys(subjectProgress);
    const data = Object.values(subjectProgress);
    const backgroundColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#6EE7B7', '#FBBF24'];

    const ctx = document.getElementById('subjects-chart')?.getContext('2d');
    if (!ctx) return;

    if (subjectsChartInstance) {
        subjectsChartInstance.destroy();
    }
    subjectsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: '科目別完了率',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 20
                    }
                }
            }
        }
    });
}

// --- Обработка данных и вызов отрисовки ---
function processDataForCharts(progress) {
    if (!progress) {
        // Устанавливаем значения по умолчанию, если нет данных
        renderKpiCards({ totalTasks: 0, overallCompletion: 0, bestSubject: '未開始' });
        return;
    }

    const kpiData = calculateKpiData(progress);
    renderKpiCards(kpiData);
    renderActivityChart(progress);
    renderSubjectsChart(kpiData);
}

// --- Экспорт данных ---
function exportData(progress) {
    try {
        const dataStr = JSON.stringify(progress, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `study-plan-progress-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("データのエクスポートに失敗しました:", error);
        alert("データのエクスポートに失敗しました。");
    }
}

// --- Инициализация ---
async function initialize() {
    try {
        await api.getCurrentUser();
    } catch (e) {
        window.location.href = '/';
        return;
    }

    try {
        const progress = await api.getProgress();

        document.getElementById('export-btn')?.addEventListener('click', () => exportData(progress));
        theme.applyTheme(progress.settings?.theme || 'light');
        theme.init((key, value) => {
            if (progress.settings) progress.settings[key] = value;
        });

        processDataForCharts(progress);
    } catch (e) {
        console.error("進捗データの読み込みに失敗しました:", e);
        if (!window.location.pathname.includes('/error')) {
            window.location.href = '/error?code=PROGRESS_LOAD_FAILED';
        }
    }
}

document.addEventListener('DOMContentLoaded', initialize);

