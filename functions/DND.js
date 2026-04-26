// Shared dossier state
let sheetStats = {};
let sheetSkills = [];
let sheetSpecialSkills = [];
let repValue = 0;
let walletValue = 0;
let upgradePoints = 0;
let bodyLevelVal = 0;
let weightVal = 0;
let stunVal = 0;
let inventory = {};
let rollModifiers = [];
let currentRoll = { sides: null, qty: 0, diceTypes: [], diceLabel: '', rolls: [], result: 0, modifiers: 0, total: 0, rolledAt: 0 };
let aimStackPoints = 0;
let _rollTimer = null;
let bannerImageData = '';
let bannerImageName = '';
let inventoryEditState = null;
let specialSkillEditState = null;
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
let playerCommandUnsubscribe = null;
let remoteBreachUnsubscribe = null;
let combatSummaryUnsubscribe = null;
let activeRemotePrompt = null;
let persistentRollPenalty = 0;
let activeStatusEffects = [];
let activeCombatSummary = null;
let combatLuckSpent = 0;
let activeNpcSyncId = '';
let npcSyncWriteSuppressed = false;
let activeInventoryFieldToggles = {};
const DOSSIER_LAUNCH_PARAMS = new URLSearchParams(window.location.search);
const IS_GM_NPC_LITE_MODE = DOSSIER_LAUNCH_PARAMS.get('gmNpcLite') === '1'
  || (DOSSIER_LAUNCH_PARAMS.get('embedded') === '1' && String(DOSSIER_LAUNCH_PARAMS.get('role') || '').trim().toLowerCase() === 'npc');

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
const CHARACTER_KEYS = new Set(['name', 'stats', 'career', 'careerskill', 'specialskill', 'specialskills', 'reputation', 'wallet', 'physicalbody', 'body', 'stunpoint', 'armor', 'damage']);
const INVENTORY_ORDER = ['weapon', 'cyberware', 'miscellaneous', 'buff'];
const DEFAULT_STATS = ['REF', 'INT', 'COOL', 'ATTR', 'TECH', 'LUCK', 'EMPT'];
const BOOT_RAW_KEY = 'cp2020_boot_raw_character';
const BOOT_DATA_KEY = 'cp2020_boot_character_data';
const BOOT_BUNDLE_KEY = 'cp2020_boot_bundle_payload';
const NPC_DOSSIER_SYNC_PREFIX = 'cp2020_npc_dossier_';
const INVENTORY_STAT_ALIASES = {
  ref: 'REF',
  int: 'INT',
  cool: 'COOL',
  attr: 'ATTR',
  tech: 'TECH',
  luck: 'LUCK',
  empt: 'EMPT',
  emp: 'EMP',
  ma: 'MA',
  body: 'BODY'
};
const INVENTORY_PHYSICAL_ALIASES = {
  bodylevel: 'bodyLevel',
  weight: 'weight',
  stun: 'stun',
  stunpoint: 'stun',
  stunpoints: 'stun',
  bodyweight: 'weight'
};

function getNpcDossierSyncKey(npcId) {
  return `${NPC_DOSSIER_SYNC_PREFIX}${String(npcId || '').trim()}`;
}

function isGMNpcLiteMode() {
  return IS_GM_NPC_LITE_MODE;
}

function renderEmbeddedNpcLiteHeader() {
  if (!isGMNpcLiteMode()) return;
  const nameNode = getById('npc-lite-name');
  const metaNode = getById('npc-lite-meta');
  const mainName = String(getById('char-name')?.textContent || 'NPC').trim() || 'NPC';
  const aliasParts = Array.from(document.querySelectorAll('.alias-tag'))
    .map((node) => String(node.textContent || '').trim())
    .filter(Boolean);
  const careerLabel = String(getById('char-career')?.dataset?.career || getById('char-career')?.textContent || 'UNKNOWN').trim() || 'UNKNOWN';
  if (nameNode) nameNode.textContent = mainName;
  if (metaNode) {
    metaNode.textContent = aliasParts.length
      ? `${careerLabel.toUpperCase()} // ${aliasParts.join(' // ')}`
      : `${careerLabel.toUpperCase()} // LOCAL NPC DOSSIER`;
  }
}

function applyEmbeddedDossierMode() {
  const liteMode = isGMNpcLiteMode();
  document.body.classList.toggle('gm-npc-lite', liteMode);
  const specialSkillPanel = getById('special-skill-panel');
  if (specialSkillPanel) specialSkillPanel.hidden = liteMode;
}

window.renderEmbeddedNpcLiteHeader = renderEmbeddedNpcLiteHeader;

applyEmbeddedDossierMode();

// DOM helpers and shared event wiring
function getById(id) {
  return document.getElementById(id);
}

function toggleDossierRoomDrawer() {
  getById('dossier-room-drawer')?.classList.toggle('open');
}

function closeDossierRoomDrawer() {
  getById('dossier-room-drawer')?.classList.remove('open');
}

