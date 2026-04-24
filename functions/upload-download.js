function stripCommentLines(raw) {
  return String(raw || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function readTextFileContents(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error('FAILED TO READ TEXT FILE.'));
    reader.readAsText(file);
  });
}

async function readFile(file) {
  const lowerName = (file?.name || '').toLowerCase();
  if (lowerName.endsWith('.zip')) {
    await importDossierBundle(file);
    return;
  }
  if (!lowerName.endsWith('.txt')) {
    showError('ERROR: Only .txt or .zip files are supported.');
    return;
  }
  parseCharacter(await readTextFileContents(file));
}

async function readItemFile(file) {
  if (document.getElementById('sheet').style.display !== 'block') {
    showError('LOAD A CHARACTER FILE BEFORE ADDING INVENTORY ITEMS.');
    return;
  }
  const lowerName = (file?.name || '').toLowerCase();
  if (lowerName.endsWith('.zip')) {
    await mergeInventoryBundle(file);
    return;
  }
  if (!lowerName.endsWith('.txt')) {
    showError('ERROR: Only .txt or .zip files are supported.');
    return;
  }
  parseItemFile(await readTextFileContents(file));
}

function readBannerImage(file) {
  if (!file.type.startsWith('image/')) {
    showError('UPLOAD AN IMAGE FILE FOR THE DOSSIER BACKGROUND.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    bannerImageData = e.target.result;
    bannerImageName = file.name || 'banner.png';
    renderBannerImage();
    showActionLog('UPDATED DOSSIER IMAGE');
  };
  reader.readAsDataURL(file);
}

function ensureZipSupport() {
  if (typeof JSZip !== 'undefined') return true;
  showError('ZIP SUPPORT FAILED TO LOAD. REFRESH THE PAGE AND TRY AGAIN.');
  return false;
}

function getImageMimeType(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/png';
}

function getImageExtensionFromMime(mime = 'image/png') {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/bmp') return 'bmp';
  return 'png';
}

function splitDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  return match ? { mime: match[1], base64: match[2] } : null;
}

function sanitizeZipEntryName(value, fallback) {
  const cleaned = String(value || fallback || 'file').split(/[\\/]/).pop().replace(/[^\w.\-]+/g, '_');
  return cleaned || fallback || 'file';
}

function sanitizeDownloadBaseName(value, fallback = 'character') {
  const cleaned = String(value || fallback).trim().replace(/[^\w.\-]+/g, '_');
  return cleaned || fallback;
}

function looksLikeCharacterText(text) {
  const lower = String(text || '').toLowerCase();
  return lower.includes('name:') && lower.includes('stats:') && lower.includes('career:');
}

function looksLikeSpecialSkillText(text) {
  const lower = String(text || '').toLowerCase();
  return lower.includes('tiedskill') || lower.includes('careerskill') || lower.includes('specialskill');
}

