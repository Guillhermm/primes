/**
 * Node.js CI test suite for Primes game logic.
 *
 * Uses Node's built-in test runner (node:test, available since Node 18).
 * Run with: node --test tests/node.js
 *
 * These functions are duplicated from script.js to allow testing without a DOM.
 * Keep them in sync when game logic changes.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Pure functions (mirrored from script.js) ─────────────────────────────────

const BASE_PRIMES = [
  2, 3, 5, 7, 11,
  13, 17, 19, 23, 29,
  31, 37, 41, 43, 47,
  53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];

const isPrime = n => {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  const limit = Math.sqrt(n);
  for (let i = 3; i <= limit; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
};

const generateNextPrime = lastPrime => {
  let candidate = lastPrime + 2;
  while (!isPrime(candidate)) candidate += 2;
  return candidate;
};

const boardsEqual = (a, b) => a.every((v, i) => v === b[i]);

const medalFromPrime = prime => {
  const n = BASE_PRIMES.length;
  if (prime >= BASE_PRIMES[n - 1]) return 'gold';
  if (prime >= BASE_PRIMES[Math.floor(n * 0.85) - 1]) return 'silver';
  if (prime >= BASE_PRIMES[Math.floor(n * 0.6) - 1]) return 'bronze';
  return 'none';
};

// ─── Stateful game logic (requires explicit state injection) ──────────────────

/**
 * All functions below take an explicit `state` object instead of using globals,
 * making them testable in isolation.
 *
 * state = { board: number[], score: number, primes: number[], mergedIndexes: Set }
 */

const highestPrimeOnBoard = board =>
  Math.max(...board.filter(v => v !== null), 0);

const ensurePrimeAtIndex = (primes, index) => {
  while (primes.length <= index) {
    primes.push(generateNextPrime(primes[primes.length - 1]));
  }
  return primes[index];
};

const getNextTargetPrime = (board, primes) => {
  const maxCurrent = highestPrimeOnBoard(board);
  const index = primes.indexOf(maxCurrent);
  const safeIndex = index !== -1
    ? index
    : primes.findIndex(p => p > maxCurrent) - 1;
  return ensurePrimeAtIndex(primes, Math.max(0, safeIndex + 1));
};

const isValidPrime = (sum, board, primes) =>
  isPrime(sum) && sum <= getNextTargetPrime(board, primes);

const bestMerge = (values, board, primes) => {
  const candidates = [];
  if (values.length >= 2) {
    const sum2 = values[0] + values[1];
    if (isValidPrime(sum2, board, primes)) candidates.push({ size: 2, value: sum2 });
  }
  if (values.length >= 3) {
    const sum3 = values[0] + values[1] + values[2];
    if (isValidPrime(sum3, board, primes)) candidates.push({ size: 3, value: sum3 });
  }
  return candidates.sort((a, b) => b.value - a.value)[0] ?? null;
};

const BOARD_SIZE = 4;

const getLineIndexes = direction => {
  const lines = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const line = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (direction === 'left')  line.push(i * BOARD_SIZE + j);
      if (direction === 'right') line.push(i * BOARD_SIZE + (BOARD_SIZE - 1 - j));
      if (direction === 'up')    line.push(j * BOARD_SIZE + i);
      if (direction === 'down')  line.push((BOARD_SIZE - 1 - j) * BOARD_SIZE + i);
    }
    lines.push(line);
  }
  return lines;
};

const computeMove = (direction, board, primes) => {
  const newBoard = [...board];
  const mergedIndexes = new Set();
  let scoreDelta = 0;

  getLineIndexes(direction).forEach(line => {
    const values = [];
    const sources = [];
    line.forEach(idx => {
      if (board[idx] !== null) { values.push(board[idx]); sources.push(idx); }
    });

    let read = 0, write = 0;
    while (read < values.length) {
      const merge = bestMerge(values.slice(read), board, primes);
      const targetIndex = line[write];
      if (merge) {
        newBoard[targetIndex] = merge.value;
        mergedIndexes.add(targetIndex);
        scoreDelta += merge.value;
        for (let i = 0; i < merge.size; i++) {
          // clear source slots (except target itself)
          if (sources[read + i] !== targetIndex) newBoard[sources[read + i]] = null;
        }
        read += merge.size;
      } else {
        newBoard[targetIndex] = values[read];
        read += 1;
      }
      write += 1;
    }
    for (let i = write; i < BOARD_SIZE; i++) newBoard[line[i]] = null;
  });

  return { newBoard, scoreDelta, mergedIndexes };
};