function normalizeCombatSummary(summary) {
  if (!summary || !Array.isArray(summary.entries)) return null;
  return {
    activeKey: String(summary.activeKey || '').trim(),
    nextKey: String(summary.nextKey || '').trim(),
    entries: summary.entries.map((entry) => ({
      key: String(entry?.key || '').trim(),
      name: String(entry?.name || 'Unknown').trim() || 'Unknown',
      career: String(entry?.career || 'UNKNOWN').trim() || 'UNKNOWN',
      side: String(entry?.side || 'ally').trim() || 'ally',
      sourceType: String(entry?.sourceType || 'npc').trim() || 'npc',
      total: Number(entry?.total || 0),
      active: !!entry?.active,
      next: !!entry?.next
    })).filter((entry) => entry.key)
  };
}

function getPlayerCombatKey() {
  return `player:${getSyncClientId()}`;
}

function isCombatActive() {
  return !!activeCombatSummary?.entries?.length;
}

function isPlayerCombatTurn() {
  if (!isCombatActive()) return false;
  const selfKey = getPlayerCombatKey();
  return activeCombatSummary.entries.some((entry) =>
    entry.key === selfKey && (entry.active || entry.key === activeCombatSummary.activeKey)
  );
}

function getAvailableCombatLuck() {
  const baseLuck = Math.max(0, typeof getBaseStatWithInventoryBonus === 'function'
    ? getBaseStatWithInventoryBonus('LUCK')
    : (parseInt(sheetStats.LUCK, 10) || 0));
  return Math.max(0, baseLuck - combatLuckSpent);
}

function resetCombatLuck(showFeedback = false) {
  const hadSpentLuck = combatLuckSpent > 0;
  combatLuckSpent = 0;
  if (!hadSpentLuck) return;
  if (typeof renderStats === 'function') renderStats();
  syncCurrentPlayerPresence();
  if (showFeedback) showActionLog('COMBAT ENDED // LUCK RESET');
}

function consumeCombatLuckUse() {
  if (!isCombatActive() || !isPlayerCombatTurn()) return false;
  if (getAvailableCombatLuck() <= 0) return false;
  combatLuckSpent += 1;
  if (typeof renderStats === 'function') renderStats();
  syncCurrentPlayerPresence();
  return true;
}

window.isCombatTurnTrackingActive = isCombatActive;
window.isPlayerCombatTurn = isPlayerCombatTurn;
window.getCombatAvailableLuck = getAvailableCombatLuck;
window.consumeCombatLuckUse = consumeCombatLuckUse;

function applyLauncherRoomLink(roomId = '', role = 'player', autoConnect = false) {
  const roomInput = getById('room-sync-input');
  const roleInput = getById('room-sync-role');
  const cleanRoomId = String(roomId || '').trim();
  const cleanRole = String(role || 'player').trim().toLowerCase() === 'npc' ? 'npc' : 'player';
  if (roomInput && cleanRoomId) roomInput.value = cleanRoomId;
  if (roleInput) roleInput.value = cleanRole;
  if (cleanRoomId) setRoomSyncStatus('disconnected', `Room "${cleanRoomId}" primed for ${cleanRole.toUpperCase()} uplink.`);
  if (autoConnect && cleanRoomId) {
    setTimeout(() => {
      if (roomSyncStatus === 'connected' && activeRoomId === cleanRoomId) return;
      connectPlayerRoom();
    }, 0);
  }
}

window.applyLauncherRoomLink = applyLauncherRoomLink;

