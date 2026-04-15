(function initGMPage() {
  let activeRef = null;
  let activeHandler = null;

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
    const entries = Object.values(data || {});
    const players = entries.filter((entry) => (entry.role || 'player') !== 'npc');
    const npcs = entries.filter((entry) => (entry.role || 'player') === 'npc');

    if (!players.length) {
      playerNode.innerHTML = '<div class="gm-empty">No players linked yet.</div>';
    } else {
      playerNode.innerHTML = players.map((player) => renderGMEntry(player)).join('');
    }

    if (!npcs.length) {
      npcNode.innerHTML = '<div class="gm-empty">No NPC links yet.</div>';
    } else {
      npcNode.innerHTML = npcs.map((npc) => renderGMEntry(npc)).join('');
    }
  }

  function renderGMEntry(entry) {
    return `
      <details class="gm-player-card gm-player-detail">
        <summary class="gm-player-summary">
          <div class="gm-player-name">${escapeGMValue(entry.name || 'Unknown')}</div>
          <div class="gm-player-meta">${escapeGMValue(entry.career || 'UNKNOWN')} // ${escapeGMValue((entry.role || 'player').toUpperCase())}</div>
        </summary>
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
                Upgrade: entry.upgradePoints ?? 0,
                Reputation: entry.reputation ?? 0,
                Wallet: entry.wallet ?? 0
              })}
            </div>
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Inventory</div>
              ${renderGMInventoryLines(entry.inventory)}
            </div>
          </div>
          <div class="gm-sheet-roll">
            <span class="gm-sheet-title">Last Roll</span>
            <span class="gm-sheet-roll-value">${renderGMRollSummary(entry.lastRoll)}</span>
          </div>
        </div>
      </details>
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

  function renderGMInventoryLines(block) {
    const entries = Array.isArray(block)
      ? block.map((entry) => [entry?.label, entry?.value])
      : Object.entries(block || {});
    if (!entries.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return entries.map(([category, items]) => `
      <div class="gm-sheet-line gm-sheet-line-stack">
        <span class="gm-sheet-key">${escapeGMValue(category)}:</span>
        <span class="gm-sheet-val gm-sheet-val-wrap">${escapeGMValue(items || '--')}</span>
      </div>
    `).join('');
  }

  function renderGMRollSummary(lastRoll) {
    if (!lastRoll || !lastRoll.dice) return '--';
    const pool = Array.isArray(lastRoll.pool) ? `[${lastRoll.pool.join(', ')}]` : '[]';
    const mod = Number(lastRoll.modifiers || 0);
    return escapeGMValue(`${lastRoll.dice} ${pool} +${mod} => ${lastRoll.total ?? lastRoll.raw ?? '--'}`);
  }

  function disconnectGMRoom() {
    if (activeRef && activeHandler) {
      activeRef.off('value', activeHandler);
    }
    activeRef = null;
    activeHandler = null;
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
      if (!data || !Object.keys(data).length) {
        setGMStatus(`Connected to "${roomId}" but no players are linked yet.`);
        setGMStatusVisual('connected');
        renderGMPlayers(null);
        setGMLastUpdated(null);
        return;
      }
      const players = Object.values(data);
      const lastUpdated = players.reduce((latest, player) => Math.max(latest, player.updatedAt || player.joinedAt || 0), 0);
      setGMStatus(`Live data received from "${roomId}".`);
      setGMStatusVisual('connected');
      renderGMPlayers(data);
      setGMLastUpdated(lastUpdated || null);
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
