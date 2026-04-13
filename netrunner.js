/* ══════════════════════════════════════════════════
   NETRUNNER DECK — Hacking Maze Module
   Cyberpunk 2020 Dossier
══════════════════════════════════════════════════ */

/* ── CONFIG ── */
const NR_DIFFICULTY = {
  easy:   { cols: 9,  rows: 7,  timeLimit: 0 },
  medium: { cols: 13, rows: 10, timeLimit: 60 },
  hard:   { cols: 17, rows: 13, timeLimit: 45 }
};

const NR_COLORS = {
  bg:         '#0b0103',
  panel:      '#17070b',
  wall:       '#591019',
  wallGlow:   '#8a1822',
  path:       '#1a0a0d',
  pathLine:   '#3b0d14',
  grid:       '#2a0a0f',
  player:     '#e01434',
  playerGlow: 'rgba(224,20,52,0.7)',
  start:      '#00d98b',
  startGlow:  'rgba(0,217,139,0.6)',
  end:        '#ff4d6d',
  endGlow:    'rgba(255,77,109,0.6)',
  visited:    '#1e0c10',
  visitedLine:'rgba(224,20,52,0.25)',
  trail:      'rgba(224,20,52,0.18)',
  text:       '#f4c5cc',
  textDim:    '#85505a'
};

/* ── STATE ── */
let nrDifficulty  = 'easy';
let nrMaze        = null;   // 2D array of cell objects
let nrCols        = 0;
let nrRows        = 0;
let nrPlayer      = { x: 0, y: 0 };
let nrStart       = { x: 0, y: 0 };
let nrEnd         = { x: 0, y: 0 };
let nrVisited     = null;   // 2D boolean
let nrTrail       = [];     // [{x,y}]
let nrComplete    = false;
let nrFailed      = false;
let nrTimerSec    = 0;
let nrTimerLimit  = 0;
let nrTimerHandle = null;
let nrAnimFrame   = null;
let nrCanvasW     = 0;
let nrCanvasH     = 0;
let nrCellSize    = 0;

/* ── TERMINAL ── */
const TERM_LINES = [
  'CMD.DeckTerminal///CONNECT///>START',
  'CMD.Buffer///Daemon.BreachData///',
  'CMD.Buffer///Daemon.ICE.Pick///',
  'CMD.Buffer///Daemon.bash.Vostok///',
  'CMD.Buffer::Token.Lumin::bash///',
  'CMD.Buffer::IP::///directory.main;',
  'CMD.Buffer::download::///импорт.джейлбрейкер///',
  'priM.stack::ztech::///tool.mz;',
  'content.file::edge1.2.6///',
  'CMD.Breach::terminate::ICE///',
  'CMD.DeckTerminal///DISCONNECT///>END',
];
const TERM_SUCCESS = 'CMD.DeckTerminal///BREACH///>SUCCESS';
const TERM_FAIL    = 'CMD.DeckTerminal///BREACH///>FAIL';

let _termQueue  = [];
let _termIndex  = 0;
let _termHandle = null;
let _termRunning = false;

function termClear() {
  const el = document.getElementById('nr-terminal');
  if (!el) return;
  el.innerHTML = '<span class="nr-term-cursor"></span>';
}

function termPrint(text, cls = '', delay = 0) {
  _termQueue.push({ text, cls, delay });
  if (!_termRunning) termFlush();
}

function termFlush() {
  if (!_termQueue.length) { _termRunning = false; return; }
  _termRunning = true;
  const { text, cls, delay } = _termQueue.shift();
  clearTimeout(_termHandle);
  _termHandle = setTimeout(() => {
    const el = document.getElementById('nr-terminal');
    if (!el) { termFlush(); return; }
    const cursor = el.querySelector('.nr-term-cursor');
    const span = document.createElement('span');
    span.className = 'nr-term-line' + (cls ? ' ' + cls : '');
    span.textContent = text;
    el.insertBefore(span, cursor);
    el.scrollTop = el.scrollHeight;
    termFlush();
  }, delay);
}

function termRunSequence(lines, baseDelay = 220) {
  termClear();
  lines.forEach((line, i) => {
    const isDim = line.startsWith('CMD.Buffer');
    termPrint(line, isDim ? 'dim' : '', i * baseDelay);
  });
}

