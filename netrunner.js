/* NETRUNNER DECK // GRID BREACH */

const NR_MODE_TIERS = {
  easy: [1, 3],
  medium: [4, 6],
  hard: [7, 10]
};

const NR_TIER_CONFIGS = {
  1: { size: 8, extraOpenings: 10, timeLimit: 10, attempts: 8 },
  2: { size: 8, extraOpenings: 8, timeLimit: 10, minPath: 14, maxOpen: 48, attempts: 12 },
  3: { size: 8, extraOpenings: 6, timeLimit: 10, minPath: 18, maxOpen: 44, attempts: 14 },
  4: { size: 12, extraOpenings: 10, timeLimit: 10, minPath: 20, maxOpen: 92, attempts: 14 },
  5: { size: 12, extraOpenings: 8, timeLimit: 10, minPath: 26, maxOpen: 86, attempts: 18 },
  6: { size: 12, extraOpenings: 6, timeLimit: 10, stairPatterns: 1, minPath: 32, maxOpen: 80, attempts: 22 },
  7: { size: 16, extraOpenings: 6, timeLimit: 10, stairPatterns: 1, minPath: 36, maxOpen: 136, attempts: 24 },
  8: { size: 16, extraOpenings: 5, timeLimit: 10, stairPatterns: 2, minPath: 40, maxOpen: 130, attempts: 28 },
  9: { size: 16, extraOpenings: 4, timeLimit: 10, stairPatterns: 3, minPath: 46, maxOpen: 124, attempts: 32 },
  10: { size: 16, extraOpenings: 3, timeLimit: 10, stairPatterns: 4, minPath: 52, maxOpen: 118, attempts: 36 }
};

const NR_COLORS = {
  bg: '#090103',
  grid: '#2a0a0f',
  open: '#15070a',
  blocked: '#050505',
  blockedGlow: 'rgba(255,255,255,0.08)',
  visited: 'rgba(224,20,52,0.12)',
  visitedLine: 'rgba(224,20,52,0.28)',
  player: '#00d98b',
  playerGlow: 'rgba(0,217,139,0.65)',
  goal: '#ff4d6d',
  goalGlow: 'rgba(255,77,109,0.65)',
  border: '#6b111d'
};

const NR_BOOT_LINES = [
  'CMD.DeckTerminal///CONNECT///>START',
  'CMD.Buffer///Daemon.BreachData///',
  'CMD.Buffer///Daemon.ICE.Pick///',
  'CMD.Buffer///Daemon.bash.Vostok///',
  'CMD.Buffer::Token.Lumin::bash///',
  'CMD.Buffer::IP::///directory.main;',
  'CMD.Buffer::download::///import.jailbreaker///',
  'priM.stack::ztech::///tool.mz;',
  'content.file::edge1.2.6///',
  'CMD.Breach::terminate::ICE///'
];

const NR_TERM_PATTERNS = [
  () => `CMD.Buffer///${pick(NR_DAEMONS)}///${pick(NR_ACTIONS)}///`,
  () => `CMD.Trace::${pick(NR_TRACES)}::///${pick(NR_TARGETS)};`,
  () => `content.file::${pick(NR_FILES)}///${pick(NR_SUFFIXES)}`,
  () => `priM.stack::${pick(NR_STACKS)}::///${pick(NR_TOOLS)};`,
  () => `CMD.Route::${pick(NR_NODES)}::///${pick(NR_DESTINATIONS)};`,
  () => `CMD.Buffer::${pick(NR_BUFFERS)}::${pick(NR_ACTIONS)}///`,
  () => `ICE.scan::${pick(NR_TRACES)}::///${pick(NR_ALERTS)};`,
  () => `SYS.exec::${pick(NR_TOOLS)}::///${pick(NR_TARGETS)};`
];

