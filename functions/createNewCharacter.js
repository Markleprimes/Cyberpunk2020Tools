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
  document.getElementById('new-career').value = '';
  modal.classList.add('show');
  document.getElementById('new-name').focus();
}

function closeNewCharacterModal() {
  const modal = document.getElementById('new-char-modal');
  if (modal) modal.classList.remove('show');
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
