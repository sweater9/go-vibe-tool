import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TILE_NAMES,
  TILE_SYMBOLS,
  canMatch,
  createStandardDeck,
  LAYOUTS,
  isTileCovered,
  isTileBlocked,
  isTileFree,
  getFreeTiles,
  findAvailableMoves,
  generateSolvableBoard,
  SolitaireGame
} from '../play/mahjong-solitaire/engine.mjs';

test('Mahjong Solitaire standard deck contains 144 tiles with correct suit and bonus distribution', () => {
  const deck = createStandardDeck();
  assert.equal(deck.length, 144);

  // Count occurrences
  const counts = Array(42).fill(0);
  for (const t of deck) counts[t]++;

  // Suits (0..26), Winds (27..30), Dragons (31..33) have 4 each
  for (let t = 0; t < 34; t++) {
    assert.equal(counts[t], 4, `Tile ${t} (${TILE_NAMES[t]}) should have 4 copies`);
  }
  // Seasons (34..37) have 1 each
  for (let s = 34; s <= 37; s++) {
    assert.equal(counts[s], 1, `Season ${s} (${TILE_NAMES[s]}) should have 1 copy`);
  }
  // Flowers (38..41) have 1 each
  for (let f = 38; f <= 41; f++) {
    assert.equal(counts[f], 1, `Flower ${f} (${TILE_NAMES[f]}) should have 1 copy`);
  }
});

test('Matching rules: exact pairs for suits/honors, wild pairs for seasons and flowers', () => {
  // Same suits match
  assert.ok(canMatch(0, 0)); // 1 Dot with 1 Dot
  assert.ok(canMatch(26, 26)); // 9 Character with 9 Character
  assert.ok(canMatch(27, 27)); // East with East
  assert.ok(canMatch(31, 31)); // Red Dragon with Red Dragon

  // Different suits do not match
  assert.ok(!canMatch(0, 1));
  assert.ok(!canMatch(0, 9));
  assert.ok(!canMatch(27, 28));

  // Seasons match ANY season
  assert.ok(canMatch(34, 35)); // Spring with Summer
  assert.ok(canMatch(34, 37)); // Spring with Winter
  assert.ok(canMatch(36, 37)); // Autumn with Winter

  // Flowers match ANY flower
  assert.ok(canMatch(38, 39)); // Plum with Orchid
  assert.ok(canMatch(38, 41)); // Plum with Bamboo Flower

  // Season does not match flower
  assert.ok(!canMatch(34, 38));
});

test('All 5 classic layouts define exactly 144 valid 3D tile coordinates', () => {
  for (const [name, fn] of Object.entries(LAYOUTS)) {
    const layout = fn();
    assert.equal(layout.length, 144, `Layout ${name} must have 144 tiles`);
    for (const tile of layout) {
      assert.ok(Number.isInteger(tile.id));
      assert.ok(tile.x >= 0 && tile.x <= 32, `Layout ${name} tile x out of range: ${tile.x}`);
      assert.ok(tile.y >= 0 && tile.y <= 16, `Layout ${name} tile y out of range: ${tile.y}`);
      assert.ok(tile.z >= 0 && tile.z <= 5, `Layout ${name} tile z out of range: ${tile.z}`);
    }
  }
});

