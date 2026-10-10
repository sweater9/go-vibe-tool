/**
 * IntelliTools V5 — Logic Crypt: Word & Deduction Puzzle Core Engine
 * Headless, client-side deductive logic game engine.
 * Fully testable in Node with zero DOM dependencies.
 */

export const DIFFICULTY_LEVELS = {
  NOVICE: 'novice',
  PRACTITIONER: 'practitioner',
  MASTER: 'master'
};

export const PUZZLE_CATALOG = {
  [DIFFICULTY_LEVELS.NOVICE]: [
    {
      id: 'nov_01',
      difficulty: DIFFICULTY_LEVELS.NOVICE,
      title: 'Four-Letter Logic Crypt #1',
      secretWord: 'CODE',
      clues: [
        'The word contains exactly two vowels: O and E.',
        'The first letter is C, which is also the 3rd letter of the alphabet.',
        'The third letter is a consonant that sounds like "dee".',
        'The vowels are positioned at the 2nd and 4th slots.'
      ]
    },
    {
      id: 'nov_02',
      difficulty: DIFFICULTY_LEVELS.NOVICE,
      title: 'Four-Letter Logic Crypt #2',
      secretWord: 'FLOW',
      clues: [
        'The word starts with F and ends with W.',
        'There is only one vowel in the word, located in the 3rd slot.',
        'The second letter is L, forming a consonant blend with F.',
        'The word describes smooth movement of liquid or data streams.'
      ]
    },
    {
      id: 'nov_03',
      difficulty: DIFFICULTY_LEVELS.NOVICE,
      title: 'Four-Letter Logic Crypt #3',
      secretWord: 'DATA',
      clues: [
        'The word contains two identical vowels: both are A.',
        'The first letter is D, and the third letter is T.',
        'The 2nd and 4th positions are occupied by the letter A.',
        'It is an anagram of TAAD.'
      ]
    },
    {
      id: 'nov_04',
      difficulty: DIFFICULTY_LEVELS.NOVICE,
      title: 'Four-Letter Logic Crypt #4',
      secretWord: 'NODE',
      clues: [
        'The word starts with N and ends with E.',
        'There are exactly two vowels in the word: O and E.',
        'The 3rd letter is D.',
        'It represents a point of intersection or graph element.'
      ]
    }
  ],

  [DIFFICULTY_LEVELS.PRACTITIONER]: [
    {
      id: 'prac_01',
      difficulty: DIFFICULTY_LEVELS.PRACTITIONER,
      title: 'Five-Letter Logic Crypt #1',
      secretWord: 'LOGIC',
      clues: [
        'The word starts with L and ends with C.',
        'There are exactly two vowels: O (slot 2) and I (slot 4).',
        'The central letter (slot 3) is G.',
        'All five letters are completely distinct.',
        'The consonants in order are L, G, C.'
      ]
    },
    {
      id: 'prac_02',
      difficulty: DIFFICULTY_LEVELS.PRACTITIONER,
      title: 'Five-Letter Logic Crypt #2',
      secretWord: 'GRAPH',
      clues: [
        'The word begins with the consonant blend GR.',
        'There is exactly one vowel, which is A in the 3rd slot.',
        'The final two letters are PH, producing an "f" sound.',
        'No letters are repeated.',
        'The word represents nodes connected by edges.'
      ]
    },
    {
      id: 'prac_03',
      difficulty: DIFFICULTY_LEVELS.PRACTITIONER,
      title: 'Five-Letter Logic Crypt #3',
      secretWord: 'STACK',
      clues: [
        'The first letter is S and the last letter is K.',
        'The word contains exactly one vowel: A at index 2 (the 3rd slot).',
        'The 2nd letter is T, and the 4th letter is C.',
        'It describes a Last-In, First-Out (LIFO) data structure.'
      ]
    },
    {
      id: 'prac_04',
      difficulty: DIFFICULTY_LEVELS.PRACTITIONER,
      title: 'Five-Letter Logic Crypt #4',
      secretWord: 'QUERY',
      clues: [
        'The word starts with Q, immediately followed by U in the 2nd slot.',
        'The 3rd letter is E.',
        'The word ends with Y, which functions as a vowel sound here.',
        'The 4th letter is R.',
        'It is a term used to request data from a database.'
      ]
    }
  ],

  [DIFFICULTY_LEVELS.MASTER]: [
    {
      id: 'mast_01',
      difficulty: DIFFICULTY_LEVELS.MASTER,
      title: 'Six-Letter Master Crypt #1',
      secretWord: 'CIPHER',
      clues: [
        'The word begins with C and ends with R.',
        'There are exactly two vowels: I in slot 2 and E in slot 5.',
        'The consonants in order are C, P, H, R.',
        'Slot 3 is P and slot 4 is H, together followed by E.',
        'All six letters are unique.',
        'It is an algorithm for performing encryption or decryption.'
      ]
    },
    {
      id: 'mast_02',
      difficulty: DIFFICULTY_LEVELS.MASTER,
      title: 'Six-Letter Master Crypt #2',
      secretWord: 'VECTOR',
      clues: [
        'The first letter is V, and the last letter is R.',
        'There are two vowels: E at position 2 and O at position 5.',
        'Positions 3 and 4 are consonants C and T.',
        'It represents a geometric quantity with magnitude and direction, or an embedding array.',
        'The word contains no duplicate letters.'
      ]
    },
    {
      id: 'mast_03',
      difficulty: DIFFICULTY_LEVELS.MASTER,
      title: 'Six-Letter Master Crypt #3',
      secretWord: 'SCHEMA',
      clues: [
        'The word starts with S and ends with A.',
        'The 2nd, 3rd, and 4th letters are consonants: C, H, and E is vowel in 4th slot? No: C, H, then E in 3rd slot.',
        'The 5th letter is M.',
        'The vowels are E in position 4 and A in position 6.',
        'It defines the structural blueprint of a database table or JSON document.'
      ]
    },
    {
      id: 'mast_04',
      difficulty: DIFFICULTY_LEVELS.MASTER,
      title: 'Six-Letter Master Crypt #4',
      secretWord: 'MATRIX',
      clues: [
        'The word begins with M and ends with X.',
        'There are two vowels: A at position 2 and I at position 5.',
        'The central consonants are T (position 3) and R (position 4).',
        'It is a rectangular array of numbers or values arranged in rows and columns.'
      ]
    }
  ]
};

