(function initGMBreachModule() {
  const TIME_OPTIONS = [8, 10, 12, 15, 20];
  const CHECKPOINTS_BY_MODE = { easy: 1, medium: 1, hard: 2 };
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

  const PARTS = {
    daemons: ['Daemon.BreachData', 'Daemon.ICE.Pick', 'Daemon.Mask.Shroud', 'Daemon.Vault.Relay', 'Daemon.Spoof.Signal', 'Daemon.NullIndex'],
    actions: ['bash', 'fork', 'splice', 'crack', 'patch', 'echo', 'inject'],
    traces: ['Token.Lumin', 'stack.ztech', 'auth.delta', 'cache.ghost', 'ghost.rail', 'vhost.zero'],
    targets: ['directory.main', 'relay.shadow', 'vault.edge', 'node.blackwall', 'trace.backdoor', 'auth.archive'],
    files: ['edge1.2.6', 'mask4.7.0', 'ghost2.4.9', 'vault9.1.3', 'prism0.8.2', 'shunt3.6.1'],
    suffixes: ['download', 'mirror', 'override', 'extract', 'verify', 'decrypt'],
    stacks: ['ztech', 'mox', 'orbital', 'voodoo', 'sovoil', 'biotechnica'],
    tools: ['tool.mz', 'latch.exe', 'fork.bin', 'ghost.sh', 'delta.cmd', 'mask.pkg'],
    nodes: ['A-01', 'B-13', 'D-77', 'H-02', 'X-09', 'Q-44'],
    destinations: ['uplink.alpha', 'uplink.gamma', 'grid.lock', 'grid.fuse', 'vault.loop', 'core.black'],
    buffers: ['heap.zero', 'cipher.lace', 'signal.knot', 'delta.ice', 'relay.crown', 'mirror.heap'],
    alerts: ['quiet', 'trace', 'lockout', 'countermeasure', 'jammed', 'masked']
  };

  const state = {
    roomId: '',
    clientId: '',
    playerName: '',
    difficulty: 'easy',
    timeLimit: 10,
    sessionId: '',
    status: '',
    setupOpen: false,
    watchStop: null,
    progressHandle: null,
    terminalHandle: null,
    outcomeLogged: ''
  };

  function el(id) {
    return document.getElementById(id);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function buildRandomLine() {
    return pick([
      () => `CMD.Buffer///${pick(PARTS.daemons)}///${pick(PARTS.actions)}///`,
      () => `CMD.Trace::${pick(PARTS.traces)}::///${pick(PARTS.targets)};`,
      () => `content.file::${pick(PARTS.files)}///${pick(PARTS.suffixes)}`,
      () => `priM.stack::${pick(PARTS.stacks)}::///${pick(PARTS.tools)};`,
      () => `CMD.Route::${pick(PARTS.nodes)}::///${pick(PARTS.destinations)};`,
      () => `CMD.Buffer::${pick(PARTS.buffers)}::${pick(PARTS.actions)}///`,
      () => `ICE.scan::${pick(PARTS.traces)}::///${pick(PARTS.alerts)};`,
      () => `SYS.exec::${pick(PARTS.tools)}::///${pick(PARTS.targets)};`
    ])();
  }

  function sliderIndexForTime(timeValue) {
    const index = TIME_OPTIONS.indexOf(Number(timeValue));
    return index >= 0 ? index : 1;
  }

  function readSelectedTime() {
    const slider = el('gm-breach-time-slider');
    const index = Math.max(0, Math.min(TIME_OPTIONS.length - 1, Number(slider?.value || 1)));
    return TIME_OPTIONS[index];
  }

  function syncSliderLabel() {
    const value = readSelectedTime();
    const label = el('gm-breach-time-value');
    if (label) label.textContent = `${value}s`;
    state.timeLimit = value;
  }

  function getCheckpointCountForMode(mode) {
    return CHECKPOINTS_BY_MODE[String(mode || '').toLowerCase()] || 0;
  }

  function getObjectiveCopy(mode) {
    const checkpointCount = getCheckpointCountForMode(mode);
    return checkpointCount
      ? `${checkpointCount} CHECKPOINT${checkpointCount > 1 ? 'S' : ''} BEFORE EXIT`
      : 'DIRECT EXIT ROUTE';
  }

  function setGMStatus(message, mode = '') {
    const status = el('gm-status');
    if (status) status.textContent = message;
    const chip = el('gm-status-chip');
    if (chip && mode) {
      chip.className = `gm-status-chip ${mode}`;
      chip.textContent = mode.toUpperCase();
    }
  }

  function setModalStatus(status) {
    const node = el('gm-breach-status');
    if (!node) return;
    node.textContent = String(status || 'pending').toUpperCase();
    node.className = 'gm-breach-status';
    if (status === 'running' || status === 'success' || status === 'armed') node.classList.add('live');
    if (status === 'fail' || status === 'cancelled') node.classList.add('fail');
  }

  function clearLoopHandles() {
    clearInterval(state.progressHandle);
    clearInterval(state.terminalHandle);
    state.progressHandle = null;
    state.terminalHandle = null;
  }

  function appendTerminal(text, extraClass = '') {
    const terminal = el('gm-breach-terminal');
    if (!terminal) return;
    const line = document.createElement('span');
    line.className = `gm-breach-line${extraClass ? ` ${extraClass}` : ''}`;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function resetTerminal() {
    const terminal = el('gm-breach-terminal');
    if (!terminal) return;
    terminal.innerHTML = '';
    BOOT_LINES.forEach((line) => appendTerminal(line, line.startsWith('CMD.Buffer') ? 'dim' : ''));
  }

  function startTerminalFeed() {
    clearInterval(state.terminalHandle);
    state.terminalHandle = setInterval(() => {
      if (!state.sessionId) return;
      appendTerminal(buildRandomLine(), Math.random() > 0.55 ? 'dim' : '');
    }, 260);
  }

  function stopWatching() {
    if (typeof state.watchStop === 'function') state.watchStop();
    state.watchStop = null;
  }

  function setSetupVisibility(isSetup) {
    state.setupOpen = isSetup;
    el('gm-breach-launch-block')?.toggleAttribute('hidden', !isSetup);
    el('gm-breach-cancel')?.toggleAttribute('hidden', isSetup);
    const launch = el('gm-breach-launch');
    if (launch) launch.hidden = !isSetup;
    const close = el('gm-breach-close');
    if (close) close.textContent = isSetup ? 'CLOSE' : 'DONE';
  }

  function closeModal() {
    clearLoopHandles();
    stopWatching();
    state.roomId = '';
    state.clientId = '';
    state.playerName = '';
    state.difficulty = 'easy';
    state.timeLimit = 10;
    state.sessionId = '';
    state.status = '';
    state.setupOpen = false;
    state.outcomeLogged = '';
    el('gm-breach-modal')?.classList.remove('show');
  }

  function openModal() {
    el('gm-breach-modal')?.classList.add('show');
  }

  function updateProgress(session) {
    const fill = el('gm-breach-progress-fill');
    const timer = el('gm-breach-timer');
    if (!fill || !timer) return;
    const startedAt = Number(session?.startedAt || 0);
    const totalMs = Math.max(1000, Number(session?.timeLimit || state.timeLimit || 10) * 1000);
    if (!startedAt) {
      fill.style.width = '0%';
      timer.textContent = `${Number(session?.timeLimit || state.timeLimit || 10)}.0s`;
      return;
    }
    const endedAt = Number(session?.endedAt || 0);
    const now = endedAt || Date.now();
    const elapsed = Math.max(0, now - startedAt);
    const remaining = Math.max(0, totalMs - elapsed);
    const pct = Math.max(0, Math.min(100, (elapsed / totalMs) * 100));
    fill.style.width = `${pct}%`;
    timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
  }

  function syncModalFromSession(session) {
    if (!session) return;
    state.sessionId = String(session.sessionId || state.sessionId || '');
    state.status = String(session.status || 'pending').toLowerCase();
    state.timeLimit = Number(session.timeLimit || state.timeLimit || 10);
    el('gm-breach-copy').textContent = `${state.playerName.toUpperCase()} // LIVE BREACH FEED`;
    el('gm-breach-mode').textContent = String(session.difficulty || state.difficulty || 'easy').toUpperCase();
    setModalStatus(state.status === 'pending' ? 'armed' : state.status);
    updateProgress(session);

    const objective = el('gm-breach-objective');
    const checkpointCount = Number(session?.checkpointCount || 0);
    if (objective) {
      objective.textContent = checkpointCount
        ? `${checkpointCount} CHECKPOINT${checkpointCount > 1 ? 'S' : ''} BEFORE EXIT`
        : 'DIRECT EXIT ROUTE';
    }

    if (state.status === 'pending') {
      clearLoopHandles();
      if (!state.terminalHandle) startTerminalFeed();
      appendTerminal('CMD.Breach///AWAIT///>PLAYER-START', 'dim');
      return;
    }

    if (state.status === 'running') {
      if (!state.terminalHandle) startTerminalFeed();
      clearInterval(state.progressHandle);
      state.progressHandle = setInterval(() => updateProgress(session), 100);
      return;
    }

    clearLoopHandles();
    if (state.outcomeLogged === state.status) return;
    state.outcomeLogged = state.status;
    if (state.status === 'success') {
      appendTerminal('CMD.DeckTerminal///BREACH///>SUCCESS', 'success');
      setGMStatus(`Remote breach succeeded for ${state.playerName}.`, 'connected');
    } else if (state.status === 'fail') {
      appendTerminal('CMD.DeckTerminal///BREACH///>FAIL', 'fail');
      setGMStatus(`Remote breach failed for ${state.playerName}.`, 'pending');
    } else if (state.status === 'cancelled') {
      appendTerminal('CMD.DeckTerminal///BREACH///>CANCELLED', 'fail');
      setGMStatus(`Remote breach cancelled for ${state.playerName}.`, 'pending');
    }
  }

  function watchSession(roomId, clientId) {
    stopWatching();
    if (typeof watchRemoteBreach !== 'function') return;
    state.watchStop = watchRemoteBreach(roomId, (session) => {
      if (!session || !session.sessionId) return;
      if (state.sessionId && session.sessionId !== state.sessionId) return;
      syncModalFromSession(session);
    }, clientId);
  }

  function openSetup(clientId, difficulty) {
    const roomId = String(window.getGMActiveRoomId?.() || '').trim();
    const players = Array.isArray(window.getGMRemotePlayers?.()) ? window.getGMRemotePlayers() : [];
    const target = players.find((entry) => String(entry?.id || '') === String(clientId || ''));
    if (!roomId) {
      setGMStatus('Connect the GM page to a room before launching a breach.', 'disconnected');
      return;
    }
    if (!target) {
      setGMStatus('That player is no longer connected.', 'pending');
      return;
    }

    clearLoopHandles();
    stopWatching();
    state.roomId = roomId;
    state.clientId = clientId;
    state.playerName = String(target.name || 'Unknown');
    state.difficulty = String(difficulty || 'easy').toLowerCase();
    state.sessionId = '';
    state.outcomeLogged = '';

    resetTerminal();
    appendTerminal(`CMD.Breach///TARGET///>${state.playerName.toUpperCase()}`);
    appendTerminal(`CMD.Breach///SELECT///>${state.difficulty.toUpperCase()}`);
    appendTerminal('CMD.Breach///CONFIG///>SET-TIMER', 'dim');
    openModal();
    setSetupVisibility(true);
    setModalStatus('pending');
    el('gm-breach-mode').textContent = state.difficulty.toUpperCase();
    el('gm-breach-copy').textContent = `${state.playerName.toUpperCase()} // REMOTE BREACH SETUP`;
    const fill = el('gm-breach-progress-fill');
    if (fill) fill.style.width = '0%';
    const timer = el('gm-breach-timer');
    if (timer) timer.textContent = `${state.timeLimit.toFixed(1)}s`;
    const objective = el('gm-breach-objective');
    if (objective) {
      objective.textContent = getObjectiveCopy(state.difficulty);
    }
    const slider = el('gm-breach-time-slider');
    if (slider) slider.value = String(sliderIndexForTime(state.timeLimit));
    syncSliderLabel();
  }

  async function launchConfiguredBreach() {
    if (!state.roomId || !state.clientId || !state.playerName) return;
    state.sessionId = `breach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    state.outcomeLogged = '';
    resetTerminal();
    appendTerminal(`CMD.Breach///TARGET///>${state.playerName.toUpperCase()}`);
    appendTerminal(`CMD.Breach///SELECT///>${state.difficulty.toUpperCase()}`);
    appendTerminal(`CMD.Breach///TIMER///>${state.timeLimit}s`);
    appendTerminal('CMD.Breach///AWAIT///>PLAYER-START', 'dim');
    setSetupVisibility(false);
    startTerminalFeed();

    const payload = {
      sessionId: state.sessionId,
      difficulty: state.difficulty,
      playerName: state.playerName,
      status: 'pending',
      gmStartedAt: Date.now(),
      reactionMs: 0,
      timeLimit: state.timeLimit,
      checkpointCount: getCheckpointCountForMode(state.difficulty)
    };

    try {
      await setRemoteBreachSession(state.roomId, state.clientId, payload);
      syncModalFromSession(payload);
      watchSession(state.roomId, state.clientId);
      setGMStatus(`Remote breach armed for ${state.playerName}.`, 'connected');
    } catch (error) {
      setGMStatus(`Remote breach error: ${error.message}`, 'disconnected');
      closeModal();
    }
  }

  async function cancelBreach() {
    if (!state.roomId || !state.clientId || !state.sessionId) {
      closeModal();
      return;
    }
    try {
      await updateRemoteBreachSession(state.roomId, state.clientId, {
        sessionId: state.sessionId,
        status: 'cancelled',
        result: 'cancelled',
        endedAt: Date.now()
      });
    } catch (error) {
      setGMStatus(`Cancel breach error: ${error.message}`, 'disconnected');
    }
  }

  function injectButtons() {
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectButtons();
    window.addEventListener('gm-monitor-updated', injectButtons);

    el('gm-breach-time-slider')?.addEventListener('input', syncSliderLabel);
    syncSliderLabel();

    document.addEventListener('click', (event) => {
      const breachButton = event.target.closest('[data-gm-breach-start]');
      if (breachButton) {
        openSetup(
          breachButton.getAttribute('data-gm-breach-start'),
          breachButton.getAttribute('data-gm-breach-mode')
        );
        return;
      }
    });

    el('gm-breach-launch')?.addEventListener('click', launchConfiguredBreach);
    el('gm-breach-cancel')?.addEventListener('click', cancelBreach);
    el('gm-breach-close')?.addEventListener('click', closeModal);
    el('gm-breach-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
  });
})();
