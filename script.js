/**
 * Detects TWA (Trusted Web Activity) / standalone PWA
 */
const isRunningAsApp = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
};

const IS_APP = isRunningAsApp();

if (IS_APP) {
  document.body.classList.add('app-mode');
}

/**
 * Mobile detection
 */
const isMobile = () => {
  return window.matchMedia('(pointer: coarse)').matches;
};

/**
 * Locks portrait orientation
 */
const lockPortrait = () => {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(() => {
      // Silently fails — CSS landscape overlay acts as fallback
    });
  }
};

if (IS_APP && isMobile()) {
  lockPortrait();
}

/**
 * SVG icon templates
 */

const SUN_SVG = `
  <circle cx="12" cy="12" r="5"/>
  <g>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </g>
`;

const MOON_SVG = `
  <path d="M21 12.79A9 9 0 1 1 11.21 3
           7 7 0 0 0 21 12.79z"/>
`;

const SOUND_ON_SVG = `
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
`;

const SOUND_OFF_SVG = `
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  <line x1="23" y1="9" x2="17" y2="15"/>
  <line x1="17" y1="9" x2="23" y2="15"/>
`;

const PAUSE_SVG = `
  <rect x="6" y="4" width="4" height="16"/>
  <rect x="14" y="4" width="4" height="16"/>
`;

/**
 * Constants
 */

const BOARD_SIZE = 4;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const MOVE_DURATION = 150;
const SWIPE_THRESHOLD = 30;

const BASE_PRIMES = [
  2, 3, 5, 7, 11,
  13, 17, 19, 23, 29,
  31, 37, 41, 43, 47,
  53, 59, 61, 67, 71,
  73, 79, 83, 89, 97,
];

const PRIMES = [...BASE_PRIMES];

const getRandomBasePrime = () =>
  Math.random() < 0.7 ? 2 : 3;

/**
 * DOM references
 */

const boardElement = document.querySelector(".game-board");
const cells = [...boardElement.querySelectorAll(".cell")];

const scoreValueEl = document.querySelector("[data-score]");
const scoreBestEl = document.querySelector("[data-score-best]");
const primeValueEl = document.querySelector("[data-prime]");
const primeBestEl = document.querySelector("[data-prime-best]");

const nextValueEl = document.querySelector("[data-next]");
const movesValueEl = document.querySelector("[data-moves]");

const newGameBtn = document.querySelector("[data-new-game]");
const infoBtn = document.querySelector("[data-info]");
const soundToggleBtn = document.querySelector("[data-sound-toggle]");
const soundIcon = soundToggleBtn.querySelector("[data-icon]");

const gameOverModal = document.querySelector("[data-game-over]");
const finalScoreEl = document.querySelector("[data-final-score]");
const finalMovesEl = document.querySelector("[data-final-moves]");
const finalPrimeEl = document.querySelector("[data-final-prime]");
const restartBtn = document.querySelector("[data-restart]");
const closeGameOverBtn = document.querySelector("[data-close-game-over]");

const pauseModal = document.querySelector("[data-pause]");
const pauseResumeBtn = document.querySelector("[data-resume]");
const pauseNewGameBtn = document.querySelector("[data-pause-new-game]");

const rulesModal = document.querySelector("[data-rules]");
const pages = [...document.querySelectorAll(".rules-page")];
const prevBtn = document.querySelector("[data-page-prev]");
const nextBtn = document.querySelector("[data-page-next]");
const indicator = document.querySelector("[data-indicator]");
const closeRulesBtn = document.querySelector("[data-close-rules]");

const hudMedalEl = document.querySelector(".hud-medal");

let bestScore = 0;
let bestPrime = 0;

/**
 * Persistent state
 */