function renderCombatFocusCard(id, entry, stateClass, fallbackMeta) {
  const node = getById(id);
  if (!node) return;
  if (!entry) {
    node.className = 'combat-focus-card';
    node.innerHTML = `
      <div class="combat-focus-name">--</div>
      <div class="combat-focus-meta">${escapeHtml(fallbackMeta)}</div>
    `;
    return;
  }
  node.className = `combat-focus-card ${stateClass}`.trim();
  node.innerHTML = `
    <div class="combat-focus-name">${escapeHtml(entry.name)}</div>
    <div class="combat-focus-meta">${escapeHtml(`${entry.side === 'ally' ? 'PROTAGONIST' : 'ANTAGONIST'} // ${entry.career} // ${entry.sourceType.toUpperCase()} // INIT ${entry.total}`)}</div>
  `;
}

function renderCombatSummaryDrawer() {
  const statusNode = getById('combat-order-status');
  const listNode = getById('combat-order-list');
  const selfKey = getPlayerCombatKey();

  if (statusNode) {
    if (roomSyncStatus !== 'connected' || !activeRoomId) statusNode.textContent = 'Room link offline.';
    else if (!activeCombatSummary?.entries?.length) statusNode.textContent = `Listening to room "${activeRoomId}" for combat order.`;
    else statusNode.textContent = `Live turn feed from room "${activeRoomId}".`;
  }

  const activeEntry = activeCombatSummary?.entries?.find((entry) => entry.active || entry.key === activeCombatSummary.activeKey) || null;
  const nextEntry = activeCombatSummary?.entries?.find((entry) => entry.next || entry.key === activeCombatSummary.nextKey) || null;

  renderCombatFocusCard('combat-order-active', activeEntry, 'active', 'No active turn.');
  renderCombatFocusCard('combat-order-next', nextEntry, 'next', 'Waiting for initiative.');

  if (!listNode) return;
  if (!activeCombatSummary?.entries?.length) {
    listNode.innerHTML = '<div class="inventory-empty">NO ACTIVE COMBAT ORDER</div>';
    return;
  }

  listNode.innerHTML = activeCombatSummary.entries.map((entry, index) => {
    const classes = [
      'combat-order-row',
      entry.active || entry.key === activeCombatSummary.activeKey ? 'active' : '',
      entry.next || entry.key === activeCombatSummary.nextKey ? 'next' : '',
      entry.key === selfKey ? 'self' : ''
    ].filter(Boolean).join(' ');
    return `
      <div class="${classes}">
        <div class="combat-order-top">
          <div class="combat-order-name">${escapeHtml(entry.name)}</div>
          <div class="combat-order-total">${escapeHtml(String(entry.total))}</div>
        </div>
        <div class="combat-order-meta">${escapeHtml(`#${index + 1} // ${entry.side === 'ally' ? 'PROTAGONIST' : 'ANTAGONIST'} // ${entry.career} // ${entry.sourceType.toUpperCase()}`)}</div>
      </div>
    `;
  }).join('');
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
bindBackdropClose('special-skill-editor-modal', () => closeSpecialSkillEditor());
bindBackdropClose('aim-hit-modal', () => closeAimHitModal());
bindBackdropClose('new-char-modal', () => closeNewCharacterModal());
bindBackdropClose('identity-modal', () => closeIdentityEditor());
bindBackdropClose('roll-execute-modal', () => cancelRollExecution());
bindBackdropClose('roll-cinema-modal', () => closeRollCinemaModal());
bindBackdropClose('player-choice-modal', () => closePlayerChoiceModal());

getById('inventory-item-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveInventoryItem();
});
getById('special-skill-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveSpecialSkill();
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
  const effectivePhysical = getEffectivePhysicalValues();
  const baseStats = Object.keys(sheetStats).map((key) => ({
    label: key,
    value: sheetStats[key] || 0
  }));
  const stats = Object.keys(sheetStats).map((key) => ({
    label: key,
    value: getEffectiveStatValue(key)
  }));
  const skills = sheetSkills.map((skill) => ({
    label: skill.name,
    value: typeof getSkillValueWithInventoryBonus === 'function'
      ? getSkillValueWithInventoryBonus(skill.name, skill.value || 0)
      : (skill.value || 0)
  }));
  const specialSkills = sheetSpecialSkills.map((skill) => ({
    id: skill.id || '',
    name: skill.name || 'Special Skill',
    tiedSkill: skill.tiedSkill || '',
    value: skill.value || 0,
    description: skill.description || ''
  }));
  const armor = LIMBS.map((limb) => ({
    label: limb,
    value: getEffectiveArmorValue(limb)
  }));
  const damage = LIMBS.map((limb) => ({
    label: limb,
    value: limbDMG[limb] || 0
  }));
  const inventoryItems = [];
  const inventoryDetailed = [];
  Object.keys(inventory || {}).forEach((category) => {
    (inventory[category] || []).forEach((item) => {
      inventoryItems.push({
        type: humanizeLabel(category),
        name: item.name || humanizeLabel(item.id || category),
        description: Array.isArray(item.info) && item.info.length
          ? item.info.join(' | ')
          : '--'
      });
      inventoryDetailed.push({
        category,
        id: item.id || buildInventoryId(category),
        name: item.name || humanizeLabel(item.id || category),
        fields: Object.entries(item.fields || {}).map(([label, value]) => ({ label, value })),
        info: [...(item.info || [])]
      });
    });
  });
  const modifierTotal = typeof getModifierTotal === 'function' ? getModifierTotal() : 0;
  const lastRollLabel = String(currentRoll?.diceLabel || (currentRoll?.sides ? `${currentRoll.qty}D${currentRoll.sides}` : '')).trim();
  const modifierDetails = Array.isArray(currentRoll?.modifierSnapshot)
    ? currentRoll.modifierSnapshot
      .filter((mod) => Number.isFinite(Number(mod?.value)))
      .map((mod) => ({
        source: String(mod?.source || '').trim(),
        label: String(mod?.label || 'Modifier').trim() || 'Modifier',
        value: Number(mod?.value || 0)
      }))
    : [];
  const lastRoll = lastRollLabel
      ? {
        dice: lastRollLabel,
        pool: [...(currentRoll.rolls || [])],
        raw: currentRoll.result || 0,
        modifiers: currentRoll.modifiers ?? modifierTotal,
        total: currentRoll.total ?? ((currentRoll.result || 0) + modifierTotal),
        modifierDetails,
        rolledAt: currentRoll.rolledAt || 0
      }
    : null;
  return {
    name: (getById('char-name')?.textContent || 'Unknown').trim() || 'Unknown',
    career: (getById('char-career')?.dataset?.career || getById('char-career')?.textContent || 'UNKNOWN').trim() || 'UNKNOWN',
    role: (getById('room-sync-role')?.value || 'player').trim() || 'player',
    baseStats,
    stats,
    skills,
    specialSkills,
    armor,
    damage,
    reputation: getEffectiveReputationValue(),
    wallet: getEffectiveWalletValue(),
    physical: {
      bodyLevel: effectivePhysical.bodyLevel,
      weight: effectivePhysical.weight,
      stun: effectivePhysical.stun
    },
    inventory: inventoryItems,
    inventoryDetailed,
    combatPenalty: Number(persistentRollPenalty || 0),
    lastRoll
  };
}

function buildCurrentDossierSheetData() {
  const names = [];
  const mainName = (getById('char-name')?.textContent || '').trim();
  if (mainName && mainName !== '--') names.push(mainName);
  document.querySelectorAll('.alias-tag').forEach((node) => {
    const alias = String(node.textContent || '').trim();
    if (alias) names.push(alias);
  });

  const careerSkill = { point: Number(upgradePoints || 0) };
  sheetSkills.forEach((skill) => {
    const label = String(skill?.name || '').trim();
    if (!label) return;
    careerSkill[label] = Number(skill?.value || 0);
  });

  const armor = {};
  const damage = {};
  LIMBS.forEach((limb) => {
    armor[limb] = Number(limbSP[limb] || 0);
    damage[limb] = Number(limbDMG[limb] || 0);
  });

  return {
    name: names.length ? names : ['Unknown'],
    stats: Object.fromEntries(Object.entries(sheetStats).map(([key, value]) => [key, Number(value || 0)])),
    career: [String(getById('char-career')?.dataset?.career || getById('char-career')?.textContent || 'UNKNOWN').trim() || 'UNKNOWN'],
    careerSkill,
    specialSkills: sheetSpecialSkills.map((skill) => ({
      id: skill.id || '',
      name: skill.name || 'Special Skill',
      tiedSkill: skill.tiedSkill || '',
      value: Number(skill.value || 0),
      description: skill.description || ''
    })),
    reputation: { rep: Number(repValue || 0) },
    wallet: { eddies: Number(walletValue || 0) },
    physicalBody: {
      bodylevel: Number(bodyLevelVal || 0),
      weight: Number(weightVal || 0),
      stunpoint: Number(stunVal || 0)
    },
    body: {},
    stunpoint: {},
    armor,
    damage,
    inventory: JSON.parse(JSON.stringify(inventory || {}))
  };
}

function readSyncedNpcDossier(npcId) {
  if (!npcId) return null;
  try {
    const raw = window.localStorage?.getItem(getNpcDossierSyncKey(npcId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read NPC dossier sync payload.', error);
    return null;
  }
}

function syncActiveNpcDossierState() {
  if (!activeNpcSyncId || npcSyncWriteSuppressed) return;
  try {
    window.localStorage?.setItem(getNpcDossierSyncKey(activeNpcSyncId), JSON.stringify({
      npcId: activeNpcSyncId,
      updatedAt: Date.now(),
      source: 'dossier',
      data: buildCurrentDossierSheetData()
    }));
  } catch (error) {
    console.warn('Failed to sync NPC dossier state.', error);
  }
}

function applyIncomingNpcDossierSync(payload, showLog = false) {
  if (!payload?.data || !payload?.npcId) return;
  activeNpcSyncId = String(payload.npcId || '').trim();
  npcSyncWriteSuppressed = true;
  try {
    renderSheet(payload.data);
  } finally {
    npcSyncWriteSuppressed = false;
  }
  if (showLog) showActionLog(`NPC DOSSIER SYNCED: ${fileSafeNameFromData(payload.data)}`);
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

function resolveInventoryStatTarget(label) {
  const clean = normalizeLookup(label);
  const alias = INVENTORY_STAT_ALIASES[clean];
  if (alias && Object.prototype.hasOwnProperty.call(sheetStats, alias)) return alias;
  if (clean === 'emp' && Object.prototype.hasOwnProperty.call(sheetStats, 'EMPT')) return 'EMPT';
  return alias || '';
}

function resolveInventorySkillTarget(label) {
  const clean = normalizeLookup(label);
  const found = (sheetSkills || []).find((skill) => {
    const skillLookup = normalizeLookup(skill?.name);
    return skillLookup === clean || skillLookup.includes(clean) || clean.includes(skillLookup);
  });
  return found?.name || '';
}

function resolveInventoryPhysicalTarget(label) {
  return INVENTORY_PHYSICAL_ALIASES[normalizeLookup(label)] || '';
}

function resolveInventoryArmorTarget(label) {
  const clean = normalizeLookup(label);
  for (const limb of LIMBS) {
    const limbKey = normalizeLookup(limb);
    if (clean === limbKey) return limb;
    if (clean.includes(limbKey) && (clean.includes('sp') || clean.includes('armor') || clean.includes('armour'))) return limb;
  }
  return '';
}

function parseDiceFormula(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;
  const qty = Math.max(1, parseInt(match[1], 10) || 1);
  const sides = Math.max(2, parseInt(match[2], 10) || 2);
  const bonusMagnitude = parseInt(match[4], 10) || 0;
  const flatBonus = match[3] === '-' ? -bonusMagnitude : bonusMagnitude;
  return {
    qty,
    sides,
    flatBonus,
    dicePool: Array.from({ length: qty }, () => sides)
  };
}

function getInventoryFieldDescriptor(label, value) {
  const raw = String(value ?? '').trim();
  const lookup = normalizeLookup(label);
  const dice = parseDiceFormula(raw);
  const signedInt = /^[-+]\d+$/.test(raw) ? parseInt(raw, 10) : null;
  const plainInt = /^[-+]?\d+$/.test(raw) ? parseInt(raw, 10) : null;
  const currencyMatch = raw.match(/^([-+]?\d+)\s*eb$/i);
  const distanceMatch = raw.match(/^([-+]?\d+)\s*m$/i);
  const statTarget = resolveInventoryStatTarget(label);
  const skillTarget = resolveInventorySkillTarget(label);
  const physicalTarget = resolveInventoryPhysicalTarget(label);
  const armorTarget = resolveInventoryArmorTarget(label);

  if (dice) {
    return {
      kind: 'dice',
      label,
      raw,
      ...dice,
      displayValue: `${dice.qty}D${dice.sides}${dice.flatBonus ? ` ${dice.flatBonus > 0 ? '+' : '-'} ${Math.abs(dice.flatBonus)}` : ''}`
    };
  }
  if (currencyMatch) {
    const numericValue = parseInt(currencyMatch[1], 10) || 0;
    return { kind: 'currency', label, raw, numericValue, displayValue: `${numericValue} EB` };
  }
  if (distanceMatch) {
    const numericValue = parseInt(distanceMatch[1], 10) || 0;
    return { kind: 'distance', label, raw, numericValue, displayValue: `${numericValue} m` };
  }
  if (statTarget && plainInt !== null) {
    return {
      kind: 'effect',
      targetType: 'stat',
      target: statTarget,
      label,
      raw,
      numericValue: plainInt,
      displayValue: `${plainInt >= 0 ? '+' : ''}${plainInt}`
    };
  }
  if (skillTarget && plainInt !== null) {
    return {
      kind: 'effect',
      targetType: 'skill',
      target: skillTarget,
      label,
      raw,
      numericValue: plainInt,
      displayValue: `${plainInt >= 0 ? '+' : ''}${plainInt}`
    };
  }
  if (physicalTarget && plainInt !== null) {
    return {
      kind: 'effect',
      targetType: 'physical',
      target: physicalTarget,
      label,
      raw,
      numericValue: plainInt,
      displayValue: `${plainInt >= 0 ? '+' : ''}${plainInt}`
    };
  }
  if ((lookup === 'reputation' || lookup === 'rep') && plainInt !== null) {
    return {
      kind: 'effect',
      targetType: 'resource',
      target: 'reputation',
      label,
      raw,
      numericValue: plainInt,
      displayValue: `${plainInt >= 0 ? '+' : ''}${plainInt}`
    };
  }
  if ((lookup === 'wallet' || lookup === 'eddies' || lookup === 'eb' || lookup === 'eurobucks') && plainInt !== null) {
    return {
      kind: 'effect',
      targetType: 'resource',
      target: 'wallet',
      label,
      raw,
      numericValue: plainInt,
      displayValue: `${plainInt >= 0 ? '+' : ''}${plainInt} EB`
    };
  }
  if (armorTarget && plainInt !== null) {
    return {
      kind: 'armor_sp',
      targetType: 'armor',
      target: armorTarget,
      label,
      raw,
      numericValue: plainInt,
      displayValue: `${plainInt >= 0 ? '+' : ''}${plainInt} SP`
    };
  }
  if (signedInt !== null) {
    return {
      kind: 'modifier',
      label,
      raw,
      numericValue: signedInt,
      displayValue: `${signedInt >= 0 ? '+' : ''}${signedInt}`
    };
  }
  if (plainInt !== null) {
    return {
      kind: 'number',
      label,
      raw,
      numericValue: plainInt,
      displayValue: String(plainInt)
    };
  }
  return {
    kind: 'text',
    label,
    raw,
    displayValue: raw
  };
}

function getInventoryFieldToggleKey(itemId, fieldLabel) {
  return `${String(itemId || '').trim()}::${String(fieldLabel || '').trim()}`;
}

function isInventoryDescriptorAutoApplied(descriptor) {
  return descriptor?.kind === 'effect'
    && ['stat', 'skill', 'physical'].includes(String(descriptor?.targetType || '').trim());
}

function isInventoryFieldEffectActive(itemId, fieldLabel) {
  return !!activeInventoryFieldToggles[getInventoryFieldToggleKey(itemId, fieldLabel)];
}

function setInventoryFieldEffectActive(itemId, fieldLabel, active) {
  const key = getInventoryFieldToggleKey(itemId, fieldLabel);
  if (active) activeInventoryFieldToggles[key] = true;
  else delete activeInventoryFieldToggles[key];
}

function clearInventoryFieldEffects() {
  activeInventoryFieldToggles = {};
}

function clearInventoryFieldEffectsForItem(itemId) {
  const prefix = `${String(itemId || '').trim()}::`;
  Object.keys(activeInventoryFieldToggles).forEach((key) => {
    if (key.startsWith(prefix)) delete activeInventoryFieldToggles[key];
  });
}

function findInventoryItemById(itemId) {
  const targetId = String(itemId || '').trim();
  if (!targetId) return null;
  for (const [category, items] of Object.entries(inventory || {})) {
    const idx = (items || []).findIndex((entry) => String(entry?.id || '').trim() === targetId);
    if (idx > -1) return { category, idx, item: items[idx] };
  }
  return null;
}

function getActiveInventoryFieldDescriptors() {
  const activeDescriptors = [];
  Object.entries(inventory || {}).forEach(([category, items]) => {
    (items || []).forEach((item) => {
      Object.entries(item?.fields || {}).forEach(([label, value]) => {
        const descriptor = getInventoryFieldDescriptor(label, value);
        const autoApplied = isInventoryDescriptorAutoApplied(descriptor);
        if (!autoApplied && !isInventoryFieldEffectActive(item.id, label)) return;
        if (!['effect', 'armor_sp'].includes(descriptor.kind)) return;
        activeDescriptors.push({
          ...descriptor,
          itemId: item.id,
          itemName: item.name || humanizeLabel(item.id || category),
          category,
          autoApplied
        });
      });
    });
  });
  return activeDescriptors;
}

function getInventoryDerivedState() {
  const state = {
    stats: {},
    skills: {},
    physical: { bodyLevel: 0, weight: 0, stun: 0 },
    resources: { reputation: 0, wallet: 0 },
    armor: {},
    effects: []
  };
  getActiveInventoryFieldDescriptors().forEach((descriptor) => {
    if (descriptor.kind === 'effect') {
      if (descriptor.targetType === 'stat' && descriptor.target) {
        state.stats[descriptor.target] = (state.stats[descriptor.target] || 0) + descriptor.numericValue;
      } else if (descriptor.targetType === 'skill' && descriptor.target) {
        state.skills[descriptor.target] = (state.skills[descriptor.target] || 0) + descriptor.numericValue;
      } else if (descriptor.targetType === 'physical' && descriptor.target) {
        state.physical[descriptor.target] = (state.physical[descriptor.target] || 0) + descriptor.numericValue;
      } else if (descriptor.targetType === 'resource' && descriptor.target) {
        state.resources[descriptor.target] = (state.resources[descriptor.target] || 0) + descriptor.numericValue;
      }
      state.effects.push({
        id: `${descriptor.itemId}:${descriptor.label}`,
        label: descriptor.itemName || 'Item Effect',
        note: `${descriptor.label} ${descriptor.numericValue >= 0 ? '+' : ''}${descriptor.numericValue}`,
        source: 'ITEM',
        modifier: null,
        locked: true
      });
    } else if (descriptor.kind === 'armor_sp' && descriptor.target) {
      state.armor[descriptor.target] = (state.armor[descriptor.target] || 0) + descriptor.numericValue;
      state.effects.push({
        id: `${descriptor.itemId}:${descriptor.label}`,
        label: descriptor.itemName || 'Armor Item',
        note: `${descriptor.target} SP ${descriptor.numericValue >= 0 ? '+' : ''}${descriptor.numericValue}`,
        source: 'ITEM',
        modifier: null,
        locked: true
      });
    }
  });
  return state;
}

function getBaseStatWithInventoryBonus(key) {
  return Math.max(0, (parseInt(sheetStats[key], 10) || 0) + (getInventoryDerivedState().stats[key] || 0));
}

function getSkillValueWithInventoryBonus(label, baseValue = null) {
  const base = baseValue === null
    ? ((sheetSkills.find((skill) => skill.name === label)?.value) || 0)
    : baseValue;
  return Math.max(0, base + (getInventoryDerivedState().skills[label] || 0));
}

function getEffectiveReputationValue() {
  return Math.max(0, repValue + (getInventoryDerivedState().resources.reputation || 0));
}

function getEffectiveWalletValue() {
  return Math.max(0, walletValue + (getInventoryDerivedState().resources.wallet || 0));
}

function getEffectivePhysicalValues() {
  const derived = getInventoryDerivedState().physical;
  return {
    bodyLevel: Math.max(0, Math.min(4, bodyLevelVal + (derived.bodyLevel || 0))),
    weight: Math.max(0, weightVal + (derived.weight || 0)),
    stun: Math.max(0, stunVal + (derived.stun || 0))
  };
}

function getEffectiveArmorValue(limb) {
  return Math.max(0, (limbSP[limb] || 0) + (getInventoryDerivedState().armor[limb] || 0));
}

function getEffectiveArmorBonus(limb) {
  return getInventoryDerivedState().armor[limb] || 0;
}

function toggleInventoryFieldEffect(itemId, fieldLabel) {
  const found = findInventoryItemById(itemId);
  if (!found?.item) return;
  const descriptor = getInventoryFieldDescriptor(fieldLabel, found.item.fields?.[fieldLabel]);
  if (!['effect', 'armor_sp'].includes(descriptor.kind)) return;
  if (isInventoryDescriptorAutoApplied(descriptor)) return;
  const nextState = !isInventoryFieldEffectActive(itemId, fieldLabel);
  setInventoryFieldEffectActive(itemId, fieldLabel, nextState);
  renderStats();
  renderSkills();
  renderRep();
  renderWallet();
  renderPhysicalBody();
  renderLimbs();
  renderActiveEffects();
  renderRollLab();
  showActionLog(`${nextState ? 'APPLIED' : 'REMOVED'} ${String(found.item.name || fieldLabel).toUpperCase()} // ${String(fieldLabel).toUpperCase()}`);
}

