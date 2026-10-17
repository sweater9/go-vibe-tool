import {
  SolitaireGame,
  TILE_NAMES,
  TILE_SYMBOLS,
  tileCategory,
  tileLabel,
  isTileFree
} from './engine.js';

// DOM Elements
const boardViewport = document.getElementById('board-viewport');
const boardContainer = document.getElementById('board-container');
const timerEl = document.getElementById('stat-timer');
const movesEl = document.getElementById('stat-moves');
const remainingEl = document.getElementById('stat-remaining');
const openPairsEl = document.getElementById('stat-open-pairs');
const statusAnnouncement = document.getElementById('status-announcement');

const layoutSelect = document.getElementById('layout-select');
const difficultySelect = document.getElementById('difficulty-select');

const btnHint = document.getElementById('btn-hint');
const btnUndo = document.getElementById('btn-undo');
const btnShuffle = document.getElementById('btn-shuffle');
const btnPause = document.getElementById('btn-pause');
const btnRestart = document.getElementById('btn-restart');

const pauseOverlay = document.getElementById('pause-overlay');
const btnResume = document.getElementById('btn-resume');

const winOverlay = document.getElementById('win-overlay');
const winStats = document.getElementById('win-stats');
const btnPlayAgain = document.getElementById('btn-play-again');

const noMovesOverlay = document.getElementById('no-moves-overlay');
const btnNoMovesUndo = document.getElementById('btn-no-moves-undo');
const btnNoMovesShuffle = document.getElementById('btn-no-moves-shuffle');

// Game state
let game = null;
let timerInterval = null;
let hintedTiles = [];
let focusedTileIndex = 0;

const STORAGE_KEY = 'govibe-mahjong-solitaire-save';

// Gentle synthetic sound effect via Web Audio API (offline, zero external files)
let audioCtx = null;
function playClickSound(freq = 600, duration = 0.05) {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }
  } catch {
    // Audio unsupported or blocked, proceed silently
  }
}

function initGame() {
  const layout = layoutSelect.value;
  const difficulty = difficultySelect.value;

  // Check saved state
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const deserialized = SolitaireGame.deserialize(saved);
    if (deserialized && deserialized.tiles.length > 0 && !deserialized.isWon) {
      game = deserialized;
      layoutSelect.value = game.layoutName;
      difficultySelect.value = game.difficulty;
      startTimer();
      renderBoard();
      announce('Restored saved game.');
      return;
    }
  }

  game = new SolitaireGame({ layoutName: layout, difficulty });
  startTimer();
  renderBoard();
  announce(`New ${layout} game started.`);
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (game && !game.isPaused && !game.isWon) {
      game.elapsedSeconds++;
      updateStats();
      saveProgress();
    }
  }, 1000);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function announce(msg) {
  if (statusAnnouncement) {
    statusAnnouncement.textContent = msg;
  }
}

