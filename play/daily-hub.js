/* Daily Challenge Hub: read-only presentation of existing local game saves.
   No network, tracking, new account, or artificial completion/streak writes. */
(function () {
  'use strict';
  const host = document.getElementById('daily-challenge-hub');
  if (!host) return;
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
  const pad = n => String(n).padStart(2, '0');
  const date = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = date(new Date());
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = date(yesterdayDate);
  const word = read('it_play_dailyword_daily');
  const wordStats = read('it_play_dailyword_stats') || {};
  const arcade = read('vibearcade:v1') || {};
  const arcadeDaily = arcade.daily && typeof arcade.daily === 'object' ? arcade.daily : {};
  const wordDone = word && word.date === today && (word.status === 'won' || word.status === 'lost');
  const wordStarted = word && word.date === today && word.status === 'playing' && Array.isArray(word.guesses) && word.guesses.length > 0;
  const wordStreak = (wordStats.lastWonDate === today || wordStats.lastWonDate === yesterday) ? Math.max(0, Number(wordStats.current) || 0) : 0;
  const arcadeStreak = arcade.streak && (arcade.streak.last === today || arcade.streak.last === yesterday) ? Math.max(0, Number(arcade.streak.count) || 0) : 0;
  const arcadeDone = Boolean(arcadeDaily[today] && (arcadeDaily[today].completed || arcadeDaily[today].done));
  const add = (tag, cls, value, parent) => { const el = document.createElement(tag); if (cls) el.className = cls; el.textContent = value; (parent || host).appendChild(el); return el; };
  add('h2', '', "Today's challenges");
  add('p', 'sub', 'Your progress stays on this device. Play offline, no account needed.');
  const grid = add('div', 'v5-grid', '');
  function card(title, status, streak, href, action) {
    const article = add('article', 'v5-card', '', grid);
    add('h3', '', title, article);
    add('p', '', status, article);
    add('p', 'sub', 'Current streak: ' + streak + (streak === 1 ? ' day' : ' days'), article);
    const link = add('a', 'btn', action, article); link.href = href;
    link.style.cssText = 'text-decoration:none;display:inline-block;align-self:flex-start';
  }
  card('Daily Word', wordDone ? 'Completed today' : wordStarted ? 'In progress' : 'Ready to play', wordStreak, 'daily-word/', wordStarted ? 'Continue Playing' : wordDone ? 'Play Practice' : 'Play Today');
  card('Vibe Arcade', arcadeDone ? 'Daily challenge completed' : 'Daily challenge available', arcadeStreak, 'vibe-arcade/', 'Open Daily Challenges');
  if (window.GVTContinue && typeof window.GVTContinue.get === 'function') {
    const resumable = window.GVTContinue.get();
    if (resumable.length) {
      const item = resumable[0], link = add('a', 'btn', 'Continue Playing: ' + item.title);
      link.href = item.path.replace(/^play\//, '');
      link.style.cssText = 'display:inline-block;margin-top:12px;text-decoration:none';
    }
  }
})();
