(function initRemoteBreachModule() {
  const MODE_TIERS = {
    easy: [1, 3],
    medium: [4, 6],
    hard: [7, 10]
  };

  const TIER_CONFIGS = {
    1: { size: 8, extraOpenings: 10, minPath: 14, maxOpen: 48, attempts: 12 },
    2: { size: 8, extraOpenings: 8, minPath: 16, maxOpen: 46, attempts: 14 },
    3: { size: 8, extraOpenings: 6, minPath: 18, maxOpen: 44, attempts: 16 },
    4: { size: 12, extraOpenings: 10, minPath: 20, maxOpen: 92, attempts: 14 },
    5: { size: 12, extraOpenings: 8, minPath: 26, maxOpen: 86, attempts: 18 },
    6: { size: 12, extraOpenings: 6, stairPatterns: 1, minPath: 32, maxOpen: 80, attempts: 22 },
    7: { size: 16, extraOpenings: 5, stairPatterns: 2, minPath: 38, maxOpen: 132, attempts: 22 },
    8: { size: 16, extraOpenings: 4, stairPatterns: 3, minPath: 44, maxOpen: 126, attempts: 24 },
    9: { size: 16, extraOpenings: 3, stairPatterns: 4, minPath: 50, maxOpen: 120, attempts: 28 },
    10: { size: 16, extraOpenings: 2, stairPatterns: 5, minPath: 56, maxOpen: 114, attempts: 32 }
  };

  const COLORS = {
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

  const BOOT_LINES = [
    'CMD.DeckTerminal///REMOTE///>OVERRIDE',
    'CMD.Buffer///Daemon.BreachData///',
    'CMD.Buffer///Daemon.ICE.Pick///',
    'CMD.Buffer///Daemon.Mask.Shroud///',
    'CMD.Buffer::Token.Lumin::fork///',
    'CMD.Route::relay.shadow::///vault.edge;',
    'CMD.Buffer::download::///import.jailbreaker///',
    'priM.stack::ztech::///tool.mz;',
    'content.file::edge1.2.6///decrypt',
    'CMD.Breach::handshake::ICE///'
  ];

  const DAEMONS = ['Daemon.BreachData', 'Daemon.ICE.Pick', 'Daemon.Mask.Shroud', 'Daemon.Vault.Relay', 'Daemon.Spoof.Signal', 'Daemon.NullIndex'];
  const ACTIONS = ['bash', 'fork', 'splice', 'crack', 'patch', 'echo', 'inject'];
  const TRACES = ['Token.Lumin', 'stack.ztech', 'auth.delta', 'cache.ghost', 'ghost.rail', 'vhost.zero'];
  const TARGETS = ['directory.main', 'relay.shadow', 'vault.edge', 'node.blackwall', 'trace.backdoor', 'auth.archive'];
  const FILES = ['edge1.2.6', 'mask4.7.0', 'ghost2.4.9', 'vault9.1.3', 'prism0.8.2', 'shunt3.6.1'];
  const SUFFIXES = ['download', 'mirror', 'override', 'extract', 'verify', 'decrypt'];
  const STACKS = ['ztech', 'mox', 'orbital', 'voodoo', 'sovoil', 'biotechnica'];
  const TOOLS = ['tool.mz', 'latch.exe', 'fork.bin', 'ghost.sh', 'delta.cmd', 'mask.pkg'];
  const NODES = ['A-01', 'B-13', 'D-77', 'H-02', 'X-09', 'Q-44'];
  const DESTINATIONS = ['uplink.alpha', 'uplink.gamma', 'grid.lock', 'grid.fuse', 'vault.loop', 'core.black'];
  const BUFFERS = ['heap.zero', 'cipher.lace', 'signal.knot', 'delta.ice', 'relay.crown', 'mirror.heap'];
  const ALERTS = ['quiet', 'trace', 'lockout', 'countermeasure', 'jammed', 'masked'];
  const SUCCESS_LINE = 'CMD.DeckTerminal///BREACH///>SUCCESS';
  const FAIL_LINE = 'CMD.DeckTerminal///BREACH///>FAIL';
  const OUTRO_TIME = 10.15;

  const state = {
    sessionId: '',
    roomId: '',
    clientId: '',
    difficulty: 'easy',
    tier: 1,
    grid: [],
    size: 0,
    player: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    visited: [],
    trail: [],
    reactionMs: 3000,
    timeLimit: 10,
    startAt: 0,
    reactionEndsAt: 0,
    deadlineAt: 0,
    timerHandle: null,
    terminalHandle: null,
    active: false,
    ended: false,
    outcome: ''
  };

  let breachAudio = null;
  let moveAudio = null;

  function el(id) {
    return document.getElementById(id);
  }

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

  function coordKey(x, y) {
    return `${x},${y}`;
  }

  function buildRandomTerminalLine() {
    return pick([
      () => `CMD.Buffer///${pick(DAEMONS)}///${pick(ACTIONS)}///`,
      () => `CMD.Trace::${pick(TRACES)}::///${pick(TARGETS)};`,
      () => `content.file::${pick(FILES)}///${pick(SUFFIXES)}`,
      () => `priM.stack::${pick(STACKS)}::///${pick(TOOLS)};`,
      () => `CMD.Route::${pick(NODES)}::///${pick(DESTINATIONS)};`,
      () => `CMD.Buffer::${pick(BUFFERS)}::${pick(ACTIONS)}///`,
      () => `ICE.scan::${pick(TRACES)}::///${pick(ALERTS)};`,
      () => `SYS.exec::${pick(TOOLS)}::///${pick(TARGETS)};`
    ])();
  }

  function appendTerminalLine(text, extraClass = '') {
    const terminal = el('remote-nr-terminal');
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

  function clearTimers() {
    clearInterval(state.timerHandle);
    clearInterval(state.terminalHandle);
    state.timerHandle = null;
    state.terminalHandle = null;
  }

  function closeModal() {
    clearTimers();
    state.active = false;
    state.sessionId = '';
    state.roomId = '';
    state.clientId = '';
    state.grid = [];
    state.visited = [];
    state.trail = [];
    state.ended = false;
    state.outcome = '';
    el('remote-breach-modal')?.classList.remove('show');
  }

  function openModal() {
    el('remote-breach-modal')?.classList.add('show');
  }

  function setChip(status) {
    const chip = el('remote-breach-chip');
    if (!chip) return;
    chip.textContent = String(status || 'PENDING').toUpperCase();
    chip.className = 'remote-breach-chip';
    if (status === 'running') chip.classList.add('live');
    if (['fail', 'cancelled'].includes(status)) chip.classList.add('fail');
    if (status === 'success') chip.classList.add('live');
  }

  function updateTimerDisplay() {
    const node = el('remote-nr-timer');
    if (!node) return;
    const remainingMs = Math.max(0, state.deadlineAt - Date.now());
    const safeTime = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(safeTime / 60);
    const seconds = safeTime % 60;
    node.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    node.classList.remove('running', 'expired');
    if (remainingMs <= 10000) node.classList.add('expired');
    else node.classList.add('running');
  }

  function renderOverlay(html, className = 'idle') {
    const overlay = el('remote-nr-maze-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    const message = document.createElement('div');
    message.className = `nr-result-msg ${className}`;
    message.innerHTML = html;
    overlay.appendChild(message);
  }

  function clearOverlay() {
    const overlay = el('remote-nr-maze-overlay');
    if (overlay) overlay.innerHTML = '';
  }

  function startMusic() {
    if (!breachAudio) {
      breachAudio = new Audio('audio/neonBreach.mp3');
      breachAudio.loop = false;
      breachAudio.preload = 'auto';
      breachAudio.volume = 0.6;
    }
    try {
      breachAudio.currentTime = 0;
    } catch (_err) {}
    breachAudio.play().catch(() => {});
  }

  function playOutro() {
    if (!breachAudio) return;
    try {
      breachAudio.currentTime = OUTRO_TIME;
    } catch (_err) {}
    breachAudio.play().catch(() => {});
  }

  function playMoveBeep() {
    if (!moveAudio) {
      moveAudio = new Audio('audio/beep.mp3');
      moveAudio.preload = 'auto';
      moveAudio.volume = 0.55;
    }
    try {
      moveAudio.currentTime = 0;
    } catch (_err) {}
    moveAudio.play().catch(() => {});
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

  function drawGrid() {
    const canvas = el('remote-nr-maze-canvas');
    if (!canvas || !state.grid.length) return;
    const wrap = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const available = Math.min((wrap?.clientWidth || 420) - 24, (wrap?.clientHeight || 420) - 24, 520);
    const cell = Math.max(18, Math.floor(available / state.size));
    const width = cell * state.size;
    const height = cell * state.size;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < state.size; y += 1) {
      for (let x = 0; x < state.size; x += 1) {
        const px = x * cell;
        const py = y * cell;
        const isBlocked = state.grid[y][x] === 1;
        const isGoal = state.goal.x === x && state.goal.y === y;
        const isPlayer = state.player.x === x && state.player.y === y;
        ctx.fillStyle = isBlocked ? COLORS.blocked : COLORS.open;
        ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        if (state.visited[y][x] && !isBlocked && !isGoal && !isPlayer) {
          ctx.fillStyle = COLORS.visited;
          ctx.fillRect(px + 5, py + 5, cell - 10, cell - 10);
        }
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
        if (isBlocked) {
          ctx.shadowColor = COLORS.blockedGlow;
          ctx.shadowBlur = 8;
          ctx.strokeStyle = '#171717';
          ctx.strokeRect(px + 4, py + 4, cell - 8, cell - 8);
          ctx.shadowBlur = 0;
        }
      }
    }

    if (state.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = COLORS.visitedLine;
      ctx.lineWidth = Math.max(3, cell * 0.14);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(state.trail[0].x * cell + cell / 2, state.trail[0].y * cell + cell / 2);
      for (let i = 1; i < state.trail.length; i += 1) {
        ctx.lineTo(state.trail[i].x * cell + cell / 2, state.trail[i].y * cell + cell / 2);
      }
      ctx.stroke();
    }

    drawNode(ctx, state.goal.x, state.goal.y, cell, COLORS.goal, COLORS.goalGlow);
    drawNode(ctx, state.player.x, state.player.y, cell, COLORS.player, COLORS.playerGlow);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
  }

  function buildPlayableGrid(size, extraOpenings) {
    const grid = Array.from({ length: size }, () => Array(size).fill(1));
    const stack = [{ x: 0, y: 0 }];
    const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
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
      const openNeighbors = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size && grid[ny][nx] === 0).length;
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
    const moves = [[0, -1], [1, 0], [0, 1], [-1, 0]];
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
    const stepRuns = [{ dx: 1, dy: 1 }, { dx: -1, dy: 1 }];
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
      if (config.stairPatterns) grid = applyStairPatterns(grid, config.stairPatterns);
      const path = findPath(grid);
      if (!path.length) continue;
      const openCells = countOpenCells(grid);
      const targetPath = config.minPath || 0;
      const targetOpen = config.maxOpen ?? Number.POSITIVE_INFINITY;
      const pathDelta = Math.abs(path.length - targetPath);
      const openDelta = Math.abs(openCells - targetOpen);
      const score = (path.length >= targetPath ? 60 : 0) + (openCells <= targetOpen ? 24 : 0) - pathDelta - (openDelta * 0.6);
      if (path.length >= targetPath && openCells <= targetOpen) return grid;
      if (score > bestScore) {
        bestScore = score;
        bestGrid = grid;
      }
    }
    return bestGrid || buildPlayableGrid(config.size, config.extraOpenings);
  }

  function buildGridForDifficulty(difficulty) {
    state.tier = randomInt(...(MODE_TIERS[difficulty] || MODE_TIERS.easy));
    const config = { ...(TIER_CONFIGS[state.tier] || TIER_CONFIGS[1]) };
    state.size = config.size;
    state.player = { x: 0, y: 0 };
    state.goal = { x: state.size - 1, y: state.size - 1 };
    state.visited = Array.from({ length: state.size }, () => Array(state.size).fill(false));
    state.visited[0][0] = true;
    state.trail = [{ x: 0, y: 0 }];
    state.grid = (config.minPath || config.maxOpen || config.stairPatterns)
      ? buildRankedGrid(config)
      : buildPlayableGrid(config.size, config.extraOpenings);
  }

  async function pushSessionPatch(patch) {
    if (!state.roomId || !state.clientId || typeof updateRemoteBreachSession !== 'function') return;
    try {
      await updateRemoteBreachSession(state.roomId, state.clientId, patch);
    } catch (error) {
      console.warn('Failed to update remote breach session.', error);
    }
  }

  async function finishRun(status, reasonLine = '') {
    if (!state.active || state.ended) return;
    state.ended = true;
    state.outcome = status;
    clearTimers();
    if (reasonLine) appendTerminalLine(reasonLine, status === 'success' ? 'success' : 'fail');
    appendTerminalLine(status === 'success' ? SUCCESS_LINE : FAIL_LINE, status === 'success' ? 'success' : 'fail');
    renderOverlay(status === 'success' ? '///BREACH<br>SUCCESS///' : '///ICE<br>DETECTED///', status === 'success' ? 'success' : 'fail');
    setChip(status);
    playOutro();
    await pushSessionPatch({
      status,
      endedAt: Date.now(),
      result: status,
      tier: state.tier
    });
    setTimeout(() => closeModal(), 1500);
  }

  async function cancelRunFromGM() {
    if (!state.active) {
      closeModal();
      return;
    }
    state.ended = true;
    clearTimers();
    appendTerminalLine('CMD.DeckTerminal///BREACH///>CANCELLED', 'fail');
    renderOverlay('///BREACH<br>ABORTED///', 'fail');
    setChip('cancelled');
    playOutro();
    setTimeout(() => closeModal(), 1200);
  }

  function movePlayer(direction) {
    if (!state.active || state.ended || Date.now() < state.reactionEndsAt) return;
    const moves = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const move = moves[direction];
    if (!move) return;
    const nextX = state.player.x + move[0];
    const nextY = state.player.y + move[1];
    if (nextX < 0 || nextY < 0 || nextX >= state.size || nextY >= state.size) {
      finishRun('fail', 'ICE.wall///>COLLISION');
      return;
    }
    if (state.grid[nextY][nextX] === 1) {
      finishRun('fail', 'ICE.wall///>COLLISION');
      return;
    }
    if (state.visited[nextY][nextX]) {
      finishRun('fail', 'TRACE.loop///>SELF-DETECTED');
      return;
    }
    state.player = { x: nextX, y: nextY };
    state.visited[nextY][nextX] = true;
    state.trail.push({ x: nextX, y: nextY });
    playMoveBeep();
    drawGrid();
    if (nextX === state.goal.x && nextY === state.goal.y) {
      finishRun('success');
    }
  }

  function startTerminalLoop() {
    clearInterval(state.terminalHandle);
    const terminal = el('remote-nr-terminal');
    if (!terminal) return;
    terminal.innerHTML = '<span class="nr-term-cursor"></span>';
    BOOT_LINES.forEach((line) => appendTerminalLine(line, line.startsWith('CMD.Buffer') ? 'dim' : ''));
    state.terminalHandle = setInterval(() => {
      if (!state.active || state.ended) return;
      appendTerminalLine(buildRandomTerminalLine(), Math.random() > 0.55 ? 'dim' : '');
    }, 260);
  }

  function tickTimer() {
    updateTimerDisplay();
    const now = Date.now();
    if (now < state.reactionEndsAt) {
      setChip('pending');
      const secs = Math.max(1, Math.ceil((state.reactionEndsAt - now) / 1000));
      renderOverlay(`///SYNC<br>${secs}///`, 'idle');
      return;
    }
    setChip('running');
    clearOverlay();
    if (now >= state.deadlineAt) {
      finishRun('fail', 'TRACE.timeout///>LOCKOUT');
    }
  }

  async function startRun(session, context = {}) {
    clearTimers();
    state.sessionId = String(session?.sessionId || '').trim();
    state.roomId = String(context?.roomId || '').trim();
    state.clientId = String(context?.clientId || '').trim();
    state.difficulty = String(session?.difficulty || 'easy').trim().toLowerCase();
    state.reactionMs = Math.max(0, Number(session?.reactionMs || 3000));
    state.timeLimit = Math.max(1, Number(session?.timeLimit || 10));
    state.startAt = Date.now();
    state.reactionEndsAt = state.startAt + state.reactionMs;
    state.deadlineAt = state.reactionEndsAt + (state.timeLimit * 1000);
    state.active = true;
    state.ended = false;
    state.outcome = '';

    buildGridForDifficulty(state.difficulty);
    openModal();
    el('remote-breach-sub').textContent = 'REFEREE INITIATED NETRUNNING OVERRIDE';
    el('remote-nr-mode').textContent = `REMOTE // ${state.difficulty.toUpperCase()}`;
    setChip('pending');
    drawGrid();
    renderOverlay(`///SYNC<br>${Math.max(1, Math.ceil(state.reactionMs / 1000))}///`, 'idle');
    startTerminalLoop();
    updateTimerDisplay();
    startMusic();

    await pushSessionPatch({
      sessionId: state.sessionId,
      difficulty: state.difficulty,
      status: 'running',
      startedAt: state.startAt,
      reactionEndsAt: state.reactionEndsAt,
      deadlineAt: state.deadlineAt,
      reactionMs: state.reactionMs,
      timeLimit: state.timeLimit,
      tier: state.tier
    });

    state.timerHandle = setInterval(tickTimer, 100);
  }

  function handleIncomingSession(session, context = {}) {
    if (!session || !session.sessionId) {
      closeModal();
      return;
    }
    const sessionId = String(session.sessionId || '').trim();
    const status = String(session.status || 'pending').trim().toLowerCase();

    if (sessionId !== state.sessionId && ['pending', 'running'].includes(status)) {
      startRun(session, context);
      return;
    }

    if (sessionId !== state.sessionId) return;
    if (status === 'cancelled') {
      cancelRunFromGM();
      return;
    }
    if (status === 'success' && !state.ended) {
      finishRun('success');
      return;
    }
    if (status === 'fail' && !state.ended) {
      finishRun('fail');
      return;
    }
    if (status === 'running') {
      setChip(Date.now() < state.reactionEndsAt ? 'pending' : 'running');
    }
  }

  window.handleIncomingRemoteBreachSession = handleIncomingSession;

  window.addEventListener('keydown', (event) => {
    if (!el('remote-breach-modal')?.classList.contains('show')) return;
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
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
    if (state.active && state.grid.length) drawGrid();
  });
})();
