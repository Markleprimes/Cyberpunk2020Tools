const DOSSIER_ROLE_KEYS = {
  solo: 'solo',
  netrunner: 'netrunner',
  techie: 'techie',
  tech: 'techie',
  medtech: 'medtech',
  medtechie: 'medtech',
  fixer: 'fixer',
  media: 'media',
  cop: 'cop',
  lawman: 'cop',
  nomad: 'nomad',
  rockerboy: 'rockerboy',
  rocker: 'rockerboy',
  hobo: 'hobo'
};

const DOSSIER_ROLE_LABELS = {
  solo: 'Solo',
  netrunner: 'Netrunner',
  techie: 'Techie',
  medtech: 'Medtech',
  fixer: 'Fixer',
  media: 'Media',
  cop: 'Cop',
  nomad: 'Nomad',
  rockerboy: 'Rockerboy',
  hobo: 'Hobo'
};

function getDossierRoleLogoPath(key) {
  return `images/roles/${key}.png`;
}

function getDossierRoleKey(value) {
  const clean = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return DOSSIER_ROLE_KEYS[clean] || '';
}

function renderCareerBadge(career) {
  const badge = document.getElementById('char-career');
  if (!badge) return;
  const label = String(career || '???').trim() || '???';
  const key = getDossierRoleKey(label);
  badge.className = 'career-badge';
  badge.dataset.career = label;
  badge.removeAttribute('title');
  badge.removeAttribute('aria-label');

  if (key) {
    const roleLabel = DOSSIER_ROLE_LABELS[key] || label;
    badge.classList.add('career-logo-only', `role-${key}`);
    badge.dataset.career = roleLabel;
    badge.dataset.roleLogo = key;
    badge.title = roleLabel;
    badge.setAttribute('aria-label', roleLabel);
    badge.innerHTML = `<img class="role-logo-img role-logo-img-${key}" src="${getDossierRoleLogoPath(key)}" alt="">`;
    return;
  }

  badge.innerHTML = `<span class="career-badge-text">${escapeHtml(label)}</span>`;
  delete badge.dataset.roleLogo;
}

function renderSheet(data) {
  document.getElementById('status-bar').style.display = 'none';
  document.getElementById('char-name').textContent = data.name[0] || 'Unknown';
  document.getElementById('char-aliases').innerHTML = data.name.slice(1).map((a) => `<span class="alias-tag">${a}</span>`).join('');
  renderCareerBadge(data.career[0] || '???');
  renderBannerImage();
  syncCurrentPlayerPresence();

  sheetStats = {};
  Object.entries(data.stats || {}).forEach(([k, v]) => {
    sheetStats[k] = parseInt(v, 10) || 0;
  });
  renderStats();

  sheetSkills = [];
  Object.entries(data.careerSkill || {}).forEach(([k, v]) => {
    if (k.toLowerCase() === 'point') return;
    sheetSkills.push({ name: k, value: parseInt(v, 10) || 0 });
  });
  upgradePoints = parseInt(data.careerSkill?.point, 10) || 0;
  renderSkills();

  sheetSpecialSkills = Array.isArray(data.specialSkills)
    ? data.specialSkills.map((skill, idx) => ({
      id: String(skill?.id || `specialskill${idx + 1}`).trim() || `specialskill${idx + 1}`,
      name: String(skill?.name || `Special Skill ${idx + 1}`).trim() || `Special Skill ${idx + 1}`,
      tiedSkill: String(skill?.tiedSkill || '').trim(),
      value: parseInt(skill?.value, 10) || 0,
      description: String(skill?.description || '').trim()
    }))
    : [];
  renderSpecialSkills();

  repValue = parseInt(data.reputation?.rep, 10) || 0;
  renderRep();
  walletValue = parseInt(data.wallet?.eddies, 10) || 0;
  renderWallet();

  bodyLevelVal = Math.max(0, Math.min(4, parseInt(data.physicalBody?.bodylevel, 10) || 0));
  weightVal = parseInt(data.physicalBody?.weight, 10);
  if (Number.isNaN(weightVal)) weightVal = parseInt(data.body?.weight, 10) || 0;
  stunVal = parseInt(data.physicalBody?.stunpoint, 10);
  if (Number.isNaN(stunVal)) stunVal = parseInt(data.stunpoint?.stun, 10) || 0;
  renderPhysicalBody();

  if (typeof clearInventoryFieldEffects === 'function') clearInventoryFieldEffects();
  inventory = {};
  mergeInventory(data.inventory || {});
  renderInventory();

  rollModifiers = [];
  aimStackPoints = 0;
  if (typeof resetQueuedDiceSilently === 'function') resetQueuedDiceSilently();
  if (typeof resetCombatLuck === 'function') resetCombatLuck(false);
  currentRoll = { sides: null, qty: 0, diceTypes: [], diceLabel: '', rolls: [], result: 0, modifiers: 0, total: 0, rolledAt: 0 };
  renderActiveEffects();
  renderRollLab();

  LIMBS.forEach((limb) => {
    limbSP[limb] = parseInt(data.armor?.[limb], 10) || 0;
    limbDMG[limb] = parseInt(data.damage?.[limb], 10) || 0;
  });
  renderLimbs();

  document.getElementById('sheet').style.display = 'block';
  updateSystemStrip(true);
}

