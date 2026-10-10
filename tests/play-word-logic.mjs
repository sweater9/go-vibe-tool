import assert from 'node:assert';
import {
  DIFFICULTY_LEVELS,
  PUZZLE_CATALOG,
  evaluateGuess,
  getHint,
  calculatePuzzleScore
} from '../play/word-logic/logic-engine.mjs';

console.log('Running Word & Logic Challenge automated tests...');

// 1. Puzzle Catalog Integrity & Difficulty Tiers
{
  for (const [diff, puzzles] of Object.entries(PUZZLE_CATALOG)) {
    assert.ok(puzzles.length >= 4, `Difficulty "${diff}" must have at least 4 puzzles`);
    for (const p of puzzles) {
      assert.ok(p.id, 'Puzzle must have id');
      assert.ok(p.title, 'Puzzle must have title');
      assert.ok(p.secretWord, 'Puzzle must have secret word');
      assert.ok(Array.isArray(p.clues) && p.clues.length >= 4, 'Puzzle must have at least 4 clues');

      if (diff === DIFFICULTY_LEVELS.NOVICE) {
        assert.strictEqual(p.secretWord.length, 4, 'Novice secret word must be 4 letters');
      } else if (diff === DIFFICULTY_LEVELS.PRACTITIONER) {
        assert.strictEqual(p.secretWord.length, 5, 'Practitioner secret word must be 5 letters');
      } else if (diff === DIFFICULTY_LEVELS.MASTER) {
        assert.strictEqual(p.secretWord.length, 6, 'Master secret word must be 6 letters');
      }
    }
  }
}
console.log('✓ Puzzle catalog verified across Novice, Practitioner, and Master tiers');

// 2. Guess Evaluation Mechanics
{
  const secret = 'LOGIC';

  // Exact Match
  const exact = evaluateGuess('LOGIC', secret);
  assert.strictEqual(exact.valid, true);
  assert.strictEqual(exact.isExactMatch, true);
  assert.ok(exact.letterResults.every(r => r.status === 'correct'));

  // Partial Match (Misplaced and Absent letters)
  // Secret: L O G I C
  // Guess:  L I O N S
  // L -> correct (pos 0)
  // I -> misplaced (in secret at pos 3)
  // O -> misplaced (in secret at pos 1)
  // N -> absent
  // S -> absent
  const partial = evaluateGuess('LIONS', secret);
  assert.strictEqual(partial.valid, true);
  assert.strictEqual(partial.isExactMatch, false);
  assert.strictEqual(partial.letterResults[0].status, 'correct');
  assert.strictEqual(partial.letterResults[1].status, 'misplaced');
  assert.strictEqual(partial.letterResults[2].status, 'misplaced');
  assert.strictEqual(partial.letterResults[3].status, 'absent');
  assert.strictEqual(partial.letterResults[4].status, 'absent');

  // Case insensitivity
  const lower = evaluateGuess('logic', secret);
  assert.strictEqual(lower.isExactMatch, true);

  // Invalid length rejection
  const tooShort = evaluateGuess('LOG', secret);
  assert.strictEqual(tooShort.valid, false);
  assert.ok(tooShort.error.includes('must be exactly 5 letters'));
}
console.log('✓ Guess evaluation logic, status tags, and length validation verified');

// 3. Hint System
{
  const puzzle = PUZZLE_CATALOG[DIFFICULTY_LEVELS.NOVICE][0]; // CODE
  // Hint 1: unrevealed slot
  const hint1 = getHint(puzzle, ['', '', '', ''], 1);
  assert.strictEqual(hint1.type, 'reveal_letter');
  assert.strictEqual(hint1.index, 0);
  assert.strictEqual(hint1.letter, 'C');

  // If slot 0 is already filled
  const hint1b = getHint(puzzle, ['C', '', '', ''], 1);
  assert.strictEqual(hint1b.index, 1);
  assert.strictEqual(hint1b.letter, 'O');

  // Hint 2: eliminate decoy letters
  const hint2 = getHint(puzzle, [], 2);
  assert.strictEqual(hint2.type, 'eliminate_letters');
  assert.ok(Array.isArray(hint2.letters));
  assert.ok(hint2.letters.every(l => !puzzle.secretWord.includes(l)));
}
console.log('✓ Progressive hint system verified');

// 4. Score Calculation Math
{
  // First-attempt quick win on Master tier
  const masterPerfect = calculatePuzzleScore(DIFFICULTY_LEVELS.MASTER, 1, 0, 25);
  assert.strictEqual(masterPerfect, 1980); // 2000 - 0 - 0 - 20

  // Solved with multiple attempts and hints
  const noviceMulti = calculatePuzzleScore(DIFFICULTY_LEVELS.NOVICE, 3, 1, 90);
  // Base 1000 - (2 * 80) - (1 * 150) - (9 * 10) = 1000 - 160 - 150 - 90 = 600
  assert.strictEqual(noviceMulti, 600);

  // Minimum floor
  const floorScore = calculatePuzzleScore(DIFFICULTY_LEVELS.NOVICE, 20, 2, 500);
  assert.strictEqual(floorScore, 100);
}
console.log('✓ Scoring algorithms and penalties verified');

console.log('ALL Word & Logic Challenge tests passed successfully!\n');