const NR_DAEMONS = ['Daemon.BreachData', 'Daemon.ICE.Pick', 'Daemon.Mask.Shroud', 'Daemon.Vault.Relay', 'Daemon.Spoof.Signal', 'Daemon.NullIndex'];
const NR_ACTIONS = ['bash', 'fork', 'splice', 'crack', 'patch', 'echo', 'inject'];
const NR_TRACES = ['Token.Lumin', 'stack.ztech', 'auth.delta', 'cache.ghost', 'ghost.rail', 'vhost.zero'];
const NR_TARGETS = ['directory.main', 'relay.shadow', 'vault.edge', 'node.blackwall', 'trace.backdoor', 'auth.archive'];
const NR_FILES = ['edge1.2.6', 'mask4.7.0', 'ghost2.4.9', 'vault9.1.3', 'prism0.8.2', 'shunt3.6.1'];
const NR_SUFFIXES = ['download', 'mirror', 'override', 'extract', 'verify', 'decrypt'];
const NR_STACKS = ['ztech', 'mox', 'orbital', 'voodoo', 'sovoil', 'biotechnica'];
const NR_TOOLS = ['tool.mz', 'latch.exe', 'fork.bin', 'ghost.sh', 'delta.cmd', 'mask.pkg'];
const NR_NODES = ['A-01', 'B-13', 'D-77', 'H-02', 'X-09', 'Q-44'];
const NR_DESTINATIONS = ['uplink.alpha', 'uplink.gamma', 'grid.lock', 'grid.fuse', 'vault.loop', 'core.black'];
const NR_BUFFERS = ['heap.zero', 'cipher.lace', 'signal.knot', 'delta.ice', 'relay.crown', 'mirror.heap'];
const NR_ALERTS = ['quiet', 'trace', 'lockout', 'countermeasure', 'jammed', 'masked'];

const NR_SUCCESS_LINE = 'CMD.DeckTerminal///BREACH///>SUCCESS';
const NR_FAIL_LINE = 'CMD.DeckTerminal///BREACH///>FAIL';

let nrDifficulty = 'easy';
let nrGrid = [];
let nrSize = 5;
let nrPlayer = { x: 0, y: 0 };
let nrGoal = { x: 4, y: 4 };
let nrVisited = [];
let nrTrail = [];
let nrComplete = false;
let nrFailed = false;
let nrCountdown = 60;
let nrTimerHandle = null;
let nrTerminalHandle = null;
let nrStarted = false;
let nrBreachAudio = null;
let nrMoveAudio = null;
let nrTier = 1;
const NR_AUDIO_OUTRO_TIME = 10.15;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * ((max - min) + 1)) + min;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getEl(id) {
  return document.getElementById(id);
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function setDifficulty(level) {
  if (!NR_MODE_TIERS[level]) return;
  nrStarted = true;
  nrDifficulty = level;
  ['easy', 'medium', 'hard'].forEach((key) => {
    const button = getEl(`nr-diff-${key}`);
    if (button) button.classList.toggle('active', key === level);
  });
  startBreachMusic();
  generateMaze();
}

function rollTierForMode(mode) {
  const range = NR_MODE_TIERS[mode] || NR_MODE_TIERS.easy;
  return randomInt(range[0], range[1]);
}

function getTierConfig(tier) {
  return { ...NR_TIER_CONFIGS[tier] };
}

function buildPlayableGrid(size, extraOpenings) {
  const grid = Array.from({ length: size }, () => Array(size).fill(1));
  const stack = [{ x: 0, y: 0 }];
  const dirs = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0]
  ];

  grid[0][0] = 0;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const nextChoices = shuffle(dirs).filter(([dx, dy]) => {
      const nx = current.x + dx;
      const ny = current.y + dy;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && grid[ny][nx] === 1;
    });

    if (!nextChoices.length) {
      stack.pop();
      continue;
    }

    const [dx, dy] = nextChoices[0];
    const nx = current.x + dx;
    const ny = current.y + dy;
    const mx = current.x + dx / 2;
    const my = current.y + dy / 2;

    grid[my][mx] = 0;
    grid[ny][nx] = 0;
    stack.push({ x: nx, y: ny });
  }

  grid[size - 1][size - 1] = 0;
  if (size % 2 === 0) {
    grid[size - 1][size - 2] = 0;
    grid[size - 2][size - 1] = 0;
  }

  let opened = 0;
  let attempts = 0;
  while (opened < extraOpenings && attempts < 120) {
    attempts += 1;
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    if ((x === 0 && y === 0) || (x === size - 1 && y === size - 1) || grid[y][x] === 0) continue;

    const openNeighbors = [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y]
    ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size && grid[ny][nx] === 0).length;

    if (openNeighbors >= 1) {
      grid[y][x] = 0;
      opened += 1;
    }
  }

  return grid;
}