function renderStats() {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = '';
  const debuffs = computeStatDebuffs();
  Object.entries(sheetStats).forEach(([k, v]) => {
    const col = STAT_COLORS[k] || 'var(--accent)';
    const debuff = debuffs[k] || null;
    const effective = getEffectiveStatValue(k);
    const isLuckSpent = k === 'LUCK' && effective !== v;
    const rollTitle = k === 'LUCK'
      ? 'Add current LUCK to roll and double raw dice result. In combat, using it spends 1 LUCK on your turn.'
      : `Add ${k} to roll`;
    const rollAction = k === 'LUCK'
      ? 'addLuckRollModifier()'
      : `addRollModifier('STAT','${k}',${effective})`;
    const card = document.createElement('div');
    card.className = `stat-item${debuff ? ' debuffed' : ''}`;
    card.innerHTML = `
      <div class="stat-label">${k}</div>
      <div class="stat-value pickable" id="sv-${k}" style="color:${col};text-shadow:var(--stat-core-glow)" title="${rollTitle}" onclick="${rollAction}">${effective}${(debuff && effective !== v) || isLuckSpent ? `<span style="font-size:.55em;opacity:.6"> (${v})</span>` : ''}</div>
      <div class="stat-debuff-tag" id="sdt-${k}">${debuff ? debuff.label : isLuckSpent ? `-${v - effective} (COMBAT)` : ''}</div>
      <div class="stat-controls">
        <button class="ctrl-btn" onclick="changeStat('${k}',1)">+</button>
        <button class="ctrl-btn minus" onclick="changeStat('${k}',-1)">-</button>
      </div>`;
    grid.appendChild(card);
  });
  syncCurrentPlayerPresence();
}

function changeStat(key, delta) {
  sheetStats[key] = Math.max(0, (sheetStats[key] || 0) + delta);
  const el = document.getElementById(`sv-${key}`);
  if (el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }
  pulsePanelFromNode(el);
  renderStats();
  showActionLog(`${key} ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${sheetStats[key]}`);
}

function getWoundLevel(dmg) {
  if (dmg <= 0) return null;
  if (dmg <= 4) return 'light';
  if (dmg <= 6) return 'serious';
  if (dmg <= 8) return 'critical';
  return 'mortal';
}

function computeStatDebuffs() {
  let worst = null;
  const order = ['light', 'serious', 'critical', 'mortal'];
  LIMBS.forEach((limb) => {
    const lvl = getWoundLevel(limbDMG[limb]);
    if (lvl && (!worst || order.indexOf(lvl) > order.indexOf(worst))) worst = lvl;
  });
  const debuffs = {};
  if (worst === 'serious') {
    debuffs.REF = { flat: 2, mult: 1, label: '-2 (SERIOUS)' };
  } else if (worst === 'critical') {
    ['REF', 'COOL', 'INT'].forEach((s) => {
      debuffs[s] = { flat: 0, mult: 0.5, label: '/2 (CRITICAL)' };
    });
  } else if (worst === 'mortal') {
    ['REF', 'COOL', 'INT'].forEach((s) => {
      debuffs[s] = { flat: 0, mult: 1 / 3, label: '/3 (MORTAL)' };
    });
  }
  return debuffs;
}

