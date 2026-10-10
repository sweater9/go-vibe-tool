import {
  getUtcDateString,
  getDailyQuestions,
  calculateUpdatedStreak,
  generateShareCard
} from './daily-engine.js';

class DailyChallengeApp {
  constructor() {
    this.STORAGE_STATS_KEY = 'it_daily_stats';
    this.STORAGE_TODAY_PREFIX = 'it_daily_completed_';

    this.todayStr = getUtcDateString();
    this.questions = getDailyQuestions(this.todayStr);
    this.currentIndex = 0;
    this.userAnswers = []; // array of { questionId, selectedIndex, isCorrect }
    this.hasAnsweredCurrent = false;

    this.stats = this.loadStats();
    this.alreadyCompletedData = this.checkTodayCompleted();

    this.initDOMElements();
    this.bindEvents();

    if (this.alreadyCompletedData) {
      this.renderCompletedView(this.alreadyCompletedData);
    } else {
      this.renderQuestionView();
    }
  }

  loadStats() {
    try {
      const saved = localStorage.getItem(this.STORAGE_STATS_KEY);
      return saved ? JSON.parse(saved) : {
        currentStreak: 0,
        maxStreak: 0,
        totalPlayed: 0,
        totalCorrect: 0,
        history: {}
      };
    } catch (_) {
      return { currentStreak: 0, maxStreak: 0, totalPlayed: 0, totalCorrect: 0, history: {} };
    }
  }

  saveStats() {
    try {
      localStorage.setItem(this.STORAGE_STATS_KEY, JSON.stringify(this.stats));
    } catch (_) {}
  }

