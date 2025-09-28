import * as api from './api.js';
import * as theme from './theme.js';
import { SUBJECTS } from './studyPlan.js';

let progress = {};
let activityChart = null;
let subjectsChart = null;

const SUBJECT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#6EE7B7', '#FBBF24'];

function renderKpiCards(completedTasks, overallProgress, topSubject) {
    const completedTasksEl = document.getElementById('kpi-completed-tasks');
    const overallProgressEl = document.getElementById('kpi-overall-progress');
    const topSubjectEl = document.getElementById('kpi-top-subject');

    if (completedTasksEl) completedTasksEl.textContent = completedTasks;
    if (overallProgressEl) overallProgressEl.textContent = `${overallProgress.toFixed(1)}%`;
    if (topSubjectEl) topSubjectEl.textContent = topSubject;
}

function renderActivityChart(chartData) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    if (activityChart) {
        activityChart.destroy();
    }
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
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { type: 'time', time: { unit: 'week', tooltipFormat: 'yyyy/MM/dd' }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return new Date(context[0].label).toLocaleDateString('ja-JP');
                        }
                    }
                }
            }
        }
    });
}

function renderSubjectsChart(chartData) {
    const ctx = document.getElementById('subjects-chart').getContext('2d');
    if (subjectsChart) {
        subjectsChart.destroy();
    }
    subjectsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: '完了率',
                data: chartData.data,
                backgroundColor: SUBJECT_COLORS,
                borderColor: '#F9FAFB', // dark:bg-gray-800
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

function processDataForCharts() {
    // --- ИСПРАВЛЕНИЕ: Добавлена проверка на наличие progress.lectures ---
    if (!progress || !progress.lectures) {
        console.warn("データがないため、表示できません。");
        // Можно отобразить сообщение об ошибке для пользователя
        return;
    }

    const activity = {};
    let completedTasksTotal = 0;
    const today = new Date();
    const ninetyDaysAgo = new Date(new Date().setDate(today.getDate() - 90));

    Object.values(progress.lectures).forEach(subject => {
        Object.keys(subject).forEach(chapterKey => {
            if (isNaN(parseInt(chapterKey, 10))) return; // Пропускаем _subjectPinned
            const chapter = subject[chapterKey];
            ['vod', 'test'].forEach(taskType => {
                if (chapter && chapter[taskType]?.checked) {
                    completedTasksTotal++;
                    if (chapter[taskType].timestamp) {
                        const date = new Date(chapter[taskType].timestamp);
                        if (date >= ninetyDaysAgo) {
                            const day = date.toISOString().split('T')[0];
                            activity[day] = (activity[day] || 0) + 1;
                        }
                    }
                }
            });
        });
    });

    const subjectProgressList = SUBJECTS.map(subject => {
        const lectures = progress.lectures?.[subject.id] || {};
        const completed = Object.values(lectures).filter(l => l && l.vod?.checked && l.test?.checked).length;
        const total = subject.totalLectures || 1; // Избегаем деления на ноль
        const percentage = (completed / total) * 100;
        return { name: subject.name, progress: percentage };
    });

    const topSubject = subjectProgressList.length > 0
        ? subjectProgressList.reduce((max, s) => s.progress > max.progress ? s : max, subjectProgressList[0]).name
        : 'N/A';

    const overallProgress = subjectProgressList.reduce((sum, s) => sum + s.progress, 0) / (subjectProgressList.length || 1);

    renderKpiCards(completedTasksTotal, overallProgress, topSubject);

    const activityLabels = Object.keys(activity).sort();
    const activityData = activityLabels.map(d => activity[d]);
    renderActivityChart({ labels: activityLabels, data: activityData });

    const subjectLabels = subjectProgressList.map(s => s.name);
    const subjectData = subjectProgressList.map(s => s.progress);
    renderSubjectsChart({ labels: subjectLabels, data: subjectData });
}

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
        theme.applyTheme(progress.settings?.theme || 'light');
        theme.init((key, value) => {
            if (progress.settings) progress.settings[key] = value;
        });
        processDataForCharts();
    } catch (e) {
        console.error("進捗データの読み込みに失敗しました:", e);
        window.location.href = '/error?code=PROGRESS_LOAD_FAILED';
    }
}

document.addEventListener('DOMContentLoaded', initialize);