function findPath(grid) {
  const size = grid.length;
  const queue = [{ x: 0, y: 0 }];
  const visited = new Set([coordKey(0, 0)]);
  const parents = new Map();
  const moves = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ];

  while (queue.length) {
    const current = queue.shift();
    if (current.x === size - 1 && current.y === size - 1) {
      const path = [];
      let key = coordKey(current.x, current.y);
      while (key) {
        const [x, y] = key.split(',').map(Number);
        path.push({ x, y });
        key = parents.get(key);
      }
      return path.reverse();
    }

    moves.forEach(([dx, dy]) => {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nextKey = coordKey(nx, ny);
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
      if (grid[ny][nx] === 1 || visited.has(nextKey)) return;
      visited.add(nextKey);
      parents.set(nextKey, coordKey(current.x, current.y));
      queue.push({ x: nx, y: ny });
    });
  }

  return [];
}

function buildStairCandidates(size) {
  const candidates = [];
  const stepRuns = [
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 }
  ];

  for (let y = 1; y < size - 3; y += 2) {
    for (let x = 1; x < size - 3; x += 2) {
      stepRuns.forEach(({ dx, dy }) => {
        const cells = [];
        let cx = x;
        let cy = y;
        for (let step = 0; step < 3; step += 1) {
          const nextX = cx + dx;
          const nextY = cy + dy;
          cells.push({ x: cx, y: cy });
          cells.push({ x: nextX, y: cy });
          cx = nextX;
          cy = nextY;
        }
        if (cells.every((cell) => cell.x > 0 && cell.y > 0 && cell.x < size - 1 && cell.y < size - 1)) {
          candidates.push(cells);
        }
      });
    }
  }

  return shuffle(candidates);
}

function applyStairPatterns(grid, patternCount) {
  let protectedPath = findPath(grid);
  if (!protectedPath.length) return grid;
  const protectedSet = new Set(protectedPath.map((node) => coordKey(node.x, node.y)));
  const candidates = buildStairCandidates(grid.length);
  let placed = 0;

  for (const cells of candidates) {
    if (placed >= patternCount) break;
    const changed = [];

    for (const cell of cells) {
      const key = coordKey(cell.x, cell.y);
      if (protectedSet.has(key) || grid[cell.y][cell.x] === 1) continue;
      changed.push(cell);
      grid[cell.y][cell.x] = 1;
    }

    if (!changed.length) continue;

    const nextPath = findPath(grid);
    if (!nextPath.length) {
      changed.forEach((cell) => {
        grid[cell.y][cell.x] = 0;
      });
      continue;
    }

    protectedPath = nextPath;
    protectedSet.clear();
    protectedPath.forEach((node) => protectedSet.add(coordKey(node.x, node.y)));
    placed += 1;
  }

  return grid;
}

function countOpenCells(grid) {
  return grid.reduce((total, row) => total + row.filter((cell) => cell === 0).length, 0);
}

