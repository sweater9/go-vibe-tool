import assert from 'node:assert';
import {
  QUESTION_CATEGORIES,
  QUESTION_BANK,
  getDailyQuestions,
  calculateUpdatedStreak,
  generateShareCard
} from '../play/daily/daily-engine.mjs';

console.log('Running Daily Knowledge Challenge automated tests...');

// 1. Question Bank Integrity
assert.strictEqual(QUESTION_BANK.length, 50, 'Question bank should contain exactly 50 curated questions');
for (const q of QUESTION_BANK) {
  assert.ok(q.id, 'Question must have id');
  assert.ok(q.category, 'Question must have category');
  assert.ok(QUESTION_CATEGORIES.includes(q.category), `Category "${q.category}" must be in allowed categories`);
  assert.ok(q.question, 'Question text must not be empty');
  assert.strictEqual(q.options.length, 4, 'Each question must have exactly 4 options');
  assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3, 'Correct index must be 0-3');
  assert.ok(q.explanation, 'Explanation must be provided');
}
console.log('✓ Curated question bank verified (50 questions across 5 categories)');

// 2. Deterministic Daily Selection
{
  const dateA = '2026-10-10';
  const setA1 = getDailyQuestions(dateA);
  const setA2 = getDailyQuestions(dateA);

  assert.strictEqual(setA1.length, 5, 'Must return exactly 5 questions');
  assert.strictEqual(setA2.length, 5, 'Must return exactly 5 questions');

  // Verify repeatability
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(setA1[i].id, setA2[i].id, `Question ${i} id must match on same date`);
    assert.strictEqual(setA1[i].correctIndex, setA2[i].correctIndex, `Correct index ${i} must match on same date`);
    assert.deepStrictEqual(setA1[i].options, setA2[i].options, `Options order ${i} must match on same date`);
  }

  // Verify category diversity: exactly one question per category
  const categoriesPresent = new Set(setA1.map(q => q.category));
  assert.strictEqual(categoriesPresent.size, 5, 'Daily challenge must include exactly 1 question per category');

  // Verify different dates produce different selections
  const dateB = '2026-10-11';
  const setB = getDailyQuestions(dateB);
  const idsA = setA1.map(q => q.id).join(',');
  const idsB = setB.map(q => q.id).join(',');
  assert.notStrictEqual(idsA, idsB, 'Consecutive days must produce distinct question selections');
}
console.log('✓ Deterministic date selection and category balance verified');

// 3. Streak and Score Math
{
  // Day 1
  const stats0 = { currentStreak: 0, maxStreak: 0, totalPlayed: 0, totalCorrect: 0, history: {} };
  const stats1 = calculateUpdatedStreak(stats0, '2026-10-10', 4, 5);
  assert.strictEqual(stats1.currentStreak, 1);
  assert.strictEqual(stats1.maxStreak, 1);
  assert.strictEqual(stats1.totalPlayed, 1);
  assert.strictEqual(stats1.totalCorrect, 4);

  // Day 2 (Consecutive)
  const stats2 = calculateUpdatedStreak(stats1, '2026-10-11', 5, 5);
  assert.strictEqual(stats2.currentStreak, 2, 'Consecutive day should increment streak');
  assert.strictEqual(stats2.maxStreak, 2);
  assert.strictEqual(stats2.totalPlayed, 2);
  assert.strictEqual(stats2.totalCorrect, 9);

  // Day 4 (Broken streak, skipped Oct 12)
  const statsBroken = calculateUpdatedStreak(stats2, '2026-10-13', 3, 5);
  assert.strictEqual(statsBroken.currentStreak, 1, 'Skipped day must reset current streak to 1');
  assert.strictEqual(statsBroken.maxStreak, 2, 'Max streak must be preserved');
  assert.strictEqual(statsBroken.totalPlayed, 3);
  assert.strictEqual(statsBroken.totalCorrect, 12);
}
console.log('✓ Streak tracking and history calculations verified');

// 4. Share Card Text Formatting
{
  const share = generateShareCard('2026-10-10', 4, 5, [true, true, false, true, true]);
  assert.ok(share.includes('IntelliTools Daily Challenge (2026-10-10)'));
  assert.ok(share.includes('Score: 4/5 (80%)'));
  assert.ok(share.includes('🟩🟩🟥🟩🟩'));
  assert.ok(share.includes('https://intellitools.online/play/daily/'));

  // Ensure no user PII in share card
  assert.ok(!share.includes('user'));
  assert.ok(!share.includes('name'));
}
console.log('✓ Share card generation and privacy compliance verified');

console.log('ALL Daily Knowledge Challenge tests passed successfully!\n');
