import * as api from './api.js';
import * as theme from './theme.js';
import { SUBJECTS } from './studyPlan.js';

let progress = {};

// グラフの色（科目別）
const SUBJECT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#6EE7B7', '#FBBF24'];

// --- グラフ描画関数 ---
function renderActivityChart(chartData) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: '完了したタスク',
                data: chartData.data,
                backgroundColor: 'rgba(79, 70, 229, 0.8)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { type: 'time', time: { unit: 'week' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// 科目別進捗リスト（バー表示）
function renderSubjectsList(labels, data) {
    const list = document.getElementById('subjects-list');
    if (!list) return;
    list.innerHTML = '';
    labels.forEach((label, i) => {
        const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
        const val = Math.max(0, Math.min(100, Number(data[i]) || 0));
        const row = document.createElement('div');
        row.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${label}</span>
                <span class="text-xs text-gray-500">${val}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div class="h-3 rounded-full" style="width:${val}%; background-color:${color}"></div>
            </div>
        `;
        list.appendChild(row);
    });
}

// 科目別凡例の描画（Chartスタブでは凡例を自前で描く）
function renderSubjectsLegend(labels, data) {
    const legend = document.getElementById('subjects-legend');
    if (!legend) return;
    legend.innerHTML = '';
    labels.forEach((label, i) => {
        const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
        const val = typeof data[i] === 'number' ? data[i] : 0;
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 text-sm';
        item.innerHTML = `<span class="inline-block w-3 h-3 rounded-full" style="background-color:${color}"></span><span>${label} ${val}%</span>`;
        legend.appendChild(item);
    });
}

// 活動サマリーの描画
function renderActivitySummary(labels, data) {
    const box = document.getElementById('activity-summary');
    if (!box) return;
    const total = (data || []).reduce((a, b) => a + (Number(b) || 0), 0);
    const last = (labels && labels.length) ? labels[labels.length - 1] : '—';
    box.textContent = `直近90日: 合計 ${total} タスク / 最終活動日: ${last}`;
}

// --- データ処理 ---
function processDataForCharts() {
    const activity = {};
    const subjectProgress = {};
    const today = new Date();
    const ninetyDaysAgo = new Date(new Date().setDate(today.getDate() - 90));

    Object.values(progress.lectures || {}).forEach(subject => {
        Object.values(subject).forEach(chapter => {
            ['vod', 'test'].forEach(taskType => {
                if (chapter[taskType]?.checked && chapter[taskType].timestamp) {
                    const date = new Date(chapter[taskType].timestamp);
                    if (date >= ninetyDaysAgo) {
                        const day = date.toISOString().split('T')[0];
                        activity[day] = (activity[day] || 0) + 1;
                    }
                }
            });
        });
    });

    SUBJECTS.forEach(subject => {
        const lectures = progress.lectures?.[subject.id] || {};
        const completed = Object.values(lectures).filter(l => l.vod?.checked && l.test?.checked).length;
        const total = subject.totalLectures || 0;
        const perc = total > 0 ? (completed / total) * 100 : 0;
        subjectProgress[subject.name] = Number(perc.toFixed(1));
    });

    const labels = Object.keys(activity).sort();
    const data = labels.map(d => activity[d]);
    const activityChartData = { labels, data };

    const subjectLabels = Object.keys(subjectProgress);
    const subjectData = subjectLabels.map(k => subjectProgress[k]);
    const subjectsChartData = {
        labels: subjectLabels,
        data: subjectData
    };

    renderActivityChart(activityChartData);
    renderActivitySummary(labels, data);
    renderSubjectsList(subjectLabels, subjectData);
}

// --- データエクスポート ---
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

// --- 初期化 ---
async function initialize() {
    // Проверяем аутентификацию через cookie, запрашивая текущего пользователя
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
            // Дашборд не сохраняет прогресс, только отображает
        });
        processDataForCharts();
    } catch (e) {
        console.error("進捗データの読み込みに失敗しました:", e);
        window.location.href = '/error?code=PROGRESS_LOAD_FAILED';
    }
}

document.addEventListener('DOMContentLoaded', initialize);