function buildRankedGrid(config) {
  let bestGrid = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < (config.attempts || 20); attempt += 1) {
    let grid = buildPlayableGrid(config.size, config.extraOpenings);
    if (config.stairPatterns) {
      grid = applyStairPatterns(grid, config.stairPatterns);
    }

    const path = findPath(grid);
    if (!path.length) continue;

    const openCells = countOpenCells(grid);
    const targetPath = config.minPath || 0;
    const targetOpen = config.maxOpen ?? Number.POSITIVE_INFINITY;
    const pathDelta = Math.abs(path.length - targetPath);
    const openDelta = Math.abs(openCells - targetOpen);
    const score = (path.length >= targetPath ? 60 : 0) + (openCells <= targetOpen ? 24 : 0) - pathDelta - (openDelta * 0.6);

    if (path.length >= targetPath && openCells <= targetOpen) {
      return grid;
    }

    if (score > bestScore) {
      bestScore = score;
      bestGrid = grid;
    }
  }

  return bestGrid || buildPlayableGrid(config.size, config.extraOpenings);
}

function generateMaze() {
  nrTier = rollTierForMode(nrDifficulty);
  const config = getTierConfig(nrTier);
  nrSize = config.size;
  nrPlayer = { x: 0, y: 0 };
  nrGoal = { x: nrSize - 1, y: nrSize - 1 };
  nrVisited = Array.from({ length: nrSize }, () => Array(nrSize).fill(false));
  nrVisited[0][0] = true;
  nrTrail = [{ x: 0, y: 0 }];
  nrComplete = false;
  nrFailed = false;
  nrCountdown = config.timeLimit;
  nrGrid = (config.minPath || config.maxOpen || config.stairPatterns)
    ? buildRankedGrid(config)
    : buildPlayableGrid(nrSize, config.extraOpenings);

  clearResultOverlay();
  restartTimer();
  restartTerminalLoop();
  drawGrid();
}

