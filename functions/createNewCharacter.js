const CP2020_MAIN_ROLES = [
  'Solo',
  'Netrunner',
  'Techie',
  'Medtech',
  'Fixer',
  'Media',
  'Cop',
  'Nomad',
  'Rockerboy',
  'Hobo'
];

const CP2020_ROLE_KEYS = {
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

function normalizeRoleLookup(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getKnownRoleKey(value) {
  return CP2020_ROLE_KEYS[normalizeRoleLookup(value)] || '';
}

function getKnownRoleLabel(value) {
  const key = getKnownRoleKey(value);
  return CP2020_MAIN_ROLES.find((role) => normalizeRoleLookup(role) === key) || String(value || '').trim();
}

function buildBlankSheetData(name = '--', aliases = [], career = 'UNKNOWN') {
  const stats = {};
  const statKeys = typeof DEFAULT_STATS !== 'undefined'
    ? DEFAULT_STATS
    : ['REF', 'INT', 'COOL', 'ATTR', 'TECH', 'LUCK', 'EMPT'];
  statKeys.forEach((stat) => {
    stats[stat] = 0;
  });
  return {
    name: [name, ...aliases.filter(Boolean)],
    stats,
    career: [career],
    careerSkill: { point: 0 },
    specialSkills: [],
    reputation: { rep: 0 },
    wallet: { eddies: 0 },
    physicalBody: { bodylevel: 0, weight: 0, stunpoint: 0 },
    body: {},
    stunpoint: {},
    armor: { Head: 0, Torso: 0, 'R.Arm': 0, 'L.Arm': 0, 'R.Leg': 0, 'L.Leg': 0 },
    damage: { Head: 0, Torso: 0, 'R.Arm': 0, 'L.Arm': 0, 'R.Leg': 0, 'L.Leg': 0 },
    inventory: {}
  };
}

function buildLauncherCharacterData(name, street, career) {
  return buildBlankSheetData(name, street ? [street] : [], career);
}

function openNewCharacterModal() {
  const modal = document.getElementById('new-char-modal');
  if (!modal) return;
  document.getElementById('new-name').value = '';
  document.getElementById('new-street').value = '';
  document.getElementById('new-career').value = 'Solo';
  modal.classList.add('show');
  document.getElementById('new-name').focus();
}

function closeNewCharacterModal() {
  const modal = document.getElementById('new-char-modal');
  if (modal) modal.classList.remove('show');
}

function getCurrentIdentityData() {
  if (typeof buildCurrentDossierSheetData === 'function') {
    return buildCurrentDossierSheetData();
  }
  const currentName = String(document.getElementById('char-name')?.textContent || '--').trim() || '--';
  const aliases = Array.from(document.querySelectorAll('.alias-tag'))
    .map((node) => String(node.textContent || '').trim())
    .filter(Boolean);
  const career = String(document.getElementById('char-career')?.dataset?.career || document.getElementById('char-career')?.textContent || 'UNKNOWN').trim() || 'UNKNOWN';
  return buildBlankSheetData(currentName, aliases, career);
}

function openIdentityEditor() {
  const modal = document.getElementById('identity-modal');
  if (!modal) return;
  const data = getCurrentIdentityData();
  document.getElementById('identity-name').value = String(data.name?.[0] || '').trim();
  document.getElementById('identity-street').value = Array.isArray(data.name) ? data.name.slice(1).join(', ') : '';
  document.getElementById('identity-career').value = String(data.career?.[0] || '').trim();
  modal.classList.add('show');
  document.getElementById('identity-name').focus();
}

function closeIdentityEditor() {
  const modal = document.getElementById('identity-modal');
  if (modal) modal.classList.remove('show');
}

function saveIdentityEditor() {
  const name = document.getElementById('identity-name').value.trim();
  const aliasRaw = document.getElementById('identity-street').value.trim();
  const career = document.getElementById('identity-career').value.trim();
  if (!name || !career) {
    showError('IDENTITY REQUIRES A NAME AND CAREER.');
    return;
  }
  const aliases = aliasRaw
    ? aliasRaw.split(',').map((part) => part.trim()).filter(Boolean)
    : [];
  const data = getCurrentIdentityData();
  data.name = [name, ...aliases];
  data.career = [career];
  renderSheet(data);
  closeIdentityEditor();
  showActionLog(`IDENTITY UPDATED: ${name.toUpperCase()}`);
}

function submitNewCharacter() {
  const name = document.getElementById('new-name').value.trim();
  const street = document.getElementById('new-street').value.trim();
  const career = document.getElementById('new-career').value.trim();
  if (!name || !career) {
    showError('NEW DOSSIER REQUIRES A NAME AND CAREER.');
    return;
  }
  document.getElementById('status-bar').style.display = 'none';
  renderSheet(buildBlankSheetData(name, street ? [street] : [], career));
  closeNewCharacterModal();
  showActionLog(`NEW DOSSIER OPENED: ${name.toUpperCase()}`);
}