function termSuccess() {
  clearTimeout(_termHandle);
  _termQueue = [];
  _termRunning = false;
  const el = document.getElementById('nr-terminal');
  if (!el) return;
  const cursor = el.querySelector('.nr-term-cursor');
  const span = document.createElement('span');
  span.className = 'nr-term-line success';
  span.textContent = TERM_SUCCESS;
  el.insertBefore(span, cursor);
  el.scrollTop = el.scrollHeight;
}

function termFail() {
  clearTimeout(_termHandle);
  _termQueue = [];
  _termRunning = false;
  const el = document.getElementById('nr-terminal');
  if (!el) return;
  const cursor = el.querySelector('.nr-term-cursor');
  const span = document.createElement('span');
  span.className = 'nr-term-line fail';
  span.textContent = TERM_FAIL;
  el.insertBefore(span, cursor);
  el.scrollTop = el.scrollHeight;
}

/* ── TAB SWITCH ── */
function switchSheetTab(tab) {
  document.getElementById('tab-content-dossier').style.display   = tab === 'dossier'    ? '' : 'none';
  document.getElementById('tab-content-netrunner').style.display = tab === 'netrunner'  ? '' : 'none';
  document.getElementById('tab-dossier').classList.toggle('active',    tab === 'dossier');
  document.getElementById('tab-netrunner').classList.toggle('active', tab === 'netrunner');
  if (tab === 'netrunner') {
    setTimeout(() => {
      if (!nrMaze) generateMaze();
      else resizeAndDraw();
    }, 40);
  }
}

/* ── DIFFICULTY ── */
function setDifficulty(level) {
  nrDifficulty = level;
  ['easy','medium','hard'].forEach(d => {
    document.getElementById('nr-diff-' + d).classList.toggle('active', d === level);
  });
  generateMaze();
}

/* ── MAZE GENERATION (Recursive Backtracker) ── */
function generateMaze() {
  const cfg  = NR_DIFFICULTY[nrDifficulty];
  nrCols     = cfg.cols;
  nrRows     = cfg.rows;
  nrComplete = false;
  nrFailed   = false;
  nrTrail    = [];
  clearInterval(nrTimerHandle);

  // Build cell grid: each cell has walls [N,E,S,W]
  nrMaze = Array.from({ length: nrRows }, (_, y) =>
    Array.from({ length: nrCols }, (_, x) => ({
      x, y,
      walls: [true, true, true, true], // N E S W
      visited: false
    }))
  );
  nrVisited = Array.from({ length: nrRows }, () => Array(nrCols).fill(false));

  // Carve paths
  carveMaze(0, 0);

  // Start = top-left, End = bottom-right
  nrStart  = { x: 0, y: 0 };
  nrEnd    = { x: nrCols - 1, y: nrRows - 1 };
  nrPlayer = { x: 0, y: 0 };
  nrVisited[0][0] = true;
  nrTrail  = [{ x: 0, y: 0 }];

  // Timer
  nrTimerLimit = cfg.timeLimit;
  nrTimerSec   = 0;
  updateTimerDisplay();
  if (nrTimerLimit > 0) {
    const box = document.getElementById('nr-timer');
    if (box) box.className = 'nr-timer-box running';
    nrTimerHandle = setInterval(tickTimer, 1000);
  } else {
    const box = document.getElementById('nr-timer');
    if (box) { box.className = 'nr-timer-box'; box.textContent = '∞'; }
  }

  // Hide overlay
  const overlay = document.getElementById('nr-maze-overlay');
  if (overlay) overlay.innerHTML = '';

  // Terminal
  termRunSequence(TERM_LINES, 200);

  resizeAndDraw();
}