function restartTimer() {
  clearInterval(nrTimerHandle);
  updateTimerDisplay();
  nrTimerHandle = setInterval(() => {
    nrCountdown -= 1;
    updateTimerDisplay();
    if (nrCountdown <= 0) {
      clearInterval(nrTimerHandle);
      clearInterval(nrTerminalHandle);
      nrFailed = true;
      appendTerminalLine(NR_FAIL_LINE, 'fail');
      showResult(false);
      jumpToBreachOutro();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timer = getEl('nr-timer');
  if (!timer) return;
  const safeTime = Math.max(0, nrCountdown);
  const minutes = Math.floor(safeTime / 60);
  const seconds = safeTime % 60;
  timer.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
  timer.classList.remove('running', 'expired');
  if (!nrStarted) return;
  if (nrFailed || safeTime <= 10) timer.classList.add('expired');
  else timer.classList.add('running');
}

function startBreachMusic() {
  if (!nrBreachAudio) {
    nrBreachAudio = new Audio('audio/neonBreach.mp3');
    nrBreachAudio.loop = false;
    nrBreachAudio.preload = 'auto';
    nrBreachAudio.volume = 0.6;
  }
  try {
    nrBreachAudio.currentTime = 0;
  } catch (_err) {}
  const playPromise = nrBreachAudio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function jumpToBreachOutro() {
  if (!nrBreachAudio) return;
  try {
    nrBreachAudio.currentTime = NR_AUDIO_OUTRO_TIME;
  } catch (_err) {}
  const playPromise = nrBreachAudio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function playMoveBeep() {
  if (!nrMoveAudio) {
    nrMoveAudio = new Audio('audio/beep.mp3');
    nrMoveAudio.preload = 'auto';
    nrMoveAudio.volume = 0.55;
  }
  try {
    nrMoveAudio.currentTime = 0;
  } catch (_err) {}
  const playPromise = nrMoveAudio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function showIdleOverlay() {
  const overlay = getEl('nr-maze-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';
  const message = document.createElement('div');
  message.className = 'nr-result-msg idle';
  message.innerHTML = '///SELECT<br>MODE///';
  overlay.appendChild(message);
}

function drawIdleCanvas() {
  const canvas = getEl('nr-maze-canvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const size = Math.max(260, Math.min((wrap?.clientWidth || 420) - 24, (wrap?.clientHeight || 420) - 24, 420));
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = NR_COLORS.bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = NR_COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

function renderIdleTerminal() {
  const terminal = getEl('nr-terminal');
  if (!terminal) return;
  terminal.innerHTML = '';
  [
    'CMD.DeckTerminal///IDLE///>AWAIT',
    'CMD.Breach///SELECT///>DIFFICULTY',
    'AUDIO.Buffer///neonBreach.mp3///>STANDBY'
  ].forEach((lineText, index) => {
    const line = document.createElement('span');
    line.className = `nr-term-line${index === 0 ? '' : ' dim'}`;
    line.textContent = lineText;
    terminal.appendChild(line);
  });
  const cursor = document.createElement('span');
  cursor.className = 'nr-term-cursor';
  terminal.appendChild(cursor);
}

function renderIdleState() {
  clearInterval(nrTimerHandle);
  clearInterval(nrTerminalHandle);
  nrGrid = [];
  nrTrail = [];
  nrVisited = [];
  nrComplete = false;
  nrFailed = false;
  nrCountdown = 0;
  updateTimerDisplay();
  drawIdleCanvas();
  showIdleOverlay();
  renderIdleTerminal();
}

function restartTerminalLoop() {
  clearInterval(nrTerminalHandle);
  const terminal = getEl('nr-terminal');
  if (!terminal) return;
  terminal.innerHTML = '<span class="nr-term-cursor"></span>';
  NR_BOOT_LINES.forEach((line) => appendTerminalLine(line, line.startsWith('CMD.Buffer') ? 'dim' : ''));
  nrTerminalHandle = setInterval(() => {
    if (nrComplete || nrFailed) return;
    appendTerminalLine(buildRandomTerminalLine(), Math.random() > 0.55 ? 'dim' : '');
  }, 260);
}

function buildRandomTerminalLine() {
  return pick(NR_TERM_PATTERNS)();
}

function appendTerminalLine(text, extraClass = '') {
  const terminal = getEl('nr-terminal');
  if (!terminal) return;
  const cursor = terminal.querySelector('.nr-term-cursor');
  const line = document.createElement('span');
  line.className = `nr-term-line${extraClass ? ` ${extraClass}` : ''}`;
  line.textContent = text;
  terminal.insertBefore(line, cursor);
  const lines = terminal.querySelectorAll('.nr-term-line');
  if (lines.length > 28) lines[0].remove();
  terminal.scrollTop = terminal.scrollHeight;
}

function clearResultOverlay() {
  const overlay = getEl('nr-maze-overlay');
  if (overlay) overlay.innerHTML = '';
}

function failRun(reasonLine) {
  if (nrComplete || nrFailed) return;
  nrFailed = true;
  clearInterval(nrTimerHandle);
  clearInterval(nrTerminalHandle);
  appendTerminalLine(reasonLine, 'fail');
  appendTerminalLine(NR_FAIL_LINE, 'fail');
  showResult(false);
  jumpToBreachOutro();
}

function showResult(success) {
  const overlay = getEl('nr-maze-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';
  const message = document.createElement('div');
  message.className = `nr-result-msg ${success ? 'success' : 'fail'}`;
  message.innerHTML = success ? '///BREACH<br>SUCCESS///' : '///ICE<br>DETECTED///';
  overlay.appendChild(message);
  if (success) appendTerminalLine(NR_SUCCESS_LINE, 'success');
}

function drawGrid() {
  const canvas = getEl('nr-maze-canvas');
  if (!canvas || !nrGrid.length) return;

  const wrap = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const available = Math.min((wrap?.clientWidth || 420) - 24, (wrap?.clientHeight || 420) - 24, 520);
  const cell = Math.max(18, Math.floor(available / nrSize));
  const width = cell * nrSize;
  const height = cell * nrSize;

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = NR_COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < nrSize; y += 1) {
    for (let x = 0; x < nrSize; x += 1) {
      const px = x * cell;
      const py = y * cell;
      const isBlocked = nrGrid[y][x] === 1;
      const isGoal = nrGoal.x === x && nrGoal.y === y;
      const isPlayer = nrPlayer.x === x && nrPlayer.y === y;

      ctx.fillStyle = isBlocked ? NR_COLORS.blocked : NR_COLORS.open;
      ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);

      if (nrVisited[y][x] && !isBlocked && !isGoal && !isPlayer) {
        ctx.fillStyle = NR_COLORS.visited;
        ctx.fillRect(px + 5, py + 5, cell - 10, cell - 10);
      }

      ctx.strokeStyle = NR_COLORS.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);

      if (isBlocked) {
        ctx.shadowColor = NR_COLORS.blockedGlow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#171717';
        ctx.strokeRect(px + 4, py + 4, cell - 8, cell - 8);
        ctx.shadowBlur = 0;
      }
    }
  }

  if (nrTrail.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = NR_COLORS.visitedLine;
    ctx.lineWidth = Math.max(3, cell * 0.14);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(nrTrail[0].x * cell + cell / 2, nrTrail[0].y * cell + cell / 2);
    for (let i = 1; i < nrTrail.length; i += 1) {
      ctx.lineTo(nrTrail[i].x * cell + cell / 2, nrTrail[i].y * cell + cell / 2);
    }
    ctx.stroke();
  }

  drawNode(ctx, nrGoal.x, nrGoal.y, cell, NR_COLORS.goal, NR_COLORS.goalGlow);
  drawNode(ctx, nrPlayer.x, nrPlayer.y, cell, NR_COLORS.player, NR_COLORS.playerGlow);

  ctx.strokeStyle = NR_COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
}

function drawNode(ctx, x, y, cell, color, glow) {
  const cx = x * cell + cell / 2;
  const cy = y * cell + cell / 2;
  const radius = Math.max(8, cell * 0.22);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.6);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, radius * 0.28), 0, Math.PI * 2);
  ctx.fill();
}

function movePlayer(direction) {
  if (nrComplete || nrFailed || !nrGrid.length) return;

  const moves = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };
  const move = moves[direction];
  if (!move) return;

  const nextX = nrPlayer.x + move[0];
  const nextY = nrPlayer.y + move[1];
  if (nextX < 0 || nextY < 0 || nextX >= nrSize || nextY >= nrSize) {
    failRun('ICE.wall///>COLLISION');
    return;
  }
  if (nrGrid[nextY][nextX] === 1) {
    failRun('ICE.wall///>COLLISION');
    return;
  }
  if (nrVisited[nextY][nextX]) {
    failRun('TRACE.loop///>SELF-DETECTED');
    return;
  }

  nrPlayer = { x: nextX, y: nextY };
  nrVisited[nextY][nextX] = true;
  nrTrail.push({ x: nextX, y: nextY });
  playMoveBeep();

  if (nextX === nrGoal.x && nextY === nrGoal.y) {
    nrComplete = true;
    clearInterval(nrTimerHandle);
    clearInterval(nrTerminalHandle);
    showResult(true);
    jumpToBreachOutro();
  }

  drawGrid();
}

function initNetrunner() {
  window.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
    if (event.key === 'r' || event.key === 'R') {
      if (!nrStarted) return;
      event.preventDefault();
      generateMaze();
      return;
    }
    const map = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right'
    };
    if (map[event.key]) {
      event.preventDefault();
      movePlayer(map[event.key]);
    }
  });

  window.addEventListener('resize', () => {
    if (nrGrid.length) drawGrid();
    else renderIdleState();
  });

  updateTimerDisplay();
  renderIdleState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNetrunner, { once: true });
} else {
  initNetrunner();
}
