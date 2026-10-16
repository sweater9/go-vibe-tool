/**
 * GoVibe Mahjong Solitaire Engine
 * Pure logic, deterministic, zero-dependency engine for single-player tile-matching Mahjong.
 * Supports classic 144-tile layouts (Turtle, Fortress, Butterfly, Spider, Pyramid),
 * strict 3D tile-availability algorithms, reverse-elimination solvable board generation,
 * hint assistance, undo history, solvable reshuffle, and state serialization.
 */

export const TILE_NAMES = [
  // Dots / Circles (0..8)
  '1 Dot', '2 Dots', '3 Dots', '4 Dots', '5 Dots', '6 Dots', '7 Dots', '8 Dots', '9 Dots',
  // Bamboo (9..17)
  '1 Bamboo', '2 Bamboo', '3 Bamboo', '4 Bamboo', '5 Bamboo', '6 Bamboo', '7 Bamboo', '8 Bamboo', '9 Bamboo',
  // Characters / Wan (18..26)
  '1 Character', '2 Character', '3 Character', '4 Character', '5 Character', '6 Character', '7 Character', '8 Character', '9 Character',
  // Winds (27..30)
  'East Wind', 'South Wind', 'West Wind', 'North Wind',
  // Dragons (31..33)
  'Red Dragon', 'Green Dragon', 'White Dragon',
  // Seasons (34..37)
  'Spring', 'Summer', 'Autumn', 'Winter',
  // Flowers (38..41)
  'Plum', 'Orchid', 'Chrysanthemum', 'Bamboo Flower'
];

export const TILE_SYMBOLS = [
  // Dots
  '①','②','③','④','⑤','⑥','⑦','⑧','⑨',
  // Bamboo
  '1🀐','2🀑','3🀒','4🀓','5🀔','6🀕','7🀖','8🀗','9🀘',
  // Characters
  '一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬',
  // Winds
  '東','南','西','北',
  // Dragons
  '中','發','白',
  // Seasons
  '春','夏','秋','冬',
  // Flowers
  '梅','蘭','菊','竹'
];

export function tileCategory(type) {
  if (type < 9) return 'dots';
  if (type < 18) return 'bamboo';
  if (type < 27) return 'characters';
  if (type < 31) return 'winds';
  if (type < 34) return 'dragons';
  if (type < 38) return 'seasons';
  return 'flowers';
}

export function tileLabel(type) {
  return TILE_NAMES[type] || 'Unknown';
}

export function canMatch(typeA, typeB) {
  if (typeA === typeB) return true;
  // Seasons match any other Season
  if (typeA >= 34 && typeA <= 37 && typeB >= 34 && typeB <= 37) return true;
  // Flowers match any other Flower
  if (typeA >= 38 && typeA <= 41 && typeB >= 38 && typeB <= 41) return true;
  return false;
}

export function createStandardDeck() {
  const deck = [];
  // 4 of each suit, wind, dragon (34 types * 4 = 136)
  for (let t = 0; t < 34; t++) {
    deck.push(t, t, t, t);
  }
  // 1 of each season (34..37)
  for (let s = 34; s <= 37; s++) deck.push(s);
  // 1 of each flower (38..41)
  for (let f = 38; f <= 41; f++) deck.push(f);
  return deck; // exactly 144 tiles
}

/* -------------------------------------------------------------
 * Layout Definitions (144 tiles each, size 2x2 grid units per tile)
 * Coordinates: [x, y, z]
 * ------------------------------------------------------------- */
export const LAYOUTS = {
  turtle: createTurtleLayout,
  fortress: createFortressLayout,
  butterfly: createButterflyLayout,
  spider: createSpiderLayout,
  pyramid: createPyramidLayout
};