async function extractZipBundle(file) {
  if (!ensureZipSupport()) throw new Error('ZIP SUPPORT FAILED TO LOAD.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const textEntries = [];
  let banner = null;
  for (const entry of entries) {
    const name = entry.name.split('/').pop();
    const lower = name.toLowerCase();
    if (lower.endsWith('.txt')) {
      textEntries.push({ name, text: await entry.async('string') });
      continue;
    }
    if (!banner && /\.(png|jpe?g|gif|webp|bmp)$/i.test(lower)) {
      const mime = getImageMimeType(name);
      banner = { name, dataUrl: `data:${mime};base64,${await entry.async('base64')}` };
    }
  }
  const characterEntry = textEntries.find((entry) => /^(character|dossier|sheet)\.txt$/i.test(entry.name))
    || textEntries.find((entry) => looksLikeCharacterText(entry.text))
    || null;
  const specialSkillEntries = textEntries.filter((entry) =>
    entry !== characterEntry && (
      /^(specialskills|specialskill|special-skills|special-skill)\.txt$/i.test(entry.name)
      || looksLikeSpecialSkillText(entry.text)
    )
  );
  return {
    characterText: characterEntry?.text || '',
    itemTexts: textEntries.filter((entry) => entry !== characterEntry && !specialSkillEntries.includes(entry)).map((entry) => entry.text),
    specialSkillTexts: specialSkillEntries.map((entry) => entry.text),
    banner
  };
}

async function importDossierBundle(file) {
  try {
    const bundle = await extractZipBundle(file);
    if (!bundle.characterText) throw new Error('CHARACTER.TXT NOT FOUND IN ZIP.');
    parseCharacter(bundle.characterText);
    (bundle.specialSkillTexts || []).forEach((text) => parseSpecialSkillFile(text));
    bundle.itemTexts.forEach((text) => parseItemFile(text));
    if (bundle.banner?.dataUrl) {
      bannerImageData = bundle.banner.dataUrl;
      bannerImageName = bundle.banner.name || 'banner.png';
      renderBannerImage();
    }
    showActionLog('DOSSIER ZIP LOADED');
  } catch (err) {
    showError(`ZIP LOAD ERROR: ${err.message}`);
  }
}

async function mergeInventoryBundle(file) {
  try {
    const bundle = await extractZipBundle(file);
    const texts = [...(bundle.characterText ? [bundle.characterText] : []), ...bundle.itemTexts];
    if (!texts.length) throw new Error('NO TXT FILES FOUND IN ZIP.');
    texts.forEach((text) => parseItemFile(text));
    if (bundle.banner?.dataUrl) {
      bannerImageData = bundle.banner.dataUrl;
      bannerImageName = bundle.banner.name || 'banner.png';
      renderBannerImage();
    }
    showActionLog('ITEM ZIP MERGED');
  } catch (err) {
    showError(`ZIP MERGE ERROR: ${err.message}`);
  }
}

function parseCharacter(raw) {
  try {
    const data = { name: [], stats: {}, career: [], careerSkill: {}, specialSkills: [], reputation: {}, wallet: {}, physicalBody: {}, body: {}, stunpoint: {}, armor: {}, damage: {}, inventory: {} };
    const text = stripCommentLines(raw);
    extractTopLevelBlocks(text).forEach(({ key, body }) => {
      key = key.trim().toLowerCase();
      if (key === 'name') data.name = parseNameBlock(body);
      else if (key === 'stats') data.stats = parseKVBlock(body);
      else if (key === 'career') data.career = parseNameBlock(body);
      else if (key === 'careerskill') data.careerSkill = parseKVBlock(body);
      else if (key === 'specialskill' || key === 'specialskills') data.specialSkills = parseSpecialSkillBlock(body);
      else if (key === 'reputation') data.reputation = parseKVBlock(body);
      else if (key === 'wallet') data.wallet = parseKVBlock(body);
      else if (key === 'physicalbody') data.physicalBody = parseKVBlock(body);
      else if (key === 'body') data.body = parseKVBlock(body);
      else if (key === 'stunpoint') data.stunpoint = parseKVBlock(body);
      else if (key === 'armor') data.armor = parseKVBlock(body);
      else if (key === 'damage') data.damage = parseKVBlock(body);
      else data.inventory[key] = parseInventoryCategory(body, key);
    });
    bannerImageData = '';
    bannerImageName = '';
    renderSheet(data);
    showActionLog(`LOADED CHARACTER FILE: ${fileSafeNameFromData(data)}`);
  } catch (err) {
    showError(`PARSE ERROR: ${err.message}`);
  }
}

function parseSpecialSkillDescription(value) {
  const match = String(value || '').match(/^description\s*:\s*\{([\s\S]*)\}$/i);
  if (match) return parseNameBlock(match[1]).join(' | ');
  const infoMatch = String(value || '').match(/^info\s*:\s*\{([\s\S]*)\}$/i);
  if (infoMatch) return parseNameBlock(infoMatch[1]).join(' | ');
  return cleanValue(String(value || ''));
}

function parseSpecialSkillEntry(block, idx) {
  const skill = {
    id: block.key || `specialskill${idx + 1}`,
    name: block.key || `Special Skill ${idx + 1}`,
    tiedSkill: '',
    value: 0,
    description: ''
  };
  splitTopLevelTokens(block.body).forEach((token) => {
    const infoMatch = token.match(/^info\s*:\s*\{([\s\S]*)\}$/i);
    if (infoMatch) {
      skill.description = parseNameBlock(infoMatch[1]).join(' | ');
      return;
    }
    const descriptionMatch = token.match(/^description\s*:\s*\{([\s\S]*)\}$/i);
    if (descriptionMatch) {
      skill.description = parseNameBlock(descriptionMatch[1]).join(' | ');
      return;
    }
    const match = token.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
    if (!match) return;
    const fieldKey = normalizeLookup(match[1]);
    const rawValue = match[2];
    const clean = cleanValue(rawValue);
    if (fieldKey === 'name') skill.name = clean || skill.name;
    else if (fieldKey === 'tiedskill' || fieldKey === 'tied' || fieldKey === 'careerskill' || fieldKey === 'skill') skill.tiedSkill = clean;
    else if (fieldKey === 'value' || fieldKey === 'rank' || fieldKey === 'modifier') skill.value = parseInt(clean, 10) || 0;
    else if (fieldKey === 'description' || fieldKey === 'effect' || fieldKey === 'whatitdoes') skill.description = parseSpecialSkillDescription(rawValue);
  });
  return skill;
}

function looksLikeFlatSpecialSkillBlocks(blocks) {
  const fieldKeys = new Set([
    'name',
    'tiedskill',
    'tied',
    'careerskill',
    'skill',
    'value',
    'rank',
    'modifier',
    'description',
    'effect',
    'whatitdoes',
    'info'
  ]);
  return Array.isArray(blocks)
    && !!blocks.length
    && blocks.every((block) => fieldKeys.has(normalizeLookup(block?.key)));
}

function parseSpecialSkillFlatFile(blocks, defaultId = 'specialskill1') {
  const skill = {
    id: defaultId,
    name: 'Special Skill',
    tiedSkill: '',
    value: 0,
    description: ''
  };
  blocks.forEach((block) => {
    const fieldKey = normalizeLookup(block?.key);
    const body = String(block?.body || '').trim();
    const bodyValue = parseNameBlock(body).join(' | ') || cleanValue(body);
    if (fieldKey === 'name') skill.name = bodyValue || skill.name;
    else if (fieldKey === 'tiedskill' || fieldKey === 'tied' || fieldKey === 'careerskill' || fieldKey === 'skill') skill.tiedSkill = bodyValue;
    else if (fieldKey === 'value' || fieldKey === 'rank' || fieldKey === 'modifier') skill.value = parseInt(cleanValue(bodyValue), 10) || 0;
    else if (fieldKey === 'description' || fieldKey === 'effect' || fieldKey === 'whatitdoes' || fieldKey === 'info') skill.description = bodyValue;
  });
  return skill.name ? [skill] : [];
}

function parseSpecialSkillBlock(body) {
  const blocks = extractTopLevelBlocks(body);
  if (looksLikeFlatSpecialSkillBlocks(blocks)) return parseSpecialSkillFlatFile(blocks);
  return blocks.map((block, idx) => parseSpecialSkillEntry(block, idx)).filter((skill) => skill.name);
}

function parseSpecialSkillFile(raw) {
  try {
    const text = stripCommentLines(raw);
    const blocks = extractTopLevelBlocks(text);
    let specialSkills = [];
    if (blocks.length === 1 && ['specialskill', 'specialskills'].includes(blocks[0].key.trim().toLowerCase())) {
      specialSkills = parseSpecialSkillBlock(blocks[0].body);
    } else if (looksLikeFlatSpecialSkillBlocks(blocks)) {
      specialSkills = parseSpecialSkillFlatFile(blocks);
    } else {
      specialSkills = blocks.map((block, idx) => parseSpecialSkillEntry(block, idx));
    }
    sheetSpecialSkills = specialSkills.filter((skill) => skill?.name);
    if (typeof renderSpecialSkills === 'function') renderSpecialSkills();
    document.getElementById('status-bar').style.display = 'none';
    showActionLog('SPECIAL SKILL FILE MERGED');
  } catch (err) {
    showError(`SPECIAL SKILL PARSE ERROR: ${err.message}`);
  }
}

function parseItemFile(raw) {
  try {
    const text = stripCommentLines(raw);
    const newInventory = {};
    extractTopLevelBlocks(text).forEach(({ key, body }) => {
      const category = key.trim().toLowerCase();
      if (CHARACTER_KEYS.has(category)) return;
      newInventory[category] = parseInventoryCategory(body, category);
    });
    mergeInventory(newInventory);
    renderInventory();
    document.getElementById('status-bar').style.display = 'none';
    showActionLog('ITEM FILE MERGED');
  } catch (err) {
    showError(`ITEM PARSE ERROR: ${err.message}`);
  }
}

function parseNameBlock(body) {
  const quoted = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return quoted.length ? quoted : body.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function parseKVBlock(body) {
  const res = {};
  body.split(/[,\n]+/).forEach((entry) => {
    const value = entry.trim();
    if (!value) return;
    const m = value.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
    if (m) res[m[1].trim()] = m[2].trim().replace(/"/g, '');
  });
  return res;
}

function buildCharacterTxt() {
  const names = [];
  const mainName = document.getElementById('char-name').textContent;
  if (mainName && mainName !== '--') names.push(mainName);
  document.querySelectorAll('.alias-tag').forEach((el) => names.push(el.textContent));
  const statLines = Object.entries(sheetStats).map(([k, v]) => `  ${k}=${v}`).join(', ');
  const careerNode = document.getElementById('char-career');
  const career = String(careerNode?.dataset?.career || careerNode?.textContent || 'UNKNOWN').trim() || 'UNKNOWN';
  const skillLines = sheetSkills.map((skill) => `  ${skill.name}=${skill.value}`).join('\n');
  const armorLines = LIMBS.map((limb) => `  ${limb}=${limbSP[limb] || 0}`).join(', ');
  const dmgLines = LIMBS.map((limb) => `  ${limb}=${limbDMG[limb] || 0}`).join(', ');
  return `name: {
  ${names.map((name) => `"${name}"`).join(', ')}
}

stats: {
  ${statLines}
}

career: {
  "${career}"
}

careerSkill: {
  point=${upgradePoints}
${skillLines}
}

reputation: {
  rep=${repValue}
}

wallet: {
  eddies=${walletValue}
}

physicalBody: {
  bodylevel=${bodyLevelVal}
  weight=${weightVal}
  stunpoint=${stunVal}
}

armor: {
${armorLines}
}

damage: {
${dmgLines}
}
`;
}

function buildSpecialSkillsTxt() {
  if (!Array.isArray(sheetSpecialSkills) || !sheetSpecialSkills.length) return '';
  const skillLines = sheetSpecialSkills.map((skill, idx) => {
    const key = String(skill.id || `specialskill${idx + 1}`).replace(/[^\w.-]+/g, '_') || `specialskill${idx + 1}`;
    const parts = [
      `name="${String(skill.name || '').replace(/"/g, '\\"')}"`,
      `tiedSkill="${String(skill.tiedSkill || '').replace(/"/g, '\\"')}"`,
      `value=${parseInt(skill.value, 10) || 0}`
    ];
    if (String(skill.description || '').trim()) {
      parts.push(`info:{ "${String(skill.description || '').replace(/"/g, '\\"')}" }`);
    }
    return `  ${key}:{ ${parts.join(', ')} }`;
  }).join(',\n');
  return `specialSkills: {\n${skillLines}\n}\n`;
}

async function triggerZipDownload(zip, filename) {
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadTxt() {
  if (!ensureZipSupport()) return;
  const zip = new JSZip();
  zip.file('character.txt', buildCharacterTxt());
  const specialSkillsText = buildSpecialSkillsTxt();
  if (specialSkillsText.trim()) zip.file('specialskills.txt', specialSkillsText);
  const inventoryText = serializeInventoryBlock();
  if (inventoryText.trim()) zip.file('items.txt', inventoryText);
  const bannerParts = splitDataUrl(bannerImageData);
  if (bannerParts) {
    const fallbackName = `banner.${getImageExtensionFromMime(bannerParts.mime)}`;
    zip.file(sanitizeZipEntryName(bannerImageName, fallbackName), bannerParts.base64, { base64: true });
  }
  await triggerZipDownload(
    zip,
    `${sanitizeDownloadBaseName(document.getElementById('char-name').textContent || 'character')}_dossier.zip`
  );
  showActionLog('DOWNLOADED DOSSIER ZIP');
}

async function downloadInventoryTxt() {
  if (!ensureZipSupport()) return;
  const inventoryText = serializeInventoryBlock();
  if (!inventoryText.trim()) {
    showError('NO INVENTORY TO DOWNLOAD.');
    return;
  }
  const zip = new JSZip();
  zip.file('items.txt', inventoryText);
  await triggerZipDownload(
    zip,
    `${sanitizeDownloadBaseName(document.getElementById('char-name').textContent || 'inventory')}_items.zip`
  );
  showActionLog('DOWNLOADED ITEM ZIP');
}

function bootDossierFromLauncher() {
  const launchParams = new URLSearchParams(window.location.search);
  const npcSyncId = launchParams.get('npcSyncId');
  const launchRoomId = launchParams.get('roomId');
  const launchRole = launchParams.get('role') || (npcSyncId ? 'npc' : 'player');
  const autoConnect = launchParams.get('autoConnect') === '1';
  if (npcSyncId && typeof readSyncedNpcDossier === 'function' && typeof applyIncomingNpcDossierSync === 'function') {
    const payload = readSyncedNpcDossier(npcSyncId);
    if (payload?.data) {
      applyIncomingNpcDossierSync(payload, false);
      if (typeof applyLauncherRoomLink === 'function') applyLauncherRoomLink(launchRoomId, launchRole, autoConnect);
      showActionLog(`NPC DOSSIER LINKED: ${fileSafeNameFromData(payload.data)}`);
      return;
    }
  }

  const pendingBundle = sessionStorage.getItem(BOOT_BUNDLE_KEY);
  if (pendingBundle) {
    sessionStorage.removeItem(BOOT_BUNDLE_KEY);
    try {
      const bundle = JSON.parse(pendingBundle);
      if (bundle.characterText) parseCharacter(bundle.characterText);
      (bundle.specialSkillTexts || []).forEach((text) => parseSpecialSkillFile(text));
      (bundle.itemTexts || []).forEach((text) => parseItemFile(text));
      if (bundle.banner?.dataUrl) {
        bannerImageData = bundle.banner.dataUrl;
        bannerImageName = bundle.banner.name || 'banner.png';
        renderBannerImage();
      }
      if (bundle.characterText || bundle.itemTexts?.length) {
        if (typeof applyLauncherRoomLink === 'function') applyLauncherRoomLink(launchRoomId, launchRole, autoConnect);
        showActionLog('DOSSIER ZIP LOADED');
        return;
      }
    } catch (err) {
      showError(`LAUNCHER ZIP ERROR: ${err.message}`);
    }
  }

  const pendingRaw = sessionStorage.getItem(BOOT_RAW_KEY);
  if (pendingRaw) {
    sessionStorage.removeItem(BOOT_RAW_KEY);
    parseCharacter(pendingRaw);
    if (typeof applyLauncherRoomLink === 'function') applyLauncherRoomLink(launchRoomId, launchRole, autoConnect);
    return;
  }

  const pendingData = sessionStorage.getItem(BOOT_DATA_KEY);
  if (pendingData) {
    sessionStorage.removeItem(BOOT_DATA_KEY);
    try {
      const data = JSON.parse(pendingData);
      renderSheet(data);
      if (typeof applyLauncherRoomLink === 'function') applyLauncherRoomLink(launchRoomId, launchRole, autoConnect);
      showActionLog(`NEW DOSSIER OPENED: ${fileSafeNameFromData(data)}`);
      return;
    } catch (err) {
      showError(`LAUNCHER DATA ERROR: ${err.message}`);
    }
  }

  renderSheet(buildBlankSheetData());
  if (typeof applyLauncherRoomLink === 'function') applyLauncherRoomLink(launchRoomId, launchRole, autoConnect);
}

if (document.getElementById('sheet')) {
  bootDossierFromLauncher();
}