test('Tile availability algorithm correctly detects coverage and horizontal edge blocks', () => {
  // Tile A at layer 0: [10, 10, 0]
  const tileA = { id: 1, x: 10, y: 10, z: 0 };

  // 1. Single tile is free
  assert.ok(isTileFree(tileA, [tileA]));

  // 2. Tile above covering tile A
  const tileAbove = { id: 2, x: 10, y: 10, z: 1 };
  assert.ok(isTileCovered(tileA, [tileA, tileAbove]));
  assert.ok(!isTileFree(tileA, [tileA, tileAbove]));

  // 3. Tile above partially overlapping tile A (|dx| < 2, |dy| < 2)
  const tilePartial = { id: 3, x: 11, y: 11, z: 1 };
  assert.ok(isTileCovered(tileA, [tileA, tilePartial]));
  assert.ok(!isTileFree(tileA, [tileA, tilePartial]));

  // 4. Tile above not overlapping (|dx| >= 2)
  const tileNonOverlap = { id: 4, x: 12, y: 10, z: 1 };
  assert.ok(!isTileCovered(tileA, [tileA, tileNonOverlap]));

  // 5. Left and right horizontal blocks on same layer
  const tileLeft = { id: 5, x: 8, y: 10, z: 0 };
  const tileRight = { id: 6, x: 12, y: 10, z: 0 };

  // Only left neighbor -> free on right -> IS FREE
  assert.ok(isTileFree(tileA, [tileA, tileLeft]));

  // Only right neighbor -> free on left -> IS FREE
  assert.ok(isTileFree(tileA, [tileA, tileRight]));

  // Both left and right neighbors -> BLOCKED!
  assert.ok(isTileBlocked(tileA, [tileA, tileLeft, tileRight]));
  assert.ok(!isTileFree(tileA, [tileA, tileLeft, tileRight]));
});

test('Reverse-elimination generator produces solvable boards with available moves', () => {
  for (const layoutName of ['turtle', 'fortress', 'butterfly', 'spider', 'pyramid']) {
    const board = generateSolvableBoard(layoutName);
    assert.equal(board.length, 144);

    const free = getFreeTiles(board);
    assert.ok(free.length >= 2, `Board ${layoutName} should have at least 2 free tiles at start`);

    const moves = findAvailableMoves(board);
    assert.ok(moves.length >= 1, `Board ${layoutName} should have at least 1 valid move at start`);
  }
});

test('Game gameplay: select, match, undo, hint, shuffle, and serialization', () => {
  const game = new SolitaireGame({ layoutName: 'turtle' });
  assert.equal(game.getActiveTiles().length, 144);
  assert.equal(game.moveCount, 0);

  // Available moves must exist
  const moves = game.getAvailableMoves();
  assert.ok(moves.length > 0);

  // Hint returns a valid matching pair
  const hintPair = game.hint();
  assert.ok(hintPair && hintPair.length === 2);
  assert.ok(canMatch(hintPair[0].type, hintPair[1].type));

  // Select first tile of matching pair
  const sel1 = game.select(hintPair[0].id);
  assert.equal(sel1.action, 'selected');
  assert.equal(game.selected.id, hintPair[0].id);

  // Select second tile of matching pair -> match occurs!
  const sel2 = game.select(hintPair[1].id);
  assert.equal(sel2.action, 'matched');
  assert.equal(game.getActiveTiles().length, 142);
  assert.equal(game.moveCount, 1);
  assert.equal(game.selected, null);

  // Undo reverts the match
  const undone = game.undo();
  assert.ok(undone);
  assert.equal(game.getActiveTiles().length, 144);

  // Shuffle retains tile count and produces valid moves
  const shuffled = game.shuffle();
  assert.ok(shuffled);
  assert.equal(game.getActiveTiles().length, 144);
  assert.ok(game.getAvailableMoves().length > 0);

  // Serialization round-trip
  const serialized = game.serialize();
  const restored = SolitaireGame.deserialize(serialized);
  assert.equal(restored.getActiveTiles().length, 144);
  assert.equal(restored.layoutName, 'turtle');
});

test('Win detection: clearing all tiles triggers isWon', () => {
  const game = new SolitaireGame({ layoutName: 'turtle' });
  // Directly simulate game down to 2 matching tiles
  game.tiles = [
    { id: 1, x: 0, y: 0, z: 0, type: 5 },
    { id: 2, x: 10, y: 0, z: 0, type: 5 }
  ];
  game.select(1);
  const result = game.select(2);
  assert.ok(result.win);
  assert.ok(game.isWon);
  assert.equal(game.getActiveTiles().length, 0);
});
