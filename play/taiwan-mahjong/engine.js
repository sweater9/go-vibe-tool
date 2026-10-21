/*!
 * GoVibeTool — Taiwanese Mahjong engine
 * Pure client-side logic: rules, tai scoring and local heuristic bots.
 * No network access, no APIs, no dependencies.
 *
 * Tile ids
 *   0-8   Characters (萬)   9-17  Dots (筒)   18-26 Bamboo (條)
 *   27-30 Winds E S W N     31-33 Dragons 中 發 白
 *   34-41 Flowers (春夏秋冬 梅蘭竹菊) — never held in the concealed hand
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TWMJ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Tiles                                                               */
  /* ------------------------------------------------------------------ */
  var FLOWER0 = 34;
  var FLOWER_EN = ['Spring', 'Summer', 'Autumn', 'Winter', 'Plum', 'Orchid', 'Bamboo', 'Chrysanthemum'];
  var FLOWER_ZH = '春夏秋冬梅蘭竹菊';

  function isFlower(t) { return t >= FLOWER0; }
  function isHonor(t) { return t >= 27 && t < 34; }
  function isWind(t) { return t >= 27 && t <= 30; }
  function isDragon(t) { return t >= 31 && t <= 33; }
  function suitOf(t) { return t < 27 ? Math.floor(t / 9) : 3; }

  function tileEn(t) {
    if (t < 27) return (t % 9 + 1) + ' ' + ['Characters', 'Dots', 'Bamboo'][Math.floor(t / 9)];
    if (t < 31) return ['East', 'South', 'West', 'North'][t - 27] + ' Wind';
    if (t < 34) return ['Red', 'Green', 'White'][t - 31] + ' Dragon';
    return FLOWER_EN[t - FLOWER0] + ' Flower';
  }
  function tileZh(t) {
    if (t < 27) return '一二三四五六七八九'.charAt(t % 9) + ['萬', '筒', '條'][Math.floor(t / 9)];
    if (t < 31) return '東南西北'.charAt(t - 27);
    if (t < 34) return '中發白'.charAt(t - 31);
    return FLOWER_ZH.charAt(t - FLOWER0);
  }

  function newCounts() { var a = new Array(34); for (var i = 0; i < 34; i++) a[i] = 0; return a; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildWall(rng) {
    var w = [], t, k;
    for (t = 0; t < 34; t++) for (k = 0; k < 4; k++) w.push(t);
    for (t = FLOWER0; t < FLOWER0 + 8; t++) w.push(t);
    for (var i = w.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var x = w[i]; w[i] = w[j]; w[j] = x;
    }
    return w;
  }

  /* ------------------------------------------------------------------ */
  /* Hand decomposition and win detection                                 */
  /* A Taiwanese hand is 5 sets + 1 pair = 17 tiles (16 held + winning).  */
  /* ------------------------------------------------------------------ */

  // Enumerate decompositions of `c` into `needSets` sets and one pair.
  // set kinds: 0 = sequence starting at t, 1 = triplet of t.
  function decompose(c, needSets, all) {
    var cc = c.slice(), res = [], sets = [], pair = -1;
    function rec(i) {
      while (i < 34 && cc[i] === 0) i++;
      if (i >= 34) {
        if (pair >= 0 && sets.length === needSets) {
          res.push({ pair: pair, sets: sets.slice() });
          return !all;
        }
        return false;
      }
      if (cc[i] >= 3 && sets.length < needSets) {
        cc[i] -= 3; sets.push({ k: 1, t: i });
        if (rec(i)) return true;
        sets.pop(); cc[i] += 3;
      }
      if (i < 27 && i % 9 <= 6 && cc[i + 1] > 0 && cc[i + 2] > 0 && sets.length < needSets) {
        cc[i]--; cc[i + 1]--; cc[i + 2]--; sets.push({ k: 0, t: i });
        if (rec(i)) return true;
        sets.pop(); cc[i]++; cc[i + 1]++; cc[i + 2]++;
      }
      if (pair < 0 && cc[i] >= 2) {
        cc[i] -= 2; pair = i;
        if (rec(i)) return true;
        pair = -1; cc[i] += 2;
      }
      return false;
    }
    rec(0);
    return res;
  }

  function total(c) { var n = 0; for (var i = 0; i < 34; i++) n += c[i]; return n; }

  function isComplete(c, meldCount) {
    var need = 5 - meldCount;
    if (total(c) !== need * 3 + 2) return false;
    return decompose(c, need, false).length > 0;
  }

  // Tiles that would complete a (3*need+1)-tile hand.
  function waitingTiles(c, meldCount) {
    var need = 5 - meldCount, out = [];
    if (total(c) !== need * 3 + 1) return out;
    for (var t = 0; t < 34; t++) {
      if (c[t] >= 4) continue;
      c[t]++;
      if (decompose(c, need, false).length > 0) out.push(t);
      c[t]--;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Shanten (tiles away from ready)                                      */
  /* -1 complete, 0 ready (tenpai), 1 one step from ready, ...            */
  /* ------------------------------------------------------------------ */
  // Per-suit table: best[j][s] = most partial blocks achievable with s complete
  // sets (j = 1 if a pair was taken as the head from this suit).
  var suitCache = new Map();
  function suitTable(c, off, len, honor) {
    var key = (honor ? 'h' : 'n'), i;
    for (i = 0; i < len; i++) key += c[off + i];
    var hit = suitCache.get(key);
    if (hit) return hit;
    var a = [], best = [[], []];
    for (i = 0; i < len; i++) a.push(c[off + i]);
    for (i = 0; i <= 5; i++) { best[0][i] = -1; best[1][i] = -1; }

    function rec(i, s, p, j) {
      while (i < len && a[i] === 0) i++;
      if (i >= len) { if (p > best[j][s]) best[j][s] = p; return; }
      if (a[i] >= 3) { a[i] -= 3; rec(i, s + 1, p, j); a[i] += 3; }
      if (!honor && i + 2 < len && a[i + 1] > 0 && a[i + 2] > 0) {
        a[i]--; a[i + 1]--; a[i + 2]--; rec(i, s + 1, p, j); a[i]++; a[i + 1]++; a[i + 2]++;
      }
      if (j === 0 && a[i] >= 2) { a[i] -= 2; rec(i, s, p, 1); a[i] += 2; }
      if (a[i] >= 2) { a[i] -= 2; rec(i, s, p + 1, j); a[i] += 2; }
      if (!honor && i + 1 < len && a[i + 1] > 0) { a[i]--; a[i + 1]--; rec(i, s, p + 1, j); a[i]++; a[i + 1]++; }
      if (!honor && i + 2 < len && a[i + 2] > 0) { a[i]--; a[i + 2]--; rec(i, s, p + 1, j); a[i]++; a[i + 2]++; }
      a[i]--; rec(i, s, p, j); a[i]++;
    }
    rec(0, 0, 0, 0);
    if (suitCache.size > 20000) suitCache.clear();
    suitCache.set(key, best);
    return best;
  }

  var shCache = new Map();
  function shanten(c, meldCount) {
    var need = 5 - meldCount, key = '', i;
    for (i = 0; i < 34; i++) key += c[i];
    key += '|' + meldCount;
    var hit = shCache.get(key);
    if (hit !== undefined) return hit;

    var dp = [[0, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1]];
    var groups = [[0, 9, false], [9, 9, false], [18, 9, false], [27, 7, true]];
    for (var g = 0; g < 4; g++) {
      var T = suitTable(c, groups[g][0], groups[g][1], groups[g][2]);
      var nd = [[-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1]];
      for (var j = 0; j < 2; j++) for (var s = 0; s <= 5; s++) {
        if (dp[j][s] < 0) continue;
        for (var j2 = 0; j2 + j < 2; j2++) for (var s2 = 0; s + s2 <= 5; s2++) {
          if (T[j2][s2] < 0) continue;
          var v = dp[j][s] + T[j2][s2];
          if (v > nd[j + j2][s + s2]) nd[j + j2][s + s2] = v;
        }
      }
      dp = nd;
    }
    var best = 2 * need;
    for (var jj = 0; jj < 2; jj++) for (var ss = 0; ss <= 5; ss++) {
      if (dp[jj][ss] < 0) continue;
      var sc = Math.min(ss, need);
      var val = 2 * need - 2 * sc - Math.min(dp[jj][ss], need - sc) - jj;
      if (val < best) best = val;
    }
    if (shCache.size > 60000) shCache.clear();
    shCache.set(key, best);
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* Tai scoring                                                          */
  /* ------------------------------------------------------------------ */
  var TAI_TABLE = [
    { group: 'Situation', rows: [
      ['莊家', 'Dealer', '1'],
      ['連N拉N', 'Dealer streak (N wins in a row)', '2 per N'],
      ['門清', 'Concealed hand, won on a discard', '1'],
      ['自摸', 'Self-draw win', '1'],
      ['不求人', 'Concealed hand + self-draw (replaces the two above)', '3'],
      ['全求人', 'Five exposed melds, won on a discard', '2'],
      ['獨聽', 'Only one tile could win (edge, middle or pair wait)', '1'],
      ['海底撈月', 'Self-draw the last tile of the wall', '1'],
      ['河底撈魚', 'Win on the discard after the last draw', '1'],
      ['槓上開花', 'Win on the replacement tile after a kong', '1'],
      ['搶槓', 'Win by robbing a kong', '1'],
      ['天胡', 'Dealer wins on the opening draw', '16'],
      ['地胡', 'Non-dealer wins before any meld or their first discard', '16']
    ] },
    { group: 'Sets', rows: [
      ['圈風 / 門風', 'Triplet of the round wind / your seat wind', '1 each'],
      ['中 / 發 / 白', 'Dragon triplet', '1 each'],
      ['小三元', 'Two dragon triplets + dragon pair (replaces dragon tai)', '4'],
      ['大三元', 'Three dragon triplets (replaces dragon tai)', '8'],
      ['小四喜', 'Three wind triplets + wind pair (replaces wind tai)', '8'],
      ['大四喜', 'Four wind triplets (replaces wind tai)', '16'],
      ['平胡', 'All sequences, no honours, no flowers, two-sided wait', '2'],
      ['碰碰胡', 'All triplets and kongs', '4'],
      ['兩暗刻', 'Two concealed triplets', '1'],
      ['三暗刻', 'Three concealed triplets', '2'],
      ['四暗刻', 'Four concealed triplets', '5'],
      ['五暗刻', 'Five concealed triplets', '8']
    ] },
    { group: 'Suits', rows: [
      ['混一色', 'One suit plus honours', '4'],
      ['清一色', 'One suit only', '8'],
      ['字一色', 'Honours only', '16']
    ] },
    { group: 'Flowers', rows: [
      ['花牌', 'A flower whose number matches your seat', '1 each'],
      ['花槓', 'All four flowers of one season set or plant set', '2'],
      ['八仙過海', 'All eight flowers (replaces flower tai)', '8']
    ] }
  ];

  function twoSided(start, w) {
    // winning tile w completing sequence start..start+2, is the wait two-sided?
    var r = start % 9;
    if (w === start) return r <= 5;
    if (w === start + 2) return r >= 1;
    return false;
  }

  function scoreHand(ctx) {
    var conc = ctx.conc, melds = ctx.melds || [], flowers = ctx.flowers || [], w = ctx.winTile;
    var selfDraw = !!ctx.selfDraw, flags = ctx.flags || {};
    var seatWind = (ctx.seat - ctx.dealer + 4) % 4;
    var roundWind = ctx.roundWind || 0;
    var mcount = melds.length;

    var decs = decompose(conc, 5 - mcount, true);
    if (!decs.length) return null;

    var pre = conc.slice(); pre[w]--;
    var waits = waitingTiles(pre, mcount);
    var singleWait = waits.length === 1;

    var mset = melds.map(function (m) {
      return { k: m.type === 'chi' ? 0 : 1, t: m.t, concealed: m.type === 'angang', fixed: true };
    });
    var hasMingMeld = melds.some(function (m) { return m.type !== 'angang'; });
    var allExposed = mcount === 5 && !melds.some(function (m) { return m.type === 'angang'; });

    var best = null;
    decs.forEach(function (D) {
      var slots = [];
      D.sets.forEach(function (s, i) {
        if (s.k === 0 ? (w >= s.t && w <= s.t + 2) : w === s.t) slots.push(i);
      });
      if (D.pair === w) slots.push(-1);
      slots.forEach(function (si) {
        var r = evalDecomp(D, si);
        if (!best || r.tai > best.tai) best = r;
      });
    });
    return best;

    function evalDecomp(D, si) {
      var sets = mset.slice();
      D.sets.forEach(function (s, i) {
        var byRon = !selfDraw && i === si && s.k === 1;
        sets.push({ k: s.k, t: s.t, concealed: !byRon });
      });
      var items = [];
      function add(zh, en, tai) { items.push({ zh: zh, en: en, tai: tai }); }

      // dealer
      if (ctx.seat === ctx.dealer) {
        add('莊家', 'Dealer', 1);
        if (ctx.lian > 0) add('連' + ctx.lian + '拉' + ctx.lian, 'Dealer streak ×' + ctx.lian, 2 * ctx.lian);
      }

      // win type
      if (selfDraw && !hasMingMeld) add('不求人', 'Concealed self-draw', 3);
      else if (selfDraw) add('自摸', 'Self-draw', 1);
      else if (!hasMingMeld) add('門清', 'Concealed hand', 1);
      if (allExposed && !selfDraw) add('全求人', 'All melds exposed', 2);

      // triplets
      var dragons = 0, winds = 0, windSets = [];
      sets.forEach(function (s) {
        if (s.k !== 1) return;
        if (isDragon(s.t)) dragons++;
        if (isWind(s.t)) { winds++; windSets.push(s.t); }
      });
      var pairIsDragon = isDragon(D.pair), pairIsWind = isWind(D.pair);

      if (dragons === 3) add('大三元', 'Big three dragons', 8);
      else if (dragons === 2 && pairIsDragon) add('小三元', 'Small three dragons', 4);
      else sets.forEach(function (s) {
        if (s.k === 1 && isDragon(s.t)) add(tileZh(s.t), tileEn(s.t) + ' set', 1);
      });

      if (winds === 4) add('大四喜', 'Big four winds', 16);
      else if (winds === 3 && pairIsWind) add('小四喜', 'Small four winds', 8);
      else windSets.forEach(function (t) {
        if (t === 27 + roundWind) add('圈風', 'Round wind', 1);
        if (t === 27 + seatWind) add('門風', 'Seat wind', 1);
      });

      // all triplets
      if (sets.every(function (s) { return s.k === 1; })) add('碰碰胡', 'All triplets', 4);

      // suits
      var suitsSeen = {}, honors = false;
      sets.forEach(function (s) { var su = suitOf(s.t); if (su === 3) honors = true; else suitsSeen[su] = true; });
      var ps = suitOf(D.pair); if (ps === 3) honors = true; else suitsSeen[ps] = true;
      var nSuits = Object.keys(suitsSeen).length;
      if (nSuits === 0) add('字一色', 'All honours', 16);
      else if (nSuits === 1 && !honors) add('清一色', 'Full flush', 8);
      else if (nSuits === 1 && honors) add('混一色', 'Half flush', 4);

      // concealed triplets
      var anke = sets.filter(function (s) { return s.k === 1 && s.concealed; }).length;
      if (anke === 5) add('五暗刻', 'Five concealed triplets', 8);
      else if (anke === 4) add('四暗刻', 'Four concealed triplets', 5);
      else if (anke === 3) add('三暗刻', 'Three concealed triplets', 2);
      else if (anke === 2) add('兩暗刻', 'Two concealed triplets', 1);

      // pinghu
      if (flowers.length === 0 && sets.every(function (s) { return s.k === 0; }) &&
          !isHonor(D.pair) && si >= 0 && D.sets[si].k === 0 && twoSided(D.sets[si].t, w)) {
        add('平胡', 'All sequences', 2);
      }

      if (singleWait) add('獨聽', 'Single wait', 1);

      // flowers
      if (flowers.length === 8) add('八仙過海', 'All eight flowers', 8);
      else if (flowers.length) {
        var matched = 0, grp = [0, 0];
        flowers.forEach(function (f) {
          var idx = f - FLOWER0;
          grp[idx >> 2]++;
          if ((idx & 3) === seatWind) matched++;
        });
        if (matched) add('花牌', 'Matching flowers ×' + matched, matched);
        if (grp[0] === 4) add('花槓', 'Season flower kong', 2);
        if (grp[1] === 4) add('花槓', 'Plant flower kong', 2);
      }

      // situational
      if (flags.lastTile && selfDraw) add('海底撈月', 'Last tile self-draw', 1);
      if (flags.lastTile && !selfDraw && !flags.robKong) add('河底撈魚', 'Last discard win', 1);
      if (flags.kongDraw && selfDraw) add('槓上開花', 'Win on kong replacement', 1);
      if (flags.robKong) add('搶槓', 'Robbing a kong', 1);
      if (flags.tianhu) add('天胡', 'Heavenly hand', 16);
      if (flags.dihu) add('地胡', 'Earthly hand', 16);

      var tai = 0;
      items.forEach(function (it) { tai += it.tai; });
      if (!items.length) add('雞胡', 'Chicken hand (no tai)', 0);
      return { tai: tai, items: items, pair: D.pair, sets: D.sets, melds: melds };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Match                                                                */
  /* ------------------------------------------------------------------ */
  var SKILL_NAMES = ['Friendly', 'Standard', 'Sharp'];

  function Match(opts) {
    opts = opts || {};
    var seed = opts.seed;
    if (seed === undefined) {
      try {
        var u = new Uint32Array(1);
        (typeof crypto !== 'undefined' ? crypto : root.crypto).getRandomValues(u);
        seed = u[0];
      } catch (e) { seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0; }
    }
    this.cfg = {
      rounds: opts.rounds || 1,          // wind rounds (4 dealer changes each)
      base: opts.base === undefined ? 30 : opts.base,
      perTai: opts.perTai === undefined ? 10 : opts.perTai,
      chips: opts.chips === undefined ? 1000 : opts.chips,
      skill: opts.skill === undefined ? 1 : opts.skill,
      humanSeats: opts.humanSeats || [0],
      names: opts.names || ['You', 'Mei', 'Hao', 'Lin'],
      seed: seed
    };
    this.rng = mulberry32(seed);
    this.players = [];
    for (var i = 0; i < 4; i++) {
      this.players.push({
        seat: i, name: this.cfg.names[i], human: this.cfg.humanSeats.indexOf(i) >= 0,
        chips: this.cfg.chips, conc: newCounts(), melds: [], flowers: [], discards: []
      });
    }
    this.dealer = 0; this.lian = 0; this.rotations = 0; this.handNo = 0;
    this.over = false; this.stage = 'idle'; this.last = null;
    this.wall = []; this.turn = 0; this.pending = null; this.response = null;
  }

  var P = Match.prototype;

  P.roundWind = function () { return Math.floor(this.rotations / 4) % 4; };
  P.seatWind = function (seat) { return (seat - this.dealer + 4) % 4; };
  P.liveWall = function () { return Math.max(0, this.wall.length - 16); };

  P.startHand = function () {
    var self = this;
    this.handNo++;
    this.wall = buildWall(this.rng);
    this.players.forEach(function (p) { p.conc = newCounts(); p.melds = []; p.flowers = []; p.discards = []; });
    this.stats = { discards: 0, melds: 0 };
    this.lastDiscard = null; this.kongDraw = false; this.afterClaim = false;
    this.pending = null; this.response = null; this._claimOpts = null; this._claimChoices = null;
    var flowersEv = [];
    for (var i = 0; i < 4; i++) {
      var s = (this.dealer + i) % 4;
      for (var k = 0; k < 16; k++) {
        var t = this.wall.shift();
        while (isFlower(t)) { this.players[s].flowers.push(t); flowersEv.push({ seat: s, tile: t }); t = this.wall.pop(); }
        this.players[s].conc[t]++;
      }
    }
    this.turn = this.dealer; this.stage = 'draw'; this.drawBack = false;
    return { type: 'deal', flowers: flowersEv, dealer: this.dealer, round: this.roundWind(), lian: this.lian, hand: this.handNo };
  };

  P.nextHand = function () {
    if (this.stage !== 'between') return null;
    var r = this.last;
    if (r && r.type === 'win') {
      if (r.seat === this.dealer) this.lian++;
      else { this.dealer = (this.dealer + 1) % 4; this.lian = 0; this.rotations++; }
    }
    if (this.rotations >= this.cfg.rounds * 4) {
      this.over = true; this.stage = 'over';
      return { type: 'over' };
    }
    return this.startHand();
  };

  P._drawTile = function (seat, fromBack, flowersEv) {
    var p = this.players[seat];
    var t = fromBack ? this.wall.pop() : this.wall.shift();
    while (t !== undefined && isFlower(t)) {
      p.flowers.push(t); flowersEv.push({ seat: seat, tile: t });
      t = this.wall.pop();
    }
    return t;
  };

  P.step = function () {
    if (this.over) return { type: 'over' };
    switch (this.stage) {
      case 'draw': return this._doDraw();
      case 'self': return this._doSelf();
      case 'claim': return this._doClaim();
      case 'robkong': return this._doRobKong();
      case 'between': return { type: 'between', result: this.last };
      default: return { type: 'idle' };
    }
  };

  P.act = function (action) { this.response = action; };

  P._drawGame = function () {
    this.stage = 'between';
    this.last = { type: 'drawgame', dealer: this.dealer };
    return this.last;
  };

  P._doDraw = function () {
    var seat = this.turn, fromBack = this.drawBack;
    if (!fromBack && this.wall.length <= 16) return this._drawGame();
    if (fromBack && this.wall.length === 0) return this._drawGame();
    var flowersEv = [];
    var t = this._drawTile(seat, fromBack, flowersEv);
    if (t === undefined) return this._drawGame();
    this.players[seat].conc[t]++;
    this.drawn = t;
    this.lastLive = !fromBack && this.wall.length <= 16;
    this.kongDrawNow = this.kongDraw; this.kongDraw = false;
    this.drawBack = false; this.afterClaim = false;
    this.stage = 'self';
    return { type: 'draw', seat: seat, tile: t, flowers: flowersEv, fromBack: fromBack, live: this.liveWall() };
  };

  P.selfOptions = function (seat) {
    var p = this.players[seat], c = p.conc, o = { hu: false, angang: [], jiagang: [] };
    if (!this.afterClaim) {
      o.hu = isComplete(c, p.melds.length);
      for (var t = 0; t < 34; t++) if (c[t] === 4) o.angang.push(t);
      p.melds.forEach(function (m) { if (m.type === 'peng' && c[m.t] >= 1) o.jiagang.push(m.t); });
    }
    return o;
  };

  P._doSelf = function () {
    var seat = this.turn, p = this.players[seat], act;
    if (p.human) {
      if (!this.response) {
        this.pending = { kind: 'self', seat: seat, options: this.selfOptions(seat) };
        return { type: 'await', kind: 'self', seat: seat, options: this.pending.options };
      }
      act = this.response; this.response = null;
      if (!this._validSelf(seat, act)) {
        this.pending = { kind: 'self', seat: seat, options: this.selfOptions(seat) };
        return { type: 'await', kind: 'self', seat: seat, options: this.pending.options };
      }
      this.pending = null;
    } else {
      act = this._botSelf(seat);
    }
    return this._applySelf(seat, act);
  };

  P._validSelf = function (seat, a) {
    var p = this.players[seat], o = this.selfOptions(seat);
    if (!a) return false;
    if (a.kind === 'hu') return o.hu;
    if (a.kind === 'angang') return o.angang.indexOf(a.tile) >= 0;
    if (a.kind === 'jiagang') return o.jiagang.indexOf(a.tile) >= 0;
    if (a.kind === 'discard') return a.tile >= 0 && a.tile < 34 && p.conc[a.tile] > 0;
    return false;
  };

  P._flags = function (seat, selfDraw, extra) {
    var f = {}, k;
    if (extra) for (k in extra) f[k] = extra[k];
    var anyMelds = this.stats.melds > 0;
    if (selfDraw && seat === this.dealer && this.stats.discards === 0 && !anyMelds) f.tianhu = true;
    if (!anyMelds && seat !== this.dealer) {
      if (selfDraw && this.players[seat].discards.length === 0) f.dihu = true;
      if (!selfDraw && this.stats.discards === 1) f.dihu = true;
    }
    return f;
  };

  P._win = function (seat, tile, selfDraw, from, extra) {
    var p = this.players[seat];
    var conc = p.conc.slice();
    if (!selfDraw) conc[tile]++;
    var sc = scoreHand({
      conc: conc, melds: p.melds, flowers: p.flowers, winTile: tile, selfDraw: selfDraw,
      seat: seat, dealer: this.dealer, roundWind: this.roundWind(), lian: this.lian,
      flags: this._flags(seat, selfDraw, extra)
    });
    var amount = this.cfg.base + this.cfg.perTai * sc.tai;
    var pay = [0, 0, 0, 0], i;
    if (selfDraw) {
      for (i = 0; i < 4; i++) if (i !== seat) { pay[i] -= amount; pay[seat] += amount; }
    } else { pay[from] -= amount; pay[seat] += amount; }
    for (i = 0; i < 4; i++) this.players[i].chips += pay[i];
    this.stage = 'between';
    this.last = {
      type: 'win', seat: seat, from: selfDraw ? null : from, selfDraw: selfDraw, tile: tile,
      tai: sc.tai, items: sc.items, amount: amount, pay: pay,
      hand: { conc: conc, melds: p.melds.map(function (m) { return m; }), flowers: p.flowers.slice(), sets: sc.sets, pair: sc.pair },
      dealer: this.dealer, lian: this.lian, robKong: !!(extra && extra.robKong)
    };
    return this.last;
  };

  P._applySelf = function (seat, a) {
    var p = this.players[seat], c = p.conc, t = a.tile;
    if (a.kind === 'hu') {
      return this._win(seat, this.drawn, true, null, { lastTile: this.lastLive, kongDraw: this.kongDrawNow });
    }
    if (a.kind === 'angang') {
      c[t] -= 4; p.melds.push({ type: 'angang', t: t, tiles: [t, t, t, t], from: null });
      this.stats.melds++;
      this.kongDraw = true; this.drawBack = true; this.stage = 'draw';
      return { type: 'angang', seat: seat, tile: t };
    }
    if (a.kind === 'jiagang') {
      c[t]--;
      var m = p.melds.filter(function (x) { return x.type === 'peng' && x.t === t; })[0];
      m.type = 'minggang'; m.tiles = [t, t, t, t]; m.added = true;
      this.stats.melds++;
      this.stage = 'robkong'; this._rob = { seat: seat, tile: t };
      return { type: 'jiagang', seat: seat, tile: t };
    }
    // discard
    c[t]--; p.discards.push(t); this.stats.discards++;
    this.lastDiscard = { seat: seat, tile: t, lastLive: this.wall.length <= 16 };
    this.afterClaim = false; this.kongDrawNow = false;
    this.stage = 'claim'; this._claimOpts = null; this._claimChoices = null;
    return { type: 'discard', seat: seat, tile: t };
  };

  /* ---- claims ---- */
  P._claimOptions = function (seat, t, isNext) {
    var p = this.players[seat], c = p.conc, m = p.melds.length, o = {}, any = false;
    c[t]++; if (isComplete(c, m)) { o.hu = true; any = true; } c[t]--;
    if (c[t] >= 2) { o.peng = true; any = true; }
    if (c[t] >= 3) { o.gang = true; any = true; }
    if (isNext && t < 27) {
      var r = t % 9, ch = [];
      if (r >= 2 && c[t - 2] && c[t - 1]) ch.push([t - 2, t - 1]);
      if (r >= 1 && r <= 7 && c[t - 1] && c[t + 1]) ch.push([t - 1, t + 1]);
      if (r <= 6 && c[t + 1] && c[t + 2]) ch.push([t + 1, t + 2]);
      if (ch.length) { o.chi = ch; any = true; }
    }
    return any ? o : null;
  };

  P._doClaim = function () {
    var from = this.lastDiscard.seat, t = this.lastDiscard.tile, i, s;
    if (!this._claimOpts) {
      this._claimOpts = {}; this._claimChoices = {};
      for (i = 1; i < 4; i++) {
        s = (from + i) % 4;
        var o = this._claimOptions(s, t, i === 1);
        if (o) this._claimOpts[s] = o;
      }
    }
    var opts = this._claimOpts, ch = this._claimChoices;
    for (i = 1; i < 4; i++) {
      s = (from + i) % 4;
      if (!opts[s] || !this.players[s].human || ch[s] !== undefined) continue;
      if (this.response && this.pending && this.pending.seat === s) {
        var r = this.response; this.response = null;
        if (this._validClaim(opts[s], r)) { ch[s] = r; this.pending = null; continue; }
      }
      this.pending = { kind: 'claim', seat: s, tile: t, from: from, options: opts[s] };
      return { type: 'await', kind: 'claim', seat: s, tile: t, from: from, options: opts[s] };
    }
    for (i = 1; i < 4; i++) {
      s = (from + i) % 4;
      if (opts[s] && !this.players[s].human && ch[s] === undefined) ch[s] = this._botClaim(s, t, opts[s]);
    }
    this.pending = null;

    // resolve: win > kong/pung > chi
    for (i = 1; i < 4; i++) {
      s = (from + i) % 4;
      if (ch[s] && ch[s].kind === 'hu') {
        this.players[from].discards.pop();
        return this._win(s, t, false, from, { lastTile: this.lastDiscard.lastLive });
      }
    }
    for (i = 1; i < 4; i++) {
      s = (from + i) % 4;
      if (ch[s] && (ch[s].kind === 'peng' || ch[s].kind === 'gang')) return this._doMeld(s, from, t, ch[s]);
    }
    for (i = 1; i < 4; i++) {
      s = (from + i) % 4;
      if (ch[s] && ch[s].kind === 'chi') return this._doMeld(s, from, t, ch[s]);
    }
    // nobody claimed
    this.turn = (from + 1) % 4; this.stage = 'draw'; this.drawBack = false;
    this._claimOpts = null; this._claimChoices = null;
    return { type: 'pass', from: from, tile: t, next: this.turn };
  };

  P._validClaim = function (o, a) {
    if (!a) return false;
    if (a.kind === 'pass') return true;
    if (a.kind === 'hu') return !!o.hu;
    if (a.kind === 'peng') return !!o.peng;
    if (a.kind === 'gang') return !!o.gang;
    if (a.kind === 'chi') {
      if (!o.chi || !a.tiles) return false;
      return o.chi.some(function (x) { return x[0] === a.tiles[0] && x[1] === a.tiles[1]; });
    }
    return false;
  };

  P._doMeld = function (seat, from, t, a) {
    var p = this.players[seat], c = p.conc, tiles, meld;
    this.players[from].discards.pop();
    this.stats.melds++;
    this._claimOpts = null; this._claimChoices = null;
    if (a.kind === 'chi') {
      var x = a.tiles; c[x[0]]--; c[x[1]]--;
      tiles = [x[0], x[1], t].sort(function (m, n) { return m - n; });
      meld = { type: 'chi', t: tiles[0], tiles: tiles, from: from, called: t };
      p.melds.push(meld);
      this.turn = seat; this.afterClaim = true; this.stage = 'self';
      return { type: 'claim', kind: 'chi', seat: seat, from: from, tile: t, meld: meld };
    }
    if (a.kind === 'peng') {
      c[t] -= 2;
      meld = { type: 'peng', t: t, tiles: [t, t, t], from: from, called: t };
      p.melds.push(meld);
      this.turn = seat; this.afterClaim = true; this.stage = 'self';
      return { type: 'claim', kind: 'peng', seat: seat, from: from, tile: t, meld: meld };
    }
    c[t] -= 3;
    meld = { type: 'minggang', t: t, tiles: [t, t, t, t], from: from, called: t };
    p.melds.push(meld);
    this.turn = seat; this.kongDraw = true; this.drawBack = true; this.stage = 'draw';
    return { type: 'claim', kind: 'gang', seat: seat, from: from, tile: t, meld: meld };
  };

  /* ---- robbing a kong ---- */
  P._doRobKong = function () {
    var kg = this._rob.seat, t = this._rob.tile, i, s;
    if (!this._robOpts) {
      this._robOpts = {}; this._robChoices = {};
      for (i = 1; i < 4; i++) {
        s = (kg + i) % 4;
        var p = this.players[s];
        p.conc[t]++;
        if (isComplete(p.conc, p.melds.length)) this._robOpts[s] = { hu: true };
        p.conc[t]--;
      }
    }
    var opts = this._robOpts, ch = this._robChoices;
    for (i = 1; i < 4; i++) {
      s = (kg + i) % 4;
      if (!opts[s] || ch[s] !== undefined) continue;
      if (this.players[s].human) {
        if (this.response && this.pending && this.pending.seat === s) {
          var r = this.response; this.response = null;
          if (this._validClaim(opts[s], r)) { ch[s] = r; this.pending = null; continue; }
        }
        this.pending = { kind: 'claim', seat: s, tile: t, from: kg, options: opts[s], robKong: true };
        return { type: 'await', kind: 'claim', seat: s, tile: t, from: kg, options: opts[s], robKong: true };
      }
      ch[s] = { kind: 'hu' };
    }
    this.pending = null;
    var robbed = null;
    for (i = 1; i < 4; i++) { s = (kg + i) % 4; if (ch[s] && ch[s].kind === 'hu') { robbed = s; break; } }
    this._robOpts = null; this._robChoices = null;
    if (robbed !== null) {
      // the kong is undone: the tile goes back to a pung
      var kp = this.players[kg], m = kp.melds.filter(function (x) { return x.type === 'minggang' && x.t === t && x.added; })[0];
      if (m) { m.type = 'peng'; m.tiles = [t, t, t]; delete m.added; }
      kp.conc[t]++;
      this.stats.melds--;
      var rp = this.players[robbed];
      var res = this._win(robbed, t, false, kg, { robKong: true });
      kp.conc[t]--;
      return res;
    }
    this.turn = kg; this.kongDraw = true; this.drawBack = true; this.stage = 'draw';
    return { type: 'kongready', seat: kg };
  };

  /* ------------------------------------------------------------------ */
  /* Bots (local heuristics only)                                         */
  /* ------------------------------------------------------------------ */
  P._seenFor = function (seat) {
    var seen = newCounts(), me = this.players[seat], i, j;
    for (i = 0; i < 34; i++) seen[i] += me.conc[i];
    this.players.forEach(function (p) {
      p.discards.forEach(function (t) { seen[t]++; });
      p.melds.forEach(function (m) {
        if (m.type === 'angang' && p !== me) return;
        m.tiles.forEach(function (t) { seen[t]++; });
      });
    });
    // melds of own hand already removed from conc, so no double count
    if (this.lastDiscard && false) seen[this.lastDiscard.tile]++;
    return seen;
  };

  function isValueTile(m, seat, t) {
    return isDragon(t) || t === 27 + m.roundWind() || t === 27 + m.seatWind(seat);
  }

  P._relevant = function (c) {
    var rel = {}, t;
    for (t = 0; t < 34; t++) {
      if (!c[t]) continue;
      rel[t] = 1;
      if (t < 27) {
        var r = t % 9;
        if (r >= 1) rel[t - 1] = 1;
        if (r >= 2) rel[t - 2] = 1;
        if (r <= 7) rel[t + 1] = 1;
        if (r <= 6) rel[t + 2] = 1;
      }
    }
    return Object.keys(rel).map(Number);
  };

  // Evaluate each distinct discard from a hand with 3*need+2 tiles.
  P._discardScores = function (seat, skill, noise) {
    var p = this.players[seat], c = p.conc, m = p.melds.length, self = this;
    var seen = this._seenFor(seat);
    var cand = [], minSh = 99, t;
    for (t = 0; t < 34; t++) {
      if (!c[t]) continue;
      c[t]--;
      var sh = shanten(c, m);
      c[t]++;
      cand.push({ t: t, sh: sh });
      if (sh < minSh) minSh = sh;
    }
    var slack = skill === 0 ? 1 : 0;
    var suitCount = [0, 0, 0, 0];
    for (t = 0; t < 34; t++) suitCount[suitOf(t)] += c[t];
    p.melds.forEach(function (mm) { suitCount[suitOf(mm.t)] += 3; });
    var maxSuit = Math.max(suitCount[0], suitCount[1], suitCount[2]);

    // threat from opponents who already show many melds
    var threats = [];
    if (skill >= 2) {
      this.players.forEach(function (o) {
        if (o.seat !== seat && o.melds.length >= 3) threats.push(o);
      });
    }

    var out = [];
    cand.forEach(function (cd) {
      if (cd.sh > minSh + slack) return;
      t = cd.t;
      c[t]--;
      var uke = 0;
      if (cd.sh <= 3) {
        self._relevant(c).forEach(function (u) {
          var unseen = 4 - seen[u]; if (u === t) unseen += 0;
          if (unseen <= 0 || c[u] >= 4) return;
          c[u]++;
          if (shanten(c, m) < cd.sh) uke += unseen;
          c[u]--;
        });
      }
      c[t]++;
      var score = -cd.sh * 1000 + uke * 10;
      var r = t < 27 ? t % 9 : -1;
      if (isHonor(t)) {
        if (c[t] === 1) score += isValueTile(self, seat, t) ? 14 : 32;
        else if (c[t] === 2) score -= 18;
        else score -= 60;
      } else {
        if (r === 0 || r === 8) score += 10;
        else if (r === 1 || r === 7) score += 4;
        if (c[t] >= 2) score -= 14;
        if (skill >= 1 && maxSuit >= 9) score += (maxSuit - suitCount[suitOf(t)]) * 0.8;
      }
      // safety
      if (threats.length && cd.sh >= 1) {
        threats.forEach(function (o) {
          var safe = o.discards.indexOf(t) >= 0 || (isHonor(t) && seen[t] >= 3);
          if (!safe) score -= (isHonor(t) ? 6 : (r >= 2 && r <= 6 ? 14 : 9));
        });
      }
      if (noise) score += self.rng() * noise;
      out.push({ t: t, sh: cd.sh, uke: uke, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  };

  P._botDiscard = function (seat) {
    var skill = this.cfg.skill;
    if (skill === 0 && this.rng() < 0.12) {
      var c = this.players[seat].conc, pool = [];
      for (var t = 0; t < 34; t++) if (c[t]) pool.push(t);
      return pool[Math.floor(this.rng() * pool.length)];
    }
    var sc = this._discardScores(seat, skill, skill === 0 ? 45 : 3);
    return sc[0].t;
  };

  P._botSelf = function (seat) {
    var p = this.players[seat], o = this.selfOptions(seat), m = p.melds.length;
    if (o.hu) return { kind: 'hu' };
    var sh0 = shanten(p.conc, m);
    if (this.cfg.skill >= 1) {
      if (o.angang.length && this.rng() < 0.7) {
        var t = o.angang[0];
        p.conc[t] -= 4;
        var after = shanten(p.conc, m + 1);
        p.conc[t] += 4;
        if (after <= sh0) return { kind: 'angang', tile: t };
      }
      if (o.jiagang.length && (isValueTile(this, seat, o.jiagang[0]) || this.rng() < 0.5)) {
        return { kind: 'jiagang', tile: o.jiagang[0] };
      }
    }
    return { kind: 'discard', tile: this._botDiscard(seat) };
  };

  P._bestAfterClaim = function (seat, remove, meldAdded) {
    // best shanten reachable after removing `remove` tiles, adding a meld, then discarding once
    var p = this.players[seat], c = p.conc, m = p.melds.length + 1, best = 99, t;
    remove.forEach(function (x) { c[x]--; });
    for (t = 0; t < 34; t++) {
      if (!c[t]) continue;
      c[t]--;
      var sh = shanten(c, m);
      c[t]++;
      if (sh < best) best = sh;
    }
    remove.forEach(function (x) { c[x]++; });
    return best;
  };

  P._botClaim = function (seat, t, o) {
    var p = this.players[seat], m = p.melds.length, skill = this.cfg.skill;
    if (o.hu) return { kind: 'hu' };
    var sh0 = shanten(p.conc, m);
    var val = isValueTile(this, seat, t);

    if (o.gang) {
      if (val && skill >= 1) return { kind: 'gang' };
    }
    if (o.peng) {
      var sh1 = this._bestAfterClaim(seat, [t, t]);
      var ok;
      if (skill === 0) ok = (val && sh1 <= sh0) || (sh1 < sh0 && this.rng() < 0.4);
      else if (skill === 1) ok = sh1 < sh0 || (val && sh1 <= sh0);
      else ok = (val && sh1 <= sh0) || (sh1 < sh0 && !(m === 0 && sh0 <= 1));
      if (ok) return { kind: 'peng' };
    }
    if (o.chi && skill >= 1 && sh0 >= 1) {
      var bestC = null, bestSh = sh0;
      var self = this;
      o.chi.forEach(function (pair) {
        var s1 = self._bestAfterClaim(seat, pair);
        if (s1 < bestSh) { bestSh = s1; bestC = pair; }
      });
      if (bestC && !(skill === 2 && m === 0 && sh0 <= 2)) return { kind: 'chi', tiles: bestC };
    }
    return { kind: 'pass' };
  };

  /* ---- helpers for the UI (hints) ---- */
  // For each distinct discard that leaves the hand ready, which tiles win?
  P.readyDiscards = function (seat) {
    var p = this.players[seat], c = p.conc, m = p.melds.length, out = {}, t;
    if (total(c) !== (5 - m) * 3 + 2) return out;
    for (t = 0; t < 34; t++) {
      if (!c[t]) continue;
      c[t]--;
      var w = waitingTiles(c, m);
      c[t]++;
      if (w.length) out[t] = w;
    }
    return out;
  };

  P.waitsNow = function (seat) {
    var p = this.players[seat];
    return waitingTiles(p.conc.slice(), p.melds.length);
  };

  P.suggestDiscard = function (seat) {
    var sc = this._discardScores(seat, 2, 0);
    return sc.length ? { tile: sc[0].t, shanten: sc[0].sh } : null;
  };

  P.shantenOf = function (seat) {
    var p = this.players[seat], c = p.conc, m = p.melds.length;
    if (total(c) === (5 - m) * 3 + 2) {
      if (isComplete(c, m)) return -1;
      var best = 99;
      for (var t = 0; t < 34; t++) {
        if (!c[t]) continue;
        c[t]--; var s = shanten(c, m); c[t]++;
        if (s < best) best = s;
      }
      return best;
    }
    return shanten(c, m);
  };

  return {
    Match: Match, scoreHand: scoreHand, isComplete: isComplete, decompose: decompose,
    waitingTiles: waitingTiles, shanten: shanten, newCounts: newCounts, buildWall: buildWall,
    mulberry32: mulberry32, tileEn: tileEn, tileZh: tileZh, isFlower: isFlower, isHonor: isHonor,
    isWind: isWind, isDragon: isDragon, suitOf: suitOf, TAI_TABLE: TAI_TABLE,
    SKILL_NAMES: SKILL_NAMES, FLOWER0: FLOWER0, FLOWER_EN: FLOWER_EN, FLOWER_ZH: FLOWER_ZH
  };
});