function getEffectiveStatValue(key) {
  let base = typeof getBaseStatWithInventoryBonus === 'function'
    ? getBaseStatWithInventoryBonus(key)
    : (sheetStats[key] || 0);
  if (key === 'LUCK' && typeof getAvailableCombatLuck === 'function') {
    base = getAvailableCombatLuck();
  }
  const debuff = computeStatDebuffs()[key];
  return debuff ? Math.max(0, Math.floor(base * debuff.mult) - debuff.flat) : base;
}

function getSkillValueByNames(...names) {
  const targets = names.map(normalizeLookup).filter(Boolean);
  let best = 0;
  sheetSkills.forEach((skill) => {
    const lookup = normalizeLookup(skill.name);
    if (targets.some((target) => lookup === target || lookup.includes(target) || target.includes(lookup))) {
      best = Math.max(best, typeof getSkillValueWithInventoryBonus === 'function'
        ? getSkillValueWithInventoryBonus(skill.name, skill.value || 0)
        : (skill.value || 0));
    }
  });
  return best;
}

function renderSkills() {
  const sp = document.getElementById('sp-display');
  sp.textContent = upgradePoints;
  sp.className = `sp-value${upgradePoints < 0 ? ' negative' : ''}`;
  const list = document.getElementById('skill-list');
  list.innerHTML = '';
  const maxVal = Math.max(...sheetSkills.map((skill) => skill.value), 10);
  sheetSkills.forEach((skill, idx) => {
    const effectiveValue = typeof getSkillValueWithInventoryBonus === 'function'
      ? getSkillValueWithInventoryBonus(skill.name, skill.value || 0)
      : (skill.value || 0);
    const pct = Math.min(100, (effectiveValue / maxVal) * 100);
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <div class="skill-main" title="Add ${skill.name} to roll" onclick="addRollModifier('SKILL','${skill.name.replace(/'/g, "\\'")}',${effectiveValue})">
        <span class="skill-name">${skill.name}</span>
        <div class="skill-bar-wrap"><div class="skill-bar" style="width:${pct}%"></div></div>
        <span class="skill-val pickable">${effectiveValue}${effectiveValue !== (skill.value || 0) ? `<span style="font-size:.55em;opacity:.6"> (${skill.value || 0})</span>` : ''}</span>
      </div>
      <div class="skill-ctrl-wrap">
        <button class="skill-ctrl-btn" onclick="event.stopPropagation();changeSkill(${idx},1)">+</button>
        <button class="skill-ctrl-btn minus" onclick="event.stopPropagation();changeSkill(${idx},-1)">-</button>
      </div>`;
    list.appendChild(row);
  });
  if (!sheetSkills.length) list.innerHTML = '';
  syncCurrentPlayerPresence();
}

function renderSpecialSkillTiedOptions() {
  const list = document.getElementById('special-skill-tied-options');
  if (!list) return;
  list.innerHTML = sheetSkills
    .map((skill) => `<option value="${escapeHtml(skill.name)}"></option>`)
    .join('');
}

function renderSpecialSkills() {
  const list = document.getElementById('special-skill-list');
  if (!list) return;
  renderSpecialSkillTiedOptions();
  if (!sheetSpecialSkills.length) {
    list.innerHTML = '<div class="inventory-empty">NO SPECIAL SKILLS LOADED</div>';
    syncCurrentPlayerPresence();
    return;
  }
  list.innerHTML = sheetSpecialSkills.map((skill, idx) => `
    <div class="special-skill-row">
      <div class="special-skill-main" title="Add ${escapeHtml(skill.name)} to roll" onclick="addRollModifier('SPECIAL','${escapeJsString(skill.name)}',${parseInt(skill.value, 10) || 0})">
        <div class="special-skill-name">${escapeHtml(skill.name)}</div>
        <div class="special-skill-meta">${escapeHtml(skill.tiedSkill || 'UNLINKED')} // VALUE ${parseInt(skill.value, 10) || 0}</div>
        <div class="special-skill-desc">${escapeHtml(skill.description || 'No description.')}</div>
      </div>
      <div class="special-skill-actions">
        <div class="special-skill-value">${parseInt(skill.value, 10) || 0}</div>
        <button class="add-skill-btn" type="button" onclick="event.stopPropagation();openSpecialSkillEditor(${idx})">EDIT</button>
        <button class="action-btn red" type="button" onclick="event.stopPropagation();removeSpecialSkill(${idx})">DEL</button>
      </div>
    </div>
  `).join('');
  syncCurrentPlayerPresence();
}

function changeUpgradePoints(delta) {
  upgradePoints += delta;
  renderSkills();
  flashById('sp-display');
  pulsePanelFromNode(document.getElementById('sp-display'));
  showActionLog(`SKILL POINTS ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${upgradePoints}`);
}

function changeSkill(idx, delta) {
  const skill = sheetSkills[idx];
  const newVal = skill.value + delta;
  if (newVal < 0) return;
  if (newVal === 0 && delta < 0) {
    showModal('DELETE SKILL?', `Remove "${skill.name}" from your skill list?`, () => {
      sheetSkills.splice(idx, 1);
      upgradePoints -= delta;
      renderSkills();
      closeModal();
    });
    return;
  }
  upgradePoints -= delta;
  skill.value = newVal;
  renderSkills();
  pulsePanelFromNode(document.getElementById('skill-list'));
  showActionLog(`${skill.name.toUpperCase()} ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${skill.value}`);
}

function addCustomSkill() {
  const input = document.getElementById('new-skill-name');
  const name = input.value.trim();
  if (!name) return;
  sheetSkills.push({ name, value: 1 });
  upgradePoints -= 1;
  input.value = '';
  renderSkills();
  pulsePanelFromNode(document.getElementById('skill-list'));
  showActionLog(`ADDED CUSTOM SKILL ${name.toUpperCase()}`);
}

function openSpecialSkillEditor(idx = -1) {
  specialSkillEditState = { idx };
  const editing = idx > -1 && sheetSpecialSkills[idx];
  const skill = editing ? sheetSpecialSkills[idx] : { name: '', tiedSkill: '', value: 0, description: '' };
  document.getElementById('special-skill-editor-title').textContent = editing ? 'EDIT SPECIAL SKILL' : 'ADD SPECIAL SKILL';
  document.getElementById('special-skill-name').value = skill.name || '';
  document.getElementById('special-skill-tied').value = skill.tiedSkill || '';
  document.getElementById('special-skill-value').value = parseInt(skill.value, 10) || 0;
  document.getElementById('special-skill-description').value = skill.description || '';
  renderSpecialSkillTiedOptions();
  document.getElementById('special-skill-editor-modal').classList.add('show');
  document.getElementById('special-skill-name').focus();
}

function closeSpecialSkillEditor() {
  document.getElementById('special-skill-editor-modal').classList.remove('show');
  specialSkillEditState = null;
}

function saveSpecialSkill() {
  const name = document.getElementById('special-skill-name').value.trim();
  if (!name) {
    showError('SPECIAL SKILL NAME IS REQUIRED.');
    return;
  }
  const tiedSkill = document.getElementById('special-skill-tied').value.trim();
  const value = Math.max(0, parseInt(document.getElementById('special-skill-value').value, 10) || 0);
  const description = document.getElementById('special-skill-description').value.trim();
  const editing = specialSkillEditState && specialSkillEditState.idx > -1 && sheetSpecialSkills[specialSkillEditState.idx];
  const skill = {
    id: editing?.id || `specialskill${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name,
    tiedSkill,
    value,
    description
  };
  if (editing) sheetSpecialSkills[specialSkillEditState.idx] = skill;
  else sheetSpecialSkills.push(skill);
  closeSpecialSkillEditor();
  renderSpecialSkills();
  pulsePanelFromNode(document.getElementById('special-skill-list'));
  showActionLog(`${editing ? 'UPDATED' : 'ADDED'} SPECIAL SKILL ${name.toUpperCase()}`);
}

function removeSpecialSkill(idx) {
  const skill = sheetSpecialSkills[idx];
  if (!skill) return;
  showModal('DELETE SPECIAL SKILL?', `Remove "${skill.name}" from special skills?`, () => {
    sheetSpecialSkills.splice(idx, 1);
    renderSpecialSkills();
    closeModal();
    showActionLog(`REMOVED SPECIAL SKILL ${skill.name.toUpperCase()}`);
  });
}

function renderRep() {
  const effectiveRep = typeof getEffectiveReputationValue === 'function' ? getEffectiveReputationValue() : repValue;
  document.getElementById('rep-number').innerHTML = effectiveRep !== repValue
    ? `${effectiveRep}<span style="font-size:.45em;opacity:.6"> (${repValue})</span>`
    : String(effectiveRep);
  document.getElementById('rep-pips').innerHTML = Array.from({ length: Math.min(effectiveRep, 40) }, () => '<div class="rep-pip"></div>').join('');
  updateSystemStrip();
  syncCurrentPlayerPresence();
}

function addEffectiveReputationModifier() {
  addRollModifier('REP', 'Reputation', typeof getEffectiveReputationValue === 'function' ? getEffectiveReputationValue() : repValue);
}

function changeRep(delta) {
  repValue = Math.max(0, repValue + delta);
  renderRep();
  flashById('rep-number');
  pulsePanelFromNode(document.getElementById('rep-number'));
  showActionLog(`REPUTATION ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${repValue}`);
}

function renderWallet() {
  const effectiveWallet = typeof getEffectiveWalletValue === 'function' ? getEffectiveWalletValue() : walletValue;
  document.getElementById('wallet-val').value = walletValue;
  document.getElementById('wallet-val').title = effectiveWallet !== walletValue
    ? `Base ${walletValue} EB // Effective ${effectiveWallet} EB`
    : `${walletValue} EB`;
  updateSystemStrip();
  syncCurrentPlayerPresence();
}

function changeWallet(delta) {
  walletValue = Math.max(0, walletValue + delta);
  renderWallet();
  flashById('wallet-val');
  pulsePanelFromNode(document.getElementById('wallet-val'));
  showActionLog(`WALLET ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${walletValue} EB`);
}

function setWallet(value) {
  walletValue = Math.max(0, parseInt(value, 10) || 0);
  renderWallet();
  flashById('wallet-val');
  pulsePanelFromNode(document.getElementById('wallet-val'));
  showActionLog(`WALLET SET TO ${walletValue} EB`);
}

function renderPhysicalBody() {
  const effective = typeof getEffectivePhysicalValues === 'function'
    ? getEffectivePhysicalValues()
    : { bodyLevel: bodyLevelVal, weight: weightVal, stun: stunVal };
  document.getElementById('body-level-val').innerHTML = effective.bodyLevel !== bodyLevelVal
    ? `${effective.bodyLevel}<span style="font-size:.45em;opacity:.6"> (${bodyLevelVal})</span>`
    : String(effective.bodyLevel);
  document.getElementById('body-val').innerHTML = effective.weight !== weightVal
    ? `${effective.weight}<span style="font-size:.45em;opacity:.6"> (${weightVal})</span>`
    : String(effective.weight);
  document.getElementById('stun-val').innerHTML = effective.stun !== stunVal
    ? `${effective.stun}<span style="font-size:.45em;opacity:.6"> (${stunVal})</span>`
    : String(effective.stun);
  updateSystemStrip();
  syncCurrentPlayerPresence();
}

function addEffectiveBodyLevelModifier() {
  const effective = typeof getEffectivePhysicalValues === 'function'
    ? getEffectivePhysicalValues()
    : { bodyLevel: bodyLevelVal };
  addRollModifier('PHYSICAL', 'Body Level', effective.bodyLevel);
}

function changeBS(which, delta) {
  if (which === 'bodylevel') bodyLevelVal = Math.max(0, Math.min(4, bodyLevelVal + delta));
  else if (which === 'weight') weightVal = Math.max(0, weightVal + delta);
  else stunVal = Math.max(0, stunVal + delta);
  renderPhysicalBody();
  const label = which === 'bodylevel' ? 'BODY LEVEL' : which === 'weight' ? 'WEIGHT' : 'STUN';
  const value = which === 'bodylevel' ? bodyLevelVal : which === 'weight' ? weightVal : stunVal;
  flashById(which === 'bodylevel' ? 'body-level-val' : which === 'weight' ? 'body-val' : 'stun-val');
  pulsePanelFromNode(document.getElementById(which === 'bodylevel' ? 'body-level-val' : which === 'weight' ? 'body-val' : 'stun-val'));
  showActionLog(`${label} ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${value}`);
}

function renderLimbs() {
  const grid = document.getElementById('limb-grid');
  grid.innerHTML = '';
  LIMBS.forEach((limb) => {
    const sp = limbSP[limb] || 0;
    const effectiveSp = typeof getEffectiveArmorValue === 'function' ? getEffectiveArmorValue(limb) : sp;
    const bonusSp = typeof getEffectiveArmorBonus === 'function' ? getEffectiveArmorBonus(limb) : 0;
    const dmg = limbDMG[limb] || 0;
    const lvl = getWoundLevel(dmg);
    const cls = lvl ? `wounded-${lvl}` : '';
    const idKey = limb.replace('.', '_');
    const card = document.createElement('div');
    card.className = `limb-card ${cls}`;
    card.id = `limb-${idKey}`;
    card.innerHTML = `
      <div class="limb-name">${limb}</div>
      <div class="limb-field-label">SP</div>
      <input class="limb-input" type="number" min="0" value="${sp}" id="sp-${idKey}" onchange="setSP('${limb}',this.value)">
      <div class="limb-total-note${bonusSp ? ' boosted' : ''}">TOTAL ${effectiveSp}${bonusSp ? ` // GEAR ${bonusSp >= 0 ? '+' : ''}${bonusSp}` : ''}</div>
      <div class="limb-ctrl">
        <button class="limb-btn" onclick="changeLimb('sp','${limb}',1)">+</button>
        <button class="limb-btn minus" onclick="changeLimb('sp','${limb}',-1)">-</button>
      </div>
      <div class="limb-field-label">DMG</div>
      <input class="limb-input dmg-input" type="number" min="0" value="${dmg}" id="dmg-${idKey}" onchange="setDMG('${limb}',this.value)">
      <div class="limb-ctrl">
        <button class="limb-btn" onclick="changeLimb('dmg','${limb}',1)">+</button>
        <button class="limb-btn minus" onclick="changeLimb('dmg','${limb}',-1)">-</button>
      </div>`;
    grid.appendChild(card);
  });
  renderWounds();
  syncCurrentPlayerPresence();
}

function changeLimb(type, limb, delta) {
  const key = limb.replace('.', '_');
  if (type === 'sp') {
    limbSP[limb] = Math.max(0, (limbSP[limb] || 0) + delta);
    document.getElementById(`sp-${key}`).value = limbSP[limb];
  } else {
    limbDMG[limb] = Math.max(0, (limbDMG[limb] || 0) + delta);
    document.getElementById(`dmg-${key}`).value = limbDMG[limb];
  }
  pulsePanelFromNode(document.getElementById(`limb-${key}`));
  refreshLimbCard(limb);
  renderWounds();
  renderStats();
}

function setSP(limb, val) {
  limbSP[limb] = Math.max(0, parseInt(val, 10) || 0);
  pulsePanelFromNode(document.getElementById(`limb-${limb.replace('.', '_')}`));
  refreshLimbCard(limb);
  renderWounds();
  renderStats();
}

function setDMG(limb, val) {
  limbDMG[limb] = Math.max(0, parseInt(val, 10) || 0);
  pulsePanelFromNode(document.getElementById(`limb-${limb.replace('.', '_')}`));
  refreshLimbCard(limb);
  renderWounds();
  renderStats();
}

function refreshLimbCard(limb) {
  const card = document.getElementById(`limb-${limb.replace('.', '_')}`);
  if (!card) return;
  card.className = 'limb-card';
  const lvl = getWoundLevel(limbDMG[limb]);
  if (lvl) card.classList.add(`wounded-${lvl}`);
}

function renderWounds() {
  const panel = document.getElementById('wound-panel');
  const rows = document.getElementById('wound-rows');
  rows.innerHTML = '';
  let hasWounds = false;
  const woundInfo = {
    light: { label: 'LIGHT', debuff: 'No stat debuff' },
    serious: { label: 'SERIOUS', debuff: 'REF -2' },
    critical: { label: 'CRITICAL', debuff: 'REF / COOL / INT / 2' },
    mortal: { label: 'MORTAL', debuff: 'REF / COOL / INT / 3' }
  };
  LIMBS.forEach((limb) => {
    const dmg = limbDMG[limb] || 0;
    if (!dmg) return;
    const lvl = getWoundLevel(dmg);
    if (!lvl) return;
    hasWounds = true;
    const info = woundInfo[lvl];
    rows.innerHTML += `
      <div class="wound-row ${lvl}">
        <span class="wound-limb">${limb}</span>
        <span class="wound-badge ${lvl}">${info.label}</span>
        <span class="wound-debuff">${info.debuff}</span>
      </div>`;
  });
  panel.classList.toggle('has-wounds', hasWounds);
  updateSystemStrip();
}
