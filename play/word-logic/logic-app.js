import {
  DIFFICULTY_LEVELS,
  PUZZLE_CATALOG,
  evaluateGuess,
  getHint,
  calculatePuzzleScore
} from './logic-engine.js';

class WordLogicApp {
  constructor() {
    this.STORAGE_STATS_KEY = 'it_play_wordlogic_stats';
    this.currentDifficulty = DIFFICULTY_LEVELS.NOVICE;
    this.puzzleIndex = 0;
    this.currentPuzzle = null;

    this.slots = [];
    this.activeSlotIndex = 0;
    this.attempts = [];
    this.hintsUsed = 0;
    this.eliminatedKeys = new Set();
    this.resolvedClues = new Set();
    this.startTime = Date.now();
    this.isCompleted = false;

    this.stats = this.loadStats();

    this.initDOMElements();
    this.bindEvents();
    this.loadPuzzle(this.currentDifficulty, 0);
  }

  loadStats() {
    try {
      const saved = localStorage.getItem(this.STORAGE_STATS_KEY);
      return saved ? JSON.parse(saved) : { totalSolved: 0, bestScores: {} };
    } catch (_) {
      return { totalSolved: 0, bestScores: {} };
    }
  }

  saveStats() {
    try {
      localStorage.setItem(this.STORAGE_STATS_KEY, JSON.stringify(this.stats));
    } catch (_) {}
  }

  initDOMElements() {
    this.difficultySelect = document.getElementById('difficultySelect');
    this.puzzleTitle = document.getElementById('puzzleTitle');
    this.slotsContainer = document.getElementById('slotsContainer');
    this.cluesList = document.getElementById('cluesList');
    this.attemptsHistory = document.getElementById('attemptsHistory');
    this.keyboardContainer = document.getElementById('keyboardContainer');
    this.hintBtn = document.getElementById('btnUseHint');
    this.hintDisplay = document.getElementById('hintDisplay');
    this.attemptCountBadge = document.getElementById('attemptCountBadge');
  }

  bindEvents() {
    // Difficulty Change
    this.difficultySelect?.addEventListener('change', (e) => {
      this.currentDifficulty = e.target.value;
      this.loadPuzzle(this.currentDifficulty, 0);
    });

    // Next / Prev Puzzle
    document.getElementById('btnNextPuzzle')?.addEventListener('click', () => {
      const list = PUZZLE_CATALOG[this.currentDifficulty];
      this.loadPuzzle(this.currentDifficulty, (this.puzzleIndex + 1) % list.length);
    });

    // Restart
    document.getElementById('btnRestartPuzzle')?.addEventListener('click', () => {
      this.restartCurrentPuzzle();
    });

    // Hint
    this.hintBtn?.addEventListener('click', () => {
      this.useHint();
    });

    // Physical Keyboard Input
    window.addEventListener('keydown', (e) => {
      if (this.isCompleted) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        this.inputLetter(key);
      } else if (e.key === 'Backspace') {
        this.handleBackspace();
      } else if (e.key === 'ArrowLeft') {
        this.setActiveSlot(Math.max(0, this.activeSlotIndex - 1));
      } else if (e.key === 'ArrowRight') {
        this.setActiveSlot(Math.min(this.slots.length - 1, this.activeSlotIndex + 1));
      } else if (e.key === 'Enter') {
        this.submitGuess();
      }
    });