function carveMaze(x, y) {
  const dirs = shuffle([
    [0, -1, 0, 2],  // N: dy=-1, remove N(0) from cur, S(2) from neighbor
    [1,  0, 1, 3],  // E: dx=+1, remove E(1) from cur, W(3) from neighbor
    [0,  1, 2, 0],  // S: dy=+1, remove S(2) from cur, N(0) from neighbor
    [-1, 0, 3, 1],  // W: dx=-1, remove W(3) from cur, E(1) from neighbor
  ]);
  nrMaze[y][x].visited = true;
  for (const [dx, dy, wallA, wallB] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= nrCols || ny >= nrRows) continue;
    if (nrMaze[ny][nx].visited) continue;
    nrMaze[y][x].walls[wallA]   = false;
    nrMaze[ny][nx].walls[wallB] = false;
    carveMaze(nx, ny);
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── TIMER ── */
function tickTimer() {
  nrTimerSec++;
  updateTimerDisplay();
  if (nrTimerSec >= nrTimerLimit) {
    clearInterval(nrTimerHandle);
    if (!nrComplete) {
      nrFailed = true;
      showResult(false);
      termFail();
    }
  }
}

function updateTimerDisplay() {
  const box = document.getElementById('nr-timer');
  if (!box) return;
  if (nrTimerLimit === 0) { box.textContent = '∞'; return; }
  const remaining = Math.max(0, nrTimerLimit - nrTimerSec);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  box.textContent = `${m}:${String(s).padStart(2, '0')}`;
  if (remaining <= 10) box.className = 'nr-timer-box expired';
}

/* ── RESIZE & DRAW ── */
function resizeAndDraw() {
  const wrap = document.getElementById('nr-maze-canvas')?.parentElement;
  if (!wrap || !nrMaze) return;
  const maxW = wrap.clientWidth  - 24;
  const maxH = wrap.clientHeight - 24 || 420;
  const cellW = Math.floor(maxW / nrCols);
  const cellH = Math.floor(maxH / nrRows);
  nrCellSize  = Math.max(18, Math.min(cellW, cellH, 52));

  const canvas = document.getElementById('nr-maze-canvas');
  nrCanvasW = nrCellSize * nrCols;
  nrCanvasH = nrCellSize * nrRows;
  canvas.width  = nrCanvasW;
  canvas.height = nrCanvasH;
  canvas.style.width  = nrCanvasW + 'px';
  canvas.style.height = nrCanvasH + 'px';

  drawMaze();
}

function drawMaze() {
  const canvas = document.getElementById('nr-maze-canvas');
  if (!canvas || !nrMaze) return;
  const ctx  = canvas.getContext('2d');
  const cs   = nrCellSize;
  const half = cs / 2;

  // Background
  ctx.fillStyle = NR_COLORS.bg;
  ctx.fillRect(0, 0, nrCanvasW, nrCanvasH);

  // Grid lines (subtle)
  ctx.strokeStyle = NR_COLORS.grid;
  ctx.lineWidth   = 0.5;
  for (let x = 0; x <= nrCols; x++) {
    ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, nrCanvasH); ctx.stroke();
  }
  for (let y = 0; y <= nrRows; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(nrCanvasW, y * cs); ctx.stroke();
  }

  // Cell fills
  for (let y = 0; y < nrRows; y++) {
    for (let x = 0; x < nrCols; x++) {
      if (nrVisited[y][x]) {
        ctx.fillStyle = NR_COLORS.visited;
        ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
      }
    }
  }

  // Trail
  if (nrTrail.length > 1) {
    ctx.strokeStyle = NR_COLORS.visitedLine;
    ctx.lineWidth   = Math.max(2, cs * 0.18);
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(nrTrail[0].x * cs + half, nrTrail[0].y * cs + half);
    for (let i = 1; i < nrTrail.length; i++) {
      ctx.lineTo(nrTrail[i].x * cs + half, nrTrail[i].y * cs + half);
    }
    ctx.stroke();
  }

  // Walls
  ctx.lineWidth   = Math.max(2, cs * 0.13);
  ctx.lineCap     = 'square';
  for (let y = 0; y < nrRows; y++) {
    for (let x = 0; x < nrCols; x++) {
      const cell = nrMaze[y][x];
      const px   = x * cs;
      const py   = y * cs;

      // Glow for outer border walls only
      const isOuter = x === 0 || y === 0 || x === nrCols - 1 || y === nrRows - 1;
      ctx.strokeStyle = isOuter ? NR_COLORS.wallGlow : NR_COLORS.wall;

      if (cell.walls[0]) { // N
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + cs, py); ctx.stroke();
      }
      if (cell.walls[1]) { // E
        ctx.beginPath(); ctx.moveTo(px + cs, py); ctx.lineTo(px + cs, py + cs); ctx.stroke();
      }
      if (cell.walls[2]) { // S
        ctx.beginPath(); ctx.moveTo(px, py + cs); ctx.lineTo(px + cs, py + cs); ctx.stroke();
      }
      if (cell.walls[3]) { // W
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + cs); ctx.stroke();
      }
    }
  }

  // Start cell (green)
  drawNodeCell(ctx, nrStart.x, nrStart.y, cs, NR_COLORS.start, NR_COLORS.startGlow, '▶');

  // End cell (red)
  drawNodeCell(ctx, nrEnd.x, nrEnd.y, cs, NR_COLORS.end, NR_COLORS.endGlow, '■');

  // Player
  if (!nrComplete && !nrFailed) {
    drawPlayer(ctx, nrPlayer.x, nrPlayer.y, cs);
  }
}

