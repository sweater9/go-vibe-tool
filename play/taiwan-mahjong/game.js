/*!
 * GoVibeTool — Taiwanese Mahjong: table UI and game controller.
 * Runs entirely in the browser. No network requests, no external APIs.
 */
(function () {
  'use strict';
  var E = window.TWMJ;

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('gvt.twmj.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('gvt.twmj.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  var WIND_EN = ['East', 'South', 'West', 'North'];
  var WIND_ZH = '東南西北';
  var NAMES = ['You', 'Mei', 'Hao', 'Lin'];
  var POS = ['', 'Right', 'Across', 'Left'];
  var SKILL_HINT = [
    'Relaxed play. Opponents make occasional mistakes and rarely claim.',
    'Balanced. Opponents build sensible hands and claim when it helps.',
    'Opponents track what has been played, defend against open hands and chase bigger scores.'
  ];

  /* ---------------- settings and record ---------------- */
  var settings = Object.assign({ skill: 1, rounds: 1, speed: 1, helper: true, multiWin: true, numbers: true }, store.get('settings', {}));
  var stats = Object.assign({ hands: 0, wins: 0, self: 0, best: 0, bestName: '', matches: 0, matchWins: 0 }, store.get('stats', {}));
  function saveSettings() { store.set('settings', settings); }
  function saveStats() { store.set('stats', stats); }

  /* ---------------- tile faces ---------------- */
  var DOT_POS = {
    2: [[15, 11], [15, 29]], 3: [[8, 8], [15, 20], [22, 32]],
    4: [[9, 11], [21, 11], [9, 29], [21, 29]], 5: [[9, 11], [21, 11], [15, 20], [9, 29], [21, 29]],
    6: [[9, 8], [21, 8], [9, 20], [21, 20], [9, 32], [21, 32]],
    7: [[7, 7], [15, 11], [23, 15], [9, 26], [21, 26], [9, 34], [21, 34]],
    8: [[9, 7], [21, 7], [9, 16], [21, 16], [9, 25], [21, 25], [9, 34], [21, 34]],
    9: [[7, 9], [15, 9], [23, 9], [7, 20], [15, 20], [23, 20], [7, 31], [15, 31], [23, 31]]
  };
  var BAM_POS = {
    2: [[15, 11], [15, 29]], 3: [[15, 11], [9, 29], [21, 29]],
    4: [[9, 11], [21, 11], [9, 29], [21, 29]], 5: [[9, 11], [21, 11], [15, 20], [9, 29], [21, 29]],
    6: [[7, 11], [15, 11], [23, 11], [7, 29], [15, 29], [23, 29]],
    7: [[15, 7], [7, 21], [15, 21], [23, 21], [7, 34], [15, 34], [23, 34]],
    8: [[5, 11], [11.7, 11], [18.3, 11], [25, 11], [5, 29], [11.7, 29], [18.3, 29], [25, 29]],
    9: [[7, 7], [15, 7], [23, 7], [7, 20], [15, 20], [23, 20], [7, 33], [15, 33], [23, 33]]
  };
  var faceCache = {};

  function dotsSVG(n) {
    var s = '<svg viewBox="0 0 30 40" aria-hidden="true">';
    if (n === 1) {
      s += '<circle cx="15" cy="20" r="12.6" fill="#1e5aa8"/><circle cx="15" cy="20" r="10.8" fill="#f8f3e4"/>' +
        '<circle cx="15" cy="20" r="9.4" fill="#c8352f"/><circle cx="15" cy="20" r="6.3" fill="#f8f3e4"/>' +
        '<circle cx="15" cy="20" r="4.7" fill="#1b8a5a"/><circle cx="15" cy="20" r="2" fill="#f8f3e4"/>';
    } else {
      var cols = ['#1e5aa8', '#c8352f', '#1b8a5a'], r = n >= 7 ? 3.7 : 4.7;
      DOT_POS[n].forEach(function (p, i) {
        var c = (n === 5 && i === 2) ? '#c8352f' : cols[(i + (n > 6 ? 1 : 0)) % 3];
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '" fill="' + c + '"/>' +
          '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (r * 0.68).toFixed(2) + '" fill="#f8f3e4"/>' +
          '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (r * 0.4).toFixed(2) + '" fill="' + c + '"/>';
      });
    }
    return s + '</svg>';
  }

  function bambooSVG(n) {
    var s = '<svg viewBox="0 0 30 40" aria-hidden="true">';
    if (n === 1) {
      // the traditional bird
      s += '<path d="M9 27 C5 33 7 38 12 37 L14 31Z" fill="#c8352f"/>' +
        '<path d="M12 31 C4 29 3 19 10 15 C14 12 19 14 20 19 C22 25 19 32 12 31Z" fill="#1b8a5a"/>' +
        '<path d="M9.5 22 C13 17.5 18 20 17.5 25.5 C14 28 10.5 26.5 9.5 22Z" fill="#35b27c"/>' +
        '<circle cx="19.5" cy="11.5" r="4.2" fill="#c8352f"/>' +
        '<path d="M23 10.5 L28 12.3 L23 14Z" fill="#d89a1f"/>' +
        '<circle cx="20.6" cy="10.6" r="1.1" fill="#f8f3e4"/>' +
        '<path d="M14 31.5 V36.5 M17.5 30.5 V36.5" stroke="#c8352f" stroke-width="1.3" stroke-linecap="round"/>';
    } else {
      var h = n <= 6 ? 14 : (n === 9 ? 10.5 : 11.5);
      BAM_POS[n].forEach(function (p, i) {
        var red = (n % 2 === 1 && ((n === 9 && i % 3 === 1) || (n !== 9 && i === (n === 7 ? 0 : (n === 5 ? 2 : 0)))));
        var c = red ? '#c8352f' : '#1b8a5a';
        s += '<rect x="' + (p[0] - 2.4) + '" y="' + (p[1] - h / 2) + '" width="4.8" height="' + h + '" rx="2.1" fill="' + c + '"/>' +
          '<rect x="' + (p[0] - 2.4) + '" y="' + (p[1] - h / 2) + '" width="1.5" height="' + h + '" rx=".7" fill="#fff" opacity=".22"/>' +
          '<line x1="' + (p[0] - 2.4) + '" x2="' + (p[0] + 2.4) + '" y1="' + p[1] + '" y2="' + p[1] + '" stroke="#f8f3e4" stroke-width=".9"/>';
      });
    }
    return s + '</svg>';
  }

  function face(t) {
    if (faceCache[t]) return faceCache[t];
    var h;
    if (t < 9) h = '<span class="num">' + '一二三四五六七八九'.charAt(t) + '</span><span class="suitc red">萬</span><span class="dg c">' + (t + 1) + '</span>';
    else if (t < 18) h = dotsSVG(t - 8) + '<span class="dg d">' + (t - 8) + '</span>';
    else if (t < 27) h = bambooSVG(t - 17) + '<span class="dg b">' + (t - 17) + '</span>';
    else if (t < 31) h = '<span class="hon">' + WIND_ZH.charAt(t - 27) + '</span>';
    else if (t === 31) h = '<span class="hon red">中</span>';
    else if (t === 32) h = '<span class="hon green">發</span>';
    else if (t === 33) h = '<span class="wf"></span>';
    else h = '<span class="flw">' + E.FLOWER_ZH.charAt(t - 34) + '</span><span class="fnum">' + ((t - 34) % 4 + 1) + '</span>';
    faceCache[t] = h;
    return h;
  }
  function cls(t, extra) {
    return 'tile' + (t >= 34 ? (t < 38 ? ' season' : ' plant') : '') + (extra ? ' ' + extra : '');
  }
  function tileHTML(t, extra) { return '<span class="' + cls(t, extra) + '" title="' + esc(E.tileEn(t)) + '">' + face(t) + '</span>'; }
  function backHTML(extra) { return '<span class="tile back ' + (extra || '') + '"></span>'; }
  function tilesHTML(arr) { return arr.map(function (t) { return tileHTML(t); }).join(''); }
  function meldHTML(m, hideKong) {
    var tiles = m.tiles;
    if (m.type === 'angang' && hideKong) return '<span class="grp">' + backHTML() + tileHTML(m.t) + tileHTML(m.t) + backHTML() + '</span>';
    return '<span class="grp">' + tilesHTML(tiles) + '</span>';
  }
  function sortedTiles(counts) {
    var out = [];
    for (var t = 0; t < 34; t++) for (var k = 0; k < counts[t]; k++) out.push(t);
    return out;
  }

  /* ---------------- state ---------------- */
  var match = null, timer = null, awaiting = null, selIdx = -1, hintTile = -1, lastEv = null;
  var readyMap = {}, resultShown = false;

  function wait(ms, fn) { clearTimeout(timer); timer = setTimeout(fn, Math.round(ms * settings.speed)); }
  function name(s) { return match.players[s].name; }
  function windOf(s) { return match.seatWind(s); }

  /* ---------------- start screen ---------------- */
  function syncSeg(root) {
    $$('.seg', root).forEach(function (seg) {
      var key = seg.getAttribute('data-setting').replace(/2$/, '');
      $$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', String(parseFloat(b.getAttribute('data-v')) === parseFloat(settings[key]))); });
    });
    $('#optHelper').checked = !!settings.helper;
    $('#optHelper2').checked = !!settings.helper;
    $('#optMulti').checked = !!settings.multiWin;
    $('#optMulti2').checked = !!settings.multiWin;
    $('#optNum').checked = settings.numbers !== false;
    $('#optNum2').checked = settings.numbers !== false;
    $('.twmj').classList.toggle('shownum', settings.numbers !== false);
    $('#skillHint').textContent = SKILL_HINT[settings.skill];
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.seg button');
    if (!b) return;
    var key = b.parentNode.getAttribute('data-setting').replace(/2$/, '');
    settings[key] = parseFloat(b.getAttribute('data-v'));
    saveSettings(); syncSeg(document);
  });
  $('#optHelper').addEventListener('change', function (e) { settings.helper = e.target.checked; saveSettings(); syncSeg(document); renderYou(); });
  $('#optHelper2').addEventListener('change', function (e) { settings.helper = e.target.checked; saveSettings(); syncSeg(document); renderYou(); });
  function setMulti(e) { settings.multiWin = e.target.checked; saveSettings(); syncSeg(document); if (match) match.cfg.multiWin = settings.multiWin; }
  $('#optMulti').addEventListener('change', setMulti);
  $('#optMulti2').addEventListener('change', setMulti);
  function setNum(e) { settings.numbers = e.target.checked; saveSettings(); syncSeg(document); }
  $('#optNum').addEventListener('change', setNum);
  $('#optNum2').addEventListener('change', setNum);

  function renderStats() {
    var card = $('#statsCard');
    if (!stats.hands) { card.hidden = true; return; }
    card.hidden = false;
    var items = [
      ['Hands played', stats.hands], ['Hands won', stats.wins], ['Self-draws', stats.self],
      ['Biggest hand', stats.best ? stats.best + ' tai' : '—'], ['Matches won', stats.matchWins + ' / ' + stats.matches]
    ];
    $('#statsList').innerHTML = items.map(function (i) { return '<div><dt>' + i[0] + '</dt><dd>' + i[1] + '</dd></div>'; }).join('');
  }
  $('#btnResetStats').addEventListener('click', function () {
    stats = { hands: 0, wins: 0, self: 0, best: 0, bestName: '', matches: 0, matchWins: 0 }; saveStats(); renderStats();
  });

  /* ---------------- match lifecycle ---------------- */
  function openDlg(id) { var d = $(id); if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } }
  function closeDlg(id) { var d = $(id); if (d.open) d.close(); }

  function startMatch() {
    clearTimeout(timer);
    match = new E.Match({ skill: settings.skill, rounds: settings.rounds, humanSeats: [0], names: NAMES, multiWin: settings.multiWin });
    $('#setup').hidden = true; $('#game').hidden = false;
    window.scrollTo(0, 0);
    beginHand(match.startHand());
  }

  function beginHand(ev) {
    awaiting = null; selIdx = -1; hintTile = -1; readyMap = {}; resultShown = false;
    $('#status').innerHTML = '';
    renderAll();
    var me = match.players[0];
    var fl = ev.flowers.filter(function (f) { return f.seat === 0; }).length;
    announce('Hand ' + match.handNo + '. You are ' + WIND_EN[windOf(0)] + (match.dealer === 0 ? ' and the dealer' : '') + '.' + (fl ? ' You were dealt ' + fl + ' flower' + (fl > 1 ? 's' : '') + ', replaced automatically.' : ''));
    wait(900, pump);
  }

  function announce(html) { $('#status').innerHTML = html; }

  function pump() {
    if (!match) return;
    var ev;
    try { ev = match.step(); } catch (err) { fail(err); return; }
    handle(ev);
  }

  function fail(err) {
    if (window.console) console.error(err);
    var t = $('#toast'); t.textContent = 'Something went wrong. Please restart the match from the menu.'; t.hidden = false;
  }

  function flash(zh, en, seat) {
    var f = $('#flash');
    f.innerHTML = '<span class="zh">' + zh + '</span>' + (en || '') + (seat !== undefined ? '<small>' + esc(name(seat)) + '</small>' : '');
    f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
  }

  function handle(ev) {
    lastEv = ev;
    switch (ev.type) {
      case 'draw':
        if (ev.seat === 0 && ev.flowers.length) flash(ev.flowers.map(function (f) { return E.FLOWER_ZH.charAt(f.tile - 34); }).join(' '), 'Flower replaced');
        renderAll();
        if (ev.seat === 0) announce('You drew <b>' + esc(E.tileEn(ev.tile)) + '</b>.');
        else announce('<span class="dim">' + esc(name(ev.seat)) + ' is thinking…</span>');
        wait(ev.seat === 0 ? 120 : 380, pump);
        break;
      case 'discard':
        renderAll();
        announce(esc(name(ev.seat)) + ' discarded <b>' + esc(E.tileEn(ev.tile)) + '</b>.');
        wait(ev.seat === 0 ? 350 : 600, pump);
        break;
      case 'pass':
        renderAll(); wait(120, pump); break;
      case 'claim':
        var map = { chi: ['吃', 'Chi'], peng: ['碰', 'Pung'], gang: ['槓', 'Kong'] }[ev.kind];
        flash(map[0], map[1], ev.seat);
        renderAll();
        announce(esc(name(ev.seat)) + ' called <b>' + map[1] + '</b> on ' + esc(E.tileEn(ev.tile)) + '.');
        wait(950, pump); break;
      case 'angang':
        flash('槓', 'Concealed kong', ev.seat); renderAll(); announce(esc(name(ev.seat)) + ' declared a concealed kong.'); wait(900, pump); break;
      case 'jiagang':
        flash('槓', 'Added kong', ev.seat); renderAll(); announce(esc(name(ev.seat)) + ' added to a pung to make a kong.'); wait(900, pump); break;
      case 'kongready':
        renderAll(); wait(250, pump); break;
      case 'await':
        awaiting = ev; selIdx = -1; hintTile = -1;
        $('#flash').classList.remove('show');
        readyMap = ev.kind === 'self' ? match.readyDiscards(0) : {};
        renderAll();
        if (ev.kind === 'self') {
          if (match.afterClaim) announce('Your turn. Choose a tile to <b>discard</b>.');
          else announce('You drew <b>' + esc(E.tileEn(match.drawn)) + '</b>. Select a tile, then tap it again to discard.');
        } else {
          announce(esc(name(ev.from)) + ' ' + (ev.robKong ? 'is adding a kong with' : 'discarded') + ' <b>' + esc(E.tileEn(ev.tile)) + '</b>. Do you want it?');
        }
        break;
      case 'win':
        flash('胡', ev.flowerWin ? 'Flowers' : ev.selfDraw ? 'Self-draw' : (ev.winners && ev.winners.length > 1 ? 'Wins' : 'Win'), ev.seat); renderAll();
        wait(1100, function () { showResult(ev); }); break;
      case 'drawgame':
        flash('流局', 'Draw game'); renderAll();
        wait(900, function () { showResult(ev); }); break;
      case 'over':
        showFinal(); break;
      default: break;
    }
  }

  /* ---------------- human input ---------------- */
  function respond(action) {
    if (!awaiting) return;
    awaiting = null; selIdx = -1; hintTile = -1;
    match.act(action);
    renderAll();
    wait(60, pump);
  }

  function selectOrDiscard(idx, t) {
    if (!awaiting || awaiting.kind !== 'self') return;
    if (selIdx === idx) { respond({ kind: 'discard', tile: t }); return; }
    selIdx = idx; hintTile = -1;
    renderYou();
    var sel = $('#hand .tile.sel'); if (sel) sel.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', function (e) {
    if (!match || $('#game').hidden || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (awaiting && awaiting.kind === 'self') {
      var btns = $$('#hand button.tile');
      if (!btns.length) return;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        var i = selIdx < 0 ? btns.length - 1 : selIdx + (k === 'ArrowLeft' ? -1 : 1);
        i = Math.max(0, Math.min(btns.length - 1, i));
        selectOrDiscard(i, +btns[i].getAttribute('data-t'));
      } else if ((k === 'Enter' || k === ' ') && selIdx >= 0 && document.activeElement && document.activeElement.classList.contains('sel')) {
        e.preventDefault();
        respond({ kind: 'discard', tile: +btns[selIdx].getAttribute('data-t') });
      } else if (k === 'Escape') { selIdx = -1; renderYou(); }
    } else if (awaiting && awaiting.kind === 'claim') {
      var o = awaiting.options;
      if (k === 'h' && o.hu) respond({ kind: 'hu' });
      else if (k === 'p' && o.peng) respond({ kind: 'peng' });
      else if (k === 'k' && o.gang) respond({ kind: 'gang' });
      else if (k === 'c' && o.chi) respond({ kind: 'chi', tiles: o.chi[0] });
      else if (k === 'Escape' || k === 'x') respond({ kind: 'pass' });
    }
  });

  $('#btnHint').addEventListener('click', function () {
    if (!awaiting || awaiting.kind !== 'self') { announce('Hints are available when it is your turn to discard.'); return; }
    var s = match.suggestDiscard(0);
    if (!s) return;
    hintTile = s.tile; selIdx = -1;
    renderYou();
    var why = s.shanten <= 0 ? 'this leaves you ready to win' : (s.shanten === 1 ? 'this keeps you one step from ready' : 'this keeps your hand most flexible');
    $('#helper').innerHTML = 'Suggestion: discard <b>' + esc(E.tileEn(s.tile)) + '</b> — ' + why + '.';
  });

  /* ---------------- rendering ---------------- */
  function renderAll() { renderHud(); renderOpps(); renderPools(); renderTable(); renderYou(); }

  // wall stacks (2 tiles each, 18 per side) and opponents' standing hands
  function renderTable() {
    var R = Math.ceil(match.wall.length / 2), first = 72 - R, k, i, html;
    for (k = 0; k < 4; k++) {
      html = '';
      for (i = 0; i < 18; i++) html += '<i class="stack' + (k * 18 + i >= first ? '' : ' gone') + '"></i>';
      $('#wall' + k).innerHTML = html;
    }
    for (var s = 1; s <= 3; s++) {
      var p = match.players[s];
      var n = p.conc.reduce(function (a, b) { return a + b; }, 0);
      var drawn = match.stage === 'self' && match.turn === s && !match.afterClaim && n === 16 - 3 * p.melds.length + 1;
      html = '';
      for (i = 0; i < n; i++) html += '<i class="tile back' + (drawn && i === n - 1 ? ' gap' : '') + '"></i>';
      var h = $('#hs' + s); h.innerHTML = html;
      h.classList.toggle('turn', match.turn === s && match.stage !== 'between');
    }
  }

  function renderHud() {
    $('#hudRound').innerHTML = WIND_EN[match.roundWind()] + ' <span lang="zh-Hant">' + WIND_ZH.charAt(match.roundWind()) + '</span>';
    $('#hudHand').textContent = match.handNo;
    $('#hudWall').textContent = match.liveWall();
    $('#hudStreakWrap').hidden = !(match.lian > 0);
    $('#hudStreak').textContent = match.lian;
    $('#center').innerHTML = '<span class="sm">' + WIND_EN[match.roundWind()] + ' round</span><span class="big">' + WIND_ZH.charAt(match.roundWind()) + '</span><span class="sm">Wall ' + match.liveWall() + '</span>';
  }

  function oppChip(s) {
    var p = match.players[s], conc = p.conc.reduce(function (a, b) { return a + b; }, 0);
    var turn = (match.turn === s && match.stage !== 'between');
    var d = document.createElement('div');
    d.className = 'opp' + (turn ? ' turn' : '');
    d.innerHTML =
      '<div class="top"><span class="wind' + (match.dealer === s ? ' dealer' : '') + '" title="' + WIND_EN[windOf(s)] + (match.dealer === s ? ' (dealer)' : '') + '">' + WIND_ZH.charAt(windOf(s)) + '</span>' +
      '<span class="nm">' + esc(p.name) + '</span><span class="pos">' + POS[s] + '</span></div>' +
      '<div class="meta"><span><b>' + p.chips + '</b> pts</span><span class="cnt">' + backHTML('cnt') + ' ×' + conc + '</span></div>' +
      '<div class="minis">' + p.melds.map(function (m) { return meldHTML(m, true); }).join('') +
      (p.flowers.length ? '<span class="grp">' + tilesHTML(p.flowers) + '</span>' : '') + '</div>';
    return d;
  }
  function renderOpps() {
    var box = $('#opps'); box.innerHTML = '';
    [3, 2, 1].forEach(function (s) { box.appendChild(oppChip(s)); });
  }

  function renderPools() {
    for (var s = 0; s < 4; s++) {
      var p = match.players[s];
      $('#pn' + s).innerHTML = '<span class="wind' + (match.dealer === s ? ' dealer' : '') + '">' + WIND_ZH.charAt(windOf(s)) + '</span> ' + esc(s === 0 ? 'You' : p.name);
      var last = (match.stage === 'claim' || (lastEv && lastEv.type === 'discard')) && match.lastDiscard && match.lastDiscard.seat === s ? p.discards.length - 1 : -1;
      var html = '';
      p.discards.forEach(function (t, i) { html += tileHTML(t, i === last ? 'lastd' : ''); });
      $('#pool' + s).innerHTML = html;
      var wrap = $('#pool' + s).parentNode, cnt = p.discards.length;
      wrap.style.setProperty('--ps', cnt <= 10 ? 1 : cnt <= 15 ? 0.84 : cnt <= 20 ? 0.7 : 0.6);
      wrap.classList.toggle('dense', cnt > 15);
    }
  }

  function seenFor0() { return match._seenFor(0); }

  function renderYou() {
    var me = match.players[0], mine = awaiting && awaiting.kind === 'self';
    var counts = me.conc.slice(), drawnTile = -1;
    var showDrawn = match.stage === 'self' && match.turn === 0 && !match.afterClaim && mine;
    if (showDrawn) { drawnTile = match.drawn; counts[drawnTile]--; }
    var tiles = sortedTiles(counts);
    var hand = $('#hand'); hand.innerHTML = '';
    var all = tiles.slice(); if (showDrawn) all.push(drawnTile);
    all.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      var isDrawn = showDrawn && i === all.length - 1;
      var isReady = settings.helper && mine && readyMap[t];
      b.className = cls(t, (isDrawn ? 'drawn ' : '') + (i === selIdx ? 'sel ' : '') + (isReady ? 'ready ' : '') + (t === hintTile ? 'hint' : ''));
      b.setAttribute('data-t', t);
      b.setAttribute('aria-label', E.tileEn(t) + (isDrawn ? ' (just drawn)' : '') + (i === selIdx ? ', selected. Press again to discard.' : ''));
      b.innerHTML = face(t);
      b.disabled = !mine;
      b.addEventListener('click', function () { selectOrDiscard(i, t); });
      hand.appendChild(b);
    });

    var ex = '';
    me.melds.forEach(function (m) { ex += meldHTML(m, false); });
    if (me.flowers.length) ex += '<span class="fl">' + tilesHTML(me.flowers) + '</span>';
    $('#exposed0').innerHTML = ex;

    renderActions();
    renderHelper();
  }

  function actBtn(zh, en, kind, extraCls, tiles) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'act ' + (extraCls || '');
    b.innerHTML = '<span class="zh">' + zh + '</span><span class="en">' + en + '</span>' + (tiles ? '<span class="mini">' + tilesHTML(tiles) + '</span>' : '');
    b.setAttribute('aria-label', en);
    return b;
  }

  function renderActions() {
    var box = $('#actions'); box.innerHTML = '';
    if (!awaiting) return;
    var o = awaiting.options, b;
    if (awaiting.kind === 'self') {
      if (o.hu) { b = actBtn('自摸', 'Win (self-draw)', 'hu', 'hu'); b.onclick = function () { respond({ kind: 'hu' }); }; box.appendChild(b); }
      o.angang.forEach(function (t) { b = actBtn('槓', 'Concealed kong', 'angang', '', [t]); b.onclick = function () { respond({ kind: 'angang', tile: t }); }; box.appendChild(b); });
      o.jiagang.forEach(function (t) { b = actBtn('加槓', 'Add to pung', 'jiagang', '', [t]); b.onclick = function () { respond({ kind: 'jiagang', tile: t }); }; box.appendChild(b); });
    } else {
      if (o.hu) { b = actBtn('胡', awaiting.robKong ? 'Win (rob kong)' : 'Win', 'hu', 'hu'); b.onclick = function () { respond({ kind: 'hu' }); }; box.appendChild(b); }
      if (o.gang) { b = actBtn('槓', 'Kong', 'gang'); b.onclick = function () { respond({ kind: 'gang' }); }; box.appendChild(b); }
      if (o.peng) { b = actBtn('碰', 'Pung', 'peng'); b.onclick = function () { respond({ kind: 'peng' }); }; box.appendChild(b); }
      if (o.chi) o.chi.forEach(function (pair) {
        var seq = pair.concat([awaiting.tile]).sort(function (x, y) { return x - y; });
        b = actBtn('吃', 'Chi', 'chi', '', seq); b.onclick = function () { respond({ kind: 'chi', tiles: pair }); }; box.appendChild(b);
      });
      b = actBtn('過', 'Pass', 'pass', 'pass'); b.onclick = function () { respond({ kind: 'pass' }); }; box.appendChild(b);
    }
  }

  function unseenLabel(waits) {
    var seen = seenFor0();
    var total = 0;
    var html = waits.map(function (w) { var left = Math.max(0, 4 - seen[w]); total += left; return tileHTML(w) + '<span style="margin:0 8px 0 2px;font-size:.78rem">×' + left + '</span>'; }).join('');
    return { html: html, total: total };
  }

  function renderHelper() {
    var box = $('#helper');
    if (!settings.helper || !match) { box.innerHTML = ''; return; }
    if (awaiting && awaiting.kind === 'self') {
      var sh = match.shantenOf(0);
      if (sh === -1) { box.innerHTML = '<b>You can win!</b> Press <b>自摸</b>.'; return; }
      var sel = selIdx >= 0 ? +$$('#hand button.tile')[selIdx].getAttribute('data-t') : -1;
      if (sel >= 0 && readyMap[sel]) {
        var u = unseenLabel(readyMap[sel]);
        box.innerHTML = 'Discarding <b>' + esc(E.tileEn(sel)) + '</b> makes you <b>ready</b>, waiting on: <span class="minis">' + u.html + '</span> (' + u.total + ' left)';
        return;
      }
      if (sel >= 0) { box.innerHTML = 'Select a tile with a green dot to discard into a ready hand, or press <b>Hint</b>.'; return; }
      if (Object.keys(readyMap).length) box.innerHTML = 'You are <b>one discard from ready</b>. Tiles with a green dot leave you waiting.';
      else box.innerHTML = 'About <b>' + sh + '</b> tile' + (sh === 1 ? '' : 's') + ' from ready after your discard.';
    } else if (awaiting && awaiting.kind === 'claim') {
      box.innerHTML = 'Claiming exposes the set. Pass if you would rather keep your hand concealed.';
    } else if (match.stage !== 'between') {
      var w = match.waitsNow(0);
      if (w.length && match.turn !== 0) {
        var uu = unseenLabel(w);
        box.innerHTML = 'You are <b>ready</b>, waiting on: <span class="minis">' + uu.html + '</span> (' + uu.total + ' left)';
      } else box.innerHTML = '';
    } else box.innerHTML = '';
  }

  /* ---------------- results ---------------- */
  function updateStats(ev) {
    stats.hands++;
    var mine = ev.type === 'win' && (ev.winners || [ev]).filter(function (w) { return w.seat === 0; })[0];
    if (mine) {
      stats.wins++; if (ev.selfDraw) stats.self++;
      if (mine.tai > stats.best) { stats.best = mine.tai; stats.bestName = mine.items.map(function (i) { return i.zh; }).join(' '); }
    }
    saveStats();
  }

  function showResult(ev) {
    if (resultShown) return;
    resultShown = true;
    updateStats(ev);
    var title = $('#resTitle'), sub = $('#resSub'), body = $('#resBody');
    var willEnd = false;
    if (ev.type === 'drawgame') {
      title.innerHTML = 'Draw game <span lang="zh-Hant">流局</span>';
      sub.textContent = 'The wall ran out. Nobody wins, and the dealer stays.';
      body.innerHTML = '';
    } else {
      var ws = ev.winners || [ev], multi = ws.length > 1;
      var wn = ws.map(function (x) { return x.seat === 0 ? 'You' : name(x.seat); });
      title.innerHTML = esc(multi ? wn.join(' and ') + ' win' : (ws[0].seat === 0 ? 'You win!' : name(ws[0].seat) + ' wins')) + ' <span lang="zh-Hant">' + (ev.selfDraw ? '自摸' : '胡') + '</span>';
      if (ev.flowerWin === 'all') sub.textContent = 'All eight flowers win at once: every opponent pays.';
      else if (ev.flowerWin === 'seven') sub.textContent = 'Seven flowers, and ' + name(ev.from) + ' drew the eighth: ' + name(ev.from) + ' pays.';
      else sub.textContent = ev.selfDraw ? 'Self-draw: every opponent pays.' : 'Won on ' + name(ev.from) + '’s discard' + (ev.robKong ? ' (robbing a kong)' : '') + ': ' + name(ev.from) + (multi ? ' pays each winner.' : ' pays.');
      body.innerHTML = ws.map(function (x) {
        var h = x.hand, conc = h.conc.slice(), last = '';
        if (ev.tile !== null && ev.tile !== undefined) { conc[ev.tile]--; last = tileHTML(ev.tile, 'winning'); }
        var hh = '<div class="res-hand">' + h.melds.map(function (m) { return meldHTML(m, false); }).join('') +
          '<span class="grp">' + tilesHTML(sortedTiles(conc)) + last + '</span>' +
          (h.flowers.length ? '<span class="grp">' + tilesHTML(h.flowers) + '</span>' : '') + '</div>';
        var rows = x.items.map(function (i) { return '<tr><td>' + i.zh + '</td><td>' + esc(i.en) + '</td><td>' + (i.tai ? '+' + i.tai : '0') + '</td></tr>'; }).join('');
        var tbl = '<table class="tai"><tbody>' + rows + '<tr class="total"><td>合計</td><td>Total · ' + match.cfg.base + ' + ' + match.cfg.perTai + ' × ' + x.tai + ' = ' + x.amount + ' pts each</td><td>' + x.tai + ' tai</td></tr></tbody></table>';
        return (multi ? '<h3 class="res-winner">' + esc(x.seat === 0 ? 'You' : name(x.seat)) + '</h3>' : '') + hh + tbl;
      }).join('') + payTable(ev.pay);
      willEnd = !ws.some(function (x) { return x.seat === match.dealer; }) && (match.rotations + 1 >= match.cfg.rounds * 4);
    }
    if (ev.type === 'drawgame') body.innerHTML = payTable([0, 0, 0, 0]);
    $('#btnNext').textContent = willEnd ? 'See final result' : 'Next hand';
    openDlg('#resultDlg');
    $('#btnNext').focus();
  }

  function payTable(pay) {
    var rows = [0, 1, 2, 3].map(function (s) {
      var d = pay[s];
      return '<tr><td>' + esc(name(s)) + '</td><td class="' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '') + '">' + (d > 0 ? '+' : '') + d + '</td><td>' + match.players[s].chips + ' pts</td></tr>';
    }).join('');
    return '<table class="tai pay"><tbody>' + rows + '</tbody></table>';
  }

  $('#btnNext').addEventListener('click', function () {
    closeDlg('#resultDlg');
    var ev = match.nextHand();
    if (!ev || ev.type === 'over') showFinal(); else beginHand(ev);
  });
  $('#resultDlg').addEventListener('cancel', function (e) { e.preventDefault(); });

  function showFinal() {
    var order = match.players.slice().sort(function (a, b) { return b.chips - a.chips; });
    var rank = order.findIndex(function (p) { return p.seat === 0; }) + 1;
    stats.matches++; if (rank === 1 && order[0].chips !== (order[1] && order[1].chips)) stats.matchWins++;
    saveStats();
    var ord = ['1st', '2nd', '3rd', '4th'];
    $('#finSub').textContent = 'You finished ' + ord[rank - 1] + ' after ' + match.handNo + ' hand' + (match.handNo === 1 ? '' : 's') + '.';
    $('#finList').innerHTML = order.map(function (p, i) {
      return '<li class="' + (p.seat === 0 ? 'me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(p.name) + '</span><span class="pts">' + p.chips + ' pts</span></li>';
    }).join('');
    openDlg('#finalDlg');
  }
  $('#btnFinAgain').addEventListener('click', function () { closeDlg('#finalDlg'); startMatch(); });
  $('#btnFinMenu').addEventListener('click', function () { closeDlg('#finalDlg'); toMenu(); });
  $('#finalDlg').addEventListener('cancel', function (e) { e.preventDefault(); });

  function toMenu() {
    clearTimeout(timer); match = null; awaiting = null;
    $('#game').hidden = true; $('#setup').hidden = false;
    $('#toast').hidden = true;
    renderStats(); syncSeg(document);
    window.scrollTo(0, 0);
  }

  /* ---------------- dialogs ---------------- */
  function buildTaiTable() {
    var base = 30, per = 10;
    $('#taiBase').textContent = base; $('#taiPer').textContent = per;
    $('#taiBody').innerHTML = E.TAI_TABLE.map(function (g) {
      return '<h3>' + esc(g.group) + '</h3><table class="tai"><tbody>' + g.rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }).join('');
  }
  $('#btnHowTo').addEventListener('click', function () { openDlg('#helpDlg'); });
  $('#btnHelp').addEventListener('click', function () { openDlg('#helpDlg'); });
  $('#btnTai').addEventListener('click', function () { openDlg('#taiDlg'); });
  $('#btnMenu').addEventListener('click', function () { $('#btnQuit').textContent = 'Quit match'; syncSeg(document); openDlg('#menuDlg'); });
  $('#btnQuit').addEventListener('click', function () {
    var b = $('#btnQuit');
    if (b.textContent === 'Quit match') { b.textContent = 'Tap again to quit'; return; }
    closeDlg('#menuDlg'); toMenu();
  });
  $('#btnStart').addEventListener('click', startMatch);

  /* ---------------- boot ---------------- */
  buildTaiTable(); syncSeg(document); renderStats();

  // test hooks (read-only helpers for automated checks)
  window.__twmj = { get match() { return match; }, get awaiting() { return awaiting; }, respond: respond, tileHTML: tileHTML };
})();