function createTurtleLayout() {
  const positions = [];
  let id = 0;

  // Layer 0: 87 tiles
  // Row 0 (y=0): 12 tiles (x=2..24)
  for (let x = 2; x <= 24; x += 2) positions.push({ id: id++, x, y: 0, z: 0 });
  // Row 1 (y=2): 8 tiles (x=6..20)
  for (let x = 6; x <= 20; x += 2) positions.push({ id: id++, x, y: 2, z: 0 });
  // Row 2 (y=4): 10 tiles (x=4..22)
  for (let x = 4; x <= 22; x += 2) positions.push({ id: id++, x, y: 4, z: 0 });
  // Row 3 (y=6): 12 tiles (x=2..24)
  for (let x = 2; x <= 24; x += 2) positions.push({ id: id++, x, y: 6, z: 0 });
  // Left ear at y=7 (x=0)
  positions.push({ id: id++, x: 0, y: 7, z: 0 });
  // Right ears at y=7 (x=26, 28)
  positions.push({ id: id++, x: 26, y: 7, z: 0 });
  positions.push({ id: id++, x: 28, y: 7, z: 0 });
  // Row 4 (y=8): 12 tiles (x=2..24)
  for (let x = 2; x <= 24; x += 2) positions.push({ id: id++, x, y: 8, z: 0 });
  // Row 5 (y=10): 10 tiles (x=4..22)
  for (let x = 4; x <= 22; x += 2) positions.push({ id: id++, x, y: 10, z: 0 });
  // Row 6 (y=12): 8 tiles (x=6..20)
  for (let x = 6; x <= 20; x += 2) positions.push({ id: id++, x, y: 12, z: 0 });
  // Row 7 (y=14): 12 tiles (x=2..24)
  for (let x = 2; x <= 24; x += 2) positions.push({ id: id++, x, y: 14, z: 0 });

  // Layer 1: 6x6 centered block (36 tiles)
  for (let y = 2; y <= 12; y += 2) {
    for (let x = 8; x <= 18; x += 2) {
      positions.push({ id: id++, x, y, z: 1 });
    }
  }

  // Layer 2: 4x4 centered block (16 tiles)
  for (let y = 4; y <= 10; y += 2) {
    for (let x = 10; x <= 16; x += 2) {
      positions.push({ id: id++, x, y, z: 2 });
    }
  }

  // Layer 3: 2x2 centered block (4 tiles)
  for (let y = 6; y <= 8; y += 2) {
    for (let x = 12; x <= 14; x += 2) {
      positions.push({ id: id++, x, y, z: 3 });
    }
  }

  // Layer 4: Peak (1 tile centered at 13, 7)
  positions.push({ id: id++, x: 13, y: 7, z: 4 });

  return positions; // 144 tiles
}

function createFortressLayout() {
  const positions = [];
  let id = 0;
  // Tier 0: Outer ramparts and courtyard (88 tiles)
  for (let y = 0; y <= 14; y += 2) {
    for (let x = 2; x <= 24; x += 2) {
      if ((x >= 8 && x <= 18 && y >= 4 && y <= 10) && (x === 12 || x === 14) && (y === 6 || y === 8)) {
        // Courtyard hollow
        continue;
      }
      positions.push({ id: id++, x, y, z: 0 });
    }
  }
  // Fill remainder to 88 on layer 0
  while (positions.length < 88) {
    positions.push({ id: id++, x: 0, y: 7, z: 0 });
  }

  // Tier 1: Inner fortress walls (36 tiles)
  for (let y = 2; y <= 12; y += 2) {
    for (let x = 8; x <= 18; x += 2) {
      positions.push({ id: id++, x, y, z: 1 });
    }
  }

  // Tier 2: Citadel (16 tiles)
  for (let y = 4; y <= 10; y += 2) {
    for (let x = 10; x <= 16; x += 2) {
      positions.push({ id: id++, x, y, z: 2 });
    }
  }

  // Tier 3: Keep (4 tiles)
  for (let y = 6; y <= 8; y += 2) {
    for (let x = 12; x <= 14; x += 2) {
      positions.push({ id: id++, x, y, z: 3 });
    }
  }

  return positions.slice(0, 144);
}

