(function initGMActionPlay() {
  const actionState = {
    ally: [],
    enemy: [],
    turnOrder: [],
    currentTurnIndex: 0,
    initiativeModal: null,
    draggedKey: ''
  };

  const initiativeAnimFrames = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toId(value) {
    return String(value || '').replace(/[^\w-]+/g, '_');
  }

  function getMonitorCombatants() {
    const players = typeof window.getGMRemotePlayers === 'function' ? window.getGMRemotePlayers() : [];
    const npcs = typeof window.getGMLocalNpcs === 'function' ? window.getGMLocalNpcs() : [];
    return [
      ...players.map((entry) => ({
        ...clone(entry),
        sourceType: 'player',
        combatKey: `player:${entry.id}`
      })),
      ...npcs.map((entry) => ({
        ...clone(entry),
        sourceType: 'npc',
        combatKey: `npc:${entry.id}`
      }))
    ];
  }

  function getCombatantMap() {
    return new Map(getMonitorCombatants().map((entry) => [entry.combatKey, entry]));
  }

  function getCombatantByKey(key) {
    return getCombatantMap().get(key) || null;
  }

  function getAssignedSide(key) {
    if (actionState.ally.includes(key)) return 'ally';
    if (actionState.enemy.includes(key)) return 'enemy';
    return '';
  }

  function normalizeActionState() {
    const availableKeys = new Set(getMonitorCombatants().map((entry) => entry.combatKey));
    actionState.ally = actionState.ally.filter((key) => availableKeys.has(key));
    actionState.enemy = actionState.enemy.filter((key) => availableKeys.has(key));
    actionState.turnOrder = actionState.turnOrder.filter((entry) => availableKeys.has(entry.key));
    if (actionState.currentTurnIndex >= actionState.turnOrder.length) {
      actionState.currentTurnIndex = Math.max(0, actionState.turnOrder.length - 1);
    }
  }

  function assignCombatantToSide(key, side) {
    if (!key || !['ally', 'enemy'].includes(side)) return;
    actionState.ally = actionState.ally.filter((entry) => entry !== key);
    actionState.enemy = actionState.enemy.filter((entry) => entry !== key);
    actionState[side].push(key);
    renderActionPlay();
  }

  function getAssignedCombatants() {
    const map = getCombatantMap();
    const build = (key, side) => {
      const combatant = map.get(key);
      return combatant ? { ...combatant, assignedSide: side } : null;
    };
    return [
      ...actionState.ally.map((key) => build(key, 'ally')).filter(Boolean),
      ...actionState.enemy.map((key) => build(key, 'enemy')).filter(Boolean)
    ];
  }

  function getRefStat(combatant) {
    const stats = Array.isArray(combatant?.stats) ? combatant.stats : [];
    const refEntry = stats.find((entry) => String(entry?.label || '').trim().toUpperCase() === 'REF');
    const value = parseInt(refEntry?.value, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function getRollSnapshot(lastRoll) {
    if (!lastRoll || !lastRoll.dice) return '';
    return `${lastRoll.dice}|${lastRoll.raw}|${lastRoll.modifiers}|${lastRoll.total}`;
  }

  function animateInitiativeValue(rowKey, start, end) {
    const node = document.getElementById(`gm-init-total-${toId(rowKey)}`);
    if (!node) return;
    if (initiativeAnimFrames[rowKey]) cancelAnimationFrame(initiativeAnimFrames[rowKey]);
    const startTime = performance.now();
    const duration = 650;
    node.classList.add('animating');

    const tick = (now) => {
      const pct = Math.min(1, (now - startTime) / duration);
      const value = Math.round(start + ((end - start) * pct));
      node.textContent = String(value);
      if (pct < 1) {
        initiativeAnimFrames[rowKey] = requestAnimationFrame(tick);
      } else {
        node.textContent = String(end);
        node.classList.remove('animating');
        initiativeAnimFrames[rowKey] = null;
      }
    };

    initiativeAnimFrames[rowKey] = requestAnimationFrame(tick);
  }

  function renderActionPool() {
    const node = document.getElementById('gm-action-pool');
    if (!node) return;
    const entries = getMonitorCombatants();
    if (!entries.length) {
      node.innerHTML = '<div class="gm-empty">No characters available yet.</div>';
      return;
    }

    node.innerHTML = entries.map((entry) => {
      const assignedSide = getAssignedSide(entry.combatKey);
      const badge = assignedSide
        ? `<span class="gm-action-char-badge${assignedSide === 'enemy' ? ' enemy' : ''}">${assignedSide === 'ally' ? 'PROTAGONIST' : 'ANTAGONIST'}</span>`
        : '';
      return `
        <div class="gm-action-char" draggable="true" data-gm-combat-key="${escapeHtml(entry.combatKey)}">
          <div class="gm-player-name">${escapeHtml(entry.name || 'Unknown')}</div>
          <div class="gm-action-char-meta">${escapeHtml(entry.career || 'UNKNOWN')} // ${escapeHtml(entry.sourceType.toUpperCase())}</div>
          ${badge}
        </div>
      `;
    }).join('');
  }

  function renderAssignedList(side, targetId, emptyMessage) {
    const node = document.getElementById(targetId);
    if (!node) return;
    const keys = actionState[side];
    const map = getCombatantMap();
    const entries = keys.map((key) => map.get(key)).filter(Boolean);
    if (!entries.length) {
      node.innerHTML = `<div class="gm-empty">${emptyMessage}</div>`;
      return;
    }
    node.innerHTML = entries.map((entry) => `
        <div class="gm-assigned-card" draggable="true" data-gm-combat-key="${escapeHtml(entry.combatKey)}">
          <div class="gm-player-name">${escapeHtml(entry.name || 'Unknown')}</div>
          <div class="gm-action-char-meta">${escapeHtml(entry.career || 'UNKNOWN')} // ${escapeHtml(entry.sourceType.toUpperCase())}</div>
          <div class="gm-assigned-side">${side === 'ally' ? 'Protagonist' : 'Antagonist'}</div>
        </div>
      `).join('');
  }

  function renderTurnOrder() {
    const node = document.getElementById('gm-turn-order');
    const note = document.getElementById('gm-turn-note');
    if (!node || !note) return;

    if (!actionState.turnOrder.length) {
      note.textContent = 'Set up both sides, then run initiative.';
      node.innerHTML = '<div class="gm-empty">No active combat order yet.</div>';
      return;
    }

    const active = actionState.turnOrder[actionState.currentTurnIndex];
    note.textContent = active
      ? `Current turn: ${active.name} // ${active.side === 'ally' ? 'Protagonist' : 'Antagonist'}`
      : 'Combat order locked in.';

    node.innerHTML = actionState.turnOrder.map((entry, index) => `
      <div class="gm-turn-row${index === actionState.currentTurnIndex ? ' active' : ''}">
        <div class="gm-turn-top">
          <div class="gm-turn-name">${escapeHtml(entry.name)}</div>
          <div class="gm-turn-total">${escapeHtml(entry.total)}</div>
        </div>
        <div class="gm-turn-meta">${escapeHtml(entry.side === 'ally' ? 'Protagonist' : 'Antagonist')} // ${escapeHtml(entry.breakdown)}</div>
        <div class="gm-turn-actions">
          <button type="button" class="gm-btn gm-btn-muted" data-gm-remove-combatant="${escapeHtml(entry.key)}">REMOVE CHARACTER</button>
        </div>
      </div>
    `).join('');
  }

  function renderActionPlay() {
    normalizeActionState();
    renderActionPool();
    renderAssignedList('ally', 'gm-ally-list', 'Drag characters here.');
    renderAssignedList('enemy', 'gm-enemy-list', 'Drag characters here.');
    renderTurnOrder();
    if (actionState.initiativeModal?.open) {
      updateInitiativeModalFromMonitor();
      renderInitiativeModal();
    }
  }

  function buildNpcInitiativeResult(combatant) {
    const raw = Math.floor(Math.random() * 10) + 1;
    const modifiers = getRefStat(combatant);
    return {
      ready: true,
      raw,
      modifiers,
      total: raw + modifiers,
      status: 'READY',
      breakdown: `1D10 RAW ${raw} + REF ${modifiers}`
    };
  }

  function openInitiativeModal() {
    const combatants = getAssignedCombatants();
    if (!combatants.length) {
      const note = document.getElementById('gm-turn-note');
      if (note) note.textContent = 'Add combatants to the Action Section first.';
      return;
    }

    const baselineSnapshots = {};
    const results = {};
    combatants.forEach((combatant) => {
      if (combatant.sourceType === 'npc') {
        results[combatant.combatKey] = buildNpcInitiativeResult(combatant);
      } else {
        baselineSnapshots[combatant.combatKey] = getRollSnapshot(combatant.lastRollVisible || combatant.lastRoll || null);
        results[combatant.combatKey] = {
          ready: false,
          raw: 0,
          modifiers: 0,
          total: 0,
          status: 'WAITING FOR PLAYER REROLL',
          breakdown: 'Player must roll again from dossier.'
        };
      }
    });

    actionState.initiativeModal = {
      open: true,
      combatants,
      baselineSnapshots,
      results
    };

    document.getElementById('gm-initiative-modal')?.classList.add('show');
    renderInitiativeModal();
    Object.entries(results).forEach(([key, result]) => {
      if (result.ready) {
        setTimeout(() => animateInitiativeValue(key, result.raw, result.total), 80);
      }
    });
  }

  function closeInitiativeModal() {
    actionState.initiativeModal = null;
    document.getElementById('gm-initiative-modal')?.classList.remove('show');
  }

  function updateInitiativeModalFromMonitor() {
    const modal = actionState.initiativeModal;
    if (!modal?.open) return;
    const combatMap = getCombatantMap();
    modal.combatants = modal.combatants
      .map((entry) => combatMap.get(entry.combatKey) || entry)
      .filter(Boolean);

    modal.combatants.forEach((combatant) => {
      if (combatant.sourceType !== 'player') return;
      const result = modal.results[combatant.combatKey];
      if (!result || result.ready) return;
      const roll = combatant.lastRollVisible || combatant.lastRoll || null;
      const snapshot = getRollSnapshot(roll);
      if (!snapshot || snapshot === modal.baselineSnapshots[combatant.combatKey]) return;
      modal.results[combatant.combatKey] = {
        ready: true,
        raw: Number(roll.raw || 0),
        modifiers: Number(roll.modifiers || 0),
        total: Number(roll.total || 0),
        status: 'READY',
        breakdown: `${roll.dice} RAW ${roll.raw ?? 0} ${Number(roll.modifiers || 0) >= 0 ? '+' : ''}${roll.modifiers || 0}`
      };
      renderInitiativeModal();
      animateInitiativeValue(combatant.combatKey, Number(roll.raw || 0), Number(roll.total || 0));
    });
  }

  function renderInitiativeModal() {
    const modal = actionState.initiativeModal;
    const list = document.getElementById('gm-initiative-list');
    const confirmButton = document.getElementById('gm-initiative-confirm');
    if (!list || !confirmButton) return;
    if (!modal?.open) {
      list.innerHTML = '<div class="gm-empty">No combatants assigned yet.</div>';
      confirmButton.disabled = true;
      return;
    }

    list.innerHTML = modal.combatants.map((combatant) => {
      const result = modal.results[combatant.combatKey];
      const isReady = !!result?.ready;
      return `
        <div class="gm-initiative-row ${isReady ? 'ready' : 'pending'}">
          <div class="gm-initiative-top">
            <div class="gm-initiative-name">${escapeHtml(combatant.name || 'Unknown')}</div>
            <div class="gm-initiative-status">${escapeHtml(result?.status || 'PENDING')}</div>
          </div>
          <div class="gm-initiative-total" id="gm-init-total-${toId(combatant.combatKey)}">${escapeHtml(isReady ? result.total : '--')}</div>
          <div class="gm-initiative-meta">${escapeHtml(result?.breakdown || '--')}</div>
        </div>
      `;
    }).join('');

    confirmButton.disabled = modal.combatants.some((combatant) => !modal.results[combatant.combatKey]?.ready);
  }

  function confirmInitiativeOrder() {
    const modal = actionState.initiativeModal;
    if (!modal?.open) return;
    const sorted = modal.combatants.map((combatant) => {
      const result = modal.results[combatant.combatKey];
      return {
        key: combatant.combatKey,
        name: combatant.name || 'Unknown',
        side: getAssignedSide(combatant.combatKey) || 'ally',
        total: result.total,
        breakdown: result.breakdown
      };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    actionState.turnOrder = sorted;
    actionState.currentTurnIndex = 0;
    closeInitiativeModal();
    renderActionPlay();
  }

  function moveTurn(delta) {
    if (!actionState.turnOrder.length) return;
    const length = actionState.turnOrder.length;
    actionState.currentTurnIndex = (actionState.currentTurnIndex + delta + length) % length;
    renderTurnOrder();
  }

  function removeCombatantFromCombat(key) {
    const entry = actionState.turnOrder.find((item) => item.key === key) || getCombatantByKey(key);
    if (!entry) return;
    if (!window.confirm(`Remove ${entry.name || 'this character'} from combat?`)) return;
    actionState.ally = actionState.ally.filter((item) => item !== key);
    actionState.enemy = actionState.enemy.filter((item) => item !== key);
    actionState.turnOrder = actionState.turnOrder.filter((item) => item.key !== key);
    if (actionState.currentTurnIndex >= actionState.turnOrder.length) {
      actionState.currentTurnIndex = Math.max(0, actionState.turnOrder.length - 1);
    }
    renderActionPlay();
  }

  function endCombat() {
    if (!window.confirm('End combat and clear the action section and turn list?')) return;
    actionState.ally = [];
    actionState.enemy = [];
    actionState.turnOrder = [];
    actionState.currentTurnIndex = 0;
    closeInitiativeModal();
    renderActionPlay();
  }

  function clearAssignedCharacters() {
    if (!actionState.ally.length && !actionState.enemy.length) return;
    if (!window.confirm('Clear all characters from the action section?')) return;
    actionState.ally = [];
    actionState.enemy = [];
    actionState.turnOrder = [];
    actionState.currentTurnIndex = 0;
    closeInitiativeModal();
    renderActionPlay();
  }

  function switchGMTab(tabName) {
    document.querySelectorAll('.gm-tab-btn').forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-gm-tab') === tabName);
    });
    document.querySelectorAll('.gm-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `gm-tab-${tabName}`);
    });
  }

  function wireDropZone(node) {
    if (!node) return;
    node.addEventListener('dragover', (event) => {
      event.preventDefault();
      node.classList.add('drag-over');
    });
    node.addEventListener('dragleave', () => {
      node.classList.remove('drag-over');
    });
    node.addEventListener('drop', (event) => {
      event.preventDefault();
      node.classList.remove('drag-over');
      const key = event.dataTransfer?.getData('text/plain') || actionState.draggedKey;
      const side = node.getAttribute('data-gm-side');
      assignCombatantToSide(key, side);
      actionState.draggedKey = '';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.gm-tab-btn').forEach((button) => {
      button.addEventListener('click', () => switchGMTab(button.getAttribute('data-gm-tab')));
    });

    wireDropZone(document.getElementById('gm-drop-ally'));
    wireDropZone(document.getElementById('gm-drop-enemy'));

    document.addEventListener('dragstart', (event) => {
      const card = event.target.closest('[data-gm-combat-key]');
      if (!card) return;
      actionState.draggedKey = card.getAttribute('data-gm-combat-key');
      event.dataTransfer?.setData('text/plain', actionState.draggedKey);
    });

    document.addEventListener('dragend', () => {
      actionState.draggedKey = '';
      document.querySelectorAll('.gm-drop-zone').forEach((node) => node.classList.remove('drag-over'));
    });

    document.getElementById('gm-init-check-btn')?.addEventListener('click', openInitiativeModal);
    document.getElementById('gm-clear-action-btn')?.addEventListener('click', clearAssignedCharacters);
    document.getElementById('gm-prev-turn-btn')?.addEventListener('click', () => moveTurn(-1));
    document.getElementById('gm-next-turn-btn')?.addEventListener('click', () => moveTurn(1));
    document.getElementById('gm-end-combat-btn')?.addEventListener('click', endCombat);
    document.getElementById('gm-initiative-cancel')?.addEventListener('click', closeInitiativeModal);
    document.getElementById('gm-initiative-confirm')?.addEventListener('click', confirmInitiativeOrder);
    document.getElementById('gm-initiative-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeInitiativeModal();
    });

    document.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-gm-remove-combatant]');
      if (removeButton) {
        removeCombatantFromCombat(removeButton.getAttribute('data-gm-remove-combatant'));
      }
    });

    window.addEventListener('gm-monitor-updated', () => {
      renderActionPlay();
    });

    renderActionPlay();
  });
})();
