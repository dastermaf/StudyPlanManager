// ==========================================================================
// 定数定義
// ==========================================================================
const CONSTANTS = {
  SESSIONS_PER_SUBJECT: 15,
  MINUTES_PER_SESSION: 90,
  CREDITS_PER_SUBJECT: 2,
  MAX_CREDITS: 22,
  MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24
};

// ==========================================================================
// DOM要素の取得
// ==========================================================================
const elements = {
  form: document.getElementById('studyForm'),
  subjects: document.getElementById('subjects'),
  subjectDetails: document.getElementById('subject-details'),
  startDate: document.getElementById('startDate'),
  endDate: document.getElementById('endDate'),
  results: document.getElementById('results'),
  summary: document.getElementById('summary'),
  progressBar: document.getElementById('progress-bar'),
  detailedInfo: document.getElementById('detailed-info'),
  recommendation: document.getElementById('recommendation'),
  dailySchedule: document.getElementById('daily-schedule')
};

// ==========================================================================
// ユーティリティ関数
// ==========================================================================
const utils = {
  createElement(tag, className, textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  },

  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins > 0 ? mins + '分' : ''}`;
  },

  calculateDaysBetween(startDate, endDate) {
    return Math.ceil((endDate - startDate) / CONSTANTS.MILLISECONDS_PER_DAY);
  },

  getProgressStatus(progressDifference) {
    if (progressDifference >= 10) {
      return '<span style="color: #27ae60;">（予定より進んでいます 👍）</span>';
    } else if (progressDifference <= -10) {
      return '<span style="color: #e74c3c;">（予定より遅れています ⚠️）</span>';
    } else {
      return '<span style="color: #f39c12;">（ほぼ予定通りです ✓）</span>';
    }
  }
};

// ==========================================================================
// メインクラス
// ==========================================================================
class StudyPaceCalculator {
  constructor() {
    this.today = new Date();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.generateSubjectInputs();
  }

  setupEventListeners() {
    elements.subjects.addEventListener('change', () => this.generateSubjectInputs());
    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.calculatePace();
    });
  }

  generateSubjectInputs() {
    const numSubjects = parseInt(elements.subjects.value);
    elements.subjectDetails.innerHTML = '';

    if (isNaN(numSubjects) || numSubjects <= 0) return;

    for (let i = 0; i < numSubjects; i++) {
      const subjectItem = this.createSubjectItem(i);
      elements.subjectDetails.appendChild(subjectItem);
    }
  }

  createSubjectItem(index) {
    const subjectDiv = utils.createElement('div', 'subject-item');

    // 科目名入力
    const nameDiv = utils.createElement('div', 'subject-name');
    const nameLabel = utils.createElement('label', '', `科目${index + 1}の名称:`);
    nameLabel.htmlFor = `subject-name-${index}`;
    const nameInput = utils.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `subject-name-${index}`;
    nameInput.placeholder = `科目${index + 1}の名称`;
    nameInput.value = `科目${index + 1}`;

    nameDiv.appendChild(nameLabel);
    nameDiv.appendChild(nameInput);

    // 進捗選択
    const progressDiv = utils.createElement('div', 'subject-progress');
    const progressLabel = utils.createElement('label', '', '学習済み回数:');
    progressLabel.htmlFor = `subject-progress-${index}`;
    const progressSelect = utils.createElement('select');
    progressSelect.id = `subject-progress-${index}`;

    for (let j = 0; j <= CONSTANTS.SESSIONS_PER_SUBJECT; j++) {
      const option = utils.createElement('option', '', `${j}/${CONSTANTS.SESSIONS_PER_SUBJECT}回`);
      option.value = j;
      progressSelect.appendChild(option);
    }

    progressDiv.appendChild(progressLabel);
    progressDiv.appendChild(progressSelect);

    subjectDiv.appendChild(nameDiv);
    subjectDiv.appendChild(progressDiv);

    return subjectDiv;
  }

  validateInputs(numSubjects, startDate, endDate) {
    if (isNaN(numSubjects) || numSubjects <= 0) {
      alert('有効な科目数を入力してください');
      return false;
    }

    if (startDate >= endDate) {
      alert('学期開始日は終了日より前である必要があります');
      return false;
    }

    return true;
  }

  collectSubjectData(numSubjects) {
    const subjects = [];
    let totalCompletedSessions = 0;

    for (let i = 0; i < numSubjects; i++) {
      const nameInput = document.getElementById(`subject-name-${i}`);
      const progressSelect = document.getElementById(`subject-progress-${i}`);

      if (nameInput && progressSelect) {
        const name = nameInput.value || `科目${i + 1}`;
        const completedSessions = parseInt(progressSelect.value);
        totalCompletedSessions += completedSessions;

        subjects.push({
          name,
          completedSessions,
          totalSessions: CONSTANTS.SESSIONS_PER_SUBJECT,
          progressPercentage: (completedSessions / CONSTANTS.SESSIONS_PER_SUBJECT) * 100
        });
      }
    }

    return { subjects, totalCompletedSessions };
  }

  calculatePace() {
    const numSubjects = parseInt(elements.subjects.value);
    const startDate = new Date(elements.startDate.value);
    const endDate = new Date(elements.endDate.value);

    if (!this.validateInputs(numSubjects, startDate, endDate)) return;

    const { subjects, totalCompletedSessions } = this.collectSubjectData(numSubjects);
    const totalSessions = numSubjects * CONSTANTS.SESSIONS_PER_SUBJECT;

    const calculations = this.performCalculations({
      numSubjects,
      totalCompletedSessions,
      totalSessions,
      startDate,
      endDate
    });

    this.displayResults(calculations, subjects);
  }

  performCalculations({ numSubjects, totalCompletedSessions, totalSessions, startDate, endDate }) {
    const overallProgressPercentage = (totalCompletedSessions / totalSessions) * 100;
    const remainingSessions = totalSessions - totalCompletedSessions;
    const remainingStudyMinutes = remainingSessions * CONSTANTS.MINUTES_PER_SESSION;
    const daysRemaining = Math.ceil((endDate - this.today) / CONSTANTS.MILLISECONDS_PER_DAY);
    const dailyStudyMinutes = Math.ceil(remainingStudyMinutes / Math.max(1, daysRemaining));
    const totalDays = utils.calculateDaysBetween(startDate, endDate);
    const daysPassed = Math.max(0, Math.min(totalDays, utils.calculateDaysBetween(this.today, startDate)));
    const timeProgressPercentage = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));
    const progressDifference = overallProgressPercentage - timeProgressPercentage;
    const credits = numSubjects * CONSTANTS.CREDITS_PER_SUBJECT;

    return {
      numSubjects,
      overallProgressPercentage,
      remainingSessions,
      totalSessions,
      remainingStudyMinutes,
      daysRemaining,
      dailyStudyMinutes,
      totalDays,
      daysPassed,
      timeProgressPercentage,
      progressDifference,
      credits,
      startDate,
      endDate
    };
  }

  displayResults(calc, subjects) {
    elements.results.classList.remove('hidden');

    this.updateProgressBar(calc.overallProgressPercentage);
    this.displaySummary(calc);
    this.displayDetailedInfo(calc, subjects);
    this.displayRecommendation(calc);
    this.displayWeeklySchedule(calc.dailyStudyMinutes);
  }

  updateProgressBar(percentage) {
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressBar.textContent = `${Math.round(percentage)}%`;
  }

  displaySummary(calc) {
    const creditWarning = calc.credits > CONSTANTS.MAX_CREDITS ?
      '<p class="warning">注意: 履修単位数が半期の上限（22単位）を超えています。</p>' : '';

    const progressStatus = utils.getProgressStatus(calc.progressDifference);

    elements.summary.innerHTML = `
      <p>履修科目数: <strong>${calc.numSubjects}科目</strong> (${calc.credits}単位)${creditWarning}</p>
      <p>残り日数: <strong>${calc.daysRemaining}日</strong> (${this.today.toLocaleDateString('ja-JP')} から ${calc.endDate.toLocaleDateString('ja-JP')} まで)</p>
      <p>学期の経過: <strong>${calc.timeProgressPercentage}%</strong> (${calc.totalDays}日中${calc.daysPassed}日経過)</p>
      <p>学習進捗: <strong>${Math.round(calc.overallProgressPercentage)}%</strong> ${progressStatus}</p>
      <p>残りの授業回数: <strong>${calc.remainingSessions}回</strong> (合計${calc.totalSessions}回中)</p>
    `;
  }

  displayDetailedInfo(calc, subjects) {
    const subjectProgressHTML = this.generateSubjectProgressHTML(subjects);

    elements.detailedInfo.innerHTML = `
      <p>残りの総学習時間: <strong>${Math.round(calc.remainingStudyMinutes / 60 * 10) / 10}時間</strong> (${calc.remainingStudyMinutes}分)</p>
      <p>1日あたりの必要学習時間: <strong>${utils.formatTime(calc.dailyStudyMinutes)}</strong></p>
      ${subjectProgressHTML}
    `;
  }

  generateSubjectProgressHTML(subjects) {
    let html = '<div class="subject-progress-list"><h4>科目別進捗状況</h4>';

    subjects.forEach(subject => {
      html += `
        <div class="subject-item">
          <div class="subject-name">
            <strong>${subject.name}</strong>
            <div class="subject-progress-bar">
              <div class="subject-progress-fill" style="width: ${subject.progressPercentage}%"></div>
            </div>
          </div>
          <div class="subject-progress">
            <span>${subject.completedSessions}/${subject.totalSessions}回完了</span>
            <span style="float: right;">${Math.round(subject.progressPercentage)}%</span>
          </div>
        </div>
      `;
    });

    return html + '</div>';
  }

  displayRecommendation(calc) {
    const recommendations = this.getRecommendations(calc.dailyStudyMinutes, calc.progressDifference);
    elements.recommendation.innerHTML = recommendations;
  }

  getRecommendations(dailyStudyMinutes, progressDifference) {
    let recommendation = '';

    if (dailyStudyMinutes <= 60) {
      recommendation = `
        <h4>学習ペース推奨</h4>
        <p>1日あたり<strong>${utils.formatTime(dailyStudyMinutes)}</strong>の学習が必要です。無理のないペースです。毎日コンスタントに学習を続けましょう。</p>
      `;
    } else if (dailyStudyMinutes <= 120) {
      recommendation = `
        <h4>学習ペース推奨</h4>
        <p>1日あたり<strong>${utils.formatTime(dailyStudyMinutes)}</strong>の学習が必要です。平日は1～2時間、休日はまとめて学習するといいでしょう。</p>
      `;
    } else if (dailyStudyMinutes <= 180) {
      recommendation = `
        <h4>学習ペース推奨（やや忙しい）</h4>
        <p>1日あたり<strong>${utils.formatTime(dailyStudyMinutes)}</strong>の学習が必要です。計画的に学習を進める必要があります。平日2時間、休日は4時間程度の学習をお勧めします。</p>
      `;
    } else {
      recommendation = `
        <h4>学習ペース推奨（かなり忙しい）</h4>
        <p>1日あたり<strong>${utils.formatTime(dailyStudyMinutes)}</strong>の学習が必要です。このペースはかなりハードです。可能であれば、<strong>まだ受講回数の少ない科目に集中する</strong>か、毎日コンスタントに学習時間を確保する必要があります。</p>
      `;
    }

    // 進捗状況に応じた追加アドバイス
    if (progressDifference <= -15) {
      recommendation += `
        <p class="warning">現在の学習進捗は予定より大幅に遅れています。以下の対策を検討してください：</p>
        <ul>
          <li>優先順位の高い科目に集中する</li>
          <li>特に進捗率の低い科目から取り組む</li>
          <li>週末や休日に集中的に学習する時間を確保する</li>
        </ul>
      `;
    } else if (progressDifference >= 15) {
      recommendation += `
        <p style="color: #27ae60;">現在の学習進捗は予定よりも進んでいます。このペースを維持しつつ、以下も意識するとよいでしょう：</p>
        <ul>
          <li>内容の理解度を確認する復習の時間を設ける</li>
          <li>進んでいる科目の知識を定着させるための演習に取り組む</li>
          <li>進捗の遅れている科目があれば、そちらにも時間を振り分ける</li>
        </ul>
      `;
    }

    return recommendation;
  }

  displayWeeklySchedule(dailyStudyMinutes) {
    const schedule = this.calculateWeeklySchedule(dailyStudyMinutes);

    elements.dailySchedule.innerHTML = `
      <h4>週間学習スケジュール案</h4>
      <div class="schedule-item">平日（月～金）: <strong>${utils.formatTime(schedule.weekday)}/日</strong></div>
      <div class="schedule-item">休日（土・日）: <strong>${utils.formatTime(schedule.weekend)}/日</strong></div>
      <p>※この配分を目安に、自分のライフスタイルに合わせて調整してください。</p>
    `;
  }

  calculateWeeklySchedule(dailyStudyMinutes) {
    const weeklyStudyMinutes = dailyStudyMinutes * 7;
    let weekdayMinutes, weekendMinutes;

    if (dailyStudyMinutes <= 60) {
      weekdayMinutes = dailyStudyMinutes;
      weekendMinutes = dailyStudyMinutes;
    } else if (dailyStudyMinutes <= 120) {
      weekdayMinutes = Math.round(dailyStudyMinutes * 0.8);
      weekendMinutes = Math.round((weeklyStudyMinutes - (weekdayMinutes * 5)) / 2);
    } else {
      weekdayMinutes = Math.round(dailyStudyMinutes * 0.6);
      weekendMinutes = Math.round((weeklyStudyMinutes - (weekdayMinutes * 5)) / 2);
    }

    return {
      weekday: weekdayMinutes,
      weekend: weekendMinutes
    };
  }
}

// ==========================================================================
// アプリケーション初期化
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  new StudyPaceCalculator();
});