const loadGameState = () => {
  const saved = localStorage.getItem("primeGameState");
  if (!saved) return false;

  try {
    const state = JSON.parse(saved);
    if (!state.board || !Array.isArray(state.board)) return false;

    board = state.board;
    moves = state.moves || 0;
    score = state.score || 0;

    // Validate PRIMES before restoring to prevent corrupt saves causing infinite loops
    if (state.PRIMES && Array.isArray(state.PRIMES) && state.PRIMES.length >= 2) {
      PRIMES.length = 0;
      PRIMES.push(...state.PRIMES);
    }

    bestScore = state.bestScore || 0;
    bestPrime = state.bestPrime || 0;

    renderBoard();
    updateMedal();
    return true;
  } catch {
    return false;
  }
};

const saveGameState = () => {
  const state = {
    board,
    moves,
    score,
    PRIMES,
    bestScore,
    bestPrime
  };
  localStorage.setItem("primeGameState", JSON.stringify(state));
};

/**
 * Game state
 */

let board = Array(CELL_COUNT).fill(null);
let moves = 0;
let score = 0;
let isAnimating = false;
let isPaused = false;

let mergedIndexes = new Set();
let spawnedIndex = null;
let currentMedal = "none";

/**
 * Sound system (Web Audio API, synthesized — no external files)
 */

const Sound = (() => {
  let ctx = null;
  let enabled = localStorage.getItem('soundEnabled') !== 'false';

  const getCtx = () => {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window['webkitAudioContext'];
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  };

  const tone = (freq, type, duration, volume) => {
    if (!enabled) return;
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + duration);
    } catch {
      // Silently fail if Web Audio is unavailable
    }
  };

  return {
    move() {
      tone(220, 'sine', 0.08, 0.12);
    },
    merge() {
      tone(440, 'triangle', 0.12, 0.25);
      setTimeout(() => tone(554, 'triangle', 0.10, 0.20), 60);
    },
    gameOver() {
      tone(220, 'sawtooth', 0.20, 0.30);
      setTimeout(() => tone(185, 'sawtooth', 0.25, 0.30), 180);
      setTimeout(() => tone(147, 'sawtooth', 0.30, 0.30), 360);
    },
    setEnabled(on) {
      enabled = on;
      localStorage.setItem('soundEnabled', on ? 'true' : 'false');
    },
    isEnabled() {
      return enabled;
    }
  };
})();

const applySoundIcon = () => {
  soundIcon.innerHTML = Sound.isEnabled() ? SOUND_ON_SVG : SOUND_OFF_SVG;
};

soundToggleBtn.addEventListener('click', () => {
  Sound.setEnabled(!Sound.isEnabled());
  applySoundIcon();
});

applySoundIcon();

/**
 * Helpers
 */

const boardsEqual = (a, b) =>
  a.every((v, i) => v === b[i]);

const highestPrimeOnBoard = () =>
  Math.max(...board.filter(v => v !== null), 0);

const ensurePrimeAtIndex = index => {
  while (PRIMES.length <= index) {
    const next = generateNextPrime(PRIMES[PRIMES.length - 1]);
    PRIMES.push(next);
  }
  return PRIMES[index];
};

const getNextTargetPrime = () => {
  const maxCurrent = highestPrimeOnBoard();
  const index = PRIMES.indexOf(maxCurrent);

  const safeIndex = index !== -1
    ? index
    : PRIMES.findIndex(p => p > maxCurrent) - 1;

  // Guard against edge case where safeIndex is negative (corrupted state)
  return ensurePrimeAtIndex(Math.max(0, safeIndex + 1));
};

const getTierFromPrime = prime => {
  let index = PRIMES.indexOf(prime);

  if (index === -1) {
    while (PRIMES[PRIMES.length - 1] < prime) {
      PRIMES.push(generateNextPrime(PRIMES[PRIMES.length - 1]));
    }
    index = PRIMES.indexOf(prime);
  }

  return Math.min(index + 1, 20);
};

const generateNextPrime = lastPrime => {
  let candidate = lastPrime + 2;
  while (!isPrime(candidate)) {
    candidate += 2;
  }
  return candidate;
};

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

/**
 * Medal logic
 */