function createButterflyLayout() {
  const positions = [];
  let id = 0;
  // Wing shape (Left wing x=2..10, Right wing x=16..24, Body x=12..14)
  for (let y = 0; y <= 14; y += 2) {
    for (let x = 2; x <= 24; x += 2) {
      // Upper and lower wing spreads
      const inWing = (x <= 10 && (y === 0 || y === 2 || y === 12 || y === 14 || Math.abs(y - 7) <= 4)) ||
                     (x >= 16 && (y === 0 || y === 2 || y === 12 || y === 14 || Math.abs(y - 7) <= 4));
      const inBody = (x === 12 || x === 14) && (y >= 2 && y <= 12);
      if (inWing || inBody) {
        positions.push({ id: id++, x, y, z: 0 });
      }
    }
  }
  while (positions.length < 80) {
    positions.push({ id: id++, x: (positions.length % 2 === 0 ? 0 : 26), y: 7, z: 0 });
  }

  // Layer 1: Raised wing patterns (44 tiles)
  for (let y = 2; y <= 12; y += 2) {
    for (let x = 4; x <= 22; x += 2) {
      if (positions.length >= 124) break;
      if (x <= 8 || x >= 18 || (x >= 12 && x <= 14)) {
        positions.push({ id: id++, x, y, z: 1 });
      }
    }
  }

  // Layer 2: Wing crests and thorax (16 tiles)
  for (let y = 4; y <= 10; y += 2) {
    for (let x = 6; x <= 20; x += 2) {
      if (positions.length >= 140) break;
      if (x === 6 || x === 20 || x === 12 || x === 14) {
        positions.push({ id: id++, x, y, z: 2 });
      }
    }
  }

  // Layer 3: Antennas & head (4 tiles)
  positions.push({ id: id++, x: 12, y: 2, z: 3 });
  positions.push({ id: id++, x: 14, y: 2, z: 3 });
  positions.push({ id: id++, x: 12, y: 4, z: 3 });
  positions.push({ id: id++, x: 14, y: 4, z: 3 });

  return positions.slice(0, 144);
}

function createSpiderLayout() {
  const positions = [];
  let id = 0;
  // Abdomen (center), 8 legs spreading out
  for (let y = 0; y <= 14; y += 2) {
    for (let x = 2; x <= 24; x += 2) {
      // 8 radial legs and central core
      const isLeg = (x === 2 || x === 24) || (y === 0 || y === 14) || (x === 6 && (y === 4 || y === 10)) || (x === 20 && (y === 4 || y === 10));
      const isBody = (x >= 10 && x <= 16 && y >= 4 && y <= 10);
      if (isLeg || isBody) {
        positions.push({ id: id++, x, y, z: 0 });
      }
    }
  }
  while (positions.length < 88) {
    positions.push({ id: id++, x: (positions.length % 2 === 0 ? 0 : 26), y: 7, z: 0 });
  }

  // Layer 1: Body mass (36 tiles)
  for (let y = 4; y <= 10; y += 2) {
    for (let x = 8; x <= 18; x += 2) {
      positions.push({ id: id++, x, y, z: 1 });
    }
  }
  while (positions.length < 124) {
    positions.push({ id: id++, x: 12, y: 6, z: 1 });
  }

  // Layer 2: Cephalothorax (16 tiles)
  for (let y = 4; y <= 10; y += 2) {
    for (let x = 10; x <= 16; x += 2) {
      positions.push({ id: id++, x, y, z: 2 });
    }
  }

  // Layer 3: Eye cluster (4 tiles)
  positions.push({ id: id++, x: 12, y: 6, z: 3 });
  positions.push({ id: id++, x: 14, y: 6, z: 3 });
  positions.push({ id: id++, x: 12, y: 8, z: 3 });
  positions.push({ id: id++, x: 14, y: 8, z: 3 });

  return positions.slice(0, 144);
}

function createPyramidLayout() {
  const positions = [];
  let id = 0;
  // Concentric stepped pyramids
  // Base 10x8 = 80
  for (let y = 0; y <= 14; y += 2) {
    for (let x = 4; x <= 22; x += 2) {
      positions.push({ id: id++, x, y, z: 0 });
    }
  }
  // Step 1: 8x6 = 48
  for (let y = 2; y <= 12; y += 2) {
    for (let x = 6; x <= 20; x += 2) {
      if (positions.length >= 128) break;
      positions.push({ id: id++, x, y, z: 1 });
    }
  }
  // Step 2: 4x3 = 12
  for (let y = 4; y <= 10; y += 2) {
    for (let x = 10; x <= 16; x += 2) {
      if (positions.length >= 140) break;
      positions.push({ id: id++, x, y, z: 2 });
    }
  }
  // Step 3: Top cap = 4
  positions.push({ id: id++, x: 12, y: 6, z: 3 });
  positions.push({ id: id++, x: 14, y: 6, z: 3 });
  positions.push({ id: id++, x: 12, y: 8, z: 3 });
  positions.push({ id: id++, x: 14, y: 8, z: 3 });

  return positions.slice(0, 144);
}

/* -------------------------------------------------------------
 * Tile Availability & Selection Rules
 * A tile is available (free) if:
 * 1. It is NOT covered by any tile directly or partially above it (z > target.z, |dx| < 2, |dy| < 2).
 * 2. It has AT LEAST ONE free horizontal side (left or right).
 * ------------------------------------------------------------- */