function saveProgress() {
  if (game && game.tiles.length > 0 && !game.isWon) {
    try {
      localStorage.setItem(STORAGE_KEY, game.serialize());
    } catch {
      // LocalStorage quota or access issue
    }
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function updateStats() {
  if (!game) return;
  timerEl.textContent = formatTime(game.elapsedSeconds);
  movesEl.textContent = game.moveCount;
  remainingEl.textContent = game.tiles.length;

  const openMoves = game.getAvailableMoves();
  openPairsEl.textContent = openMoves.length;

  btnUndo.disabled = game.history.length === 0;
  btnHint.disabled = openMoves.length === 0 || game.isPaused || game.isWon;
}

function renderBoard() {
  if (!game) return;
  boardViewport.replaceChildren();
  hintedTiles = [];

  const activeTiles = game.getActiveTiles();
  const unitW = 28;
  const unitH = 34;
  const dx = -4; // 3D layer offset x
  const dy = -4; // 3D layer offset y

  activeTiles.forEach((tile, index) => {
    const isFree = isTileFree(tile, activeTiles);
    const isSelected = game.selected && game.selected.id === tile.id;
    const cat = tileCategory(tile.type);

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sol-tile ${isFree ? 'free' : 'blocked'} ${isSelected ? 'selected' : ''}`;
    el.dataset.id = tile.id;
    el.dataset.type = tile.type;
    el.dataset.z = tile.z;
    el.dataset.cat = cat;

    const posX = tile.x * unitW + tile.z * dx;
    const posY = tile.y * unitH + tile.z * dy;
    el.style.setProperty('--base-x', `${posX}px`);
    el.style.setProperty('--base-y', `${posY}px`);
    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;
    el.style.zIndex = tile.z * 100 + tile.y;

    el.setAttribute('aria-label', `${tileLabel(tile.type)}, layer ${tile.z + 1}, ${isFree ? 'available' : 'blocked'}`);
    el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    el.setAttribute('tabindex', isFree ? '0' : '-1');

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'symbol';
    symbolSpan.textContent = TILE_SYMBOLS[tile.type] || '?';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = tileLabel(tile.type);

    el.append(symbolSpan, labelSpan);

    el.onclick = () => handleTileClick(tile.id);
    boardViewport.append(el);
  });

  updateStats();
  adjustScale();

  // Check Game States
  if (game.isWon) {
    handleWin();
  } else if (game.isGameOver) {
    handleNoMoves();
  }
}

function handleTileClick(tileId) {
  if (!game || game.isPaused || game.isWon) return;

  // Clear any existing hint animations
  clearHints();

  const prevSelected = game.selected;
  const result = game.select(tileId);

  if (result.success) {
    if (result.action === 'selected') {
      playClickSound(520, 0.04);
      announce(`Selected ${tileLabel(result.tile.type)}.`);
    } else if (result.action === 'deselected') {
      playClickSound(400, 0.03);
      announce('Tile deselected.');
    } else if (result.action === 'matched') {
      playClickSound(800, 0.08);
      announce(`Matched ${tileLabel(result.match[0].type)}! ${result.win ? 'You won!' : ''}`);
    }
    renderBoard();
    saveProgress();
  } else {
    playClickSound(240, 0.08); // Blocked/error sound
    announce(result.reason || 'Tile cannot be selected.');
  }
}

function clearHints() {
  hintedTiles.forEach(id => {
    const el = boardViewport.querySelector(`.sol-tile[data-id="${id}"]`);
    if (el) el.classList.remove('hinted');
  });
  hintedTiles = [];
}

function showHint() {
  clearHints();
  const pair = game.hint();
  if (pair) {
    playClickSound(700, 0.06);
    hintedTiles = [pair[0].id, pair[1].id];
    hintedTiles.forEach(id => {
      const el = boardViewport.querySelector(`.sol-tile[data-id="${id}"]`);
      if (el) el.classList.add('hinted');
    });
    announce(`Hint: matching pair of ${tileLabel(pair[0].type)} highlighted.`);
    // Auto clear after 4 seconds
    setTimeout(clearHints, 4000);
  } else {
    announce('No moves currently available. Try shuffling or undoing.');
  }
}

function handleUndo() {
  clearHints();
  const undone = game.undo();
  if (undone) {
    playClickSound(480, 0.06);
    renderBoard();
    saveProgress();
    announce(`Restored pair of ${tileLabel(undone.tiles[0].type)}.`);
  }
}

function handleShuffle() {
  clearHints();
  const ok = game.shuffle();
  if (ok) {
    playClickSound(640, 0.1);
    noMovesOverlay.hidden = true;
    renderBoard();
    saveProgress();
    announce('Tiles reshuffled into a solvable configuration.');
  } else {
    announce('Shuffle failed to find valid moves.');
  }
}

function handleWin() {
  clearInterval(timerInterval);
  localStorage.removeItem(STORAGE_KEY);
  winStats.textContent = `Completed in ${formatTime(game.elapsedSeconds)} with ${game.moveCount} moves.`;
  winOverlay.hidden = false;
  playClickSound(920, 0.2);
  announce('Congratulations! You solved the Mahjong Solitaire board!');
}

function handleNoMoves() {
  noMovesOverlay.hidden = false;
  announce('No matching moves left. You can Undo your last move or Shuffle remaining tiles.');
}

function togglePause() {
  if (!game || game.isWon) return;
  game.isPaused = !game.isPaused;
  pauseOverlay.hidden = !game.isPaused;
  btnPause.textContent = game.isPaused ? '▶ Resume' : '⏸ Pause';
  announce(game.isPaused ? 'Game paused.' : 'Game resumed.');
}

// Responsive Board Auto-scaling
function adjustScale() {
  if (!boardContainer || !boardViewport) return;
  const scrollSize = document.getElementById('board-scroll-size');
  if (!scrollSize) return;
  const baseW = 960;
  const baseH = 560;
  const availableW = Math.max(0, boardContainer.clientWidth - (window.innerWidth <= 768 ? 20 : 60));
  // Mobile tiles remain touch-friendly: 52x68 tiles render at least ~42x54.
  // The board scrolls horizontally instead of shrinking to fit a narrow phone.
  const minScale = window.innerWidth <= 768 ? 0.81 : 0.35;
  const scale = availableW < baseW ? Math.max(minScale, availableW / baseW) : 1;
  boardViewport.style.transform = `scale(${scale})`;
  scrollSize.style.width = `${Math.round(baseW * scale)}px`;
  scrollSize.style.height = `${Math.round(baseH * scale)}px`;
  boardContainer.style.minHeight = `${Math.round(baseH * scale + 40)}px`;
}

window.addEventListener('resize', adjustScale);

// Keyboard Accessibility & WCAG Navigation
window.addEventListener('keydown', (e) => {
  // Ignore inside selects or inputs
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

  if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    showHint();
  } else if (e.key === 'u' || e.key === 'U') {
    e.preventDefault();
    handleUndo();
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    handleShuffle();
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    togglePause();
  } else if (e.key === 'Escape') {
    if (game && game.selected) {
      game.selected = null;
      renderBoard();
      announce('Selection cleared.');
    }
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    // Navigate between free tiles
    const freeTileEls = Array.from(boardViewport.querySelectorAll('.sol-tile.free'));
    if (freeTileEls.length === 0) return;

    e.preventDefault();
    const currentActive = document.activeElement;
    let idx = freeTileEls.indexOf(currentActive);
    if (idx < 0) idx = 0;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      idx = (idx + 1) % freeTileEls.length;
    } else {
      idx = (idx - 1 + freeTileEls.length) % freeTileEls.length;
    }
    freeTileEls[idx].focus();
  }
});

// Button bindings
btnHint.onclick = showHint;
btnUndo.onclick = handleUndo;
btnShuffle.onclick = handleShuffle;
btnPause.onclick = togglePause;
btnResume.onclick = togglePause;

btnRestart.onclick = () => {
  if (game && game.moveCount > 0 && !game.isWon) {
    if (!confirm('Start a new board? Current progress will be reset.')) return;
  }
  localStorage.removeItem(STORAGE_KEY);
  initGame();
};

layoutSelect.onchange = () => {
  localStorage.removeItem(STORAGE_KEY);
  initGame();
};

difficultySelect.onchange = () => {
  if (game) game.difficulty = difficultySelect.value;
};

btnPlayAgain.onclick = () => {
  winOverlay.hidden = true;
  localStorage.removeItem(STORAGE_KEY);
  initGame();
};

btnNoMovesUndo.onclick = () => {
  noMovesOverlay.hidden = true;
  handleUndo();
};

btnNoMovesShuffle.onclick = () => {
  handleShuffle();
};

// Start on DOMContentLoaded
initGame();

// Register service worker for direct-visit offline play
if ('serviceWorker' in navigator) {
  if (document.readyState === 'complete') {
    navigator.serviceWorker.register('../../sw.js').catch(() => {});
  } else {
    window.addEventListener('load', () => navigator.serviceWorker.register('../../sw.js').catch(() => {}));
  }
}