/**
 * Validates a player guess against the puzzle secret
 */
export function evaluateGuess(guessWord, secretWord) {
  const guess = String(guessWord || '').trim().toUpperCase();
  const secret = String(secretWord || '').trim().toUpperCase();

  if (guess.length !== secret.length) {
    return {
      valid: false,
      error: `Guess must be exactly ${secret.length} letters long.`
    };
  }

  const isExactMatch = guess === secret;
  const letterResults = []; // 'correct' (green), 'misplaced' (yellow), 'absent' (gray)

  const secretLetters = secret.split('');
  const guessLetters = guess.split('');
  const matchedSecretIndices = new Set();
  const matchedGuessIndices = new Set();

  // Pass 1: exact matches
  for (let i = 0; i < secret.length; i++) {
    if (guessLetters[i] === secretLetters[i]) {
      letterResults[i] = { letter: guessLetters[i], status: 'correct', index: i };
      matchedSecretIndices.add(i);
      matchedGuessIndices.add(i);
    }
  }

  // Pass 2: misplaced matches
  for (let i = 0; i < secret.length; i++) {
    if (matchedGuessIndices.has(i)) continue;
    const char = guessLetters[i];
    let foundIndex = -1;
    for (let j = 0; j < secret.length; j++) {
      if (!matchedSecretIndices.has(j) && secretLetters[j] === char) {
        foundIndex = j;
        break;
      }
    }
    if (foundIndex !== -1) {
      letterResults[i] = { letter: char, status: 'misplaced', index: i };
      matchedSecretIndices.add(foundIndex);
    } else {
      letterResults[i] = { letter: char, status: 'absent', index: i };
    }
  }

  return {
    valid: true,
    isExactMatch,
    guess,
    letterResults
  };
}

/**
 * Returns a hint for the puzzle
 */
export function getHint(puzzle, currentSlots = [], hintNumber = 1) {
  const secret = puzzle.secretWord.toUpperCase();
  if (hintNumber === 1) {
    // Reveal first unrevealed letter position
    for (let i = 0; i < secret.length; i++) {
      if (!currentSlots[i] || currentSlots[i] !== secret[i]) {
        return {
          type: 'reveal_letter',
          index: i,
          letter: secret[i],
          message: `Hint: Letter at slot #${i + 1} is "${secret[i]}".`
        };
      }
    }
  }

  // Hint 2: Eliminate 3-4 letters that are NOT in the secret word
  const allAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const nonSecretLetters = allAlphabet.filter(ch => !secret.includes(ch));
  const eliminated = nonSecretLetters.slice(0, 4);
  return {
    type: 'eliminate_letters',
    letters: eliminated,
    message: `Hint: The letters [${eliminated.join(', ')}] are NOT in the crypt.`
  };
}

/**
 * Calculates score for puzzle completion
 */
export function calculatePuzzleScore(difficulty, attempts, hintsUsed, elapsedSeconds = 60) {
  let baseScore = 1000;
  if (difficulty === DIFFICULTY_LEVELS.PRACTITIONER) baseScore = 1500;
  if (difficulty === DIFFICULTY_LEVELS.MASTER) baseScore = 2000;

  const attemptPenalty = Math.max(0, (attempts - 1) * 80);
  const hintPenalty = hintsUsed * 150;
  const timePenalty = Math.min(300, Math.floor(elapsedSeconds / 10) * 10);

  return Math.max(100, baseScore - attemptPenalty - hintPenalty - timePenalty);
}