const medalFromPrime = prime => {
  const n = BASE_PRIMES.length;
  if (prime >= BASE_PRIMES[n - 1]) return "gold";
  if (prime >= BASE_PRIMES[Math.floor(n * 0.85) - 1]) return "silver";
  if (prime >= BASE_PRIMES[Math.floor(n * 0.6) - 1]) return "bronze";
  return "none";
};

const updateMedal = () => {
  const medal = medalFromPrime(highestPrimeOnBoard());
  if (medal !== currentMedal) {
    currentMedal = medal;
    hudMedalEl.dataset.medal = medal;
  }
};

/**
 * Tiles
 */

const createTile = (value, index) => {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.textContent = value;
  tile.dataset.value = value;

  const tier = getTierFromPrime(value);
  tile.classList.add(`tile--tier-${tier}`);

  if (mergedIndexes.has(index)) tile.classList.add("tile--merge");
  if (index === spawnedIndex) tile.classList.add("tile--spawn");

  const length = value.toString().length;
  const maxFont = 2;
  const minFont = 1;
  const maxChars = 5;

  const calculatedFont = Math.max(
    minFont,
    maxFont - ((length - 2) * (maxFont - minFont) / (maxChars - 2))
  );

  tile.style.fontSize = `${calculatedFont}rem`;

  return tile;
};

const clearCells = () => {
  cells.forEach(cell => (cell.innerHTML = ""));
};

/**
 * Animation helpers
 */

const getCellPosition = index => {
  const rect = cells[index].getBoundingClientRect();
  return { x: rect.left, y: rect.top };
};

const animateMove = (tile, from, to) => {
  const a = getCellPosition(from);
  const b = getCellPosition(to);
  tile.style.transform = `translate(${b.x - a.x}px, ${b.y - a.y}px)`;
};

/**
 * Render
 */

const renderBoard = () => {
  clearCells();

  board.forEach((value, index) => {
    if (value !== null) {
      cells[index].appendChild(createTile(value, index));
    }
  });

  nextValueEl.textContent = getNextTargetPrime();
  movesValueEl.textContent = moves;

  scoreValueEl.textContent = score;
  scoreBestEl.textContent = bestScore;

  const highest = highestPrimeOnBoard();
  primeValueEl.textContent = highest;
  primeBestEl.textContent = bestPrime;

  mergedIndexes.clear();
  spawnedIndex = null;
};

/**
 * Spawning
 */

const getEmptyIndexes = () =>
  board.map((v, i) => (v === null ? i : null)).filter(i => i !== null);

const spawnTile = value => {
  const empty = getEmptyIndexes();
  if (!empty.length) return false;

  spawnedIndex = empty[Math.floor(Math.random() * empty.length)];
  board[spawnedIndex] = value;
  return true;
};

/**
 * Merge helpers
 */

const isValidPrime = sum => {
  if (!isPrime(sum)) return false;
  return sum <= getNextTargetPrime();
};

const bestMerge = values => {
  const candidates = [];

  if (values.length >= 2) {
    const sum2 = values[0] + values[1];
    if (isValidPrime(sum2)) candidates.push({ size: 2, value: sum2 });
  }

  if (values.length >= 3) {
    const sum3 = values[0] + values[1] + values[2];
    if (isValidPrime(sum3)) candidates.push({ size: 3, value: sum3 });
  }

  return candidates.sort((a, b) => b.value - a.value)[0] ?? null;
};

/**
 * Movement
 */

const getLineIndexes = direction => {
  const lines = [];

  for (let i = 0; i < BOARD_SIZE; i++) {
    const line = [];
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (direction === "left") line.push(i * BOARD_SIZE + j);
      if (direction === "right") line.push(i * BOARD_SIZE + (BOARD_SIZE - 1 - j));
      if (direction === "up") line.push(j * BOARD_SIZE + i);
      if (direction === "down") line.push((BOARD_SIZE - 1 - j) * BOARD_SIZE + i);
    }
    lines.push(line);
  }
  return lines;
};

