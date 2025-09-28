import * as api from './api.js';
import * as theme from './theme.js';
import { SUBJECTS } from './studyPlan.js';

let progress = {};
let activityChart = null;
let subjectsChart = null;

// Цвета для диаграммы по предметам
const SUBJECT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#6EE7B7', '#FBBF24'];

// --- Функции отрисовки графиков ---

function renderActivityChart(chartData, isDarkMode) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    if (activityChart) {
        activityChart.destroy();
    }

    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const labelColor = isDarkMode ? '#d1d5db' : '#374151';

    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: '完了したタスク',
                data: chartData.data,
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
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: labelColor,
                    },
                    grid: { color: gridColor }
                },
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'yyyy/MM/dd',
                        displayFormats: {
                            day: 'M/d'
                        }
                    },
                    ticks: { color: labelColor },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            return dateFns.format(new Date(context[0].label), 'yyyy年M月d日');
                        }
                    }
                }
            }
        }
    });
}

function renderSubjectsChart(chartData, isDarkMode) {
    const ctx = document.getElementById('subjects-chart').getContext('2d');
    if (subjectsChart) {
        subjectsChart.destroy();
    }

    const labelColor = isDarkMode ? '#d1d5db' : '#374151';

    subjectsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: SUBJECT_COLORS,
                borderColor: isDarkMode ? '#1f2937' : '#ffffff',
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
                        color: labelColor,
                        padding: 15,
                        boxWidth: 12,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed.toFixed(1) + '%';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


// --- Обработка данных и обновление UI ---

function processData() {
    const lectures = progress.lectures || {};

    // 1. Расчет для карточек
    let totalTasks = 0;
    let totalLectures = 0;
    let completedLectures = 0;
    const subjectProgress = {};

    SUBJECTS.forEach(subject => {
        totalLectures += subject.totalLectures;
        const subjLectures = lectures[subject.id] || {};
        let subjCompleted = 0;
        Object.values(subjLectures).forEach(chapter => {
            if(chapter.vod?.checked) totalTasks++;
            if(chapter.test?.checked) totalTasks++;
            if(chapter.vod?.checked && chapter.test?.checked) {
                subjCompleted++;
            }
        });
        completedLectures += subjCompleted;
        subjectProgress[subject.name] = subject.totalLectures > 0 ? (subjCompleted / subject.totalLectures) * 100 : 0;
    });

    const overallCompletion = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
    const bestSubject = Object.entries(subjectProgress).reduce((best, current) => current[1] > best[1] ? current : best, ["-", 0]);

    document.getElementById('total-tasks-stat').textContent = totalTasks;
    document.getElementById('overall-completion-stat').textContent = `${overallCompletion.toFixed(1)}%`;
    document.getElementById('best-subject-stat').textContent = bestSubject[0];

    // 2. Данные для графика активности (последние 90 дней)
    const activity = new Map();
    const today = new Date();
    const ninetyDaysAgo = dateFns.subDays(today, 90);

    Object.values(lectures).forEach(subject => {
        Object.values(subject).forEach(chapter => {
            ['vod', 'test'].forEach(taskType => {
                if (chapter[taskType]?.checked && chapter[taskType].timestamp) {
                    const date = new Date(chapter[taskType].timestamp);
                    if (date >= ninetyDaysAgo) {
                        const day = dateFns.format(date, 'yyyy-MM-dd');
                        activity.set(day, (activity.get(day) || 0) + 1);
                    }
                }
            });
        });
    });

    const sortedActivity = [...activity.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
    const activityChartData = {
        labels: sortedActivity.map(d => d[0]),
        data: sortedActivity.map(d => d[1])
    };

    // 3. Данные для круговой диаграммы
    const subjectsChartData = {
        labels: Object.keys(subjectProgress),
        data: Object.values(subjectProgress)
    };

    const isDarkMode = document.documentElement.classList.contains('dark');
    renderActivityChart(activityChartData, isDarkMode);
    renderSubjectsChart(subjectsChartData, isDarkMode);
}

// --- Экспорт данных ---
function exportData() {
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
        const user = await api.getCurrentUser();
        if (!user) {
            window.location.href = '/';
            return;
        }
    } catch (e) {
        window.location.href = '/';
        return;
    }

    document.getElementById('export-btn')?.addEventListener('click', exportData);

    try {
        progress = await api.getProgress();
        theme.init((key, value) => {
            if (progress.settings) progress.settings[key] = value;
            // При смене темы перерисовываем графики с новыми цветами
            const isDarkMode = value === 'dark';
            if (activityChart) {
                const activityData = {
                    labels: activityChart.data.labels,
                    data: activityChart.data.datasets[0].data
                };
                renderActivityChart(activityData, isDarkMode);
            }
            if (subjectsChart) {
                const subjectsData = {
                    labels: subjectsChart.data.labels,
                    data: subjectsChart.data.datasets[0].data
                };
                renderSubjectsChart(subjectsData, isDarkMode);
            }
        });
        theme.applyTheme(progress.settings?.theme || 'light');
        processData();
    } catch (e) {
        console.error("進捗データの読み込みに失敗しました:", e);
        window.location.href = '/error?code=PROGRESS_LOAD_FAILED';
    }
}

document.addEventListener('DOMContentLoaded', initialize);
