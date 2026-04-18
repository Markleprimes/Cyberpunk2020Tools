// Shared dossier state
let sheetStats = {};
let sheetSkills = [];
let repValue = 0;
let walletValue = 0;
let upgradePoints = 0;
let bodyLevelVal = 0;
let weightVal = 0;
let stunVal = 0;
let inventory = {};
let rollModifiers = [];
let currentRoll = { sides: null, qty: 1, rolls: [], result: 0, modifiers: 0, total: 0, rolledAt: 0 };
let aimStackPoints = 0;
let _rollTimer = null;
let bannerImageData = '';
let bannerImageName = '';
let inventoryEditState = null;
let aimHitWeapons = [];
let dossierHoverAudio = null;
let dossierHoveredButton = null;
let rollCinemaFrame = null;
let rollCinemaNumberTimer = null;
let rollCinemaCountTimer = null;
let rollCinemaRevealTimer = null;
let rollCinemaAutoCloseTimer = null;
let rollCountAudio = null;
let rollBounceAudios = [];
let pendingRollRequest = null;
let rollShakePower = 0;
let rollShakeActive = false;
let rollShakePointerId = null;
let rollShakeLastPoint = null;
let systemTickerTimer = null;
let systemTickerIndex = 0;
let _toastTimer = null;
let _modalCb = null;
let activeRoomId = '';
let roomSyncStatus = 'disconnected';
let playerPromptUnsubscribe = null;
let playerEffectsUnsubscribe = null;
let activeRemotePrompt = null;
let persistentRollPenalty = 0;
let activeStatusEffects = [];

const LIMBS = ['Head', 'Torso', 'R.Arm', 'L.Arm', 'R.Leg', 'L.Leg'];
let limbSP = { Head: 0, Torso: 0, 'R.Arm': 0, 'L.Arm': 0, 'R.Leg': 0, 'L.Leg': 0 };
let limbDMG = { Head: 0, Torso: 0, 'R.Arm': 0, 'L.Arm': 0, 'R.Leg': 0, 'L.Leg': 0 };

const STAT_COLORS = {
  REF: 'var(--stat-core)',
  INT: 'var(--stat-core)',
  COOL: 'var(--stat-core)',
  ATTR: 'var(--stat-core)',
  TECH: 'var(--stat-core)',
  LUCK: 'var(--stat-core)',
  EMPT: 'var(--stat-core)',
  MA: 'var(--stat-core)',
  BODY: 'var(--stat-core)',
  EMP: 'var(--stat-core)'
};
const CHARACTER_KEYS = new Set(['name', 'stats', 'career', 'careerskill', 'reputation', 'wallet', 'physicalbody', 'body', 'stunpoint', 'armor', 'damage']);
const INVENTORY_ORDER = ['weapon', 'cyberware', 'miscellaneous', 'buff'];
const DEFAULT_STATS = ['REF', 'INT', 'COOL', 'ATTR', 'TECH', 'LUCK', 'EMPT'];
const BOOT_RAW_KEY = 'cp2020_boot_raw_character';
const BOOT_DATA_KEY = 'cp2020_boot_character_data';
const BOOT_BUNDLE_KEY = 'cp2020_boot_bundle_payload';

// DOM helpers and shared event wiring
function getById(id) {
  return document.getElementById(id);
}

function bindFilePicker(id, handler) {
  const input = getById(id);
  if (!input) return;
  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) handler(file);
  });
}

function bindBackdropClose(id, closeHandler) {
  const modal = getById(id);
  if (!modal) return;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeHandler();
  });
}

bindFilePicker('file-input2', (file) => readFile(file));
bindFilePicker('item-file-input', (file) => readItemFile(file));
bindFilePicker('banner-image-input', (file) => readBannerImage(file));