const computeMove = direction => {
  const moveAnimations = [];
  const newBoard = [...board];

  getLineIndexes(direction).forEach(line => {
    const values = [];
    const sources = [];

    line.forEach(index => {
      if (board[index] !== null) {
        values.push(board[index]);
        sources.push(index);
      }
    });

    let read = 0;
    let write = 0;

    while (read < values.length) {
      const slice = values.slice(read);
      const merge = bestMerge(slice);
      const targetIndex = line[write];

      if (merge) {
        newBoard[targetIndex] = merge.value;
        mergedIndexes.add(targetIndex);
        score += merge.value;

        for (let i = 0; i < merge.size; i++) {
          moveAnimations.push({
            from: sources[read + i],
            to: targetIndex
          });
        }

        read += merge.size;
      } else {
        newBoard[targetIndex] = values[read];
        moveAnimations.push({
          from: sources[read],
          to: targetIndex
        });
        read += 1;
      }

      write += 1;
    }

    for (let i = write; i < BOARD_SIZE; i++) {
      newBoard[line[i]] = null;
    }
  });

  return { newBoard, moveAnimations };
};

/**
 * Perform move
 */

const anyModalOpen = () =>
  !gameOverModal.classList.contains("hidden") ||
  !rulesModal.classList.contains("hidden") ||
  !pauseModal.classList.contains("hidden");

const move = async direction => {
  if (isAnimating || isPaused || anyModalOpen()) return;

  const { newBoard, moveAnimations } = computeMove(direction);
  if (boardsEqual(board, newBoard)) return;

  // Play sound immediately (before animation) for responsive feel
  const hadMerge = mergedIndexes.size > 0;
  if (hadMerge) Sound.merge();
  else Sound.move();

  isAnimating = true;
  moves += 1;

  moveAnimations.forEach(({ from, to }) => {
    const tile = cells[from].querySelector(".tile");
    if (tile) animateMove(tile, from, to);
  });

  setTimeout(() => {
    try {
      board = newBoard;
      spawnTile(getRandomBasePrime());

      bestScore = Math.max(bestScore, score);
      bestPrime = Math.max(bestPrime, highestPrimeOnBoard());

      renderBoard();
      updateMedal();

      try {
        saveGameState();
      } catch {
        // Storage quota exceeded — game continues without saving
      }
    } finally {
      // Always reset animation lock, even if an error occurred above
      isAnimating = false;
      mergedIndexes.clear();
      spawnedIndex = null;
    }

    if (isGameOver()) {
      Sound.gameOver();
      showGameOver();
    }
  }, MOVE_DURATION);
};

/**
 * Keyboard input
 */

window.addEventListener("keydown", e => {
  const map = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };

  if (e.key === "Escape") {
    if (!pauseModal.classList.contains("hidden")) {
      resumeGame();
    } else if (!rulesModal.classList.contains("hidden")) {
      rulesModal.classList.add("hidden");
    }
    return;
  }

  if (map[e.key]) {
    e.preventDefault();
    move(map[e.key]);
  }
});

/**
 * Swipe input
 */

let touchStartX = 0;
let touchStartY = 0;

// Prevent native pull-to-refresh only when at top
document.addEventListener('touchmove', function(e) {
  if (window.pageYOffset === 0 && e.changedTouches[0].pageY > 0) {
    e.preventDefault();
  }
}, { passive: false });

boardElement.addEventListener("touchstart", e => {
  if (e.touches.length !== 1) return;

  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;

  e.preventDefault();
}, { passive: false });

boardElement.addEventListener("touchend", e => {
  if (e.changedTouches.length !== 1) return;

  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

  const direction = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");

  move(direction);

  e.preventDefault();
}, { passive: false });

/**
 * Game over
 */

const canMergeLine = values =>
  values.some((_, i) => bestMerge(values.slice(i)));

