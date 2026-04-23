(function initGMActionPlay() {
  const actionState = {
    ally: [],
    enemy: [],
    boardOpposition: [],
    turnOrder: [],
    currentTurnIndex: 0,
    liveTurnIndex: 0,
    initiativeModal: null,
    facedownModal: null,
    draggedKey: '',
    manualRolls: {},
    turnStartSnapshots: {},
    boardOppositionByTurn: {},
    turnRollHistoryByTurn: {},
    facedownPenaltyByKey: {}
  };

  const initiativeAnimFrames = {};
  const initiativeRevealTimers = {};
  const INITIATIVE_PLAYER_REVEAL_DELAY_MS = 1600;
  let lastPublishedCombatSummary = '';
  let lastPublishedCombatRoomId = '';
  let facedownPromptUnsubscribe = null;
  let confirmModalAction = null;
  const turnRollAnimFrames = {};
  const turnRollSnapshots = {};

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

  function getTurnEntry(index = actionState.currentTurnIndex) {
    return actionState.turnOrder[index] || null;
  }

  function getLiveTurnEntry() {
    return getTurnEntry(actionState.liveTurnIndex);
  }

  function isViewingHistoricalTurn() {
    return actionState.turnOrder.length && actionState.currentTurnIndex !== actionState.liveTurnIndex;
  }

  function getActiveCombatant() {
    const active = getLiveTurnEntry();
    return active ? getCombatantByKey(active.key) : null;
  }

  function getViewedCombatant() {
    const viewed = getTurnEntry(actionState.currentTurnIndex);
    return viewed ? getCombatantByKey(viewed.key) : null;
  }

  function getTurnCombatants() {
    return actionState.turnOrder
      .map((entry) => {
        const combatant = getCombatantByKey(entry.key);
        return combatant ? { ...combatant, turnSide: entry.side } : null;
      })
      .filter(Boolean);
  }

  function applyManualRollToCombatant(key, roll) {
    if (!key || !roll?.dice) return;
    actionState.manualRolls[key] = {
      dice: roll.dice,
      pool: Array.isArray(roll.pool) ? [...roll.pool] : [],
      raw: Number(roll.raw || 0),
      modifiers: Number(roll.modifiers || 0),
      total: Number(roll.total || 0)
    };
    renderActionPlay();
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
    actionState.boardOpposition = actionState.boardOpposition.filter((key) => availableKeys.has(key));
    actionState.turnOrder = actionState.turnOrder.filter((entry) => availableKeys.has(entry.key));
    Object.keys(actionState.manualRolls).forEach((key) => {
      if (!availableKeys.has(key)) delete actionState.manualRolls[key];
    });
    Object.keys(actionState.turnStartSnapshots).forEach((key) => {
      if (!availableKeys.has(key)) delete actionState.turnStartSnapshots[key];
    });
    Object.keys(actionState.boardOppositionByTurn).forEach((turnKey) => {
      actionState.boardOppositionByTurn[turnKey] = (actionState.boardOppositionByTurn[turnKey] || [])
        .filter((key) => availableKeys.has(key) && key !== turnKey);
      if (!actionState.boardOppositionByTurn[turnKey].length) {
        delete actionState.boardOppositionByTurn[turnKey];
      }
    });
    Object.keys(actionState.turnRollHistoryByTurn).forEach((turnKey) => {
      const history = actionState.turnRollHistoryByTurn[turnKey] || {};
      Object.keys(history).forEach((combatKey) => {
        if (!availableKeys.has(combatKey)) delete history[combatKey];
      });
      if (!Object.keys(history).length) delete actionState.turnRollHistoryByTurn[turnKey];
    });
    Object.keys(actionState.facedownPenaltyByKey).forEach((combatKey) => {
      if (!availableKeys.has(combatKey)) delete actionState.facedownPenaltyByKey[combatKey];
    });
    if (actionState.currentTurnIndex >= actionState.turnOrder.length) {
      actionState.currentTurnIndex = Math.max(0, actionState.turnOrder.length - 1);
    }
    if (actionState.liveTurnIndex >= actionState.turnOrder.length) {
      actionState.liveTurnIndex = Math.max(0, actionState.turnOrder.length - 1);
    }
  }

  function assignCombatantToSide(key, side) {
    if (!key || !['ally', 'enemy'].includes(side)) return;
    actionState.ally = actionState.ally.filter((entry) => entry !== key);
    actionState.enemy = actionState.enemy.filter((entry) => entry !== key);
    actionState[side].push(key);
    actionState.turnOrder = actionState.turnOrder.map((entry) => (
      entry.key === key
        ? { ...entry, side }
        : entry
    ));
    renderActionPlay();
  }

  function getBoardOppositionForIndex(index = actionState.currentTurnIndex) {
    const entry = getTurnEntry(index);
    if (!entry) return [];
    return [...(actionState.boardOppositionByTurn[entry.key] || [])];
  }

  function setBoardOppositionForIndex(index, keys) {
    const entry = getTurnEntry(index);
    if (!entry) return;
    const cleaned = [...new Set((keys || []).filter((key) => key && key !== entry.key))];
    if (cleaned.length) {
      actionState.boardOppositionByTurn[entry.key] = cleaned;
    } else {
      delete actionState.boardOppositionByTurn[entry.key];
    }
  }

  function addCombatantToBoardOpposition(key) {
    const active = getLiveTurnEntry();
    if (!key || !active || key === active.key) return;
    const opposition = getBoardOppositionForIndex(actionState.liveTurnIndex).filter((entry) => entry !== key);
    opposition.push(key);
    setBoardOppositionForIndex(actionState.liveTurnIndex, opposition);
    renderActionPlay();
  }

  function getCombatDropSide(node) {
    const defaultSide = node?.getAttribute('data-gm-side') || 'ally';
    if (!actionState.turnOrder.length) return defaultSide;
    const active = getLiveTurnEntry();
    if (!active) return defaultSide;
    if (node?.id === 'gm-drop-ally') return active.side;
    if (node?.id === 'gm-drop-enemy') return active.side === 'ally' ? 'enemy' : 'ally';
    return defaultSide;
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

  function getFacedownCombatants() {
    return actionState.turnOrder.length === 2
      ? getTurnCombatants()
      : getAssignedCombatants();
  }

  function getRefStat(combatant) {
    const stats = Array.isArray(combatant?.stats) ? combatant.stats : [];
    const refEntry = stats.find((entry) => String(entry?.label || '').trim().toUpperCase() === 'REF');
    const value = parseInt(refEntry?.value, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function getRollSnapshot(lastRoll) {
    if (!lastRoll || !lastRoll.dice) return '';
    return `${lastRoll.dice}|${lastRoll.raw}|${lastRoll.modifiers}|${lastRoll.total}|${lastRoll.rolledAt || 0}`;
  }

  function getCombatantVisibleRoll(combatant) {
    if (!combatant) return null;
    return actionState.manualRolls[combatant.combatKey]
      || combatant.lastRollVisible
      || combatant.lastRoll
      || null;
  }

  function cloneRollValue(roll) {
    if (!roll || !roll.dice) return null;
    return {
      dice: roll.dice,
      pool: Array.isArray(roll.pool) ? [...roll.pool] : [],
      raw: Number(roll.raw || 0),
      modifiers: Number(roll.modifiers || 0),
      total: Number(roll.total || 0)
    };
  }

  function captureTurnRollHistory(index = actionState.liveTurnIndex) {
    const entry = getTurnEntry(index);
    if (!entry) return;
    const opposition = getBoardOppositionForIndex(index);
    const rollHistory = {};
    [entry.key, ...opposition].forEach((combatKey) => {
      const combatant = getCombatantByKey(combatKey);
      const roll = cloneRollValue(getCombatantVisibleRoll(combatant));
      if (roll) rollHistory[combatKey] = roll;
    });
    if (Object.keys(rollHistory).length) {
      actionState.turnRollHistoryByTurn[entry.key] = rollHistory;
    } else {
      delete actionState.turnRollHistoryByTurn[entry.key];
    }
  }

  function markLiveTurnBaseline() {
    const active = getLiveTurnEntry();
    if (!active) return;
    const combatant = getCombatantByKey(active.key);
    setBoardOppositionForIndex(
      actionState.liveTurnIndex,
      getBoardOppositionForIndex(actionState.liveTurnIndex).filter((key) => key !== active.key)
    );
    if (!(active.key in actionState.turnStartSnapshots)) {
      actionState.turnStartSnapshots[active.key] = getRollSnapshot(getCombatantVisibleRoll(combatant));
    }
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
          ${renderCombatPickGroup(entry)}
        </div>
      `).join('');
  }

  function getCombatStatPairs(block) {
    if (Array.isArray(block)) {
      return block
        .map((entry) => ({
          label: String(entry?.label || '').trim(),
          value: parseInt(entry?.value, 10)
        }))
        .filter((entry) => entry.label && Number.isFinite(entry.value));
    }
    return Object.entries(block || {})
      .map(([label, value]) => ({
        label: String(label || '').trim(),
        value: parseInt(value, 10)
      }))
      .filter((entry) => entry.label && Number.isFinite(entry.value));
  }

  function renderCombatPickLines(source, sectionLabel, block) {
    const entries = getCombatStatPairs(block).slice(0, 4);
    if (!entries.length) return '';
    return `
      <div class="gm-combat-pick-group">
        <div class="gm-combat-pick-title">${escapeHtml(sectionLabel)}</div>
        <div class="gm-combat-picks">
          ${entries.map((entry) => `
            <button
              type="button"
              class="gm-combat-pick"
              data-gm-combat-roll-source="${escapeHtml(source)}"
              data-gm-combat-roll-label="${escapeHtml(entry.label)}"
              data-gm-combat-roll-value="${escapeHtml(entry.value)}"
            >
              <span>${escapeHtml(entry.label)}</span>
              <strong>${escapeHtml(entry.value)}</strong>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderCombatPickGroup(combatant) {
    const source = combatant?.name || 'Combatant';
    return `
      <div class="gm-combat-pick-wrap">
        ${renderCombatPickLines(source, 'Stats', combatant?.stats)}
        ${renderCombatPickLines(source, 'Skills', combatant?.skills)}
      </div>
    `;
  }

  function renderCombatSetupBoard() {
    const allyNode = document.getElementById('gm-ally-list');
    const enemyNode = document.getElementById('gm-enemy-list');
    const allyTitle = document.getElementById('gm-drop-ally-title');
    const enemyTitle = document.getElementById('gm-drop-enemy-title');
    if (!allyNode || !enemyNode || !allyTitle || !enemyTitle) return false;
    if (!actionState.turnOrder.length) {
      allyTitle.textContent = 'Protagonist';
      enemyTitle.textContent = 'Antagonist';
      return false;
    }

    const viewed = getTurnEntry(actionState.currentTurnIndex);
    const activeCombatant = getViewedCombatant();
    if (!viewed || !activeCombatant) return false;
    const historical = isViewingHistoricalTurn();

    const opposition = getBoardOppositionForIndex(actionState.currentTurnIndex)
      .filter((key) => key !== viewed.key)
      .map((key) => getCombatantByKey(key))
      .filter(Boolean);

    allyTitle.textContent = `Current Actor // ${viewed.side === 'ally' ? 'Protagonist' : 'Antagonist'}${historical ? ' // HISTORY' : ''}`;
    enemyTitle.textContent = `Opposition // ${viewed.side === 'ally' ? 'Antagonist' : 'Protagonist'}${historical ? ' // LOCKED' : ''}`;

    allyNode.innerHTML = `
      <div class="gm-assigned-card">
        <div class="gm-player-name">${escapeHtml(activeCombatant.name || 'Unknown')}</div>
        <div class="gm-action-char-meta">${escapeHtml(activeCombatant.career || 'UNKNOWN')} // ${escapeHtml(viewed.side === 'ally' ? 'PROTAGONIST' : 'ANTAGONIST')}</div>
        <div class="gm-turn-roll">
          ${renderTurnRollPanel(activeCombatant, `board-active-${viewed.key}`, '', {
            hideUntilTurnRoll: !historical,
            rollOverride: historical ? actionState.turnRollHistoryByTurn[viewed.key]?.[viewed.key] || null : null
          })}
        </div>
        ${historical ? '' : renderCombatPickGroup(activeCombatant)}
      </div>
    `;

    enemyNode.innerHTML = opposition.length ? opposition.map((combatant) => `
      <div class="gm-assigned-card"${historical ? '' : ` draggable="true" data-gm-combat-key="${escapeHtml(combatant.combatKey)}"`}>
        <div class="gm-player-name">${escapeHtml(combatant.name || 'Unknown')}</div>
        <div class="gm-action-char-meta">${escapeHtml(combatant.career || 'UNKNOWN')} // ${escapeHtml(viewed.side === 'ally' ? 'ANTAGONIST' : 'PROTAGONIST')}</div>
        <div class="gm-turn-roll">
          ${renderTurnRollPanel(combatant, `board-opposition-${combatant.combatKey}`, '', {
            rollOverride: historical ? actionState.turnRollHistoryByTurn[viewed.key]?.[combatant.combatKey] || null : null
          })}
        </div>
        ${historical ? '' : renderCombatPickGroup(combatant)}
      </div>
    `).join('') : `<div class="gm-empty">${historical ? 'No opposition recorded for this turn.' : 'Drag characters here for the current opposition.'}</div>`;

    animateTurnRoll(`board-active-${viewed.key}`, activeCombatant);
    opposition.forEach((combatant) => {
      animateTurnRoll(`board-opposition-${combatant.combatKey}`, combatant);
    });
    return true;
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

    const active = getLiveTurnEntry();
    const viewed = getTurnEntry(actionState.currentTurnIndex);
    note.textContent = viewed
      ? `${isViewingHistoricalTurn() ? 'Viewing previous turn' : 'Current turn'}: ${viewed.name} // ${viewed.side === 'ally' ? 'Protagonist' : 'Antagonist'}${active && viewed.key !== active.key ? ` // Live actor: ${active.name}` : ''}`
      : 'Combat order locked in.';

    node.innerHTML = actionState.turnOrder.map((entry, index) => {
      return `
        <div class="gm-turn-row${index === actionState.currentTurnIndex ? ' active' : ''}${index === actionState.liveTurnIndex ? ' live' : ''}">
          <div class="gm-turn-top">
            <div class="gm-turn-name">${escapeHtml(entry.name)}</div>
            <div class="gm-turn-total">${escapeHtml(entry.total)}</div>
          </div>
          <div class="gm-turn-meta">${escapeHtml(entry.side === 'ally' ? 'Protagonist' : 'Antagonist')} // ${escapeHtml(entry.breakdown)}</div>
          <div class="gm-turn-actions">
            <button type="button" class="gm-btn gm-btn-muted" data-gm-remove-combatant="${escapeHtml(entry.key)}">REMOVE CHARACTER</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFacedownButtonState() {
    const button = document.getElementById('gm-facedown-btn');
    if (!button) return;
    button.disabled = getFacedownCombatants().length !== 2;
  }

  function buildCombatSummary() {
    if (!actionState.turnOrder.length) return null;
    const nextIndex = actionState.turnOrder.length > 1
      ? (actionState.liveTurnIndex + 1) % actionState.turnOrder.length
      : actionState.liveTurnIndex;
    return {
      activeKey: actionState.turnOrder[actionState.liveTurnIndex]?.key || '',
      nextKey: actionState.turnOrder[nextIndex]?.key || '',
      entries: actionState.turnOrder.map((entry, index) => {
        const combatant = getCombatantByKey(entry.key);
        const sourceType = combatant?.sourceType || (String(entry.key || '').startsWith('player:') ? 'player' : 'npc');
        return {
          key: entry.key,
          name: combatant?.name || entry.name || 'Unknown',
          career: combatant?.career || 'UNKNOWN',
          side: entry.side || 'ally',
          sourceType,
          total: Number(entry.total || 0),
          active: index === actionState.liveTurnIndex,
          next: index === nextIndex
        };
      })
    };
  }

  function publishCombatSummary() {
    const roomId = typeof window.getGMActiveRoomId === 'function'
      ? String(window.getGMActiveRoomId() || '').trim()
      : '';
    const summary = buildCombatSummary();
    const snapshot = summary ? JSON.stringify(summary) : '';

    if (lastPublishedCombatRoomId && lastPublishedCombatRoomId !== roomId && typeof clearCombatSummary === 'function') {
      clearCombatSummary(lastPublishedCombatRoomId).catch((error) => {
        console.warn('Failed to clear stale combat summary.', error);
      });
      lastPublishedCombatSummary = '';
    }

    if (!roomId) {
      lastPublishedCombatRoomId = '';
      lastPublishedCombatSummary = '';
      return;
    }

    if (!summary) {
      if (lastPublishedCombatSummary && typeof clearCombatSummary === 'function') {
        clearCombatSummary(roomId).catch((error) => {
          console.warn('Failed to clear combat summary.', error);
        });
      }
      lastPublishedCombatRoomId = roomId;
      lastPublishedCombatSummary = '';
      return;
    }

    if (roomId === lastPublishedCombatRoomId && snapshot === lastPublishedCombatSummary) return;
    lastPublishedCombatRoomId = roomId;
    lastPublishedCombatSummary = snapshot;
    if (typeof setCombatSummary === 'function') {
      setCombatSummary(roomId, summary).catch((error) => {
        console.warn('Failed to publish combat summary.', error);
      });
    }
  }

  function renderActionPlay() {
    normalizeActionState();
    renderActionPool();
    if (!renderCombatSetupBoard()) {
      renderAssignedList('ally', 'gm-ally-list', 'Drag characters here.');
      renderAssignedList('enemy', 'gm-enemy-list', 'Drag characters here.');
    }
    renderTurnOrder();
    renderFacedownButtonState();
    const clearButton = document.getElementById('gm-clear-action-btn');
    if (clearButton) {
      clearButton.disabled = !!actionState.turnOrder.length && isViewingHistoricalTurn();
    }
    if (actionState.initiativeModal?.open) {
      updateInitiativeModalFromMonitor();
      renderInitiativeModal();
    }
    if (actionState.facedownModal?.open) {
      updateFacedownModalFromMonitor();
      renderFacedownModal();
    }
    publishCombatSummary();
    window.dispatchEvent(new CustomEvent('gm-action-updated', {
      detail: {
        turnOrder: clone(actionState.turnOrder),
        currentTurnKey: actionState.turnOrder[actionState.liveTurnIndex]?.key || '',
        turnCombatants: getTurnCombatants()
      }
    }));
  }

  function renderTurnRollPanel(combatant, slotKey, className = '', options = {}) {
    const roll = options.rollOverride || (options.hideUntilTurnRoll && combatant?.sourceType === 'player'
      ? (actionState.manualRolls[combatant.combatKey] || combatant.lastRollVisible || null)
      : getCombatantVisibleRoll(combatant));
    const pending = !!combatant?.lastRollPending && !(roll && roll.dice);
    if (options.hideUntilTurnRoll) {
      const baseline = actionState.turnStartSnapshots[combatant?.combatKey || ''] || '';
      const snapshot = getRollSnapshot(roll);
      if (!snapshot || snapshot === baseline) {
        return `
          <div class="gm-roll-panel ${className}">
            <div class="gm-sheet-title">Last Roll</div>
            <div class="gm-roll-empty">${pending ? 'Roll incoming...' : 'Awaiting turn roll.'}</div>
          </div>
        `;
      }
    }
    if (!roll || !roll.dice) {
      return `
        <div class="gm-roll-panel ${className}">
          <div class="gm-sheet-title">Last Roll</div>
          <div class="gm-roll-empty">${pending ? 'Roll incoming...' : 'No roll yet.'}</div>
        </div>
      `;
    }
    const pool = Array.isArray(roll.pool) ? `[${roll.pool.join(', ')}]` : '[]';
    const modifiers = Number(roll.modifiers || 0);
    const modifierText = `${modifiers >= 0 ? '+' : ''}${modifiers}`;
    return `
      <div class="gm-roll-panel ${className}">
        <div class="gm-roll-head">
          <span class="gm-sheet-title">Last Roll</span>
          <span class="gm-roll-dice">${escapeHtml(roll.dice)}</span>
        </div>
        <div class="gm-roll-total" id="gm-turn-roll-total-${toId(slotKey)}">${escapeHtml(roll.raw ?? roll.total ?? '--')}</div>
        <div class="gm-roll-meta">
          <span>POOL ${escapeHtml(pool)}</span>
          <span>MOD ${escapeHtml(modifierText)}</span>
          <span>RAW ${escapeHtml(roll.raw ?? '--')}</span>
        </div>
      </div>
    `;
  }

  function animateTurnRoll(slotKey, combatant) {
    const roll = getCombatantVisibleRoll(combatant);
    if (!roll || !roll.dice) return;
    const node = document.getElementById(`gm-turn-roll-total-${toId(slotKey)}`);
    if (!node) return;
    const snapshot = `${roll.dice}|${roll.raw}|${roll.modifiers}|${roll.total}`;
    if (turnRollSnapshots[slotKey] === snapshot) {
      node.textContent = String(roll.total ?? '--');
      node.classList.remove('animating');
      return;
    }
    if (turnRollAnimFrames[slotKey]) cancelAnimationFrame(turnRollAnimFrames[slotKey]);
    const start = Number(roll.raw ?? 0);
    const end = Number(roll.total ?? 0);
    const startedAt = performance.now();
    const duration = 650;
    node.classList.add('animating');
    const tick = (now) => {
      const pct = Math.min(1, (now - startedAt) / duration);
      const value = Math.round(start + ((end - start) * pct));
      node.textContent = String(value);
      if (pct < 1) {
        turnRollAnimFrames[slotKey] = requestAnimationFrame(tick);
      } else {
        node.textContent = String(end);
        node.classList.remove('animating');
        turnRollAnimFrames[slotKey] = null;
        turnRollSnapshots[slotKey] = snapshot;
      }
    };
    turnRollAnimFrames[slotKey] = requestAnimationFrame(tick);
  }

  function openActionConfirmModal(title, message, onConfirm) {
    confirmModalAction = onConfirm;
    const titleNode = document.getElementById('gm-action-confirm-title');
    const messageNode = document.getElementById('gm-action-confirm-message');
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
    document.getElementById('gm-action-confirm-modal')?.classList.add('show');
  }

  function closeActionConfirmModal() {
    confirmModalAction = null;
    document.getElementById('gm-action-confirm-modal')?.classList.remove('show');
  }

  function acceptActionConfirmModal() {
    if (typeof confirmModalAction === 'function') confirmModalAction();
    closeActionConfirmModal();
  }

  function purgeCombatantFromCombat(key) {
    const removedIndex = actionState.turnOrder.findIndex((item) => item.key === key);
    actionState.ally = actionState.ally.filter((item) => item !== key);
    actionState.enemy = actionState.enemy.filter((item) => item !== key);
    actionState.boardOpposition = actionState.boardOpposition.filter((item) => item !== key);
    Object.keys(actionState.boardOppositionByTurn).forEach((turnKey) => {
      actionState.boardOppositionByTurn[turnKey] = (actionState.boardOppositionByTurn[turnKey] || []).filter((item) => item !== key);
      if (!actionState.boardOppositionByTurn[turnKey].length) delete actionState.boardOppositionByTurn[turnKey];
    });
    actionState.turnOrder = actionState.turnOrder.filter((item) => item.key !== key);
    delete actionState.manualRolls[key];
    delete actionState.turnStartSnapshots[key];
    delete actionState.facedownPenaltyByKey[key];
    if (removedIndex !== -1) {
      if (removedIndex < actionState.currentTurnIndex) actionState.currentTurnIndex -= 1;
      if (removedIndex < actionState.liveTurnIndex) actionState.liveTurnIndex -= 1;
    }
    if (actionState.currentTurnIndex >= actionState.turnOrder.length) actionState.currentTurnIndex = Math.max(0, actionState.turnOrder.length - 1);
    if (actionState.liveTurnIndex >= actionState.turnOrder.length) actionState.liveTurnIndex = Math.max(0, actionState.turnOrder.length - 1);
  }

  function buildNpcInitiativeResult(combatant) {
    const raw = Math.floor(Math.random() * 10) + 1;
    const ref = getRefStat(combatant);
    const penalty = Number(actionState.facedownPenaltyByKey[combatant?.combatKey] || 0);
    const modifiers = ref + penalty;
    return {
      ready: true,
      raw,
      modifiers,
      total: raw + modifiers,
      status: 'READY',
      breakdown: `1D10 RAW ${raw} + REF ${ref}${penalty ? ` ${penalty < 0 ? '-' : '+'} ${Math.abs(penalty)} FACEDOWN` : ''}`
    };
  }

  function openInitiativeModal() {
    const combatants = getAssignedCombatants();
    if (!combatants.length) {
      const note = document.getElementById('gm-turn-note');
      if (note) note.textContent = 'Add combatants to Combat Setup first.';
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
    Object.values(initiativeRevealTimers).forEach((timer) => clearTimeout(timer));
    Object.keys(initiativeRevealTimers).forEach((key) => delete initiativeRevealTimers[key]);
    actionState.initiativeModal = null;
    document.getElementById('gm-initiative-modal')?.classList.remove('show');
  }

  function buildFacedownNpcResult(combatant) {
    const raw = Math.floor(Math.random() * 10) + 1;
    const cool = Array.isArray(combatant?.stats)
      ? (parseInt(combatant.stats.find((entry) => String(entry?.label || '').trim().toUpperCase() === 'COOL')?.value, 10) || 0)
      : 0;
    const reputation = parseInt(combatant?.reputation, 10) || 0;
    return {
      ready: true,
      raw,
      modifiers: cool + reputation,
      total: raw + cool + reputation,
      status: 'READY',
      breakdown: `1D10 RAW ${raw} + COOL ${cool} + REP ${reputation}`
    };
  }

  function getFacedownLoser(modal = actionState.facedownModal) {
    const combatants = Array.isArray(modal?.combatants) ? modal.combatants : [];
    const results = modal?.results || {};
    if (combatants.length !== 2) return null;
    const [a, b] = combatants;
    const resultA = results[a.combatKey];
    const resultB = results[b.combatKey];
    if (!resultA?.ready || !resultB?.ready || resultA.total === resultB.total) return null;
    return resultA.total < resultB.total ? a : b;
  }

  function clearFacedownPromptWatch() {
    if (typeof facedownPromptUnsubscribe === 'function') facedownPromptUnsubscribe();
    facedownPromptUnsubscribe = null;
  }

  async function ensurePlayerFacedownPrompt(modal = actionState.facedownModal) {
    const loser = getFacedownLoser(modal);
    if (!modal?.open || !loser || loser.sourceType !== 'player' || modal.playerChoice?.promptId) return;
    const roomId = typeof window.getGMActiveRoomId === 'function' ? String(window.getGMActiveRoomId() || '').trim() : '';
    const clientId = String(loser.id || loser.clientId || loser.combatKey || '').replace(/^player:/, '');
    if (!roomId || !clientId || typeof sendPlayerPrompt !== 'function' || typeof watchPlayerPrompt !== 'function') {
      modal.playerChoice = {
        targetKey: loser.combatKey,
        clientId,
        status: 'unavailable',
        label: 'Unable to contact player dossier.'
      };
      return;
    }
    const promptId = `facedown-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    modal.playerChoice = {
      targetKey: loser.combatKey,
      clientId,
      promptId,
      status: 'pending',
      label: `Waiting for ${loser.name || 'player'} to choose on dossier...`
    };
    clearFacedownPromptWatch();
    facedownPromptUnsubscribe = watchPlayerPrompt(roomId, async (prompt) => {
      if (!actionState.facedownModal?.open || actionState.facedownModal?.playerChoice?.promptId !== promptId) return;
      if (!prompt || prompt.promptId !== promptId || prompt.status !== 'answered' || !prompt.response?.choice) return;
      actionState.facedownModal.playerChoice = {
        ...actionState.facedownModal.playerChoice,
        status: 'answered',
        choice: prompt.response.choice,
        label: `${loser.name || 'Player'} chose ${String(prompt.response.choice).toUpperCase()}.`
      };
      renderFacedownModal();
      try {
        if (typeof clearPlayerPrompt === 'function') await clearPlayerPrompt(roomId, clientId);
      } catch (error) {
        console.warn('Failed to clear player facedown prompt.', error);
      }
      clearFacedownPromptWatch();
      if (prompt.response.choice === 'backoff') {
        resolveFacedownBackoff(loser.combatKey);
      } else if (prompt.response.choice === 'stay') {
        actionState.facedownPenaltyByKey[loser.combatKey] = Number(prompt.penalty || -3);
        closeFacedownModal();
        openInitiativeModal();
      }
    }, clientId);
    try {
      await sendPlayerPrompt(roomId, clientId, {
        type: 'facedown-choice',
        promptId,
        loserName: loser.name || 'Player',
        penalty: -3,
        createdAt: Date.now()
      });
    } catch (error) {
      modal.playerChoice = {
        ...modal.playerChoice,
        status: 'send-failed',
        label: `Prompt failed: ${error.message}`
      };
      clearFacedownPromptWatch();
      renderFacedownModal();
    }
  }

  function openFacedownModal() {
    const combatants = getFacedownCombatants();
    if (combatants.length !== 2) return;
    const baselineSnapshots = {};
    const results = {};
    combatants.forEach((combatant) => {
      if (combatant.sourceType === 'npc') {
        results[combatant.combatKey] = buildFacedownNpcResult(combatant);
      } else {
        baselineSnapshots[combatant.combatKey] = getRollSnapshot(combatant.lastRollVisible || null);
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

    actionState.facedownModal = {
      open: true,
      combatants,
      baselineSnapshots,
      results,
      playerChoice: null
    };

    document.getElementById('gm-facedown-modal')?.classList.add('show');
    renderFacedownModal();
    Object.entries(results).forEach(([key, result]) => {
      if (result.ready) {
        setTimeout(() => animateInitiativeValue(`facedown-${key}`, result.raw, result.total), 80);
      }
    });
  }

  function closeFacedownModal() {
    const modal = actionState.facedownModal;
    const roomId = typeof window.getGMActiveRoomId === 'function' ? String(window.getGMActiveRoomId() || '').trim() : '';
    const promptId = modal?.playerChoice?.promptId;
    const clientId = modal?.playerChoice?.clientId;
    Object.keys(initiativeRevealTimers)
      .filter((key) => key.startsWith('facedown-'))
      .forEach((key) => {
        clearTimeout(initiativeRevealTimers[key]);
        delete initiativeRevealTimers[key];
    });
    clearFacedownPromptWatch();
    if (roomId && clientId && promptId && typeof clearPlayerPrompt === 'function') {
      clearPlayerPrompt(roomId, clientId).catch((error) => {
        console.warn('Failed to clear player prompt while closing facedown modal.', error);
      });
    }
    actionState.facedownModal = null;
    document.getElementById('gm-facedown-modal')?.classList.remove('show');
    window.dispatchEvent(new CustomEvent('gm-facedown-updated', {
      detail: null
    }));
  }

  function updateFacedownModalFromMonitor() {
    const modal = actionState.facedownModal;
    if (!modal?.open) return;
    const combatMap = getCombatantMap();
    modal.combatants = modal.combatants
      .map((entry) => combatMap.get(entry.combatKey) || entry)
      .filter(Boolean);

    modal.combatants.forEach((combatant) => {
      if (combatant.sourceType !== 'player') return;
      const result = modal.results[combatant.combatKey];
      if (!result || result.ready || result.pendingReveal) return;
      const roll = combatant.lastRollVisible || null;
      const snapshot = getRollSnapshot(roll);
      if (!snapshot || snapshot === modal.baselineSnapshots[combatant.combatKey]) return;
      modal.results[combatant.combatKey] = {
        ...result,
        pendingReveal: true,
        status: 'SYNCING WITH PLAYER CINEMA',
        breakdown: 'Waiting for player dice animation to finish...'
      };
      renderFacedownModal();
      clearTimeout(initiativeRevealTimers[`facedown-${combatant.combatKey}`]);
      initiativeRevealTimers[`facedown-${combatant.combatKey}`] = setTimeout(() => {
        if (!actionState.facedownModal?.open) return;
        const liveCombatant = getCombatantByKey(combatant.combatKey) || combatant;
        const liveRoll = liveCombatant.lastRollVisible || null;
        if (!liveRoll) return;
        modal.results[combatant.combatKey] = {
          ready: true,
          pendingReveal: false,
          raw: Number(liveRoll.raw || 0),
          modifiers: Number(liveRoll.modifiers || 0),
          total: Number(liveRoll.total || 0),
          status: 'READY',
          breakdown: `${liveRoll.dice} RAW ${liveRoll.raw ?? 0} ${Number(liveRoll.modifiers || 0) >= 0 ? '+' : ''}${liveRoll.modifiers || 0}`
        };
        delete initiativeRevealTimers[`facedown-${combatant.combatKey}`];
        renderFacedownModal();
        animateInitiativeValue(`facedown-${combatant.combatKey}`, Number(liveRoll.raw || 0), Number(liveRoll.total || 0));
      }, INITIATIVE_PLAYER_REVEAL_DELAY_MS);
    });
  }

  function renderFacedownModal() {
    const modal = actionState.facedownModal;
    const list = document.getElementById('gm-facedown-list');
    const confirmButton = document.getElementById('gm-facedown-confirm');
    if (!list || !confirmButton) return;
    if (!modal?.open) {
      list.innerHTML = '<div class="gm-empty">Exactly two combatants are required.</div>';
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
          <div class="gm-initiative-total" id="gm-init-total-${toId(`facedown-${combatant.combatKey}`)}">${escapeHtml(isReady ? result.total : '--')}</div>
          <div class="gm-initiative-meta">${escapeHtml(result?.breakdown || '--')}</div>
        </div>
      `;
    }).join('');

    if (modal.combatants.every((combatant) => modal.results[combatant.combatKey]?.ready)) {
      ensurePlayerFacedownPrompt(modal);
    }
    confirmButton.disabled = modal.combatants.some((combatant) => !modal.results[combatant.combatKey]?.ready);
    window.dispatchEvent(new CustomEvent('gm-facedown-updated', {
      detail: clone(modal)
    }));
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
      if (!result || result.ready || result.pendingReveal) return;
      const roll = combatant.lastRollVisible || combatant.lastRoll || null;
      const snapshot = getRollSnapshot(roll);
      if (!snapshot || snapshot === modal.baselineSnapshots[combatant.combatKey]) return;
      modal.results[combatant.combatKey] = {
        ...result,
        pendingReveal: true,
        status: 'SYNCING WITH PLAYER CINEMA',
        breakdown: 'Waiting for player dice animation to finish...'
      };
      renderInitiativeModal();
      clearTimeout(initiativeRevealTimers[combatant.combatKey]);
      initiativeRevealTimers[combatant.combatKey] = setTimeout(() => {
        if (!actionState.initiativeModal?.open) return;
        const liveCombatant = getCombatantByKey(combatant.combatKey) || combatant;
        const liveRoll = liveCombatant.lastRollVisible || liveCombatant.lastRoll || roll;
        modal.results[combatant.combatKey] = {
          ready: true,
          pendingReveal: false,
          raw: Number(liveRoll.raw || 0),
          modifiers: Number(liveRoll.modifiers || 0),
          total: Number(liveRoll.total || 0),
          status: 'READY',
          breakdown: `${liveRoll.dice} RAW ${liveRoll.raw ?? 0} ${Number(liveRoll.modifiers || 0) >= 0 ? '+' : ''}${liveRoll.modifiers || 0}`
        };
        delete initiativeRevealTimers[combatant.combatKey];
        renderInitiativeModal();
        animateInitiativeValue(combatant.combatKey, Number(liveRoll.raw || 0), Number(liveRoll.total || 0));
      }, INITIATIVE_PLAYER_REVEAL_DELAY_MS);
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
    actionState.liveTurnIndex = 0;
    closeInitiativeModal();
    actionState.manualRolls = {};
    actionState.boardOpposition = [];
    actionState.boardOppositionByTurn = {};
    actionState.turnStartSnapshots = {};
    markLiveTurnBaseline();
    renderActionPlay();
  }

  function moveTurn(delta) {
    if (!actionState.turnOrder.length) return;
    const length = actionState.turnOrder.length;
    if (delta < 0) {
      actionState.currentTurnIndex = Math.max(0, actionState.currentTurnIndex - 1);
      renderActionPlay();
      return;
    }

    if (isViewingHistoricalTurn()) {
      actionState.currentTurnIndex = Math.min(actionState.liveTurnIndex, actionState.currentTurnIndex + 1);
      renderActionPlay();
      return;
    }

    captureTurnRollHistory(actionState.liveTurnIndex);
    const nextIndex = (actionState.liveTurnIndex + 1 + length) % length;
    if (nextIndex === 0) {
      actionState.boardOppositionByTurn = {};
      actionState.turnStartSnapshots = {};
      actionState.turnRollHistoryByTurn = {};
    }
    actionState.liveTurnIndex = nextIndex;
    actionState.currentTurnIndex = actionState.liveTurnIndex;
    markLiveTurnBaseline();
    renderActionPlay();
  }

  function removeCombatantFromCombat(key) {
    const entry = actionState.turnOrder.find((item) => item.key === key) || getCombatantByKey(key);
    if (!entry) return;
    openActionConfirmModal(
      'REMOVE CHARACTER',
      `Remove ${entry.name || 'this character'} from combat?`,
      () => {
        purgeCombatantFromCombat(key);
        markLiveTurnBaseline();
        renderActionPlay();
      }
    );
  }

  function resolveFacedownBackoff(key) {
    if (!key) return;
    purgeCombatantFromCombat(key);
    closeFacedownModal();
    markLiveTurnBaseline();
    renderActionPlay();
  }

  function resolveFacedownStayStrong() {
    const modal = actionState.facedownModal;
    if (modal?.combatants?.length === 2) {
      const [a, b] = modal.combatants;
      const resultA = modal.results?.[a.combatKey];
      const resultB = modal.results?.[b.combatKey];
      if (resultA?.ready && resultB?.ready && resultA.total !== resultB.total) {
        const loser = resultA.total < resultB.total ? a : b;
        if (loser?.sourceType === 'npc') {
          actionState.facedownPenaltyByKey[loser.combatKey] = -3;
        }
      }
    }
    closeFacedownModal();
    openInitiativeModal();
  }

  function endCombat() {
    openActionConfirmModal(
      'END COMBAT',
      'End combat and clear Combat Setup and the turn list?',
      () => {
        actionState.ally = [];
        actionState.enemy = [];
        actionState.boardOpposition = [];
        actionState.boardOppositionByTurn = {};
        actionState.turnRollHistoryByTurn = {};
        actionState.facedownPenaltyByKey = {};
        actionState.turnOrder = [];
        actionState.currentTurnIndex = 0;
        actionState.liveTurnIndex = 0;
        actionState.manualRolls = {};
        actionState.turnStartSnapshots = {};
        closeInitiativeModal();
        renderActionPlay();
      }
    );
  }

  function clearAssignedCharacters() {
    if (!actionState.turnOrder.length && !actionState.ally.length && !actionState.enemy.length) return;
    if (actionState.turnOrder.length && isViewingHistoricalTurn()) {
      const note = document.getElementById('gm-turn-note');
      if (note) note.textContent = 'Previous turns are locked. Return to the live turn to edit Combat Setup.';
      return;
    }
    if (actionState.turnOrder.length && !getBoardOppositionForIndex(actionState.liveTurnIndex).length) return;
    openActionConfirmModal(
      'CLEAR CHARACTERS',
      actionState.turnOrder.length
        ? 'Clear only the current Combat Setup board?'
        : 'Clear all characters from Combat Setup?',
      () => {
        if (actionState.turnOrder.length) {
          setBoardOppositionForIndex(actionState.liveTurnIndex, []);
        } else {
          actionState.ally = [];
          actionState.enemy = [];
        }
        renderActionPlay();
      }
    );
  }

  function switchGMTab(tabName) {
    document.querySelectorAll('.gm-tab-btn').forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-gm-tab') === tabName);
    });
    document.querySelectorAll('.gm-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `gm-tab-${tabName}`);
    });
    if (tabName !== 'action' && typeof window.closeGMActionDrawer === 'function') {
      window.closeGMActionDrawer();
    }
  }

  function wireDropZone(node) {
    if (!node) return;
    node.addEventListener('dragover', (event) => {
      if (actionState.turnOrder.length && isViewingHistoricalTurn()) return;
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
      if (actionState.turnOrder.length) {
        if (isViewingHistoricalTurn()) {
          actionState.draggedKey = '';
          return;
        }
        if (node.id === 'gm-drop-enemy') addCombatantToBoardOpposition(key);
      } else {
        const side = getCombatDropSide(node);
        assignCombatantToSide(key, side);
      }
      actionState.draggedKey = '';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.getGMActiveCombatant = () => {
      const active = getActiveCombatant();
      return active ? clone(active) : null;
    };
    window.getGMTurnCombatants = () => getTurnCombatants().map((combatant) => clone(combatant));
    window.getGMCurrentTurnKey = () => actionState.turnOrder[actionState.liveTurnIndex]?.key || '';
    window.getGMCombatPenalty = (key) => Number(actionState.facedownPenaltyByKey[key] || 0);
    window.applyGMCombatantRoll = (key, roll) => applyManualRollToCombatant(key, roll);
    window.getGMFacedownState = () => actionState.facedownModal ? clone(actionState.facedownModal) : null;
    window.resolveGMFacedownBackoff = resolveFacedownBackoff;
    window.resolveGMFacedownStayStrong = resolveFacedownStayStrong;
    window.openGMInitiativeModal = openInitiativeModal;

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
    document.getElementById('gm-facedown-btn')?.addEventListener('click', openFacedownModal);
    document.getElementById('gm-clear-action-btn')?.addEventListener('click', clearAssignedCharacters);
    document.getElementById('gm-prev-turn-btn')?.addEventListener('click', () => moveTurn(-1));
    document.getElementById('gm-next-turn-btn')?.addEventListener('click', () => moveTurn(1));
    document.getElementById('gm-end-combat-btn')?.addEventListener('click', endCombat);
    document.getElementById('gm-initiative-cancel')?.addEventListener('click', closeInitiativeModal);
    document.getElementById('gm-initiative-confirm')?.addEventListener('click', confirmInitiativeOrder);
    document.getElementById('gm-initiative-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeInitiativeModal();
    });
    document.getElementById('gm-facedown-cancel')?.addEventListener('click', closeFacedownModal);
    document.getElementById('gm-facedown-confirm')?.addEventListener('click', closeFacedownModal);
    document.getElementById('gm-facedown-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeFacedownModal();
    });
    document.getElementById('gm-action-confirm-cancel')?.addEventListener('click', closeActionConfirmModal);
    document.getElementById('gm-action-confirm-accept')?.addEventListener('click', acceptActionConfirmModal);
    document.getElementById('gm-action-confirm-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeActionConfirmModal();
    });

    document.addEventListener('click', (event) => {
      const combatRollButton = event.target.closest('[data-gm-combat-roll-value]');
      if (combatRollButton && typeof window.addGMRollModifier === 'function') {
        const source = combatRollButton.getAttribute('data-gm-combat-roll-source') || 'Combat';
        const label = combatRollButton.getAttribute('data-gm-combat-roll-label') || 'Value';
        const value = parseInt(combatRollButton.getAttribute('data-gm-combat-roll-value'), 10);
        if (Number.isFinite(value)) {
          window.addGMRollModifier(source, label, value);
        }
        return;
      }

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