bindBackdropClose('inventory-editor-modal', () => closeInventoryEditor());
bindBackdropClose('aim-hit-modal', () => closeAimHitModal());
bindBackdropClose('new-char-modal', () => closeNewCharacterModal());
bindBackdropClose('roll-execute-modal', () => cancelRollExecution());
bindBackdropClose('roll-cinema-modal', () => closeRollCinemaModal());
bindBackdropClose('player-choice-modal', () => closePlayerChoiceModal());

getById('inventory-item-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveInventoryItem();
});
getById('room-sync-connect-btn')?.addEventListener('click', () => connectPlayerRoom());
getById('room-sync-disconnect-btn')?.addEventListener('click', () => disconnectPlayerRoom());
getById('room-sync-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') connectPlayerRoom();
});
getById('player-choice-backoff')?.addEventListener('click', () => submitPlayerChoicePrompt('backoff'));
getById('player-choice-stay')?.addEventListener('click', () => submitPlayerChoicePrompt('stay'));

window.getPersistentRollPenalty = () => Number(persistentRollPenalty || 0);
window.getStatusEffectModifiers = () => activeStatusEffects
  .filter((effect) => Number.isFinite(Number(effect?.modifier)))
  .map((effect) => ({
    source: effect.source || 'GM',
    label: effect.label || 'Status Effect',
    value: Number(effect.modifier || 0),
    persistent: true,
    note: effect.note || ''
  }));

function showError(msg) {
  const bar = getById('status-bar');
  bar.textContent = msg;
  bar.style.display = 'block';
}

function getCurrentCharacterProfile() {
  const stats = Object.keys(sheetStats).map((key) => ({
    label: key,
    value: getEffectiveStatValue(key)
  }));
  const skills = sheetSkills.map((skill) => ({
    label: skill.name,
    value: skill.value || 0
  }));
  const armor = LIMBS.map((limb) => ({
    label: limb,
    value: limbSP[limb] || 0
  }));
  const damage = LIMBS.map((limb) => ({
    label: limb,
    value: limbDMG[limb] || 0
  }));
  const inventoryItems = [];
  Object.keys(inventory || {}).forEach((category) => {
    (inventory[category] || []).forEach((item) => {
      inventoryItems.push({
        type: humanizeLabel(category),
        name: item.name || humanizeLabel(item.id || category),
        description: Array.isArray(item.info) && item.info.length
          ? item.info.join(' | ')
          : '--'
      });
    });
  });
  const modifierTotal = typeof getModifierTotal === 'function' ? getModifierTotal() : 0;
  const lastRoll = currentRoll?.sides
      ? {
        dice: `${currentRoll.qty}D${currentRoll.sides}`,
        pool: [...(currentRoll.rolls || [])],
        raw: currentRoll.result || 0,
        modifiers: currentRoll.modifiers ?? modifierTotal,
        total: currentRoll.total ?? ((currentRoll.result || 0) + modifierTotal),
        rolledAt: currentRoll.rolledAt || 0
      }
    : null;
  return {
    name: (getById('char-name')?.textContent || 'Unknown').trim() || 'Unknown',
    career: (getById('char-career')?.textContent || 'UNKNOWN').trim() || 'UNKNOWN',
    role: (getById('room-sync-role')?.value || 'player').trim() || 'player',
    stats,
    skills,
    armor,
    damage,
    reputation: repValue,
    wallet: walletValue,
    physical: {
      bodyLevel: bodyLevelVal,
      weight: weightVal,
      stun: stunVal
    },
    inventory: inventoryItems,
    combatPenalty: Number(persistentRollPenalty || 0),
    lastRoll
  };
}