const isGameOver = () => {
  if (board.includes(null)) return false;

  return !["left", "right", "up", "down"].some(dir =>
    getLineIndexes(dir).some(line =>
      canMergeLine(line.map(i => board[i]).filter(v => v !== null))
    )
  );
};

const showGameOver = () => {
  finalScoreEl.textContent = score;
  finalMovesEl.textContent = moves;
  finalPrimeEl.textContent = highestPrimeOnBoard();
  gameOverModal.classList.remove("hidden");
};

closeGameOverBtn.addEventListener("click", () =>
  gameOverModal.classList.add("hidden")
);

/**
 * Pause system
 */

const pauseGame = () => {
  if (isGameOver() || !gameOverModal.classList.contains("hidden")) return;
  isPaused = true;
  pauseModal.classList.remove("hidden");
};

const resumeGame = () => {
  isPaused = false;
  pauseModal.classList.add("hidden");
};

pauseResumeBtn.addEventListener("click", resumeGame);

pauseNewGameBtn.addEventListener("click", () => {
  resumeGame();
  startGame();
});

/**
 * Back button handler (Android hardware back / browser back)
 *
 * Strategy: push a dummy history state on init so the first back press
 * is intercepted. Each interception re-pushes to keep the buffer alive.
 */

const handleBackButton = () => {
  if (!rulesModal.classList.contains("hidden")) {
    rulesModal.classList.add("hidden");
    return;
  }
  if (!gameOverModal.classList.contains("hidden")) {
    gameOverModal.classList.add("hidden");
    return;
  }
  if (isPaused) {
    resumeGame();
    return;
  }
  pauseGame();
};

const initBackButtonHandler = () => {
  history.pushState(null, "");
  window.addEventListener("popstate", () => {
    history.pushState(null, "");
    handleBackButton();
  });
};

/**
 * Rules modal
 */

let currentPage = 0;

const updateRulesPage = () => {
  pages.forEach((p, i) =>
    p.classList.toggle("active", i === currentPage)
  );

  indicator.textContent = `${currentPage + 1} / ${pages.length}`;
  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage === pages.length - 1;
};

prevBtn.addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    updateRulesPage();
  }
});

nextBtn.addEventListener("click", () => {
  if (currentPage < pages.length - 1) {
    currentPage++;
    updateRulesPage();
  }
});

infoBtn.addEventListener("click", () => {
  rulesModal.classList.remove("hidden");
  currentPage = 0;
  updateRulesPage();
});

closeRulesBtn.addEventListener("click", () =>
  rulesModal.classList.add("hidden")
);

/**
 * Theme (dark / light)
 */

const themeToggleBtn = document.querySelector('[data-theme-toggle]');
const themeIcon = themeToggleBtn.querySelector('[data-icon]');

const applyTheme = theme => {
  if (theme === 'light') {
    document.body.dataset.theme = 'light';
    themeIcon.innerHTML = MOON_SVG;
  } else {
    delete document.body.dataset.theme;
    themeIcon.innerHTML = SUN_SVG;
  }
  localStorage.setItem('theme', theme);
};

themeToggleBtn.addEventListener('click', () => {
  const current = localStorage.getItem('theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
});

const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);

/**
 * Lifecycle
 */

const animateNewButton = () => {
  newGameBtn.classList.add("animate");
  setTimeout(() => {
    newGameBtn.classList.remove("animate");
  }, 1000);
};

const startGame = () => {
  board.fill(null);
  moves = 0;
  score = 0;
  currentMedal = "none";
  isPaused = false;

  hudMedalEl.dataset.medal = "none";
  gameOverModal.classList.add("hidden");
  pauseModal.classList.add("hidden");

  spawnTile(getRandomBasePrime());
  spawnTile(getRandomBasePrime());
  renderBoard();

  try {
    saveGameState();
  } catch {
    // Storage unavailable — game runs without persistence
  }
};

newGameBtn.addEventListener("click", animateNewButton);
newGameBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

if (!loadGameState()) {
  startGame();
}

initBackButtonHandler();
