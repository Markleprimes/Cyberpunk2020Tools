(function initGMPage() {
  let activeRef = null;
  let activeHandler = null;
  const gmRollStateByClient = {};
  const gmDelayedRollsByClient = {};

  function setGMStatusVisual(status) {
    const chip = document.getElementById('gm-status-chip');
    if (!chip) return;
    chip.textContent = status.toUpperCase();
    chip.className = `gm-status-chip ${status}`;
  }

  function setGMStatus(message) {
    const node = document.getElementById('gm-status');
    if (node) node.textContent = message;
  }

  function setGMLastUpdated(value) {
    const node = document.getElementById('gm-updated');
    if (!node) return;
    if (!value) {
      node.textContent = '--';
      return;
    }
    const date = new Date(value);
    node.textContent = Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function renderGMPlayers(data) {
    const playerNode = document.getElementById('gm-player-list');
    const npcNode = document.getElementById('gm-npc-list');
    if (!playerNode || !npcNode) return;
    const entries = Object.entries(data || {}).map(([id, entry]) => ({ id, ...(entry || {}) }));
    const players = entries.filter((entry) => (entry.role || 'player') !== 'npc');
    const npcs = entries.filter((entry) => (entry.role || 'player') === 'npc');

    if (!players.length) {
      playerNode.innerHTML = '<div class="gm-empty">No players linked yet.</div>';
    } else {
      playerNode.innerHTML = players.map((player) => renderGMEntry(player.id, player)).join('');
    }

    if (!npcs.length) {
      npcNode.innerHTML = '<div class="gm-empty">No NPC links yet.</div>';
    } else {
      npcNode.innerHTML = npcs.map((npc) => renderGMEntry(npc.id, npc)).join('');
    }

    animateGMRollPanels(entries);
  }

  function renderGMEntry(clientId, entry) {
    return `
      <div class="gm-player-card gm-player-detail">
        <div class="gm-player-summary">
          <div class="gm-player-name">${escapeGMValue(entry.name || 'Unknown')}</div>
          <div class="gm-player-meta">${escapeGMValue(entry.career || 'UNKNOWN')} // ${escapeGMValue((entry.role || 'player').toUpperCase())}</div>
        </div>
        <div class="gm-player-sheet">
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Stats</div>
              ${renderGMKeyValueLines(entry.stats)}
            </div>
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Skill</div>
              ${renderGMKeyValueLines(entry.skills)}
            </div>
          </div>
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Dossier</div>
              ${renderGMKeyValueLines({
                Reputation: entry.reputation ?? 0,
                Wallet: entry.wallet ?? 0
              })}
            </div>
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Physical</div>
              ${renderGMKeyValueLines({
                BodyLevel: entry.physical?.bodyLevel ?? 0,
                Weight: entry.physical?.weight ?? 0,
                Stun: entry.physical?.stun ?? 0
              })}
            </div>
          </div>
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Inventory</div>
              ${renderGMItemList(entry.inventory)}
            </div>
          </div>
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Armor & Damage</div>
              ${renderGMArmorDamageTable(entry.armor, entry.damage)}
            </div>
          </div>
          ${renderGMRollPanel(clientId, entry.lastRollVisible || null, entry.lastRollPending)}
        </div>
      </div>
    `;
  }

  function escapeGMValue(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderGMKeyValueLines(block) {
    const entries = Array.isArray(block)
      ? block.map((entry) => [entry?.label, entry?.value])
      : Object.entries(block || {});
    if (!entries.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return entries.map(([key, value]) => `
      <div class="gm-sheet-line">
        <span class="gm-sheet-key">${escapeGMValue(key)}:</span>
        <span class="gm-sheet-val">${escapeGMValue(value)}</span>
      </div>
    `).join('');
  }

  function renderGMRollSummary(lastRoll) {
    if (!lastRoll || !lastRoll.dice) return '--';
    const pool = Array.isArray(lastRoll.pool) ? `[${lastRoll.pool.join(', ')}]` : '[]';
    const mod = Number(lastRoll.modifiers || 0);
    return escapeGMValue(`${lastRoll.dice} ${pool} +${mod} => ${lastRoll.total ?? lastRoll.raw ?? '--'}`);
  }

  function renderGMArmorDamageTable(armor, damage) {
    const armorMap = new Map((Array.isArray(armor) ? armor : []).map((entry) => [entry?.label, entry?.value]));
    const damageMap = new Map((Array.isArray(damage) ? damage : []).map((entry) => [entry?.label, entry?.value]));
    const limbs = ['Head', 'Torso', 'R.Arm', 'L.Arm', 'R.Leg', 'L.Leg'];
    return `
      <table class="gm-ad-table">
        <thead>
          <tr>
            <th>Limb</th>
            <th>Armor</th>
            <th>Damage</th>
          </tr>
        </thead>
        <tbody>
          ${limbs.map((limb) => `
            <tr>
              <td>${escapeGMValue(limb)}</td>
              <td>${escapeGMValue(armorMap.get(limb) ?? 0)}</td>
              <td>${escapeGMValue(damageMap.get(limb) ?? 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderGMRollPanel(clientId, lastRoll, isPending = false) {
    if (!lastRoll || !lastRoll.dice) {
      return `
        <div class="gm-roll-panel">
          <div class="gm-sheet-title">Last Roll</div>
          <div class="gm-roll-empty">${isPending ? 'Roll incoming...' : 'No roll yet.'}</div>
        </div>
      `;
    }
    const pool = Array.isArray(lastRoll.pool) ? `[${lastRoll.pool.join(', ')}]` : '[]';
    const modifiers = Number(lastRoll.modifiers || 0);
    const modifierText = `${modifiers >= 0 ? '+' : ''}${modifiers}`;
    return `
      <div class="gm-roll-panel">
        <div class="gm-roll-head">
          <span class="gm-sheet-title">Last Roll</span>
          <span class="gm-roll-dice">${escapeGMValue(lastRoll.dice)}</span>
        </div>
        <div class="gm-roll-total" id="gm-roll-total-${escapeGMValue(clientId)}" data-roll-client="${escapeGMValue(clientId)}" data-roll-raw="${escapeGMValue(lastRoll.raw ?? 0)}" data-roll-total="${escapeGMValue(lastRoll.total ?? 0)}">${escapeGMValue(lastRoll.raw ?? lastRoll.total ?? '--')}</div>
        <div class="gm-roll-meta">
          <span>POOL ${escapeGMValue(pool)}</span>
          <span>MOD ${escapeGMValue(modifierText)}</span>
          <span>RAW ${escapeGMValue(lastRoll.raw ?? '--')}</span>
        </div>
      </div>
    `;
  }

  function animateGMRollPanels(entries) {
    entries.forEach((entry) => {
      const lastRoll = entry.lastRollVisible || null;
      if (!lastRoll || !lastRoll.dice) return;
      const node = document.getElementById(`gm-roll-total-${entry.id}`);
      if (!node) return;
      const snapshot = `${lastRoll.dice}|${lastRoll.raw}|${lastRoll.modifiers}|${lastRoll.total}`;
      const prevState = gmRollStateByClient[entry.id];
      if (prevState?.animationFrame) {
        cancelAnimationFrame(prevState.animationFrame);
      }
      if (prevState?.displayedSnapshot === snapshot) {
        node.textContent = String(lastRoll.total ?? '--');
        node.classList.remove('animating');
        gmRollStateByClient[entry.id] = {
          ...(gmRollStateByClient[entry.id] || {}),
          displayedSnapshot: snapshot,
          animationFrame: null
        };
        return;
      }

      const start = Number(lastRoll.raw ?? 0);
      const end = Number(lastRoll.total ?? 0);
      const duration = 650;
      const startedAt = performance.now();
      node.classList.add('animating');

      const tick = (now) => {
        const pct = Math.min(1, (now - startedAt) / duration);
        const value = Math.round(start + ((end - start) * pct));
        node.textContent = String(value);
        if (pct < 1) {
          const frame = requestAnimationFrame(tick);
          gmRollStateByClient[entry.id] = {
            ...(gmRollStateByClient[entry.id] || {}),
            animationFrame: frame
          };
        } else {
          node.textContent = String(end);
          node.classList.remove('animating');
          gmRollStateByClient[entry.id] = {
            ...(gmRollStateByClient[entry.id] || {}),
            displayedSnapshot: snapshot,
            animationFrame: null
          };
        }
      };

      const frame = requestAnimationFrame(tick);
      gmRollStateByClient[entry.id] = {
        ...(gmRollStateByClient[entry.id] || {}),
        animationFrame: frame
      };
    });
  }

  function renderGMItemList(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return list.map((item) => {
      const name = typeof item === 'string' ? item : item?.name;
      const type = typeof item === 'string' ? 'Item' : (item?.type || 'Item');
      const description = typeof item === 'string' ? '--' : (item?.description || '--');
      return `
      <div class="gm-sheet-line gm-sheet-line-stack">
        <span class="gm-sheet-key">${escapeGMValue(type)}:</span>
        <span class="gm-sheet-val gm-sheet-val-wrap">${escapeGMValue(name || '--')} // ${escapeGMValue(description)}</span>
      </div>
    `;
    }).join('');
  }

  function disconnectGMRoom() {
    if (activeRef && activeHandler) {
      activeRef.off('value', activeHandler);
    }
    Object.values(gmDelayedRollsByClient).forEach((timer) => clearTimeout(timer));
    Object.keys(gmDelayedRollsByClient).forEach((key) => delete gmDelayedRollsByClient[key]);
    activeRef = null;
    activeHandler = null;
  }

  function createRenderSafeEntry(id, entry) {
    const copy = JSON.parse(JSON.stringify(entry || {}));
    const roll = copy.lastRoll || null;
    if (!roll || !roll.dice) {
      copy.lastRollVisible = null;
      copy.lastRollPending = false;
      return copy;
    }
    const snapshot = `${roll.dice}|${roll.raw}|${roll.modifiers}|${roll.total}`;
    if (gmRollStateByClient[id]?.snapshot === snapshot) {
      copy.lastRollVisible = roll;
      copy.lastRollPending = false;
      return copy;
    }
    copy.lastRollVisible = gmRollStateByClient[id]?.visibleRoll || null;
    copy.lastRollPending = true;
    return copy;
  }

  function scheduleGMRollReveal(roomId, id, roll, onApply) {
    if (!roll || !roll.dice) return;
    const snapshot = `${roll.dice}|${roll.raw}|${roll.modifiers}|${roll.total}`;
    if (gmRollStateByClient[id]?.snapshot === snapshot) return;
    clearTimeout(gmDelayedRollsByClient[id]);
    gmDelayedRollsByClient[id] = setTimeout(() => {
      gmRollStateByClient[id] = {
        ...(gmRollStateByClient[id] || {}),
        snapshot,
        visibleRoll: roll
      };
      delete gmDelayedRollsByClient[id];
      onApply();
      setGMStatus(`Roll reveal applied from "${roomId}".`);
      setGMStatusVisual('connected');
    }, 5000);
  }

  function applyGMRoomData(roomId, data) {
    const rawEntries = Object.entries(data || {}).map(([id, entry]) => ({ id, ...(entry || {}) }));
    if (!rawEntries.length) {
      setGMStatus(`Connected to "${roomId}" but no players are linked yet.`);
      setGMStatusVisual('connected');
      renderGMPlayers(null);
      setGMLastUpdated(null);
      return;
    }

    rawEntries.forEach((entry) => {
      scheduleGMRollReveal(roomId, entry.id, entry.lastRoll || null, () => applyGMRoomData(roomId, data));
    });

    const renderEntries = rawEntries.map((entry) => ({
      id: entry.id,
      ...entry,
      ...createRenderSafeEntry(entry.id, entry)
    }));

    const lastUpdated = rawEntries.reduce((latest, entry) => Math.max(latest, entry.updatedAt || entry.joinedAt || 0), 0);
    const pendingRoll = renderEntries.some((entry) => entry.lastRollPending);
    setGMStatus(pendingRoll
      ? `Live data received from "${roomId}". Roll reveal pending 5 seconds.`
      : `Live data received from "${roomId}".`);
    setGMStatusVisual(pendingRoll ? 'pending' : 'connected');
    renderGMPlayers(renderEntries);
    setGMLastUpdated(lastUpdated || null);
  }

  function connectGMRoom() {
    const roomId = (document.getElementById('gm-room-id')?.value || 'test-room').trim() || 'test-room';
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) {
      setGMStatus('Firebase failed to initialize.');
      setGMStatusVisual('disconnected');
      return;
    }

    disconnectGMRoom();
    setGMStatus(`Listening to room "${roomId}"...`);
    setGMStatusVisual('pending');
    renderGMPlayers(null);
    setGMLastUpdated(null);

    activeRef = roomRef.child('players');
    activeHandler = (snapshot) => {
      const data = snapshot.val();
      applyGMRoomData(roomId, data);
    };

    activeRef.on('value', activeHandler, (error) => {
      setGMStatus(`Firebase listen error: ${error.message}`);
      setGMStatusVisual('disconnected');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initFirebaseRealtime();
    const connectButton = document.getElementById('gm-connect-btn');
    if (connectButton) {
      connectButton.addEventListener('click', connectGMRoom);
    }

    const roomInput = document.getElementById('gm-room-id');
    if (roomInput) {
      roomInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') connectGMRoom();
      });
    }

    setGMStatusVisual('disconnected');
  });
})();