function drawNodeCell(ctx, x, y, cs, color, glowColor, symbol) {
  const px = x * cs + 2;
  const py = y * cs + 2;
  const sz = cs - 4;

  // Background fill
  ctx.fillStyle = color + '22';
  ctx.fillRect(px, py, sz, sz);

  // Glow border
  ctx.shadowColor = glowColor;
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.strokeRect(px + 1, py + 1, sz - 2, sz - 2);
  ctx.shadowBlur  = 0;

  // Symbol
  const fontSize = Math.max(8, Math.floor(cs * 0.38));
  ctx.fillStyle  = color;
  ctx.font       = `bold ${fontSize}px 'Share Tech Mono', monospace`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x * cs + cs / 2, y * cs + cs / 2);
}

function drawPlayer(ctx, x, y, cs) {
  const cx = x * cs + cs / 2;
  const cy = y * cs + cs / 2;
  const r  = Math.max(4, cs * 0.28);

  // Outer glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
  grad.addColorStop(0,   'rgba(224,20,52,0.5)');
  grad.addColorStop(0.5, 'rgba(224,20,52,0.15)');
  grad.addColorStop(1,   'rgba(224,20,52,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Core diamond
  ctx.fillStyle   = NR_COLORS.player;
  ctx.shadowColor = NR_COLORS.playerGlow;
  ctx.shadowBlur  = 12;
  ctx.beginPath();
  ctx.moveTo(cx,       cy - r);
  ctx.lineTo(cx + r,   cy);
  ctx.lineTo(cx,       cy + r);
  ctx.lineTo(cx - r,   cy);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Inner dot
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, r * 0.28), 0, Math.PI * 2);
  ctx.fill();
}

/* ── PLAYER MOVEMENT ── */
function movePlayer(dir) {
  if (nrComplete || nrFailed || !nrMaze) return;

  const { x, y } = nrPlayer;
  const cell      = nrMaze[y][x];

  const moves = { up: [0,-1,0,2], right: [1,0,1,3], down: [0,1,2,0], left: [-1,0,3,1] };
  const [dx, dy, wallIdx] = moves[dir];

  if (cell.walls[wallIdx]) return; // blocked

  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= nrCols || ny >= nrRows) return;

  nrPlayer = { x: nx, y: ny };
  nrVisited[ny][nx] = true;
  nrTrail.push({ x: nx, y: ny });

  // Check win
  if (nx === nrEnd.x && ny === nrEnd.y) {
    nrComplete = true;
    clearInterval(nrTimerHandle);
    showResult(true);
    termSuccess();
  }

  drawMaze();
}

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (document.getElementById('tab-content-netrunner')?.style.display === 'none') return;
  const map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                w:'up', s:'down', a:'left', d:'right',
                W:'up', S:'down', A:'left', D:'right' };
  if (map[e.key]) { e.preventDefault(); movePlayer(map[e.key]); }
});

/* ── RESULT OVERLAY ── */
function showResult(success) {
  const overlay = document.getElementById('nr-maze-overlay');
  if (!overlay) return;
  const div = document.createElement('div');
  div.className = 'nr-result-msg ' + (success ? 'success' : 'fail');
  div.innerHTML = success
    ? '///BREACH<br>SUCCESS///'
    : '///ICE<br>DETECTED///';
  overlay.innerHTML = '';
  overlay.appendChild(div);
  drawMaze();
}

/* ── RESIZE HANDLER ── */
window.addEventListener('resize', () => {
  if (document.getElementById('tab-content-netrunner')?.style.display !== 'none') {
    resizeAndDraw();
  }
});
