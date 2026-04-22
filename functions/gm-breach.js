(function initGMBreachModule() {
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
    sessionId: '',
    status: '',
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
    if (status === 'running' || status === 'success') node.classList.add('live');
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

  function closeModal() {
    clearLoopHandles();
    stopWatching();
    state.roomId = '';
    state.clientId = '';
    state.playerName = '';
    state.difficulty = 'easy';
    state.sessionId = '';
    state.status = '';
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
    const base = Number(session?.startedAt || session?.gmStartedAt || Date.now());
    const totalMs = Math.max(1000, Number(session?.reactionMs || 3000) + (Number(session?.timeLimit || 10) * 1000));
    const endedAt = Number(session?.endedAt || 0);
    const now = endedAt || Date.now();
    const elapsed = Math.max(0, now - base);
    const remaining = Math.max(0, totalMs - elapsed);
    const pct = Math.max(0, Math.min(100, (elapsed / totalMs) * 100));
    fill.style.width = `${pct}%`;
    timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
  }

  function syncModalFromSession(session) {
    if (!session) return;
    state.sessionId = String(session.sessionId || state.sessionId || '');
    state.status = String(session.status || 'pending').toLowerCase();
    el('gm-breach-copy').textContent = `${state.playerName.toUpperCase()} // LIVE BREACH FEED`;
    el('gm-breach-mode').textContent = String(session.difficulty || state.difficulty || 'easy').toUpperCase();
    setModalStatus(state.status);
    updateProgress(session);

    if (['pending', 'running'].includes(state.status)) {
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

  async function startBreach(clientId, difficulty) {
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

    state.roomId = roomId;
    state.clientId = clientId;
    state.playerName = String(target.name || 'Unknown');
    state.difficulty = String(difficulty || 'easy').toLowerCase();
    state.sessionId = `breach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    state.outcomeLogged = '';

    resetTerminal();
    appendTerminal(`CMD.Breach///TARGET///>${state.playerName.toUpperCase()}`);
    appendTerminal(`CMD.Breach///SELECT///>${state.difficulty.toUpperCase()}`);
    appendTerminal('CMD.Breach///AWAIT///>PLAYER-HANDSHAKE', 'dim');
    openModal();
    setModalStatus('pending');
    el('gm-breach-mode').textContent = state.difficulty.toUpperCase();
    el('gm-breach-copy').textContent = `${state.playerName.toUpperCase()} // LIVE BREACH FEED`;
    startTerminalFeed();

    const payload = {
      sessionId: state.sessionId,
      difficulty: state.difficulty,
      playerName: state.playerName,
      status: 'pending',
      gmStartedAt: Date.now(),
      reactionMs: 3000,
      timeLimit: 10
    };

    try {
      await setRemoteBreachSession(roomId, clientId, payload);
      syncModalFromSession(payload);
      watchSession(roomId, clientId);
      setGMStatus(`Remote breach launched for ${state.playerName}.`, 'connected');
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
    document.querySelectorAll('#gm-player-list .gm-player-card[data-gm-client-id][data-gm-role="player"]').forEach((card) => {
      if (card.querySelector('.gm-breach-btn-row')) return;
      const sheet = card.querySelector('.gm-player-sheet');
      if (!sheet) return;
      const clientId = card.getAttribute('data-gm-client-id') || '';
      const wrap = document.createElement('div');
      wrap.className = 'gm-card-actions gm-card-actions-split';
      wrap.innerHTML = `
        <div class="gm-sheet-title">Remote Breach</div>
        <div class="gm-breach-btn-row">
          <button type="button" class="gm-btn" data-gm-breach-start="${clientId}" data-gm-breach-mode="easy">EASY</button>
          <button type="button" class="gm-btn" data-gm-breach-start="${clientId}" data-gm-breach-mode="medium">MEDIUM</button>
          <button type="button" class="gm-btn" data-gm-breach-start="${clientId}" data-gm-breach-mode="hard">HARD</button>
        </div>
      `;
      sheet.insertBefore(wrap, sheet.firstChild);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectButtons();
    window.addEventListener('gm-monitor-updated', injectButtons);

    document.addEventListener('click', (event) => {
      const breachButton = event.target.closest('[data-gm-breach-start]');
      if (breachButton) {
        startBreach(
          breachButton.getAttribute('data-gm-breach-start'),
          breachButton.getAttribute('data-gm-breach-mode')
        );
        return;
      }
    });

    el('gm-breach-cancel')?.addEventListener('click', cancelBreach);
    el('gm-breach-close')?.addEventListener('click', closeModal);
    el('gm-breach-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
  });
})();
