/* GoVibeTool Play — "Continue playing".
   Reads only each game's own localStorage save (read-only, same origin, nothing leaves the device) and reports a game
   ONLY when it holds genuinely resumable progress that the game itself will restore:
     2048         an unfinished board with a score        (it_play_2048_state)
     Daily Word   today's puzzle started but not finished, or an unfinished practice word
     Vibe Arcade  one or more games saved beyond level 1  (vibearcade:v1, vibe-crown-level-v1, vibe-loop-level-v1)
   Logic Crypt and Taiwanese Mahjong keep only stats/settings (no mid-game save), so they never appear here. */
(function (root) {
  'use strict';
  var pow2 = function (n) { return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0; };
  function readJSON(st, k) { try { var v = st.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function dateKey(d) { d = d || new Date(); var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  function g2048(st) {
    var d = readJSON(st, 'it_play_2048_state');
    if (!d || !Array.isArray(d.v) || d.v.length !== 4 || !Number.isFinite(d.s) || d.s <= 0) return null;
    var g = d.v, top = 0;
    for (var r = 0; r < 4; r++) { if (!Array.isArray(g[r]) || g[r].length !== 4) return null; for (var c = 0; c < 4; c++) { var x = g[r][c]; if (x !== 0 && !pow2(x)) return null; if (x > top) top = x; } }
    var movable = false;
    for (r = 0; r < 4 && !movable; r++) for (c = 0; c < 4; c++) { if (g[r][c] === 0 || (c < 3 && g[r][c] === g[r][c + 1]) || (r < 3 && g[r][c] === g[r + 1][c])) { movable = true; break; } }
    if (!movable) return null; // a finished game is not resumable
    return { id: '2048', title: '2048 Challenge', path: 'play/2048/', detail: 'Score ' + d.s + ' · best tile ' + top };
  }

  function dailyWord(st, today) {
    var okGame = function (g) { return g && typeof g.answer === 'string' && /^[a-z]{5}$/.test(g.answer) && Array.isArray(g.guesses) && g.guesses.length > 0 && g.guesses.length < 6 && g.guesses.every(function (w) { return /^[a-z]{5}$/.test(w); }) && g.status === 'playing'; };
    var daily = readJSON(st, 'it_play_dailyword_daily');
    if (okGame(daily) && daily.date === today) return { id: 'daily-word', title: 'Daily Word Challenge', path: 'play/daily-word/', detail: "Today's puzzle · " + daily.guesses.length + ' of 6 guesses used' };
    var prac = readJSON(st, 'it_play_dailyword_practice');
    if (okGame(prac)) return { id: 'daily-word', title: 'Daily Word Challenge', path: 'play/daily-word/', detail: 'Practice word · ' + prac.guesses.length + ' of 6 guesses used' };
    return null;
  }

  function arcade(st) {
    var parts = [], lv = function (n) { n = Math.floor(Number(n)); return Number.isFinite(n) && n > 1 ? Math.min(n, 999999) : 0; };
    var p = readJSON(st, 'vibearcade:v1'), games = p && typeof p === 'object' && p.games && typeof p.games === 'object' ? p.games : {};
    [['vl', 'Vibeline'], ['tw', 'Twofold'], ['ca', 'Carve']].forEach(function (g) { var l = games[g[0]] && lv(games[g[0]].level); if (l) parts.push(g[1] + ' level ' + l); });
    [['vibe-crown-level-v1', 'Crown Grid'], ['vibe-loop-level-v1', 'Loopcraft']].forEach(function (g) { var l; try { l = lv(st.getItem(g[0])); } catch (e) { l = 0; } if (l) parts.push(g[1] + ' level ' + l); });
    if (!parts.length) return null;
    return { id: 'vibe-arcade', title: 'Vibe Arcade', path: 'play/vibe-arcade/', detail: parts.slice(0, 2).join(' · ') + (parts.length > 2 ? ' · +' + (parts.length - 2) + ' more' : '') };
  }

  function detect(st, today) {
    var out = [];
    [g2048, function (s) { return dailyWord(s, today || dateKey()); }, arcade].forEach(function (f) { try { var r = f(st); if (r) out.push(r); } catch (e) { /* a broken save never breaks the page */ } });
    return out;
  }
  function get() { try { return detect(root.localStorage, dateKey()); } catch (e) { return []; } }

  /* Play directory: fill #continue-list (links are relative to the /play/ page). Textual only, no innerHTML. */
  function renderDirectory() {
    var host = root.document && root.document.getElementById('continue-list'), sec = root.document && root.document.getElementById('continue-playing');
    if (!host || !sec) return;
    var items = get(); host.textContent = '';
    items.forEach(function (it) {
      var li = root.document.createElement('li'), a = root.document.createElement('a'), t = root.document.createElement('strong'), d = root.document.createElement('span'), go = root.document.createElement('b');
      a.className = 'continue-item'; a.href = it.path.replace(/^play\//, ''); t.textContent = it.title; d.textContent = it.detail; go.textContent = 'Continue →'; go.setAttribute('aria-hidden', 'true');
      a.setAttribute('aria-label', 'Continue ' + it.title + '. ' + it.detail); a.append(t, d, go); li.append(a); host.append(li);
    });
    sec.hidden = items.length === 0;
  }
  var api = { detect: detect, get: get, dateKey: dateKey, renderDirectory: renderDirectory };
  root.GVTContinue = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    var run = function () { renderDirectory(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run); else run();
    root.addEventListener('pageshow', function (e) { if (e.persisted) renderDirectory(); });
    root.addEventListener('storage', renderDirectory);
  }
})(typeof window !== 'undefined' ? window : globalThis);
