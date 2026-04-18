function renderSheet(data) {
  document.getElementById('status-bar').style.display = 'none';
  document.getElementById('char-name').textContent = data.name[0] || 'Unknown';
  document.getElementById('char-aliases').innerHTML = data.name.slice(1).map((a) => `<span class="alias-tag">${a}</span>`).join('');
  document.getElementById('char-career').textContent = data.career[0] || '???';
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

  inventory = {};
  mergeInventory(data.inventory || {});
  renderInventory();

  rollModifiers = [];
  aimStackPoints = 0;
  currentRoll = { sides: null, qty: getRollQuantity(), rolls: [], result: 0, modifiers: 0, total: 0, rolledAt: 0 };
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
    const effective = debuff ? Math.max(0, Math.floor(v * debuff.mult) - debuff.flat) : v;
    const card = document.createElement('div');
    card.className = `stat-item${debuff ? ' debuffed' : ''}`;
    card.innerHTML = `
      <div class="stat-label">${k}</div>
      <div class="stat-value pickable" id="sv-${k}" style="color:${col};text-shadow:var(--stat-core-glow)" title="Add ${k} to roll" onclick="addRollModifier('STAT','${k}',${effective})">${effective}${debuff && effective !== v ? `<span style="font-size:.55em;opacity:.6"> (${v})</span>` : ''}</div>
      <div class="stat-debuff-tag" id="sdt-${k}">${debuff ? debuff.label : ''}</div>
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
  const base = sheetStats[key] || 0;
  const debuff = computeStatDebuffs()[key];
  return debuff ? Math.max(0, Math.floor(base * debuff.mult) - debuff.flat) : base;
}

function getSkillValueByNames(...names) {
  const targets = names.map(normalizeLookup).filter(Boolean);
  let best = 0;
  sheetSkills.forEach((skill) => {
    const lookup = normalizeLookup(skill.name);
    if (targets.some((target) => lookup === target || lookup.includes(target) || target.includes(lookup))) {
      best = Math.max(best, skill.value || 0);
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
    const pct = Math.min(100, (skill.value / maxVal) * 100);
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <div class="skill-main" title="Add ${skill.name} to roll" onclick="addRollModifier('SKILL','${skill.name.replace(/'/g, "\\'")}',${skill.value})">
        <span class="skill-name">${skill.name}</span>
        <div class="skill-bar-wrap"><div class="skill-bar" style="width:${pct}%"></div></div>
        <span class="skill-val pickable">${skill.value}</span>
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

function renderRep() {
  document.getElementById('rep-number').textContent = repValue;
  document.getElementById('rep-pips').innerHTML = Array.from({ length: Math.min(repValue, 40) }, () => '<div class="rep-pip"></div>').join('');
  updateSystemStrip();
  syncCurrentPlayerPresence();
}

function changeRep(delta) {
  repValue = Math.max(0, repValue + delta);
  renderRep();
  flashById('rep-number');
  pulsePanelFromNode(document.getElementById('rep-number'));
  showActionLog(`REPUTATION ${delta > 0 ? 'INCREASED' : 'DECREASED'} TO ${repValue}`);
}

function renderWallet() {
  document.getElementById('wallet-val').value = walletValue;
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
  document.getElementById('body-level-val').textContent = bodyLevelVal;
  document.getElementById('body-val').textContent = weightVal;
  document.getElementById('stun-val').textContent = stunVal;
  updateSystemStrip();
  syncCurrentPlayerPresence();
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