const canMergeLine = (values, board, primes) =>
  values.some((_, i) => bestMerge(values.slice(i), board, primes));

const isGameOver = (board, primes) => {
  if (board.includes(null)) return false;
  return !['left', 'right', 'up', 'down'].some(dir =>
    getLineIndexes(dir).some(line =>
      canMergeLine(line.map(i => board[i]).filter(v => v !== null), board, primes)
    )
  );
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

const makeBoard = (values = []) => {
  const b = Array(16).fill(null);
  values.forEach((v, i) => { b[i] = v ?? null; });
  return b;
};

const freshPrimes = () => [...BASE_PRIMES];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('isPrime', () => {
  it('identifies primes correctly', () => {
    for (const p of [2, 3, 5, 7, 11, 97, 101]) assert.ok(isPrime(p), `${p} should be prime`);
  });
  it('rejects non-primes', () => {
    for (const n of [0, 1, 4, 6, 9, 15, 100, -7]) assert.ok(!isPrime(n), `${n} should not be prime`);
  });
  it('handles 2 (only even prime)', () => {
    assert.ok(isPrime(2));
    assert.ok(!isPrime(4));
  });
});

describe('generateNextPrime', () => {
  it('generates correct successive primes', () => {
    assert.equal(generateNextPrime(3), 5);
    assert.equal(generateNextPrime(5), 7);
    assert.equal(generateNextPrime(7), 11);
    assert.equal(generateNextPrime(89), 97);
    assert.equal(generateNextPrime(97), 101);
  });
  it('result is always prime', () => {
    assert.ok(isPrime(generateNextPrime(41)));
    assert.ok(isPrime(generateNextPrime(97)));
    assert.ok(isPrime(generateNextPrime(101)));
  });
});

describe('boardsEqual', () => {
  it('detects equal boards', () => {
    assert.ok(boardsEqual([2, 3, null, null], [2, 3, null, null]));
    assert.ok(boardsEqual(Array(16).fill(null), Array(16).fill(null)));
  });
  it('detects differences', () => {
    assert.ok(!boardsEqual([2, 3, null, null], [2, 5, null, null]));
    assert.ok(!boardsEqual([null, 3, null, null], [2, 3, null, null]));
  });
});

describe('medalFromPrime', () => {
  it('returns none below bronze', () => {
    assert.equal(medalFromPrime(2), 'none');
    assert.equal(medalFromPrime(43), 'none');
  });
  it('returns bronze from 47', () => {
    assert.equal(medalFromPrime(47), 'bronze');
    assert.equal(medalFromPrime(71), 'bronze');
  });
  it('returns silver from 73', () => {
    assert.equal(medalFromPrime(73), 'silver');
    assert.equal(medalFromPrime(89), 'silver');
  });
  it('returns gold from 97 and beyond', () => {
    assert.equal(medalFromPrime(97), 'gold');
    assert.equal(medalFromPrime(101), 'gold');
  });
});

describe('bestMerge', () => {
  it('merges two tiles into a prime', () => {
    const board = makeBoard([3]);
    assert.deepEqual(bestMerge([2, 3], board, freshPrimes()), { size: 2, value: 5 });
    assert.deepEqual(bestMerge([3, 2], board, freshPrimes()), { size: 2, value: 5 });
  });
  it('returns null when sum is not prime', () => {
    const board = makeBoard([3]);
    assert.equal(bestMerge([2, 2], board, freshPrimes()), null); // 4 not prime
    assert.equal(bestMerge([3, 3], board, freshPrimes()), null); // 6 not prime
  });
  it('returns null for single tile', () => {
    const board = makeBoard([3]);
    assert.equal(bestMerge([3], board, freshPrimes()), null);
  });
  it('prefers 3-tile merge when value is higher', () => {
    // board highest = 7, next = 11; [2,2,7]=11 beats [2,2]=4 (not prime anyway)
    const board = makeBoard([7]);
    assert.deepEqual(bestMerge([2, 2, 7], board, freshPrimes()), { size: 3, value: 11 });
  });
  it('prefers higher-value merge (3-tile > 2-tile)', () => {
    // board highest = 5, next = 7; [2,3,2]: 2+3=5 and 2+3+2=7, prefer 7
    const board = makeBoard([5]);
    assert.deepEqual(bestMerge([2, 3, 2], board, freshPrimes()), { size: 3, value: 7 });
  });
  it('rejects merge exceeding next target', () => {
    // board highest = 3, next = 5; 2+5=7 > 5 → blocked
    const board = makeBoard([3]);
    assert.equal(bestMerge([2, 5], board, freshPrimes()), null);
  });
});

describe('isGameOver', () => {
  it('returns false with empty cells', () => {
    assert.ok(!isGameOver(makeBoard(), freshPrimes()));
    assert.ok(!isGameOver(makeBoard([2, null, 3]), freshPrimes()));
  });
  it('returns false when a merge is possible', () => {
    // Full board; 2+3=5 is valid (highest=59, next=61, 5<=61)
    const board = makeBoard([2, 3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);
    assert.ok(!isGameOver(board, freshPrimes()));
  });
  it('returns true when board is full with no valid merges', () => {
    // All 47s: 47+47=94 (not prime), 47+47+47=141 (not prime)
    const board = makeBoard(Array(16).fill(47));
    assert.ok(isGameOver(board, freshPrimes()));
  });
});

describe('computeMove', () => {
  it('slides tiles left without merging (3+7=10, not prime)', () => {
    const board = makeBoard([null, 3, null, 7]);
    const { newBoard, scoreDelta } = computeMove('left', board, freshPrimes());
    assert.deepEqual(newBoard.slice(0, 4), [3, 7, null, null]);
    assert.equal(scoreDelta, 0);
  });
  it('merges two tiles left', () => {
    const board = makeBoard([2, 3]);
    const { newBoard, scoreDelta } = computeMove('left', board, freshPrimes());
    assert.deepEqual(newBoard.slice(0, 4), [5, null, null, null]);
    assert.equal(scoreDelta, 5);
  });
  it('slides a single tile right', () => {
    const board = makeBoard([2]);
    const { newBoard } = computeMove('right', board, freshPrimes());
    assert.deepEqual(newBoard.slice(0, 4), [null, null, null, 2]);
  });
  it('slides column up without merging (3+7=10, not prime)', () => {
    const board = makeBoard([null, null, null, null, 3, null, null, null, null, null, null, null, 7]);
    const { newBoard } = computeMove('up', board, freshPrimes());
    assert.deepEqual([newBoard[0], newBoard[4], newBoard[8], newBoard[12]], [3, 7, null, null]);
  });
  it('slides column down without merging (3+7=10, not prime)', () => {
    const board = makeBoard([3, null, null, null, null, null, null, null, null, null, null, null, 7]);
    const { newBoard } = computeMove('down', board, freshPrimes());
    assert.deepEqual([newBoard[0], newBoard[4], newBoard[8], newBoard[12]], [null, null, 3, 7]);
  });
  it('performs 3-tile merge', () => {
    // board highest = 7, next = 11; [2,2,7] → [11]
    const board = makeBoard([2, 2, 7]);
    const { newBoard, scoreDelta } = computeMove('left', board, freshPrimes());
    assert.deepEqual(newBoard.slice(0, 4), [11, null, null, null]);
    assert.equal(scoreDelta, 11);
  });
});