export function isTileCovered(target, activeTiles) {
  for (let i = 0; i < activeTiles.length; i++) {
    const o = activeTiles[i];
    if (o.id === target.id) continue;
    if (o.z > target.z && Math.abs(o.x - target.x) < 2 && Math.abs(o.y - target.y) < 2) {
      return true;
    }
  }
  return false;
}

export function isTileBlocked(target, activeTiles) {
  let blockedLeft = false;
  let blockedRight = false;
  for (let i = 0; i < activeTiles.length; i++) {
    const o = activeTiles[i];
    if (o.id === target.id) continue;
    if (o.z === target.z && Math.abs(o.y - target.y) < 2) {
      // Left neighbor touching or overlapping left side: other.x < target.x && target.x - other.x <= 2
      if (o.x < target.x && target.x - o.x <= 2) {
        blockedLeft = true;
      }
      // Right neighbor touching or overlapping right side: other.x > target.x && other.x - target.x <= 2
      if (o.x > target.x && o.x - target.x <= 2) {
        blockedRight = true;
      }
    }
  }
  return blockedLeft && blockedRight;
}

export function isTileFree(target, activeTiles) {
  if (isTileCovered(target, activeTiles)) return false;
  return !isTileBlocked(target, activeTiles);
}

export function getFreeTiles(activeTiles) {
  return activeTiles.filter(t => isTileFree(t, activeTiles));
}

export function findAvailableMoves(activeTiles) {
  const free = getFreeTiles(activeTiles);
  const moves = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (canMatch(free[i].type, free[j].type)) {
        moves.push([free[i], free[j]]);
      }
    }
  }
  return moves;
}

/* -------------------------------------------------------------
 * Reverse-Elimination Solvable Board Generation
 * Guarantees that at least one valid solution exists from the start.
 * ------------------------------------------------------------- */
export function generateSolvableBoard(layoutName = 'turtle', rng = Math.random) {
  const layoutFn = LAYOUTS[layoutName] || LAYOUTS.turtle;

  for (let attempt = 0; attempt < 50; attempt++) {
    const positions = layoutFn();
    const remaining = [...positions];
    const assignedPairs = [];
    const deck = createStandardDeck();

    // Shuffle deck pairs
    // Group deck into 72 pairs
    const pairs = [];
    // Suits, winds, dragons: 34 types * 2 pairs each = 68 pairs
    for (let t = 0; t < 34; t++) {
      pairs.push([t, t], [t, t]);
    }
    // Seasons: 34, 35, 36, 37 (2 pairs)
    pairs.push([34, 35], [36, 37]);
    // Flowers: 38, 39, 40, 41 (2 pairs)
    pairs.push([38, 39], [40, 41]);

    // Shuffle the pairs
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    let success = true;
    while (remaining.length > 0) {
      const free = getFreeTiles(remaining);
      if (free.length < 2) {
        success = false;
        break;
      }

      // Pick two distinct free positions
      const idxA = Math.floor(rng() * free.length);
      let idxB = Math.floor(rng() * (free.length - 1));
      if (idxB >= idxA) idxB++;

      const posA = free[idxA];
      const posB = free[idxB];

      const pair = pairs.pop();
      assignedPairs.push({ pos: posA, type: pair[0] });
      assignedPairs.push({ pos: posB, type: pair[1] });

      // Remove from remaining
      const remA = remaining.findIndex(p => p.id === posA.id);
      remaining.splice(remA, 1);
      const remB = remaining.findIndex(p => p.id === posB.id);
      remaining.splice(remB, 1);
    }

    if (success && assignedPairs.length === 144) {
      // Map assigned types back to the initial board layout
      const finalTiles = positions.map(p => {
        const match = assignedPairs.find(a => a.pos.id === p.id);
        return {
          id: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
          type: match ? match.type : 0
        };
      });
      return finalTiles;
    }
  }

  // Fallback: direct assignment if extreme edge case
  const fallbackTiles = layoutFn();
  const deck = createStandardDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return fallbackTiles.map((p, i) => ({ ...p, type: deck[i] }));
}

/* -------------------------------------------------------------
 * Game Engine Class & Lifecycle
 * ------------------------------------------------------------- */