function getRenderableStatusEffects() {
  const effects = [...getInventoryDerivedState().effects, ...activeStatusEffects];
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

function stopPlayerCommandWatch() {
  if (typeof playerCommandUnsubscribe === 'function') playerCommandUnsubscribe();
  playerCommandUnsubscribe = null;
}

function stopRemoteBreachWatch() {
  if (typeof remoteBreachUnsubscribe === 'function') remoteBreachUnsubscribe();
  remoteBreachUnsubscribe = null;
  if (typeof window.handleIncomingRemoteBreachSession === 'function') {
    window.handleIncomingRemoteBreachSession(null, { roomId: activeRoomId, clientId: getSyncClientId() });
  }
}

function startRemoteBreachWatch(roomId) {
  stopRemoteBreachWatch();
  if (!roomId || typeof watchRemoteBreach !== 'function') return;
  remoteBreachUnsubscribe = watchRemoteBreach(roomId, (session) => {
    if (typeof window.handleIncomingRemoteBreachSession === 'function') {
      window.handleIncomingRemoteBreachSession(session, { roomId, clientId: getSyncClientId() });
    }
  });
}

function stopCombatSummaryWatch() {
  if (typeof combatSummaryUnsubscribe === 'function') combatSummaryUnsubscribe();
  combatSummaryUnsubscribe = null;
  activeCombatSummary = null;
  resetCombatLuck(false);
  renderCombatSummaryDrawer();
}

function startCombatSummaryWatch(roomId) {
  stopCombatSummaryWatch();
  if (!roomId || typeof watchCombatSummary !== 'function') return;
  combatSummaryUnsubscribe = watchCombatSummary(roomId, (summary) => {
    const hadCombat = isCombatActive();
    activeCombatSummary = normalizeCombatSummary(summary);
    if (hadCombat && !isCombatActive()) resetCombatLuck(true);
    else if (typeof renderStats === 'function') renderStats();
    renderCombatSummaryDrawer();
  });
}

function rebuildInventoryItemFromPayload(payload, fallbackCategory = 'miscellaneous') {
  const category = sanitizeInventoryCategory(payload?.category || fallbackCategory);
  const fields = {};
  (payload?.fields || []).forEach((field) => {
    const label = String(field?.label || '').trim();
    if (!label) return;
    fields[label] = String(field?.value ?? '').trim();
  });
  return {
    category,
    item: {
      id: String(payload?.id || buildInventoryId(category)).trim() || buildInventoryId(category),
      name: String(payload?.name || 'Item').trim() || 'Item',
      fields,
      info: Array.isArray(payload?.info) ? payload.info.map((line) => String(line || '').trim()).filter(Boolean) : []
    }
  };
}

function applyRemoteInventoryUpsert(payload) {
  const { category, item } = rebuildInventoryItemFromPayload(payload, payload?.category);
  Object.keys(inventory || {}).forEach((existingCategory) => {
    if (existingCategory === category || !Array.isArray(inventory[existingCategory])) return;
    inventory[existingCategory] = inventory[existingCategory].filter((entry) => entry.id !== item.id);
    if (!inventory[existingCategory].length) delete inventory[existingCategory];
  });
  if (!inventory[category]) inventory[category] = [];
  const existingIndex = inventory[category].findIndex((entry) => entry.id === item.id);
  if (existingIndex > -1) inventory[category][existingIndex] = item;
  else inventory[category].push(item);
  renderInventory();
  renderStats();
  renderSkills();
  renderRep();
  renderWallet();
  renderPhysicalBody();
  renderLimbs();
  renderActiveEffects();
  renderRollLab();
}

function applyRemoteInventoryDelete(payload) {
  const category = sanitizeInventoryCategory(payload?.category);
  const itemId = String(payload?.id || '').trim();
  if (!category || !inventory[category]?.length) return;
  inventory[category] = inventory[category].filter((item) => item.id !== itemId);
  clearInventoryFieldEffectsForItem(itemId);
  if (!inventory[category].length) delete inventory[category];
  renderInventory();
  renderStats();
  renderSkills();
  renderRep();
  renderWallet();
  renderPhysicalBody();
  renderLimbs();
  renderActiveEffects();
  renderRollLab();
}

function applyRemotePlayerCommand(commandId, command) {
  if (!command || !command.type) return;
  const num = (value) => Math.max(0, parseInt(value, 10) || 0);
  switch (command.type) {
    case 'setStat':
      if (command.key) {
        sheetStats[command.key] = num(command.value);
        renderStats();
      }
      break;
    case 'setSkill': {
      const label = String(command.label || '').trim();
      if (!label) break;
      const idx = sheetSkills.findIndex((skill) => skill.name === label);
      if (idx > -1) sheetSkills[idx].value = num(command.value);
      else sheetSkills.push({ name: label, value: num(command.value) });
      renderSkills();
      break;
    }
    case 'setReputation':
      repValue = num(command.value);
      renderRep();
      break;
    case 'setWallet':
      walletValue = num(command.value);
      renderWallet();
      break;
    case 'setPhysical':
      if (command.field === 'bodyLevel') bodyLevelVal = Math.max(0, Math.min(4, num(command.value)));
      else if (command.field === 'weight') weightVal = num(command.value);
      else if (command.field === 'stun') stunVal = num(command.value);
      renderPhysicalBody();
      break;
    case 'setArmor':
      if (LIMBS.includes(command.limb)) {
        limbSP[command.limb] = num(command.value);
        renderLimbs();
      }
      break;
    case 'setDamage':
      if (LIMBS.includes(command.limb)) {
        limbDMG[command.limb] = num(command.value);
        renderLimbs();
      }
      break;
    case 'inventoryUpsert':
      applyRemoteInventoryUpsert(command.item || {});
      break;
    case 'inventoryDelete':
      applyRemoteInventoryDelete(command.item || {});
      break;
    default:
      return;
  }
  showActionLog(`REFEREE UPDATE // ${String(command.label || command.type).toUpperCase()}`);
}

function startPlayerCommandWatch(roomId) {
  stopPlayerCommandWatch();
  if (!roomId || typeof watchPlayerCommands !== 'function') return;
  playerCommandUnsubscribe = watchPlayerCommands(roomId, async (commandId, command) => {
    try {
      applyRemotePlayerCommand(commandId, command);
    } finally {
      try {
        await clearPlayerCommand(roomId, getSyncClientId(), commandId);
      } catch (error) {
        console.warn('Failed to clear remote player command.', error);
      }
    }
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
    startPlayerCommandWatch(roomId);
    startRemoteBreachWatch(roomId);
    startCombatSummaryWatch(roomId);
    setRoomSyncStatus('connected');
    renderCombatSummaryDrawer();
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
    stopPlayerCommandWatch();
    stopRemoteBreachWatch();
    stopCombatSummaryWatch();
    await disconnectPlayerPresence();
  } catch (error) {
    console.warn('Room disconnect failed.', error);
  }
  activeRoomId = '';
  setRoomSyncStatus('disconnected');
  renderCombatSummaryDrawer();
  showActionLog('ROOM LINK DISCONNECTED');
}

async function syncCurrentPlayerPresence() {
  syncActiveNpcDossierState();
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
    (currentRoll.diceLabel || currentRoll.sides)
      ? `Last roll ${currentRoll.diceLabel || `${currentRoll.qty}D${currentRoll.sides}`} => ${currentRoll.result}.`
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

window.addEventListener('storage', (event) => {
  if (!event.key || !event.key.startsWith(NPC_DOSSIER_SYNC_PREFIX) || !event.newValue) return;
  try {
    const payload = JSON.parse(event.newValue);
    if (!payload?.npcId || payload.source === 'dossier' || !payload.data) return;
    if (activeNpcSyncId && payload.npcId !== activeNpcSyncId) return;
    applyIncomingNpcDossierSync(payload, true);
  } catch (error) {
    console.warn('Failed to apply synced NPC dossier update.', error);
  }
});

window.readSyncedNpcDossier = readSyncedNpcDossier;
window.applyIncomingNpcDossierSync = applyIncomingNpcDossierSync;
window.getInventoryFieldDescriptor = getInventoryFieldDescriptor;
window.findInventoryItemById = findInventoryItemById;
window.toggleInventoryFieldEffect = toggleInventoryFieldEffect;
window.isInventoryFieldEffectActive = isInventoryFieldEffectActive;
window.isInventoryDescriptorAutoApplied = isInventoryDescriptorAutoApplied;
window.getSkillValueWithInventoryBonus = getSkillValueWithInventoryBonus;
window.getEffectiveReputationValue = getEffectiveReputationValue;
window.getEffectiveWalletValue = getEffectiveWalletValue;
window.getEffectivePhysicalValues = getEffectivePhysicalValues;
window.getEffectiveArmorValue = getEffectiveArmorValue;
window.getEffectiveArmorBonus = getEffectiveArmorBonus;

renderCombatSummaryDrawer();

function resetSheet() {
  showModal('CLEAR DOSSIER?', 'Discard current character and reset the dossier to blank values?', () => {
    getById('file-input2').value = '';
    getById('item-file-input').value = '';
    getById('banner-image-input').value = '';
    bannerImageData = '';
    bannerImageName = '';
    clearInventoryFieldEffects();
    getById('status-bar').style.display = 'none';
    closeInventoryEditor();
    closeAimHitModal();
    cancelRollExecution();
    closeRollCinemaModal();
    stopPlayerPromptWatch();
    stopPlayerEffectsWatch();
    stopPlayerCommandWatch();
    stopRemoteBreachWatch();
    persistentRollPenalty = 0;
    clearInterval(_rollTimer);
    renderSheet(buildBlankSheetData());
    closeModal();
    showActionLog('CLEARED DOSSIER');
  });
}