  checkTodayCompleted() {
    try {
      const key = this.STORAGE_TODAY_PREFIX + this.todayStr;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (_) {
      return null;
    }
  }

  recordTodayCompleted(score, userAnswers) {
    try {
      const key = this.STORAGE_TODAY_PREFIX + this.todayStr;
      const payload = {
        dateStr: this.todayStr,
        score,
        userAnswers,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(payload));
      this.alreadyCompletedData = payload;
    } catch (_) {}
  }

  initDOMElements() {
    this.quizContainer = document.getElementById('quizContainer');
    this.progressFill = document.getElementById('progressFill');
    this.progressLabel = document.getElementById('progressLabel');
    this.categoryBadge = document.getElementById('categoryBadge');
    this.streakBadge = document.getElementById('streakBadge');
  }

  bindEvents() {
    // Keep shortcuts scoped to the quiz; native button activation owns Enter/Space.
    this.quizContainer.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || this.alreadyCompletedData) return;
      const options = [...this.quizContainer.querySelectorAll('.quiz-option')];
      const current = options.indexOf(document.activeElement);
      if (!this.hasAnsweredCurrent && current >= 0) {
        let next;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % options.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current + options.length - 1) % options.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = options.length - 1;
        if (next !== undefined) {
          e.preventDefault();
          this.selectOption(next);
          return;
        }
      }
      const key = e.key.toUpperCase();
      const idx = '1234'.includes(key) ? '1234'.indexOf(key) : 'ABCD'.indexOf(key);
      if (!this.hasAnsweredCurrent && idx >= 0) {
        e.preventDefault();
        this.selectOption(idx);
      }
    });

    this.startCountdown();
  }

  renderQuestionView() {
    const q = this.questions[this.currentIndex];
    this.hasAnsweredCurrent = false;

    // Progress updates
    const currentNum = this.currentIndex + 1;
    const totalNum = this.questions.length;
    const pct = ((currentNum - 1) / totalNum) * 100;
    if (this.progressFill) this.progressFill.style.width = `${pct}%`;
    if (this.progressLabel) this.progressLabel.textContent = `Question ${currentNum} of ${totalNum}`;
    if (this.categoryBadge) this.categoryBadge.textContent = q.category;
    if (this.streakBadge) this.streakBadge.textContent = `🔥 ${this.stats.currentStreak} Day Streak`;

    const letters = ['A', 'B', 'C', 'D'];

    this.quizContainer.innerHTML = `
      <div class="quiz-card" role="region" aria-label="Question ${currentNum}">
        <span class="v5-badge featured" style="margin-bottom:12px;">${q.category}</span>
        <h2 style="font-size:22px; line-height:1.35; margin:12px 0 24px; color:var(--ink);">${this.escapeHtml(q.question)}</h2>

        <div class="options-list" role="radiogroup" aria-label="Answer options">
          ${q.options.map((opt, idx) => `
            <button type="button" class="quiz-option" data-idx="${idx}" role="radio" aria-checked="false" tabindex="${idx === 0 ? 0 : -1}">
              <span class="quiz-option-letter">${letters[idx]}</span>
              <span>${this.escapeHtml(opt)}</span>
            </button>
          `).join('')}
        </div>

        <div id="explanationHost"></div>

        <div id="actionRow" class="actions" style="margin-top:20px; display:none;">
          <button id="btnNext" type="button" class="btn" style="width:100%;">
            ${this.currentIndex < this.questions.length - 1 ? 'Next Question →' : 'View Results & Score →'}
          </button>
        </div>
      </div>
    `;

    this.quizContainer.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        this.selectOption(idx);
      });
    });

    document.getElementById('btnNext')?.addEventListener('click', () => {
      this.nextQuestion();
    });
  }

  selectOption(idx) {
    if (this.hasAnsweredCurrent) return;
    this.hasAnsweredCurrent = true;

    const q = this.questions[this.currentIndex];
    const isCorrect = idx === q.correctIndex;

    this.userAnswers.push({
      questionId: q.id,
      selectedIndex: idx,
      isCorrect
    });

    // Update option buttons UI
    const optionBtns = this.quizContainer.querySelectorAll('.quiz-option');
    optionBtns.forEach((btn, i) => {
      btn.setAttribute("aria-disabled", "true");
      btn.tabIndex = i === idx ? 0 : -1;
      btn.setAttribute("aria-checked", String(i === idx));
      if (i === q.correctIndex) {
        btn.classList.add('correct');
      } else if (i === idx && !isCorrect) {
        btn.classList.add('incorrect');
      }
    });

    // Show explanation box
    const expHost = document.getElementById('explanationHost');
    if (expHost) {
      expHost.innerHTML = `
        <div class="explanation-box" aria-live="polite">
          <strong style="color:${isCorrect ? '#059669' : '#dc2626'}; display:block; margin-bottom:4px;">
            ${isCorrect ? '✓ Correct Answer!' : '✗ Incorrect'}
          </strong>
          <p style="margin:0; font-size:14px; color:var(--ink);">${this.escapeHtml(q.explanation)}</p>
        </div>
      `;
    }

    // Reveal Next button
    const actionRow = document.getElementById('actionRow');
    if (actionRow) actionRow.style.display = 'flex';
    optionBtns[idx]?.focus();
  }

  nextQuestion() {
    if (!this.hasAnsweredCurrent) return;
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.renderQuestionView();
      this.quizContainer.querySelector(".quiz-option")?.focus();
    } else {
      this.completeChallenge();
    }
  }

  completeChallenge() {
    const score = this.userAnswers.filter(a => a.isCorrect).length;
    this.stats = calculateUpdatedStreak(this.stats, this.todayStr, score, this.questions.length);
    this.saveStats();
    this.recordTodayCompleted(score, this.userAnswers);

    this.renderCompletedView(this.alreadyCompletedData);
  }

  renderCompletedView(completedData) {
    const score = completedData.score;
    const total = this.questions.length;
    const pct = Math.round((score / total) * 100);

    if (this.progressFill) this.progressFill.style.width = '100%';
    if (this.progressLabel) this.progressLabel.textContent = `Completed (${this.todayStr})`;

    const answerBooleans = (completedData.userAnswers || []).map(a => a.isCorrect);

    this.quizContainer.innerHTML = `
      <div class="quiz-card" style="text-align:center;">
        <span class="v5-badge featured" style="background:#fce7f3; color:#be185d;">Challenge Completed</span>
        <h2 style="font-size:32px; margin:16px 0 8px;">Today's Score: ${score} / ${total}</h2>
        <p style="color:var(--muted); margin:0 0 24px;">You solved ${score} out of ${total} questions correctly (${pct}%).</p>

        <!-- Streak & Stats Grid -->
        <div class="stat-counter-grid">
          <div class="stat-counter-box">
            <strong>${this.stats.currentStreak}</strong>
            <small>Day Streak</small>
          </div>
          <div class="stat-counter-box">
            <strong>${this.stats.maxStreak}</strong>
            <small>Best Streak</small>
          </div>
          <div class="stat-counter-box">
            <strong>${this.stats.totalPlayed}</strong>
            <small>Days Played</small>
          </div>
          <div class="stat-counter-box">
            <strong>${Math.round((this.stats.totalCorrect / (this.stats.totalPlayed * 5 || 1)) * 100)}%</strong>
            <small>Accuracy</small>
          </div>
        </div>

        <!-- Share Button -->
        <div style="margin:24px 0;">
          <button id="btnShareCard" type="button" class="btn" style="background:linear-gradient(110deg,#ec4899,#8b5cf6);">
            📋 Share Result
          </button>
        </div>

        <div style="background:#fafafc; border:1px solid var(--line); border-radius:14px; padding:16px; margin:24px 0; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:14px;">Review Today's Questions</strong>
            <span id="nextDropCountdown" style="font-size:12px; color:var(--muted); font-family:monospace;">Next challenge in: --:--:--</span>
          </div>

          ${this.questions.map((q, idx) => {
            const userAns = (completedData.userAnswers || [])[idx];
            const isUserCorrect = userAns ? userAns.isCorrect : false;
            return `
              <div style="padding:12px 0; border-top:1px solid var(--line); font-size:13px;">
                <div style="display:flex; gap:8px; align-items:flex-start;">
                  <span>${isUserCorrect ? '🟩' : '🟥'}</span>
                  <div>
                    <strong>Q${idx + 1}: ${this.escapeHtml(q.question)}</strong>
                    <div style="color:#065f46; margin:4px 0 2px;">Correct: ${this.escapeHtml(q.options[q.correctIndex])}</div>
                    <small style="color:var(--muted);">${this.escapeHtml(q.explanation)}</small>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Cross-Pillar Recommendations -->
        <div style="margin-top:28px; text-align:left;">
          <span class="eyebrow">CONTINUE LEARNING</span>
          <h3 style="margin:6px 0 12px; font-size:18px;">Recommended for You</h3>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a href="../../knowledge/" class="btn alt small" style="text-decoration:none;">Search Knowledge Base</a>
            <a href="../word-logic/" class="btn alt small" style="text-decoration:none;">Play Word & Logic Challenge →</a>
            <a href="../../labs/" class="btn alt small" style="text-decoration:none;">Explore Interactive Labs →</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnShareCard')?.addEventListener('click', () => {
      const shareText = generateShareCard(this.todayStr, score, total, answerBooleans);
      navigator.clipboard.writeText(shareText).then(() => {
        this.showToast('Result copied to clipboard! Ready to share.');
      }).catch(() => {
        prompt('Copy your score:', shareText);
      });
    });
  }

  startCountdown() {
    const update = () => {
      const el = document.getElementById('nextDropCountdown');
      if (!el) return;
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diffMs = tomorrow - now;
      if (diffMs <= 0) {
        el.textContent = 'New challenge ready! Refresh page.';
        return;
      }
      const hrs = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
      const mins = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
      const secs = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
      el.textContent = `Next drop in: ${hrs}:${mins}:${secs}`;
    };
    setInterval(update, 1000);
    update();
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  showToast(msg) {
    let toast = document.getElementById('dailyToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dailyToast';
      toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:100; padding:12px 20px; border-radius:12px; background:#10b981; color:#fff; font-weight:700; font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.2); transition:opacity .3s;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dailyChallengeApp = new DailyChallengeApp();
});