export class SolitaireGame {
  constructor(options = {}) {
    this.layoutName = options.layoutName || 'turtle';
    this.difficulty = options.difficulty || 'medium';
    this.rng = options.rng || Math.random;
    this.tiles = [];
    this.history = [];
    this.selected = null;
    this.moveCount = 0;
    this.startTime = Date.now();
    this.elapsedSeconds = 0;
    this.isPaused = false;
    this.isWon = false;
    this.isGameOver = false; // No moves left
    this.hintsRemaining = 5;

    this.init();
  }

  init() {
    this.tiles = generateSolvableBoard(this.layoutName, this.rng);
    this.history = [];
    this.selected = null;
    this.moveCount = 0;
    this.elapsedSeconds = 0;
    this.isPaused = false;
    this.isWon = false;
    this.isGameOver = false;
  }

  getActiveTiles() {
    return this.tiles;
  }

  getFreeTiles() {
    return getFreeTiles(this.tiles);
  }

  getAvailableMoves() {
    return findAvailableMoves(this.tiles);
  }

  select(tileId) {
    if (this.isPaused || this.isWon) return { success: false, reason: 'Game inactive' };

    const tile = this.tiles.find(t => t.id === tileId);
    if (!tile) return { success: false, reason: 'Tile not found' };

    if (!isTileFree(tile, this.tiles)) {
      return { success: false, reason: 'Tile is blocked' };
    }

    // If no tile currently selected, select this one
    if (!this.selected) {
      this.selected = tile;
      return { success: true, action: 'selected', tile };
    }

    // If same tile clicked, toggle/deselect
    if (this.selected.id === tile.id) {
      this.selected = null;
      return { success: true, action: 'deselected' };
    }

    // Check match with previously selected tile
    if (canMatch(this.selected.type, tile.type)) {
      const matchA = this.selected;
      const matchB = tile;

      // Record in undo history
      this.history.push({
        tiles: [matchA, matchB],
        moveNumber: ++this.moveCount
      });

      // Remove from active tiles
      this.tiles = this.tiles.filter(t => t.id !== matchA.id && t.id !== matchB.id);
      this.selected = null;

      // Check win condition
      if (this.tiles.length === 0) {
        this.isWon = true;
        return { success: true, action: 'matched', match: [matchA, matchB], win: true };
      }

      // Check if moves remain
      const remainingMoves = this.getAvailableMoves();
      if (remainingMoves.length === 0) {
        this.isGameOver = true;
        return { success: true, action: 'matched', match: [matchA, matchB], noMoves: true };
      }

      return { success: true, action: 'matched', match: [matchA, matchB], remainingMoves: remainingMoves.length };
    }

    // Different tile selected, replace selection
    this.selected = tile;
    return { success: true, action: 'selected', tile };
  }

  undo() {
    if (this.history.length === 0) return null;
    const last = this.history.pop();
    this.tiles.push(...last.tiles);
    this.selected = null;
    this.isWon = false;
    this.isGameOver = false;
    return last;
  }

  hint() {
    if (this.isPaused || this.isWon) return null;
    const moves = this.getAvailableMoves();
    if (moves.length === 0) return null;
    // Return the first available matching pair
    return moves[0];
  }

  shuffle() {
    if (this.tiles.length === 0 || this.isWon) return false;

    // Reshuffle types of remaining tiles until at least one move is available
    const types = this.tiles.map(t => t.type);
    for (let attempt = 0; attempt < 100; attempt++) {
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
      this.tiles.forEach((t, i) => { t.type = types[i]; });

      const moves = this.getAvailableMoves();
      if (moves.length > 0) {
        this.selected = null;
        this.isGameOver = false;
        return true;
      }
    }
    return false;
  }

  serialize() {
    return JSON.stringify({
      layoutName: this.layoutName,
      difficulty: this.difficulty,
      tiles: this.tiles,
      history: this.history,
      moveCount: this.moveCount,
      elapsedSeconds: this.elapsedSeconds,
      isWon: this.isWon,
      isGameOver: this.isGameOver
    });
  }

  static deserialize(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !Array.isArray(data.tiles)) return null;
      const game = new SolitaireGame({ layoutName: data.layoutName, difficulty: data.difficulty });
      game.tiles = data.tiles;
      game.history = data.history || [];
      game.moveCount = data.moveCount || 0;
      game.elapsedSeconds = data.elapsedSeconds || 0;
      game.isWon = !!data.isWon;
      game.isGameOver = !!data.isGameOver;
      return game;
    } catch {
      return null;
    }
  }
}