function setRoomSyncStatus(status, detail = '') {
  roomSyncStatus = status;
  const statusNode = getById('room-sync-status');
  const noteNode = getById('room-sync-note');
  if (statusNode) {
    statusNode.textContent = status.toUpperCase();
    statusNode.className = `room-sync-status ${status}`;
  }
  if (noteNode) {
    if (detail) noteNode.textContent = detail;
    else if (status === 'connected') noteNode.textContent = `Live with room "${activeRoomId}" as ${(getById('room-sync-role')?.value || 'player').toUpperCase()}. Multiple clients can join the same room.`;
    else if (status === 'pending') noteNode.textContent = 'Contacting the referee uplink...';
    else noteNode.textContent = 'Push this character name to the referee monitor. Multiple clients can join the same room.';
  }
}

function setPersistentRollPenalty(value, reason = '') {
  persistentRollPenalty = Number(value || 0);
  renderActiveEffects();
  renderRollLab();
  syncCurrentPlayerPresence();
  if (reason) showActionLog(reason);
}

function normalizeStatusEffects(effectMap) {
  return Object.values(effectMap || {})
    .map((effect) => ({
      id: String(effect?.id || '').trim(),
      label: String(effect?.label || 'Status Effect').trim() || 'Status Effect',
      note: String(effect?.note || '').trim(),
      source: String(effect?.source || 'GM').trim() || 'GM',
      modifier: effect?.modifier === '' || effect?.modifier === null || typeof effect?.modifier === 'undefined'
        ? null
        : Number(effect.modifier || 0),
      updatedAt: Number(effect?.updatedAt || 0)
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getRenderableStatusEffects() {
  const effects = [...activeStatusEffects];
  if (persistentRollPenalty) {
    effects.unshift({
      id: 'facedown-penalty',
      label: 'Facedown Penalty',
      note: 'Applied after choosing STAY STRONG.',
      source: 'STATUS',
      modifier: Number(persistentRollPenalty || 0),
      locked: true
    });
  }
  return effects;
}

function renderActiveEffects() {
  const list = getById('active-effects-list');
  if (!list) return;
  const effects = getRenderableStatusEffects();
  if (!effects.length) {
    list.innerHTML = '<div class="inventory-empty">NO ACTIVE EFFECTS</div>';
    return;
  }
  list.innerHTML = effects.map((effect) => {
    const hasModifier = Number.isFinite(Number(effect?.modifier));
    const modifier = hasModifier ? Number(effect.modifier || 0) : null;
    return `
      <div class="status-effect-item${effect.locked ? ' locked' : ''}">
        <div class="status-effect-head">
          <span class="status-effect-label">${escapeHtml(effect.label || 'Status Effect')}</span>
          ${hasModifier ? `<span class="status-effect-mod">${modifier >= 0 ? '+' : ''}${modifier}</span>` : '<span class="status-effect-mod status-effect-mod-note">NOTE</span>'}
        </div>
        <div class="status-effect-meta">${escapeHtml(effect.source || 'GM')}</div>
        ${effect.note ? `<div class="status-effect-note">${escapeHtml(effect.note)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function closePlayerChoiceModal() {
  getById('player-choice-modal')?.classList.remove('show');
}

function renderPlayerChoiceModal(prompt) {
  const title = getById('player-choice-title');
  const message = getById('player-choice-msg');
  const note = getById('player-choice-note');
  const backoff = getById('player-choice-backoff');
  const stay = getById('player-choice-stay');
  if (!title || !message || !note || !backoff || !stay) return;
  const penalty = Number(prompt?.penalty || -3);
  title.textContent = 'FACEDOWN RESULT';
  message.textContent = `${String(prompt?.loserName || getById('char-name')?.textContent || 'YOU').trim().toUpperCase()} LOST THE FACEDOWN. CHOOSE YOUR RESPONSE.`;
  note.textContent = `BACK OFF removes you from combat. STAY STRONG keeps you in the fight and applies ${penalty >= 0 ? '+' : ''}${penalty} to future rolls until cleared by the referee.`;
  backoff.disabled = false;
  stay.disabled = false;
  getById('player-choice-modal')?.classList.add('show');
}

function handleIncomingPlayerPrompt(prompt) {
  activeRemotePrompt = prompt || null;
  if (!prompt || prompt.status === 'resolved' || prompt.status === 'cleared') {
    closePlayerChoiceModal();
    return;
  }
  if (prompt.type !== 'facedown-choice') return;
  if (prompt.status === 'answered') {
    if (prompt.response?.choice === 'stay') {
      setPersistentRollPenalty(Number(prompt.penalty || -3));
    }
    closePlayerChoiceModal();
    return;
  }
  if (prompt.status === 'pending') renderPlayerChoiceModal(prompt);
}

function stopPlayerPromptWatch() {
  if (typeof playerPromptUnsubscribe === 'function') playerPromptUnsubscribe();
  playerPromptUnsubscribe = null;
  activeRemotePrompt = null;
  closePlayerChoiceModal();
}

function startPlayerPromptWatch(roomId) {
  stopPlayerPromptWatch();
  if (!roomId || typeof watchPlayerPrompt !== 'function') return;
  playerPromptUnsubscribe = watchPlayerPrompt(roomId, handleIncomingPlayerPrompt);
}

function stopPlayerEffectsWatch() {
  if (typeof playerEffectsUnsubscribe === 'function') playerEffectsUnsubscribe();
  playerEffectsUnsubscribe = null;
  activeStatusEffects = [];
  renderActiveEffects();
  renderRollLab();
}

function startPlayerEffectsWatch(roomId) {
  stopPlayerEffectsWatch();
  if (!roomId || typeof watchPlayerEffects !== 'function') return;
  playerEffectsUnsubscribe = watchPlayerEffects(roomId, (effectMap) => {
    activeStatusEffects = normalizeStatusEffects(effectMap);
    renderActiveEffects();
    renderRollLab();
  });
}

async function submitPlayerChoicePrompt(choice) {
  if (!activeRemotePrompt || !activeRoomId) return;
  const backoff = getById('player-choice-backoff');
  const stay = getById('player-choice-stay');
  if (backoff) backoff.disabled = true;
  if (stay) stay.disabled = true;
  try {
    await respondToPlayerPrompt(activeRoomId, activeRemotePrompt.promptId, { choice });
    if (choice === 'stay') {
      setPersistentRollPenalty(
        Number(activeRemotePrompt.penalty || -3),
        'FACEDOWN LOST // STAY STRONG PENALTY APPLIED'
      );
    } else {
      showActionLog('FACEDOWN LOST // BACK OFF SENT TO REFEREE');
    }
    closePlayerChoiceModal();
  } catch (error) {
    showError(`FACEDOWN RESPONSE ERROR: ${error.message}`);
    if (backoff) backoff.disabled = false;
    if (stay) stay.disabled = false;
  }
}

async function connectPlayerRoom() {
  const roomId = String(getById('room-sync-input')?.value || '').trim();
  if (!roomId) {
    showError('ENTER A ROOM ID BEFORE CONNECTING.');
    return;
  }
  setRoomSyncStatus('pending');
  try {
    initFirebaseRealtime();
    await connectPlayerPresence(roomId, getCurrentCharacterProfile());
    activeRoomId = roomId;
    startPlayerPromptWatch(roomId);
    startPlayerEffectsWatch(roomId);
    setRoomSyncStatus('connected');
    showActionLog(`CONNECTED TO ROOM ${roomId.toUpperCase()}`);
  } catch (error) {
    activeRoomId = '';
    setRoomSyncStatus('disconnected', 'Connection failed. Check Firebase or room settings.');
    showError(`ROOM CONNECT ERROR: ${error.message}`);
  }
}

async function disconnectPlayerRoom() {
  try {
    stopPlayerPromptWatch();
    stopPlayerEffectsWatch();
    await disconnectPlayerPresence();
  } catch (error) {
    console.warn('Room disconnect failed.', error);
  }
  activeRoomId = '';
  setRoomSyncStatus('disconnected');
  showActionLog('ROOM LINK DISCONNECTED');
}

async function syncCurrentPlayerPresence() {
  if (roomSyncStatus !== 'connected' || !activeRoomId) return;
  try {
    await updatePlayerPresence(getCurrentCharacterProfile());
  } catch (error) {
    console.warn('Failed to update player presence.', error);
  }
}

function flashNode(node, className = 'react-flash') {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

function flashById(id, className = 'react-flash') {
  flashNode(getById(id), className);
}

function pulsePanelFromNode(node) {
  const panel = node?.closest?.('.panel');
  flashNode(panel, 'panel-hit');
}

function getActiveWoundCount() {
  return Object.values(limbDMG).filter((value) => (parseInt(value, 10) || 0) > 0).length;
}

function buildSystemTickerMessages() {
  const inventoryCount = typeof orderedInventoryCategories === 'function'
    ? orderedInventoryCategories().reduce((sum, key) => sum + (inventory[key]?.length || 0), 0)
    : 0;
  const woundCount = getActiveWoundCount();
  const modTotal = typeof getModifierTotal === 'function' ? getModifierTotal() : 0;
  const name = (document.getElementById('char-name')?.textContent || 'DOSSIER').trim();
  const career = (document.getElementById('char-career')?.textContent || 'UNKNOWN').trim();
  return [
    `${name} // ${career} profile synced to Night City uplink.`,
    `Street cred ${repValue}. Wallet ${walletValue} eb. Upgrade pool ${upgradePoints}.`,
    `Inventory nodes ${inventoryCount}. Wound channels ${woundCount || 0}. Roll modifiers ${modTotal >= 0 ? '+' : ''}${modTotal}.`,
    `Body ${bodyLevelVal}. Weight ${weightVal}. Stun ${stunVal}. Aim stack ${aimStackPoints}.`,
    'Night City is playing tricks again. Keep one eye on the glass and one on the exits.',
    'Signal ghosts are playing tricks in the dossier feed. That usually means the system is awake.',
    currentRoll.sides
      ? `Last roll ${currentRoll.qty}D${currentRoll.sides} => ${currentRoll.result}.`
      : 'Roll lab idle. Breach protocol waiting for the next command.'
  ];
}

function updateSystemStrip(forceRestart = false) {
  const textEl = document.getElementById('system-strip-text');
  const invEl = document.getElementById('system-metric-inv');
  const woundEl = document.getElementById('system-metric-wound');
  const rollEl = document.getElementById('system-metric-roll');
  if (!textEl || !invEl || !woundEl || !rollEl) return;
  const inventoryCount = typeof orderedInventoryCategories === 'function'
    ? orderedInventoryCategories().reduce((sum, key) => sum + (inventory[key]?.length || 0), 0)
    : 0;
  const woundCount = getActiveWoundCount();
  const modTotal = typeof getModifierTotal === 'function' ? getModifierTotal() : 0;
  const messages = buildSystemTickerMessages();
  if (forceRestart) systemTickerIndex = 0;
  textEl.textContent = messages[systemTickerIndex % messages.length];
  invEl.textContent = `INV ${inventoryCount}`;
  woundEl.textContent = woundCount ? `WOUND ${woundCount}` : 'WOUND CLEAR';
  rollEl.textContent = `MOD ${modTotal >= 0 ? '+' : ''}${modTotal}`;
  clearInterval(systemTickerTimer);
  systemTickerTimer = setInterval(() => {
    const nextMessages = buildSystemTickerMessages();
    systemTickerIndex = (systemTickerIndex + 1) % nextMessages.length;
    textEl.textContent = nextMessages[systemTickerIndex];
  }, 3200);
}

function showActionLog(msg) {
  const toast = document.getElementById('action-toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  const strip = document.getElementById('system-strip-text');
  if (strip) {
    strip.textContent = msg;
    flashNode(getById('system-strip'), 'panel-hit');
    systemTickerIndex = 0;
    updateSystemStrip();
  }
}

function playDossierHoverSound() {
  if (!dossierHoverAudio) {
    dossierHoverAudio = new Audio('audio/menu-hover.mp3');
    dossierHoverAudio.preload = 'auto';
  }
  dossierHoverAudio.currentTime = 0;
  dossierHoverAudio.play().catch(() => {});
}

document.addEventListener('mouseover', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button === dossierHoveredButton) return;
  if (button.contains(event.relatedTarget)) return;
  dossierHoveredButton = button;
  playDossierHoverSound();
});

document.addEventListener('mouseout', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button === dossierHoveredButton && !button.contains(event.relatedTarget)) {
    dossierHoveredButton = null;
  }
});

function renderBannerImage() {
  const banner = document.querySelector('.name-banner');
  if (!banner) return;
  if (bannerImageData) {
    banner.style.backgroundImage = `url('${bannerImageData}')`;
    banner.classList.add('has-image');
  } else {
    banner.style.backgroundImage = 'none';
    banner.classList.remove('has-image');
  }
}

function extractTopLevelBlocks(text) {
  const blocks = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /[,\s]/.test(text[i])) i += 1;
    if (i >= text.length) break;
    const keyStart = i;
    while (i < text.length && text[i] !== ':') i += 1;
    if (i >= text.length) break;
    const key = text.slice(keyStart, i).trim().replace(/^"|"$/g, '');
    i += 1;
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (text[i] !== '{') {
      while (i < text.length && text[i] !== ',' && text[i] !== '\n') i += 1;
      continue;
    }
    let depth = 0;
    let inQuote = false;
    const bodyStart = i + 1;
    let end = i;
    for (; end < text.length; end += 1) {
      const ch = text[end];
      if (ch === '"' && text[end - 1] !== '\\') inQuote = !inQuote;
      if (inQuote) continue;
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.push({ key, body: text.slice(bodyStart, end).trim() });
    i = end + 1;
  }
  return blocks;
}

function splitTopLevelTokens(text) {
  const tokens = [];
  let cur = '';
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== '\\') {
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (!inQuote) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      if ((ch === ',' || ch === '\n' || ch === '\r') && depth === 0) {
        if (cur.trim()) tokens.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  return tokens;
}

function cleanValue(val) {
  return val.trim().replace(/^"(.*)"$/, '$1');
}

function humanizeLabel(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeLookup(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fileSafeNameFromData(data) {
  return (data?.name?.[0] || 'UNKNOWN').toString().toUpperCase();
}

function parseRollableValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value).trim();
  if (/^[-+]?\d+$/.test(str)) return parseInt(str, 10);
  return null;
}

function showModal(title, msg, cb) {
  getById('modal-title').textContent = title;
  getById('modal-msg').textContent = msg;
  _modalCb = cb;
  getById('modal').classList.add('show');
  getById('modal-confirm').onclick = () => {
    if (_modalCb) _modalCb();
  };
}

function closeModal() {
  getById('modal').classList.remove('show');
  _modalCb = null;
}

getById('modal').addEventListener('click', (e) => {
  if (e.target === getById('modal')) closeModal();
});

function resetSheet() {
  showModal('CLEAR DOSSIER?', 'Discard current character and reset the dossier to blank values?', () => {
    getById('file-input2').value = '';
    getById('item-file-input').value = '';
    getById('banner-image-input').value = '';
    bannerImageData = '';
    bannerImageName = '';
    getById('status-bar').style.display = 'none';
    closeInventoryEditor();
    closeAimHitModal();
    cancelRollExecution();
    closeRollCinemaModal();
    stopPlayerPromptWatch();
    stopPlayerEffectsWatch();
    persistentRollPenalty = 0;
    clearInterval(_rollTimer);
    renderSheet(buildBlankSheetData());
    closeModal();
    showActionLog('CLEARED DOSSIER');
  });
}
