(function initGMCharacterTabs() {
  const tabEncounterState = {
    mode: '',
    left: [],
    right: []
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncateLabel(value, max = 18) {
    if (typeof window.truncateGMNpcTabLabel === 'function') return window.truncateGMNpcTabLabel(value, max);
    const text = String(value || '').trim() || 'TAB';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function getNpcTabName(npcId) {
    if (typeof window.getGMNpcTabName === 'function') return window.getGMNpcTabName(npcId);
    return `npc-${String(npcId || '').trim()}`;
  }

  function getPlayerTabName(playerId) {
    return `player-${String(playerId || '').trim()}`;
  }

  function buildNpcIframeSrc(npc) {
    const params = new URLSearchParams({
      npcSyncId: String(npc?.id || '').trim(),
      role: 'npc',
      embedded: '1',
      gmNpcLite: '1'
    });
    const roomId = typeof window.getGMActiveRoomId === 'function' ? String(window.getGMActiveRoomId() || '').trim() : '';
    if (roomId) {
      params.set('roomId', roomId);
      params.set('autoConnect', '1');
    } else {
      params.set('autoConnect', '0');
    }
    return `DND.html?${params.toString()}`;
  }

  function getPanelsRoot() {
    return document.getElementById('gm-character-tab-panels');
  }

  function getAllCombatants() {
    const players = typeof window.getGMRemotePlayers === 'function' ? window.getGMRemotePlayers() : [];
    const npcs = typeof window.getGMLocalNpcs === 'function' ? window.getGMLocalNpcs() : [];
    return [
      ...players.map((entry) => ({
        ...entry,
        sourceType: 'player',
        combatKey: `player:${entry.id}`,
        tabName: getPlayerTabName(entry.id)
      })),
      ...npcs.map((entry) => ({
        ...entry,
        sourceType: 'npc',
        combatKey: `npc:${entry.id}`,
        tabName: getNpcTabName(entry.id)
      }))
    ];
  }

  function getCombatantByTabName(tabName) {
    return getAllCombatants().find((entry) => entry.tabName === tabName) || null;
  }

  function clearEncounterState() {
    tabEncounterState.mode = '';
    tabEncounterState.left = [];
    tabEncounterState.right = [];
    renderEncounterStrip();
  }

  function normalizeEncounterState() {
    const validKeys = new Set(getAllCombatants().map((entry) => entry.combatKey));
    tabEncounterState.left = tabEncounterState.left.filter((key) => validKeys.has(key));
    tabEncounterState.right = tabEncounterState.right.filter((key) => validKeys.has(key));
    if (!tabEncounterState.left.length && !tabEncounterState.right.length) {
      tabEncounterState.mode = '';
    }
  }

  function renderEncounterList(keys) {
    const combatants = getAllCombatants();
    const list = keys
      .map((key) => combatants.find((entry) => entry.combatKey === key))
      .filter(Boolean);
    if (!list.length) return '<div class="gm-empty">No character selected.</div>';
    return list.map((combatant) => `
      <div class="gm-tab-session-card">
        <div class="gm-tab-session-name">${escapeHtml(combatant.name || 'Unknown')}</div>
        <div class="gm-tab-session-meta">${escapeHtml((combatant.career || 'UNKNOWN').toUpperCase())} // ${escapeHtml((combatant.sourceType || 'character').toUpperCase())}</div>
      </div>
    `).join('');
  }

  function renderEncounterStrip() {
    normalizeEncounterState();
    const bar = document.getElementById('gm-tab-session-bar');
    const title = document.getElementById('gm-tab-session-title');
    const leftNode = document.getElementById('gm-tab-session-left');
    const rightNode = document.getElementById('gm-tab-session-right');
    const launch = document.getElementById('gm-tab-session-launch');
    if (!bar || !title || !leftNode || !rightNode || !launch) return;
    const active = !!tabEncounterState.mode;
    bar.hidden = !active;
    if (!active) return;
    title.textContent = tabEncounterState.mode === 'initiative' ? 'INITIATION CHECK STAGING' : 'FACEDOWN STAGING';
    leftNode.innerHTML = renderEncounterList(tabEncounterState.left);
    rightNode.innerHTML = renderEncounterList(tabEncounterState.right);
    if (tabEncounterState.mode === 'initiative') {
      launch.hidden = false;
      launch.disabled = !(tabEncounterState.left.length && tabEncounterState.right.length);
    } else {
      launch.hidden = true;
      launch.disabled = true;
    }
  }

  function launchFacedownIfReady() {
    if (tabEncounterState.mode !== 'facedown') return;
    if (tabEncounterState.left.length !== 1 || tabEncounterState.right.length !== 1) return;
    const combatants = [tabEncounterState.left[0], tabEncounterState.right[0]]
      .map((key, index) => {
        const combatant = getAllCombatants().find((entry) => entry.combatKey === key);
        return combatant ? { ...combatant, assignedSide: index === 0 ? 'left' : 'right' } : null;
      })
      .filter(Boolean);
    if (combatants.length === 2 && typeof window.openGMFacedownModalForCombatants === 'function') {
      window.openGMFacedownModalForCombatants(combatants);
      clearEncounterState();
    }
  }

  function launchInitiativeFromStrip() {
    if (tabEncounterState.mode !== 'initiative') return;
    const combatants = [
      ...tabEncounterState.left.map((key) => {
        const combatant = getAllCombatants().find((entry) => entry.combatKey === key);
        return combatant ? { ...combatant, assignedSide: 'left' } : null;
      }),
      ...tabEncounterState.right.map((key) => {
        const combatant = getAllCombatants().find((entry) => entry.combatKey === key);
        return combatant ? { ...combatant, assignedSide: 'right' } : null;
      })
    ].filter(Boolean);
    if (combatants.length && typeof window.openGMInitiativeModalForCombatants === 'function') {
      window.openGMInitiativeModalForCombatants(combatants);
      clearEncounterState();
    }
  }

  function addCombatantToEncounter(tabName, side) {
    const combatant = getCombatantByTabName(tabName);
    if (!combatant) return;
    tabEncounterState.left = tabEncounterState.left.filter((key) => key !== combatant.combatKey);
    tabEncounterState.right = tabEncounterState.right.filter((key) => key !== combatant.combatKey);
    if (side === 'left') tabEncounterState.left.push(combatant.combatKey);
    else tabEncounterState.right.push(combatant.combatKey);
    renderEncounterStrip();
    launchFacedownIfReady();
  }

  function startFacedown(tabName) {
    clearEncounterState();
    tabEncounterState.mode = 'facedown';
    addCombatantToEncounter(tabName, 'left');
  }

  function addToFacedown(tabName) {
    if (tabEncounterState.mode !== 'facedown') startFacedown(tabName);
    else addCombatantToEncounter(tabName, 'right');
  }

  function startInitiative(tabName, side) {
    if (tabEncounterState.mode !== 'initiative') {
      clearEncounterState();
      tabEncounterState.mode = 'initiative';
    }
    addCombatantToEncounter(tabName, side);
  }

  function closeContextMenu() {
    const menu = document.getElementById('gm-tab-context-menu');
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = '';
  }

  function buildMenuItem(label, action, className = '') {
    return `<button type="button" class="gm-tab-context-item${className ? ` ${className}` : ''}" data-gm-context-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
  }

  function openContextMenu(event, tabName) {
    event.preventDefault();
    const menu = document.getElementById('gm-tab-context-menu');
    const combatant = getCombatantByTabName(tabName);
    if (!menu || !combatant) return;
    const actions = [];
    if (!tabEncounterState.mode) {
      actions.push(buildMenuItem('Facedown', `facedown:${tabName}`));
      actions.push(buildMenuItem('Initiation Check / Left', `init-left:${tabName}`));
      actions.push(buildMenuItem('Initiation Check / Right', `init-right:${tabName}`));
    } else if (tabEncounterState.mode === 'facedown') {
      if (!tabEncounterState.left.includes(combatant.combatKey) && !tabEncounterState.right.includes(combatant.combatKey)) {
        actions.push(buildMenuItem('Add to Facedown', `facedown-add:${tabName}`));
      }
      actions.push(buildMenuItem('Clear Facedown', 'clear-session'));
    } else if (tabEncounterState.mode === 'initiative') {
      if (!tabEncounterState.left.includes(combatant.combatKey)) actions.push(buildMenuItem('Add to Left', `init-left:${tabName}`));
      if (!tabEncounterState.right.includes(combatant.combatKey)) actions.push(buildMenuItem('Add to Right', `init-right:${tabName}`));
      actions.push(buildMenuItem('Launch Initiative', 'launch-init', tabEncounterState.left.length && tabEncounterState.right.length ? '' : 'disabled'));
      actions.push(buildMenuItem('Clear Initiative', 'clear-session'));
    }
    menu.innerHTML = actions.join('');
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.hidden = false;
  }

  function ensurePlayerPanel(player) {
    const panelsRoot = getPanelsRoot();
    if (!panelsRoot) return null;
    const tabName = getPlayerTabName(player.id);
    const panelId = `gm-tab-${tabName}`;
    let panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'gm-tab-panel gm-character-tab-panel';
      panel.id = panelId;
      panelsRoot.appendChild(panel);
    }
    const renderHtml = typeof window.renderGMRemotePlayerDossierHtml === 'function'
      ? window.renderGMRemotePlayerDossierHtml(player.id, player)
      : `<section class="gm-panel"><div class="gm-empty">Player dossier renderer unavailable.</div></section>`;
    panel.innerHTML = renderHtml;
    return panel;
  }

  function ensureNpcPanel(npc) {
    const panelsRoot = getPanelsRoot();
    if (!panelsRoot) return null;
    const tabName = getNpcTabName(npc.id);
    const panelId = `gm-tab-${tabName}`;
    let panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'gm-tab-panel gm-npc-tab-panel';
      panel.id = panelId;
      panel.innerHTML = `
        <section class="gm-panel gm-panel-dossier">
          <div class="gm-npc-tab-toolbar">
            <div>
              <div class="gm-panel-title" style="margin-bottom:6px;">NPC DOSSIER TAB</div>
              <div class="gm-npc-sheet-kicker">Embedded dossier stack // this tab runs the same page and JS as the player sheet.</div>
            </div>
            <div class="gm-card-actions" style="margin-bottom:0;">
              <button type="button" class="gm-btn gm-btn-muted gm-tab-toolbar-badge" disabled>LOCAL NPC</button>
            </div>
          </div>
          <div class="gm-dossier-frame-shell">
            <iframe class="gm-dossier-embed" data-gm-npc-frame="${escapeHtml(npc.id)}" title="${escapeHtml(npc.name || 'NPC dossier')}" loading="lazy"></iframe>
          </div>
        </section>
      `;
      panelsRoot.appendChild(panel);
    }
    const frame = panel.querySelector('iframe[data-gm-npc-frame]');
    const nextSrc = buildNpcIframeSrc(npc);
    if (frame && frame.getAttribute('src') !== nextSrc) {
      frame.setAttribute('src', nextSrc);
      frame.setAttribute('title', `${npc.name || 'NPC'} dossier`);
    }
    const titleNode = panel.querySelector('.gm-panel-title');
    if (titleNode) titleNode.textContent = `${String(npc.name || 'NPC').toUpperCase()} // DOSSIER TAB`;
    return panel;
  }

  function renderCharacterTabButtons(players, npcs) {
    const strip = document.getElementById('gm-character-tab-strip');
    if (!strip) return;
    strip.innerHTML = [
      ...players.map((player) => `
        <button type="button" class="gm-tab-btn gm-tab-btn-npc" data-gm-tab="${escapeHtml(getPlayerTabName(player.id))}" title="${escapeHtml(player.name || 'Player')}">
          <span class="gm-tab-btn-text">${escapeHtml(truncateLabel(player.name || 'PLAYER'))}</span>
        </button>
      `),
      ...npcs.map((npc) => `
        <button type="button" class="gm-tab-btn gm-tab-btn-npc" data-gm-tab="${escapeHtml(getNpcTabName(npc.id))}" title="${escapeHtml(npc.name || 'NPC')}">
          <span class="gm-tab-btn-text">${escapeHtml(truncateLabel(npc.name || 'NPC'))}</span>
        </button>
      `)
    ].join('');
  }

  function cleanupPanels(players, npcs) {
    const panelsRoot = getPanelsRoot();
    if (!panelsRoot) return;
    const validIds = new Set([
      ...players.map((player) => `gm-tab-${getPlayerTabName(player.id)}`),
      ...npcs.map((npc) => `gm-tab-${getNpcTabName(npc.id)}`)
    ]);
    Array.from(panelsRoot.children).forEach((panel) => {
      if (!validIds.has(panel.id)) panel.remove();
    });
  }

  function renderGMCharacterTabs(preferredTab) {
    const players = typeof window.getGMRemotePlayers === 'function' ? window.getGMRemotePlayers() : [];
    const npcs = typeof window.getGMLocalNpcs === 'function' ? window.getGMLocalNpcs() : [];
    renderCharacterTabButtons(players, npcs);
    cleanupPanels(players, npcs);
    players.forEach((player) => ensurePlayerPanel(player));
    npcs.forEach((npc) => ensureNpcPanel(npc));

    const emptyNode = document.getElementById('gm-character-tabs-empty');
    if (emptyNode) emptyNode.hidden = !!(players.length || npcs.length);

    const current = document.querySelector('.gm-tab-btn.active')?.getAttribute('data-gm-tab') || '';
    const firstTab = players[0]
      ? getPlayerTabName(players[0].id)
      : npcs[0]
        ? getNpcTabName(npcs[0].id)
        : 'monitor';
    const validTabs = new Set([
      'monitor',
      ...players.map((player) => getPlayerTabName(player.id)),
      ...npcs.map((npc) => getNpcTabName(npc.id))
    ]);
    const nextTab = validTabs.has(preferredTab || current) ? (preferredTab || current) : firstTab;
    if (typeof window.switchGMTab === 'function') window.switchGMTab(nextTab);
    renderEncounterStrip();
  }

  function openNpcCreateModal() {
    document.getElementById('gm-npc-create-modal')?.classList.add('show');
  }

  function closeNpcCreateModal() {
    document.getElementById('gm-npc-create-modal')?.classList.remove('show');
  }

  window.renderGMCharacterTabs = renderGMCharacterTabs;
  window.renderGMNpcTabs = renderGMCharacterTabs;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gm-create-npc-tab-btn')?.addEventListener('click', openNpcCreateModal);
    document.getElementById('gm-npc-create-cancel')?.addEventListener('click', closeNpcCreateModal);
    document.getElementById('gm-npc-create-new-btn')?.addEventListener('click', () => {
      closeNpcCreateModal();
      if (typeof window.createGMNpcTab === 'function') window.createGMNpcTab();
    });
    document.getElementById('gm-npc-create-import-btn')?.addEventListener('click', () => {
      closeNpcCreateModal();
      if (typeof window.openGMNpcFilePicker === 'function') window.openGMNpcFilePicker();
    });
    document.getElementById('gm-tab-session-clear')?.addEventListener('click', clearEncounterState);
    document.getElementById('gm-tab-session-launch')?.addEventListener('click', launchInitiativeFromStrip);
    document.addEventListener('contextmenu', (event) => {
      const tabButton = event.target.closest('.gm-tab-btn[data-gm-tab]');
      if (!tabButton) return;
      const tabName = String(tabButton.getAttribute('data-gm-tab') || '').trim();
      if (!tabName || tabName === 'monitor') return;
      openContextMenu(event, tabName);
    });
    document.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-gm-context-action]');
      if (actionButton) {
        if (actionButton.classList.contains('disabled')) {
          closeContextMenu();
          return;
        }
        const action = String(actionButton.getAttribute('data-gm-context-action') || '').trim();
        if (action.startsWith('facedown:')) startFacedown(action.split(':').slice(1).join(':'));
        else if (action.startsWith('facedown-add:')) addToFacedown(action.split(':').slice(1).join(':'));
        else if (action.startsWith('init-left:')) startInitiative(action.split(':').slice(1).join(':'), 'left');
        else if (action.startsWith('init-right:')) startInitiative(action.split(':').slice(1).join(':'), 'right');
        else if (action === 'launch-init') launchInitiativeFromStrip();
        else if (action === 'clear-session') clearEncounterState();
        closeContextMenu();
        return;
      }
      if (!event.target.closest('#gm-tab-context-menu')) closeContextMenu();
    });
    document.getElementById('gm-npc-file-input')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file && typeof window.loadGMNpcFileFromPicker === 'function') {
        await window.loadGMNpcFileFromPicker(file);
      }
      event.target.value = '';
    });
    renderGMCharacterTabs();
  });
}());