    this.renderOnScreenKeyboard();
  }

  loadPuzzle(difficulty, index) {
    const list = PUZZLE_CATALOG[difficulty] || PUZZLE_CATALOG[DIFFICULTY_LEVELS.NOVICE];
    this.puzzleIndex = index % list.length;
    this.currentPuzzle = list[this.puzzleIndex];

    const len = this.currentPuzzle.secretWord.length;
    this.slots = new Array(len).fill('');
    this.activeSlotIndex = 0;
    this.attempts = [];
    this.hintsUsed = 0;
    this.eliminatedKeys = new Set();
    this.resolvedClues = new Set();
    this.startTime = Date.now();
    this.isCompleted = false;

    if (this.puzzleTitle) {
      this.puzzleTitle.textContent = `${this.currentPuzzle.title} (${len} Letters)`;
    }
    if (this.hintDisplay) {
      this.hintDisplay.innerHTML = '';
    }
    if (this.hintBtn) {
      this.hintBtn.disabled = false;
      this.hintBtn.textContent = '💡 Get Clue Hint (2 Left)';
    }

    this.renderSlots();
    this.renderClues();
    this.renderAttempts();
    this.updateKeyboardState();
    this.updateAttemptBadge();
    this.showToast(`Loaded puzzle: ${this.currentPuzzle.title}`);
  }

  restartCurrentPuzzle() {
    this.loadPuzzle(this.currentDifficulty, this.puzzleIndex);
    this.showToast('Puzzle restarted');
  }

  renderSlots() {
    this.slotsContainer.innerHTML = this.slots.map((char, idx) => `
      <div class="cipher-slot ${idx === this.activeSlotIndex ? 'active' : ''} ${char ? 'filled' : ''}" data-idx="${idx}" role="textbox" aria-label="Letter ${idx + 1}" tabindex="0">
        ${this.escapeHtml(char)}
      </div>
    `).join('');

    this.slotsContainer.querySelectorAll('.cipher-slot').forEach(el => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        this.setActiveSlot(idx);
      });
    });
  }

  setActiveSlot(idx) {
    this.activeSlotIndex = idx;
    this.slotsContainer.querySelectorAll('.cipher-slot').forEach((el, i) => {
      if (i === idx) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  inputLetter(char) {
    if (this.isCompleted) return;
    this.slots[this.activeSlotIndex] = char;
    this.renderSlots();
    if (this.activeSlotIndex < this.slots.length - 1) {
      this.setActiveSlot(this.activeSlotIndex + 1);
    }
  }

  handleBackspace() {
    if (this.isCompleted) return;
    if (this.slots[this.activeSlotIndex]) {
      this.slots[this.activeSlotIndex] = '';
    } else if (this.activeSlotIndex > 0) {
      this.setActiveSlot(this.activeSlotIndex - 1);
      this.slots[this.activeSlotIndex] = '';
    }
    this.renderSlots();
  }

  submitGuess() {
    if (this.isCompleted) return;
    const guess = this.slots.join('');
    if (guess.length < this.currentPuzzle.secretWord.length || this.slots.includes('')) {
      this.showToast('Please fill all letter slots before submitting', true);
      return;
    }

    const evaluation = evaluateGuess(guess, this.currentPuzzle.secretWord);
    if (!evaluation.valid) {
      this.showToast(evaluation.error, true);
      return;
    }

    this.attempts.unshift(evaluation);

    // Update eliminated keys on keyboard
    evaluation.letterResults.forEach(r => {
      if (r.status === 'absent') {
        this.eliminatedKeys.add(r.letter);
      }
    });

    this.renderAttempts();
    this.updateKeyboardState();
    this.updateAttemptBadge();

    if (evaluation.isExactMatch) {
      this.handlePuzzleComplete();
    } else {
      this.showToast('Not quite! Review clues and letter status.');
    }
  }

  handlePuzzleComplete() {
    this.isCompleted = true;
    const elapsedSecs = Math.max(10, Math.round((Date.now() - this.startTime) / 1000));
    const score = calculatePuzzleScore(this.currentDifficulty, this.attempts.length, this.hintsUsed, elapsedSecs);

    this.stats.totalSolved = (this.stats.totalSolved || 0) + 1;
    this.stats.bestScores = this.stats.bestScores || {};
    this.stats.bestScores[this.currentPuzzle.id] = Math.max(this.stats.bestScores[this.currentPuzzle.id] || 0, score);
    this.saveStats();

    // Mark slots confirmed in green
    this.slotsContainer.querySelectorAll('.cipher-slot').forEach(el => {
      el.classList.add('confirmed');
    });

    const completionModal = document.createElement('div');
    completionModal.id = 'completionModal';
    completionModal.style.cssText = 'position:fixed; inset:0; background:rgba(16,18,37,.6); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:200; padding:20px;';
    completionModal.innerHTML = `
      <div style="background:#fff; border-radius:24px; padding:36px; max-width:480px; width:100%; text-align:center; box-shadow:0 25px 70px rgba(0,0,0,.3); animation:fadeIn .25s ease;">
        <span class="v5-badge featured" style="background:#dcfce7; color:#15803d; font-size:12px; margin-bottom:12px;">Crypt Decoded!</span>
        <h2 style="font-size:32px; margin:12px 0 8px; letter-spacing:-.03em;">"${this.currentPuzzle.secretWord}"</h2>
        <p style="color:var(--muted); margin:0 0 24px;">You cracked the code in ${this.attempts.length} ${this.attempts.length === 1 ? 'attempt' : 'attempts'} and ${elapsedSecs}s!</p>

        <div style="background:var(--surface-2); border-radius:16px; padding:20px; margin-bottom:24px; display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div>
            <strong style="font-size:26px; color:var(--brand);">${score}</strong>
            <small style="display:block; color:var(--muted); text-transform:uppercase; font-size:11px; font-weight:750;">Score Points</small>
          </div>
          <div>
            <strong style="font-size:26px; color:var(--ink);">${this.stats.totalSolved}</strong>
            <small style="display:block; color:var(--muted); text-transform:uppercase; font-size:11px; font-weight:750;">Total Solved</small>
          </div>
        </div>

        <div class="actions" style="justify-content:center; gap:12px;">
          <button id="btnModalNext" type="button" class="btn" style="background:linear-gradient(110deg,#ec4899,#8b5cf6);">Next Puzzle →</button>
          <button id="btnModalClose" type="button" class="btn alt">Close Review</button>
        </div>
      </div>
    `;

    document.body.appendChild(completionModal);

    document.getElementById('btnModalNext')?.addEventListener('click', () => {
      completionModal.remove();
      const list = PUZZLE_CATALOG[this.currentDifficulty];
      this.loadPuzzle(this.currentDifficulty, (this.puzzleIndex + 1) % list.length);
    });

    document.getElementById('btnModalClose')?.addEventListener('click', () => {
      completionModal.remove();
    });
  }

  useHint() {
    if (this.hintsUsed >= 2) {
      this.showToast('No more hints available for this puzzle', true);
      return;
    }

    this.hintsUsed++;
    const hint = getHint(this.currentPuzzle, this.slots, this.hintsUsed);

    if (hint.type === 'reveal_letter') {
      this.slots[hint.index] = hint.letter;
      this.renderSlots();
    } else if (hint.type === 'eliminate_letters') {
      hint.letters.forEach(l => this.eliminatedKeys.add(l));
      this.updateKeyboardState();
    }

    if (this.hintDisplay) {
      this.hintDisplay.innerHTML = `
        <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:10px 14px; font-size:13px; color:#92400e; margin-top:12px;">
          <strong>💡 ${this.escapeHtml(hint.message)}</strong>
        </div>
      `;
    }

    if (this.hintBtn) {
      const remaining = 2 - this.hintsUsed;
      this.hintBtn.textContent = `💡 Get Clue Hint (${remaining} Left)`;
      if (remaining === 0) this.hintBtn.disabled = true;
    }

    this.showToast('Hint applied (-150 pts penalty)');
  }

  renderClues() {
    this.cluesList.innerHTML = this.currentPuzzle.clues.map((clue, idx) => `
      <div class="clue-item ${this.resolvedClues.has(idx) ? 'resolved' : ''}" data-idx="${idx}">
        <input type="checkbox" class="clue-checkbox" ${this.resolvedClues.has(idx) ? 'checked' : ''} aria-label="Mark clue resolved">
        <span>${this.escapeHtml(clue)}</span>
      </div>
    `).join('');

    this.cluesList.querySelectorAll('.clue-checkbox').forEach(box => {
      box.addEventListener('change', (e) => {
        const item = e.target.closest('.clue-item');
        const idx = parseInt(item.getAttribute('data-idx'), 10);
        if (e.target.checked) {
          this.resolvedClues.add(idx);
          item.classList.add('resolved');
        } else {
          this.resolvedClues.delete(idx);
          item.classList.remove('resolved');
        }
      });
    });
  }

  renderAttempts() {
    if (!this.attemptsHistory) return;
    if (this.attempts.length === 0) {
      this.attemptsHistory.innerHTML = '<div style="color:var(--muted); font-size:12px; text-align:center; padding:14px;">No guesses submitted yet.</div>';
      return;
    }

    this.attemptsHistory.innerHTML = this.attempts.map((att, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); font-size:13px;">
        <span style="font-weight:750; color:var(--muted); font-size:11px;">Attempt ${this.attempts.length - i}</span>
        <div style="display:flex; gap:5px;">
          ${att.letterResults.map(r => `
            <span style="display:inline-grid; place-items:center; width:28px; height:28px; border-radius:6px; font-weight:800; font-size:13px; color:#fff; background:${r.status === 'correct' ? '#10b981' : (r.status === 'misplaced' ? '#f59e0b' : '#94a3b8')};">
              ${r.letter}
            </span>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  renderOnScreenKeyboard() {
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
    ];

    this.keyboardContainer.innerHTML = rows.map(row => `
      <div style="display:flex; gap:6px; justify-content:center; width:100%; margin-bottom:6px;">
        ${row.map(k => `
          <button type="button" class="key-btn ${k === 'ENTER' || k === '⌫' ? 'action-key' : ''}" data-key="${k}">
            ${k}
          </button>
        `).join('')}
      </div>
    `).join('');

    this.keyboardContainer.querySelectorAll('.key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const k = e.currentTarget.getAttribute('data-key');
        if (k === 'ENTER') this.submitGuess();
        else if (k === '⌫') this.handleBackspace();
        else this.inputLetter(k);
      });
    });
  }

  updateKeyboardState() {
    this.keyboardContainer.querySelectorAll('.key-btn').forEach(btn => {
      const k = btn.getAttribute('data-key');
      if (this.eliminatedKeys.has(k)) {
        btn.classList.add('eliminated');
      } else {
        btn.classList.remove('eliminated');
      }
    });
  }

  updateAttemptBadge() {
    if (this.attemptCountBadge) {
      this.attemptCountBadge.textContent = `${this.attempts.length} Attempts`;
    }
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  showToast(msg, isError = false) {
    let toast = document.getElementById('logicToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'logicToast';
      toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:100; padding:12px 20px; border-radius:12px; color:#fff; font-weight:700; font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.2); transition:opacity .3s;';
      document.body.appendChild(toast);
    }
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.wordLogicApp = new WordLogicApp();
});
