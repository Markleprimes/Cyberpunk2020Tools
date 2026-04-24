(function initGMPage() {
  window.toggleGMRoomDrawer = function toggleGMRoomDrawer() {
    document.getElementById('gm-room-drawer')?.classList.toggle('open');
  };

  window.closeGMRoomDrawer = function closeGMRoomDrawer() {
    document.getElementById('gm-room-drawer')?.classList.remove('open');
  };

  window.toggleGMActionDrawer = function toggleGMActionDrawer() {
    document.getElementById('gm-action-drawer')?.classList.toggle('open');
  };

  window.closeGMActionDrawer = function closeGMActionDrawer() {
    document.getElementById('gm-action-drawer')?.classList.remove('open');
  };

  let activeRef = null;
  let activeHandler = null;
  let activeEffectsRef = null;
  let activeEffectsHandler = null;
  let activeRoomId = '';
  let gmLocalNpcSeed = 0;
  let gmLocalRollFrame = null;
  let gmLocalNpcs = [];
  let gmRemotePlayers = [];
  let gmHoverAudio = null;
  let gmHoveredControl = null;
  let gmRollModifiers = [];
  let gmCurrentRoll = null;
  let gmPendingRollRequest = null;
  let gmSelectedRollSubjectKey = '';
  let gmRollShakePower = 0;
  let gmRollShakeActive = false;
  let gmRollShakePointerId = null;
  let gmRollShakeLastPoint = null;
  let gmRollCinemaFrame = null;
  let gmRollCinemaNumberTimer = null;
  let gmRollCinemaRevealTimer = null;
  let gmRollCinemaAutoCloseTimer = null;
  let gmRollCountAudio = null;
  let gmRollBounceAudios = [];
  let gmAimStackPoints = 0;
  let gmAimHitWeapons = [];
  let gmEffectTargetClientId = '';
  let gmInventoryTargetClientId = '';
  let gmInventoryTargetMode = 'remote';

  const gmRollStateByClient = {};
  const gmDelayedRollsByClient = {};
  let gmRemotePlayerData = {};
  let gmRemotePlayerEffects = {};
  const GM_LIMBS = ['Head', 'Torso', 'R.Arm', 'L.Arm', 'R.Leg', 'L.Leg'];
  const GM_NPC_DOSSIER_SYNC_PREFIX = 'cp2020_npc_dossier_';

  function getGMNpcSyncKey(npcId) {
    return `${GM_NPC_DOSSIER_SYNC_PREFIX}${String(npcId || '').trim()}`;
  }

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

  function escapeGMValue(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function humanizeLabel(value) {
    return String(value || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[._]/g, ' ')
      .trim();
  }

  function cleanValue(val) {
    return String(val || '').trim().replace(/^"(.*)"$/, '$1');
  }

  function parseGMNumericValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const str = String(value ?? '').trim();
    if (/^[-+]?\d+$/.test(str)) return parseInt(str, 10);
    return null;
  }

  function parseGMEditorFields(text) {
    const fields = {};
    String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) fields[key] = value;
    });
    return fields;
  }

  function sanitizeGMCategory(value) {
    return String(value || 'miscellaneous').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w.-]/g, '') || 'miscellaneous';
  }

  function buildGMInventoryId(category) {
    return `${category}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
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

  function stripCommentLines(raw) {
    return String(raw || '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
  }

  function parseNameBlock(body) {
    const quoted = [...String(body || '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    return quoted.length
      ? quoted
      : String(body || '').split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
  }

  function parseKVBlock(body) {
    const result = {};
    String(body || '').split(/[,\n]+/).forEach((entry) => {
      const value = entry.trim();
      if (!value) return;
      const match = value.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
      if (match) result[match[1].trim()] = match[2].trim().replace(/"/g, '');
    });
    return result;
  }

  function parseInventoryCategory(body, category) {
    const blocks = extractTopLevelBlocks(body);
    if (blocks.length) return blocks.map((block, idx) => parseInventoryItemBlock(block, category, idx));
    const names = parseNameBlock(body);
    return names.map((name, idx) => ({ id: `${category}${idx + 1}`, name, fields: {}, info: [] }));
  }

  function parseInventoryItemBlock(block, category, idx) {
    const fields = {};
    let name = block.key;
    let info = [];
    splitTopLevelTokens(block.body).forEach((token) => {
      const infoMatch = token.match(/^info\s*:\s*\{([\s\S]*)\}$/i);
      if (infoMatch) {
        info = parseNameBlock(infoMatch[1]);
        return;
      }
      const match = token.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
      if (!match) return;
      const fieldKey = match[1].trim();
      const value = cleanValue(match[2]);
      if (fieldKey.toLowerCase() === 'name') name = value || name;
      else fields[fieldKey] = value;
    });
    return {
      id: block.key || `${category}${idx + 1}`,
      name: name || `${category} ${idx + 1}`,
      fields,
      info
    };
  }

  function looksLikeCharacterText(text) {
    const lower = String(text || '').toLowerCase();
    return lower.includes('name:') && lower.includes('stats:') && lower.includes('career:');
  }

  function parseGMCharacterText(raw) {
    const data = {
      name: [],
      stats: {},
      career: [],
      careerSkill: {},
      specialSkills: [],
      reputation: {},
      wallet: {},
      physicalBody: {},
      body: {},
      stunpoint: {},
      armor: {},
      damage: {},
      inventory: {}
    };

    const text = stripCommentLines(raw);
    extractTopLevelBlocks(text).forEach(({ key, body }) => {
      const lower = key.trim().toLowerCase();
      if (lower === 'name') data.name = parseNameBlock(body);
      else if (lower === 'stats') data.stats = parseKVBlock(body);
      else if (lower === 'career') data.career = parseNameBlock(body);
      else if (lower === 'careerskill') data.careerSkill = parseKVBlock(body);
      else if (lower === 'specialskill' || lower === 'specialskills') data.specialSkills = parseGMSpecialSkillBlock(body);
      else if (lower === 'reputation') data.reputation = parseKVBlock(body);
      else if (lower === 'wallet') data.wallet = parseKVBlock(body);
      else if (lower === 'physicalbody') data.physicalBody = parseKVBlock(body);
      else if (lower === 'body') data.body = parseKVBlock(body);
      else if (lower === 'stunpoint') data.stunpoint = parseKVBlock(body);
      else if (lower === 'armor') data.armor = parseKVBlock(body);
      else if (lower === 'damage') data.damage = parseKVBlock(body);
      else data.inventory[lower] = parseInventoryCategory(body, lower);
    });

    return data;
  }

  function parseGMSpecialSkillEntry(block, idx) {
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
      const fieldKey = String(match[1] || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const rawValue = cleanValue(match[2]);
      if (fieldKey === 'name') skill.name = rawValue || skill.name;
      else if (fieldKey === 'tiedskill' || fieldKey === 'tied' || fieldKey === 'careerskill' || fieldKey === 'skill') skill.tiedSkill = rawValue;
      else if (fieldKey === 'value' || fieldKey === 'rank' || fieldKey === 'modifier') skill.value = parseGMNumericValue(rawValue) ?? 0;
      else if (fieldKey === 'description' || fieldKey === 'effect' || fieldKey === 'whatitdoes') skill.description = rawValue;
    });
    return skill;
  }

  function looksLikeFlatGMSpecialSkillBlocks(blocks) {
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
      && blocks.every((block) => fieldKeys.has(String(block?.key || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')));
  }

  function parseGMFlatSpecialSkillFile(blocks, defaultId = 'specialskill1') {
    const skill = {
      id: defaultId,
      name: 'Special Skill',
      tiedSkill: '',
      value: 0,
      description: ''
    };
    blocks.forEach((block) => {
      const fieldKey = String(block?.key || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const body = String(block?.body || '').trim();
      const bodyValue = parseNameBlock(body).join(' | ') || cleanValue(body);
      if (fieldKey === 'name') skill.name = bodyValue || skill.name;
      else if (fieldKey === 'tiedskill' || fieldKey === 'tied' || fieldKey === 'careerskill' || fieldKey === 'skill') skill.tiedSkill = bodyValue;
      else if (fieldKey === 'value' || fieldKey === 'rank' || fieldKey === 'modifier') skill.value = parseGMNumericValue(bodyValue) ?? 0;
      else if (fieldKey === 'description' || fieldKey === 'effect' || fieldKey === 'whatitdoes' || fieldKey === 'info') skill.description = bodyValue;
    });
    return skill.name ? [skill] : [];
  }

  function parseGMSpecialSkillBlock(body) {
    const blocks = extractTopLevelBlocks(body);
    if (looksLikeFlatGMSpecialSkillBlocks(blocks)) return parseGMFlatSpecialSkillFile(blocks);
    return blocks.map((block, idx) => parseGMSpecialSkillEntry(block, idx));
  }

  function parseGMSpecialSkillFile(raw) {
    const text = stripCommentLines(raw);
    const blocks = extractTopLevelBlocks(text);
    if (blocks.length === 1 && ['specialskill', 'specialskills'].includes(blocks[0].key.trim().toLowerCase())) {
      return parseGMSpecialSkillBlock(blocks[0].body);
    }
    if (looksLikeFlatGMSpecialSkillBlocks(blocks)) {
      return parseGMFlatSpecialSkillFile(blocks);
    }
    return blocks.map((block, idx) => parseGMSpecialSkillEntry(block, idx));
  }

  async function readGMTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result || ''));
      reader.onerror = () => reject(new Error('FAILED TO READ NPC FILE.'));
      reader.readAsText(file);
    });
  }

  function ensureGMZipSupport() {
    if (typeof JSZip !== 'undefined') return true;
    setGMStatus('ZIP support failed to load on GM page.');
    setGMStatusVisual('disconnected');
    return false;
  }

  async function extractGMZipBundle(file) {
    if (!ensureGMZipSupport()) throw new Error('ZIP SUPPORT FAILED TO LOAD.');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const textEntries = [];
    for (const entry of entries) {
      const name = entry.name.split('/').pop();
      if (name.toLowerCase().endsWith('.txt')) {
        textEntries.push({ name, text: await entry.async('string') });
      }
    }
    const characterEntry = textEntries.find((entry) => /^(character|dossier|sheet)\.txt$/i.test(entry.name))
      || textEntries.find((entry) => looksLikeCharacterText(entry.text))
      || null;
    const specialSkillEntries = textEntries.filter((entry) =>
      entry !== characterEntry && (
        /^(specialskills|specialskill|special-skills|special-skill)\.txt$/i.test(entry.name)
        || String(entry.text || '').toLowerCase().includes('tiedskill')
      )
    );
    return {
      characterText: characterEntry?.text || '',
      itemTexts: textEntries.filter((entry) => entry !== characterEntry && !specialSkillEntries.includes(entry)).map((entry) => entry.text),
      specialSkillTexts: specialSkillEntries.map((entry) => entry.text)
    };
  }

  function mergeGMInventory(targetInventory, sourceInventory) {
    Object.entries(sourceInventory || {}).forEach(([category, items]) => {
      if (!Array.isArray(items) || !items.length) return;
      if (!targetInventory[category]) targetInventory[category] = [];
      targetInventory[category].push(...items);
    });
  }

  function flattenGMInventory(inventoryMap) {
    const list = [];
    Object.entries(inventoryMap || {}).forEach(([category, items]) => {
      (items || []).forEach((item) => {
        list.push({
          type: humanizeLabel(category),
          name: item.name || humanizeLabel(item.id || category),
          description: Array.isArray(item.info) && item.info.length ? item.info.join(' | ') : '--'
        });
      });
    });
    return list;
  }

  function buildGMNpcEntry(parsedData, sourceLabel = '') {
    const physicalBody = parsedData.physicalBody || {};
    const bodyBlock = parsedData.body || {};
    const stunBlock = parsedData.stunpoint || {};
    return {
      id: `npc-local-${Date.now().toString(36)}-${gmLocalNpcSeed += 1}`,
      name: parsedData.name?.[0] || sourceLabel || 'Unknown NPC',
      career: parsedData.career?.[0] || 'NPC',
      role: 'npc-local',
      stats: Object.entries(parsedData.stats || {}).map(([label, value]) => ({ label, value: parseGMNumericValue(value) ?? value })),
      skills: Object.entries(parsedData.careerSkill || {})
        .filter(([label]) => label.toLowerCase() !== 'point')
        .map(([label, value]) => ({ label, value: parseGMNumericValue(value) ?? value })),
      specialSkills: Array.isArray(parsedData.specialSkills) ? parsedData.specialSkills.map((skill, idx) => ({
        id: String(skill?.id || `specialskill${idx + 1}`).trim() || `specialskill${idx + 1}`,
        name: String(skill?.name || `Special Skill ${idx + 1}`).trim() || `Special Skill ${idx + 1}`,
        tiedSkill: String(skill?.tiedSkill || '').trim(),
        value: parseGMNumericValue(skill?.value) ?? 0,
        description: String(skill?.description || '').trim()
      })) : [],
      reputation: parseGMNumericValue(parsedData.reputation?.rep) ?? 0,
      wallet: parseGMNumericValue(parsedData.wallet?.eddies) ?? 0,
      physical: {
        bodyLevel: parseGMNumericValue(physicalBody.bodylevel) ?? 0,
        weight: parseGMNumericValue(physicalBody.weight ?? bodyBlock.weight) ?? 0,
        stun: parseGMNumericValue(physicalBody.stunpoint ?? stunBlock.stun) ?? 0
      },
      inventoryMap: JSON.parse(JSON.stringify(parsedData.inventory || {})),
      inventory: flattenGMInventory(parsedData.inventory || {}),
      inventoryDetailed: Object.entries(parsedData.inventory || {}).flatMap(([category, items]) =>
        (items || []).map((item) => ({
          category,
          id: item.id || buildGMInventoryId(category),
          name: item.name || humanizeLabel(item.id || category),
          fields: Object.entries(item.fields || {}).map(([label, value]) => ({ label, value })),
          info: [...(item.info || [])]
        }))
      ),
      armor: GM_LIMBS.map((limb) => ({ label: limb, value: parseGMNumericValue(parsedData.armor?.[limb]) ?? 0 })),
      damage: GM_LIMBS.map((limb) => ({ label: limb, value: parseGMNumericValue(parsedData.damage?.[limb]) ?? 0 })),
      lastRollVisible: null,
      lastRollPending: false
    };
  }

  function buildDossierDataFromGMNpc(entry) {
    const stats = {};
    (entry?.stats || []).forEach((row) => {
      const label = String(row?.label || '').trim();
      if (!label) return;
      stats[label] = parseGMNumericValue(row?.value) ?? 0;
    });
    const careerSkill = { point: 0 };
    (entry?.skills || []).forEach((row) => {
      const label = String(row?.label || '').trim();
      if (!label) return;
      careerSkill[label] = parseGMNumericValue(row?.value) ?? 0;
    });
    const armor = {};
    (entry?.armor || []).forEach((row) => {
      const label = String(row?.label || '').trim();
      if (!label) return;
      armor[label] = parseGMNumericValue(row?.value) ?? 0;
    });
    const damage = {};
    (entry?.damage || []).forEach((row) => {
      const label = String(row?.label || '').trim();
      if (!label) return;
      damage[label] = parseGMNumericValue(row?.value) ?? 0;
    });
    return {
      name: [entry?.name || 'Unknown NPC'],
      stats,
      career: [entry?.career || 'NPC'],
      careerSkill,
      specialSkills: Array.isArray(entry?.specialSkills) ? entry.specialSkills.map((skill, idx) => ({
        id: String(skill?.id || `specialskill${idx + 1}`).trim() || `specialskill${idx + 1}`,
        name: String(skill?.name || `Special Skill ${idx + 1}`).trim() || `Special Skill ${idx + 1}`,
        tiedSkill: String(skill?.tiedSkill || '').trim(),
        value: parseGMNumericValue(skill?.value) ?? 0,
        description: String(skill?.description || '').trim()
      })) : [],
      reputation: { rep: parseGMNumericValue(entry?.reputation) ?? 0 },
      wallet: { eddies: parseGMNumericValue(entry?.wallet) ?? 0 },
      physicalBody: {
        bodylevel: parseGMNumericValue(entry?.physical?.bodyLevel) ?? 0,
        weight: parseGMNumericValue(entry?.physical?.weight) ?? 0,
        stunpoint: parseGMNumericValue(entry?.physical?.stun) ?? 0
      },
      body: {},
      stunpoint: {},
      armor,
      damage,
      inventory: JSON.parse(JSON.stringify(entry?.inventoryMap || {}))
    };
  }

  function persistGMNpcDossierSync(npcId) {
    const npc = gmLocalNpcs.find((entry) => entry.id === npcId);
    if (!npc) return;
    try {
      window.localStorage?.setItem(getGMNpcSyncKey(npcId), JSON.stringify({
        npcId,
        updatedAt: Date.now(),
        source: 'gm',
        data: buildDossierDataFromGMNpc(npc)
      }));
    } catch (error) {
      console.warn('Failed to persist NPC dossier sync payload.', error);
    }
  }

  function applyDossierDataToLocalNpc(npcId, data, sourceLabel = 'NPC') {
    const index = gmLocalNpcs.findIndex((entry) => entry.id === npcId);
    if (index === -1 || !data) return;
    const existing = gmLocalNpcs[index];
    const rebuilt = buildGMNpcEntry(data, sourceLabel);
    rebuilt.id = existing.id;
    rebuilt.role = existing.role;
    rebuilt.lastRollVisible = existing.lastRollVisible || null;
    rebuilt.lastRollPending = existing.lastRollPending || false;
    gmLocalNpcs[index] = rebuilt;
    renderGMNpcList();
  }

  function openGMNpcDossier(npcId) {
    const npc = gmLocalNpcs.find((entry) => entry.id === npcId);
    if (!npc) {
      setGMStatus('Selected NPC is no longer available.');
      return;
    }
    persistGMNpcDossierSync(npcId);
    const params = new URLSearchParams({
      npcSyncId: String(npcId || '').trim(),
      role: 'npc',
      autoConnect: activeRoomId ? '1' : '0'
    });
    if (activeRoomId) params.set('roomId', activeRoomId);
    const targetUrl = `DND.html?${params.toString()}`;
    try {
      window.open(targetUrl, '_blank', 'noopener');
      setGMStatus(`Opened dossier for ${npc.name || 'NPC'}.`);
      setGMStatusVisual(activeRef ? 'connected' : 'pending');
    } catch (error) {
      setGMStatus(`NPC dossier launch error: ${error.message}`);
      setGMStatusVisual('disconnected');
    }
  }

  function getGMBlockValue(block, label) {
    const entry = (Array.isArray(block) ? block : []).find((item) => String(item?.label || '').trim() === String(label || '').trim());
    return parseGMNumericValue(entry?.value) ?? 0;
  }

  function getGMWoundLevel(dmg) {
    const value = parseGMNumericValue(dmg) ?? 0;
    if (value <= 0) return null;
    if (value <= 4) return 'LIGHT';
    if (value <= 6) return 'SERIOUS';
    if (value <= 8) return 'CRITICAL';
    return 'MORTAL';
  }

  function getGMWorstWound(entry) {
    const order = ['LIGHT', 'SERIOUS', 'CRITICAL', 'MORTAL'];
    let worst = null;
    (entry?.damage || []).forEach((limb) => {
      const level = getGMWoundLevel(limb?.value);
      if (level && (!worst || order.indexOf(level) > order.indexOf(worst))) worst = level;
    });
    return worst;
  }

  function getGMNpcDebuffs(entry) {
    const worst = getGMWorstWound(entry);
    const debuffs = {};
    if (worst === 'SERIOUS') {
      debuffs.REF = { flat: 2, mult: 1, label: '-2 (SERIOUS)' };
    } else if (worst === 'CRITICAL') {
      ['REF', 'COOL', 'INT'].forEach((label) => {
        debuffs[label] = { flat: 0, mult: 0.5, label: '/2 (CRITICAL)' };
      });
    } else if (worst === 'MORTAL') {
      ['REF', 'COOL', 'INT'].forEach((label) => {
        debuffs[label] = { flat: 0, mult: 1 / 3, label: '/3 (MORTAL)' };
      });
    }
    return debuffs;
  }

  function getGMDisplayStats(entry) {
    const debuffs = getGMNpcDebuffs(entry);
    return (Array.isArray(entry?.stats) ? entry.stats : []).map((stat) => {
      const base = parseGMNumericValue(stat?.value) ?? 0;
      const label = String(stat?.label || '').trim();
      const debuff = debuffs[label];
      const effective = debuff ? Math.max(0, Math.floor(base * debuff.mult) - debuff.flat) : base;
      return {
        label,
        value: debuff && effective !== base ? `${effective} (${base})` : effective,
        rawValue: effective,
        debuff: debuff?.label || ''
      };
    });
  }

  function getGMWeaponList(entry) {
    return Array.isArray(entry?.inventoryMap?.weapon) ? entry.inventoryMap.weapon : [];
  }

  function renderGMKeyValueLines(block, options = {}) {
    const entries = Array.isArray(block)
      ? block.map((entry) => [entry?.label, entry?.value, entry?.rawValue])
      : Object.entries(block || {});
    if (!entries.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return entries.map(([key, value, rawValue]) => {
      const numericValue = parseGMNumericValue(rawValue ?? value);
      const pickable = options.pickable && numericValue !== null;
      const pickAttrs = pickable
        ? ` data-gm-roll-source="${escapeGMValue(options.source || 'GM')}" data-gm-roll-label="${escapeGMValue(key)}" data-gm-roll-value="${escapeGMValue(numericValue)}" title="Add ${escapeGMValue(key)} to GM roll"`
        : '';
      return `
        <div class="gm-sheet-line${pickable ? ' pickable' : ''}"${pickAttrs}>
          <span class="gm-sheet-key">${escapeGMValue(key)}:</span>
          <span class="gm-sheet-val">${escapeGMValue(value)}</span>
        </div>
      `;
    }).join('');
  }

  function renderGMEditableNumberLines(block, options = {}) {
    const entries = Array.isArray(block)
      ? block.map((entry) => ({ label: entry?.label, value: parseGMNumericValue(entry?.rawValue ?? entry?.value) ?? 0, commandField: entry?.label }))
      : Object.entries(block || {}).map(([label, value]) => ({ label, value: parseGMNumericValue(value) ?? 0, commandField: label }));
    if (!entries.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return entries.map((entry) => `
      <div class="gm-sheet-line">
        <span class="gm-sheet-key">${escapeGMValue(entry.label)}:</span>
        <input class="gm-ad-input gm-remote-input" type="number" min="0" value="${escapeGMValue(entry.value)}" data-gm-remote-edit="${escapeGMValue(options.commandType || 'setValue')}" data-gm-client-id="${escapeGMValue(options.clientId || '')}" data-gm-label="${escapeGMValue(entry.commandField || entry.label)}">
      </div>
    `).join('');
  }

  function renderGMLocalEditableNumberLines(block, options = {}) {
    const entries = Array.isArray(block)
      ? block.map((entry) => ({ label: entry?.label, value: parseGMNumericValue(entry?.rawValue ?? entry?.value) ?? 0, commandField: entry?.label }))
      : Object.entries(block || {}).map(([label, value]) => ({ label, value: parseGMNumericValue(value) ?? 0, commandField: label }));
    if (!entries.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return entries.map((entry) => `
      <div class="gm-sheet-line">
        <span class="gm-sheet-key">${escapeGMValue(entry.label)}:</span>
        <input class="gm-ad-input gm-remote-input" type="number" min="0" value="${escapeGMValue(entry.value)}" data-gm-local-edit="${escapeGMValue(options.commandType || 'setValue')}" data-gm-npc-id="${escapeGMValue(options.npcId || '')}" data-gm-label="${escapeGMValue(entry.commandField || entry.label)}">
      </div>
    `).join('');
  }

  function renderGMArmorDamageTable(armor, damage, options = {}) {
    const armorMap = new Map((Array.isArray(armor) ? armor : []).map((entry) => [entry?.label, entry?.value]));
    const damageMap = new Map((Array.isArray(damage) ? damage : []).map((entry) => [entry?.label, entry?.value]));
    const editable = !!options.editable;
    const targetType = options.targetType || 'npc';
    const targetId = options.targetId || options.npcId || '';
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
          ${GM_LIMBS.map((limb) => `
            <tr>
              <td>${escapeGMValue(limb)}</td>
              <td>${editable
                ? `<input class="gm-ad-input" type="number" min="0" value="${escapeGMValue(armorMap.get(limb) ?? 0)}" data-gm-ad-input="armor" data-gm-target-type="${escapeGMValue(targetType)}" data-gm-target-id="${escapeGMValue(targetId)}" data-gm-limb="${escapeGMValue(limb)}">`
                : escapeGMValue(armorMap.get(limb) ?? 0)}</td>
              <td>${editable
                ? `<input class="gm-ad-input" type="number" min="0" value="${escapeGMValue(damageMap.get(limb) ?? 0)}" data-gm-ad-input="damage" data-gm-target-type="${escapeGMValue(targetType)}" data-gm-target-id="${escapeGMValue(targetId)}" data-gm-limb="${escapeGMValue(limb)}">`
                : escapeGMValue(damageMap.get(limb) ?? 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderGMWeaponList(entry) {
    const weapons = getGMWeaponList(entry);
    if (!weapons.length) {
      return '<div class="gm-sheet-line"><span class="gm-sheet-key">--</span><span class="gm-sheet-val">--</span></div>';
    }
    return weapons.map((weapon) => {
      const fields = weapon.fields || {};
      const damage = fields.Damage || fields['Damage/Ammo'] || '--';
      const accuracy = fields.Accuracy ?? fields['Weapon Accuracy'] ?? fields.WA ?? '--';
      return `
        <div class="gm-sheet-line gm-sheet-line-stack">
          <span class="gm-sheet-key">${escapeGMValue(weapon.name || 'Weapon')}:</span>
          <span class="gm-sheet-val gm-sheet-val-wrap">ACC ${escapeGMValue(accuracy)} // DMG ${escapeGMValue(damage)}</span>
        </div>
      `;
    }).join('');
  }

  function updateLocalNpcArmorDamage(npcId, field, limb, value) {
    const npc = gmLocalNpcs.find((entry) => entry.id === npcId);
    if (!npc || !['armor', 'damage'].includes(field)) return;
    const target = Array.isArray(npc[field]) ? npc[field] : [];
    const row = target.find((entry) => entry.label === limb);
    if (!row) return;
    row.value = Math.max(0, parseGMNumericValue(value) ?? 0);
    renderGMNpcList();
    persistGMNpcDossierSync(npcId);
    setGMStatus(`${npc.name || 'NPC'} ${field.toUpperCase()} ${limb} set to ${row.value}.`);
    setGMStatusVisual(activeRef ? 'connected' : 'disconnected');
  }

  function updateLocalNpcValue(npcId, type, label, value) {
    const npc = gmLocalNpcs.find((entry) => entry.id === npcId);
    if (!npc) return;
    const nextValue = Math.max(0, parseGMNumericValue(value) ?? 0);
    if (type === 'setStat') {
      const target = (npc.stats || []).find((entry) => String(entry?.label || '').trim() === String(label || '').trim());
      if (target) target.value = nextValue;
    } else if (type === 'setSkill') {
      const target = (npc.skills || []).find((entry) => String(entry?.label || '').trim() === String(label || '').trim());
      if (target) target.value = nextValue;
      else npc.skills = [...(npc.skills || []), { label, value: nextValue }];
    } else if (type === 'setReputation') {
      npc.reputation = nextValue;
    } else if (type === 'setWallet') {
      npc.wallet = nextValue;
    } else if (type === 'setPhysical') {
      if (!npc.physical) npc.physical = { bodyLevel: 0, weight: 0, stun: 0 };
      npc.physical[label] = nextValue;
    } else {
      return;
    }
    renderGMNpcList();
    persistGMNpcDossierSync(npcId);
    setGMStatus(`${npc.name || 'NPC'} ${String(label || type).toUpperCase()} set to ${nextValue}.`);
    setGMStatusVisual(activeRef ? 'connected' : 'pending');
  }

  function upsertLocalNpcInventoryItem(npcId, itemPayload) {
    const npc = gmLocalNpcs.find((entry) => entry.id === npcId);
    if (!npc) return;
    const category = sanitizeGMCategory(itemPayload?.category);
    if (!category) return;
    if (!npc.inventoryMap) npc.inventoryMap = {};
    if (!npc.inventoryMap[category]) npc.inventoryMap[category] = [];
    const item = {
      id: String(itemPayload?.id || buildGMInventoryId(category)).trim() || buildGMInventoryId(category),
      name: String(itemPayload?.name || 'Item').trim() || 'Item',
      fields: Object.fromEntries((itemPayload?.fields || []).map((field) => [field.label, field.value])),
      info: Array.isArray(itemPayload?.info) ? itemPayload.info.map((line) => String(line || '').trim()).filter(Boolean) : []
    };
    const existingIndex = npc.inventoryMap[category].findIndex((entry) => entry.id === item.id);
    if (existingIndex > -1) npc.inventoryMap[category][existingIndex] = item;
    else npc.inventoryMap[category].push(item);
    npc.inventory = flattenGMInventory(npc.inventoryMap);
    npc.inventoryDetailed = Object.entries(npc.inventoryMap || {}).flatMap(([entryCategory, items]) =>
      (items || []).map((entryItem) => ({
        category: entryCategory,
        id: entryItem.id || '',
        name: entryItem.name || 'Item',
        fields: Object.entries(entryItem.fields || {}).map(([label, value]) => ({ label, value })),
        info: [...(entryItem.info || [])]
      }))
    );
    renderGMNpcList();
    persistGMNpcDossierSync(npcId);
    setGMStatus(`${npc.name || 'NPC'} inventory updated.`);
    setGMStatusVisual(activeRef ? 'connected' : 'pending');
  }

  function deleteLocalNpcInventoryItem(npcId, category, itemId) {
    const npc = gmLocalNpcs.find((entry) => entry.id === npcId);
    if (!npc?.inventoryMap?.[category]) return;
    npc.inventoryMap[category] = npc.inventoryMap[category].filter((item) => item.id !== itemId);
    if (!npc.inventoryMap[category].length) delete npc.inventoryMap[category];
    npc.inventory = flattenGMInventory(npc.inventoryMap);
    npc.inventoryDetailed = Object.entries(npc.inventoryMap || {}).flatMap(([entryCategory, items]) =>
      (items || []).map((entryItem) => ({
        category: entryCategory,
        id: entryItem.id || '',
        name: entryItem.name || 'Item',
        fields: Object.entries(entryItem.fields || {}).map(([label, value]) => ({ label, value })),
        info: [...(entryItem.info || [])]
      }))
    );
    renderGMNpcList();
    persistGMNpcDossierSync(npcId);
    setGMStatus(`${npc.name || 'NPC'} inventory item deleted.`);
    setGMStatusVisual(activeRef ? 'connected' : 'pending');
  }

  function updateRemotePlayerArmorDamage(clientId, field, limb, value) {
    if (!['armor', 'damage'].includes(field) || !GM_LIMBS.includes(limb)) return;
    sendGMRemotePlayerCommand(clientId, {
      type: field === 'armor' ? 'setArmor' : 'setDamage',
      label: `${field} ${limb}`,
      limb,
      value: Math.max(0, parseGMNumericValue(value) ?? 0)
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

  function renderGMSpecialSkillSection(specialSkills = []) {
    const skills = Array.isArray(specialSkills) ? specialSkills.filter(Boolean) : [];
    if (!skills.length) return '';
    return `
      <div class="gm-sheet-columns gm-sheet-columns-wide">
        <div class="gm-sheet-col">
          <div class="gm-sheet-title">Special Skills</div>
          <div class="gm-special-skill-list">
            ${skills.map((skill) => `
              <div class="gm-special-skill-item">
                <div class="gm-special-skill-head">
                  <span class="gm-special-skill-name">${escapeGMValue(skill.name || 'Special Skill')}</span>
                  <span class="gm-special-skill-value">+${escapeGMValue(parseGMNumericValue(skill.value) ?? 0)}</span>
                </div>
                <div class="gm-special-skill-meta">${escapeGMValue(skill.tiedSkill || 'UNLINKED')}</div>
                <div class="gm-special-skill-desc">${escapeGMValue(skill.description || 'No description.')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderGMRemoteInventory(entry, clientId) {
    const items = Array.isArray(entry?.inventoryDetailed) ? entry.inventoryDetailed : [];
    if (!items.length) {
      return `
        <div class="gm-empty">No inventory items.</div>
        <div class="gm-card-actions" style="justify-content:flex-start;margin-top:10px;margin-bottom:0;">
          <button type="button" class="gm-btn" data-gm-add-item="${escapeGMValue(clientId)}">ADD ITEM</button>
        </div>
      `;
    }
    return `
      <div class="gm-remote-inventory-list">
        ${items.map((item) => `
          <div class="gm-remote-item">
            <div class="gm-remote-item-head">
              <div>
                <div class="gm-remote-item-name">${escapeGMValue(item.name || 'Item')}</div>
                <div class="gm-remote-item-type">${escapeGMValue(humanizeLabel(item.category || 'miscellaneous'))}</div>
              </div>
            </div>
            ${(item.info || []).length ? `<div class="gm-remote-item-note">${escapeGMValue(item.info.join(' | '))}</div>` : ''}
            <div class="gm-remote-item-actions">
              <button type="button" class="gm-btn gm-btn-muted" data-gm-delete-item="${escapeGMValue(clientId)}" data-gm-item-category="${escapeGMValue(item.category || 'miscellaneous')}" data-gm-item-id="${escapeGMValue(item.id || '')}">DELETE</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="gm-card-actions" style="justify-content:flex-start;margin-top:10px;margin-bottom:0;">
        <button type="button" class="gm-btn" data-gm-add-item="${escapeGMValue(clientId)}">ADD ITEM</button>
      </div>
    `;
  }

  function renderGMLocalInventory(entry, npcId) {
    const items = Array.isArray(entry?.inventoryDetailed)
      ? entry.inventoryDetailed
      : Object.entries(entry?.inventoryMap || {}).flatMap(([category, categoryItems]) =>
        (categoryItems || []).map((item) => ({
          category,
          id: item.id || '',
          name: item.name || 'Item',
          info: [...(item.info || [])]
        }))
      );
    if (!items.length) {
      return `
        <div class="gm-empty">No inventory items.</div>
        <div class="gm-card-actions" style="justify-content:flex-start;margin-top:10px;margin-bottom:0;">
          <button type="button" class="gm-btn" data-gm-add-local-item="${escapeGMValue(npcId)}">ADD ITEM</button>
        </div>
      `;
    }
    return `
      <div class="gm-remote-inventory-list">
        ${items.map((item) => `
          <div class="gm-remote-item">
            <div class="gm-remote-item-head">
              <div>
                <div class="gm-remote-item-name">${escapeGMValue(item.name || 'Item')}</div>
                <div class="gm-remote-item-type">${escapeGMValue(humanizeLabel(item.category || 'miscellaneous'))}</div>
              </div>
            </div>
            ${(item.info || []).length ? `<div class="gm-remote-item-note">${escapeGMValue(item.info.join(' | '))}</div>` : ''}
            <div class="gm-remote-item-actions">
              <button type="button" class="gm-btn gm-btn-muted" data-gm-delete-local-item="${escapeGMValue(npcId)}" data-gm-item-category="${escapeGMValue(item.category || 'miscellaneous')}" data-gm-item-id="${escapeGMValue(item.id || '')}">DELETE</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="gm-card-actions" style="justify-content:flex-start;margin-top:10px;margin-bottom:0;">
        <button type="button" class="gm-btn" data-gm-add-local-item="${escapeGMValue(npcId)}">ADD ITEM</button>
      </div>
    `;
  }

  function renderGMRemoteWeapons(entry) {
    const items = (Array.isArray(entry?.inventoryDetailed) ? entry.inventoryDetailed : []).filter((item) => item.category === 'weapon');
    if (!items.length) return '<div class="gm-empty">No weapon entries.</div>';
    return items.map((item) => `
      <div class="gm-sheet-line gm-sheet-line-stack">
        <span class="gm-sheet-key">${escapeGMValue(item.name || 'Weapon')}:</span>
        <span class="gm-sheet-val gm-sheet-val-wrap">${escapeGMValue((item.info || []).join(' | ') || '--')}</span>
      </div>
    `).join('');
  }

  function getGMEffectsForClient(clientId) {
    return Object.values(gmRemotePlayerEffects?.[clientId] || {})
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

  function renderGMEffectsSection(clientId, effects = [], editable = false) {
    if (!editable && !effects.length) return '';
    return `
      <div class="gm-sheet-columns gm-sheet-columns-wide">
        <div class="gm-sheet-col">
          <div class="gm-sheet-title">Effects</div>
          <div class="gm-effects-list">
            ${effects.length ? effects.map((effect) => `
              <div class="gm-effect-chip">
                <div class="gm-effect-chip-head">
                  <span class="gm-effect-chip-name">${escapeGMValue(effect.label || 'Status Effect')}</span>
                  <span class="gm-effect-chip-mod">${Number.isFinite(Number(effect?.modifier)) ? `${Number(effect.modifier || 0) >= 0 ? '+' : ''}${escapeGMValue(effect.modifier)}` : 'NOTE'}</span>
                </div>
                <div class="gm-effect-chip-meta">${escapeGMValue(effect.source || 'GM')}</div>
                ${effect.note ? `<div class="gm-effect-chip-note">${escapeGMValue(effect.note)}</div>` : ''}
                ${editable ? `
                  <div class="gm-effect-chip-actions">
                    <button type="button" class="gm-btn gm-btn-muted" data-gm-remove-effect="${escapeGMValue(clientId)}" data-gm-effect-id="${escapeGMValue(effect.id || '')}">REMOVE</button>
                  </div>` : ''}
              </div>
            `).join('') : '<div class="gm-empty">No active effects.</div>'}
          </div>
          ${editable ? `
            <div class="gm-card-actions" style="justify-content:flex-start;margin-top:10px;margin-bottom:0;">
              <button type="button" class="gm-btn" data-gm-add-effect="${escapeGMValue(clientId)}">ADD EFFECT</button>
            </div>` : ''}
        </div>
      </div>
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
        <div class="gm-roll-total" id="gm-roll-total-${escapeGMValue(clientId)}">${escapeGMValue(lastRoll.raw ?? lastRoll.total ?? '--')}</div>
        <div class="gm-roll-meta">
          <span>POOL ${escapeGMValue(pool)}</span>
          <span>MOD ${escapeGMValue(modifierText)}</span>
          <span>RAW ${escapeGMValue(lastRoll.raw ?? '--')}</span>
        </div>
      </div>
    `;
  }

  function renderGMEntry(clientId, entry, options = {}) {
    const pickSource = entry.name || 'NPC';
    const displayStats = options.pickable ? getGMDisplayStats(entry) : entry.stats;
    const wound = options.pickable ? getGMWorstWound(entry) : null;
    const effects = Array.isArray(options.effects) ? options.effects : [];
    const editableStats = Array.isArray(entry.baseStats) && entry.baseStats.length ? entry.baseStats : entry.stats;
    const editablePhysical = {
      bodyLevel: entry.physical?.bodyLevel ?? 0,
      weight: entry.physical?.weight ?? 0,
      stun: entry.physical?.stun ?? 0
    };
    return `
      <div class="gm-player-card gm-player-detail" data-gm-client-id="${escapeGMValue(clientId)}" data-gm-role="${escapeGMValue(entry.role || 'player')}" data-gm-player-name="${escapeGMValue(entry.name || 'Unknown')}">
        <div class="gm-player-summary">
          <div class="gm-player-name">${escapeGMValue(entry.name || 'Unknown')}</div>
          <div class="gm-player-meta">${escapeGMValue(entry.career || 'UNKNOWN')} // ${escapeGMValue((entry.role || 'player').toUpperCase())}</div>
        </div>
        <div class="gm-player-sheet">
          ${options.removable ? `
            <div class="gm-card-actions">
              <button type="button" class="gm-btn" data-gm-open-npc-dossier="${escapeGMValue(clientId)}">OPEN DOSSIER</button>
              <button type="button" class="gm-btn gm-btn-muted" data-gm-remove-npc="${escapeGMValue(clientId)}">REMOVE NPC</button>
            </div>` : ''}
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Stats</div>
              ${options.localEditable
                ? renderGMLocalEditableNumberLines(editableStats, { commandType: 'setStat', npcId: clientId })
                : options.remoteEditable
                ? renderGMEditableNumberLines(editableStats, { commandType: 'setStat', clientId })
                : renderGMKeyValueLines(displayStats, { pickable: !!options.pickable, source: `${pickSource} Stat` })}
            </div>
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Skill</div>
              ${options.localEditable
                ? renderGMLocalEditableNumberLines(entry.skills, { commandType: 'setSkill', npcId: clientId })
                : options.remoteEditable
                ? renderGMEditableNumberLines(entry.skills, { commandType: 'setSkill', clientId })
                : renderGMKeyValueLines(entry.skills, { pickable: !!options.pickable, source: `${pickSource} Skill` })}
            </div>
          </div>
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Dossier</div>
              ${options.localEditable
                ? `${renderGMLocalEditableNumberLines([{ label: 'Reputation', value: entry.reputation ?? 0, commandField: 'reputation' }], { commandType: 'setReputation', npcId: clientId })}
                   ${renderGMLocalEditableNumberLines([{ label: 'Wallet', value: entry.wallet ?? 0, commandField: 'wallet' }], { commandType: 'setWallet', npcId: clientId })}`
                : options.remoteEditable
                ? `${renderGMEditableNumberLines([{ label: 'Reputation', value: entry.reputation ?? 0, commandField: 'reputation' }], { commandType: 'setReputation', clientId })}
                   ${renderGMEditableNumberLines([{ label: 'Wallet', value: entry.wallet ?? 0, commandField: 'wallet' }], { commandType: 'setWallet', clientId })}`
                : renderGMKeyValueLines({
                  Reputation: entry.reputation ?? 0,
                  Wallet: entry.wallet ?? 0
                })}
            </div>
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Physical</div>
              ${options.localEditable
                ? renderGMLocalEditableNumberLines([
                  { label: 'BodyLevel', value: editablePhysical.bodyLevel, commandField: 'bodyLevel' },
                  { label: 'Weight', value: editablePhysical.weight, commandField: 'weight' },
                  { label: 'Stun', value: editablePhysical.stun, commandField: 'stun' }
                ], { commandType: 'setPhysical', npcId: clientId })
                : options.remoteEditable
                ? renderGMEditableNumberLines([
                  { label: 'BodyLevel', value: editablePhysical.bodyLevel, commandField: 'bodyLevel' },
                  { label: 'Weight', value: editablePhysical.weight, commandField: 'weight' },
                  { label: 'Stun', value: editablePhysical.stun, commandField: 'stun' }
                ], { commandType: 'setPhysical', clientId })
                : renderGMKeyValueLines({
                  BodyLevel: entry.physical?.bodyLevel ?? 0,
                  Weight: entry.physical?.weight ?? 0,
                  Stun: entry.physical?.stun ?? 0
                })}
            </div>
          </div>
          ${renderGMSpecialSkillSection(entry.specialSkills)}
          ${renderGMEffectsSection(clientId, effects, !!options.effectEditable)}
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Weapons</div>
              ${options.remoteEditable ? renderGMRemoteWeapons(entry) : renderGMWeaponList(entry)}
            </div>
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Inventory</div>
              ${options.localEditable
                ? renderGMLocalInventory(entry, clientId)
                : options.remoteEditable
                  ? renderGMRemoteInventory(entry, clientId)
                  : renderGMItemList(entry.inventory)}
            </div>
          </div>
          <div class="gm-sheet-columns gm-sheet-columns-wide">
            <div class="gm-sheet-col">
              <div class="gm-sheet-title">Armor & Damage</div>
              ${renderGMArmorDamageTable(entry.armor, entry.damage, options.remoteEditable
                ? { editable: true, targetType: 'player', targetId: clientId }
                : { editable: !!(options.removable || options.localEditable), targetType: 'npc', targetId: clientId })}
              ${options.removable ? `<div class="gm-npc-wound">Wound Status: ${escapeGMValue(wound || 'CLEAR')}</div>` : ''}
            </div>
          </div>
          ${renderGMRollPanel(clientId, entry.lastRollVisible || null, entry.lastRollPending)}
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
      const snapshot = `${lastRoll.dice}|${lastRoll.raw}|${lastRoll.modifiers}|${lastRoll.total}|${lastRoll.rolledAt || 0}`;
      const prevState = gmRollStateByClient[entry.id];
      if (prevState?.animationFrame) cancelAnimationFrame(prevState.animationFrame);
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

  function renderGMRemotePlayers(data) {
    const playerNode = document.getElementById('gm-player-list');
    if (!playerNode) return;
    const entries = Object.entries(data || {}).map(([id, entry]) => ({ id, ...(entry || {}) }));
    const players = entries.filter((entry) => (entry.role || 'player') !== 'npc');
    gmRemotePlayers = players.map((entry) => JSON.parse(JSON.stringify(entry)));

    if (!players.length) {
      playerNode.innerHTML = '<div class="gm-empty">No players linked yet.</div>';
    } else {
      playerNode.innerHTML = players.map((player) => renderGMEntry(player.id, player, {
        effects: player.effects || [],
        effectEditable: true,
        remoteEditable: true
      })).join('');
    }

    animateGMRollPanels(players);
    publishGMMonitorState();
  }

  function renderGMNpcList() {
    const npcNode = document.getElementById('gm-npc-list');
    if (!npcNode) return;
    if (!gmLocalNpcs.length) {
      npcNode.innerHTML = '<div class="gm-empty">No local NPC dossier loaded yet.</div>';
      publishGMMonitorState();
      return;
    }
    npcNode.innerHTML = gmLocalNpcs.map((npc) => renderGMEntry(npc.id, npc, { removable: true, pickable: true, localEditable: true })).join('');
    publishGMMonitorState();
  }

  function publishGMMonitorState() {
    window.gmMonitorState = {
      remotePlayers: gmRemotePlayers.map((entry) => JSON.parse(JSON.stringify(entry))),
      localNpcs: gmLocalNpcs.map((entry) => JSON.parse(JSON.stringify(entry)))
    };
    window.dispatchEvent(new CustomEvent('gm-monitor-updated', {
      detail: window.gmMonitorState
    }));
  }

  function disconnectGMRoom() {
    const previousRoomId = activeRoomId;
    if (activeRef && activeHandler) activeRef.off('value', activeHandler);
    if (activeEffectsRef && activeEffectsHandler) activeEffectsRef.off('value', activeEffectsHandler);
    Object.values(gmDelayedRollsByClient).forEach((timer) => clearTimeout(timer));
    Object.keys(gmDelayedRollsByClient).forEach((key) => delete gmDelayedRollsByClient[key]);
    activeRef = null;
    activeHandler = null;
    activeEffectsRef = null;
    activeEffectsHandler = null;
    activeRoomId = '';
    gmRemotePlayerData = {};
    gmRemotePlayerEffects = {};
    if (previousRoomId && typeof clearCombatSummary === 'function') {
      clearCombatSummary(previousRoomId).catch((error) => {
        console.warn('Failed to clear combat summary on disconnect.', error);
      });
    }
  }

  function createRenderSafeEntry(id, entry) {
    const copy = JSON.parse(JSON.stringify(entry || {}));
    const roll = copy.lastRoll || null;
    if (!roll || !roll.dice) {
      copy.lastRollVisible = null;
      copy.lastRollPending = false;
      return copy;
    }
    const snapshot = `${roll.dice}|${roll.raw}|${roll.modifiers}|${roll.total}|${roll.rolledAt || 0}`;
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
    const snapshot = `${roll.dice}|${roll.raw}|${roll.modifiers}|${roll.total}|${roll.rolledAt || 0}`;
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

  function applyGMRemoteState(roomId) {
    const rawEntries = Object.entries(gmRemotePlayerData || {}).map(([id, entry]) => ({
      id,
      ...(entry || {}),
      effects: getGMEffectsForClient(id)
    }));
    if (!rawEntries.length) {
      setGMStatus(`Connected to "${roomId}" but no players are linked yet.`);
      setGMStatusVisual('connected');
      renderGMRemotePlayers(null);
      setGMLastUpdated(null);
      return;
    }

    rawEntries.forEach((entry) => {
      scheduleGMRollReveal(roomId, entry.id, entry.lastRoll || null, () => applyGMRemoteState(roomId));
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
    renderGMRemotePlayers(Object.fromEntries(renderEntries.map((entry) => [entry.id, entry])));
    setGMLastUpdated(lastUpdated || null);
  }

  function applyGMRoomData(roomId, data) {
    gmRemotePlayerData = data || {};
    applyGMRemoteState(roomId);
  }

  function applyGMEffectsData(roomId, data) {
    gmRemotePlayerEffects = data || {};
    applyGMRemoteState(roomId);
  }

  function connectGMRoom() {
    const roomId = (document.getElementById('gm-room-id')?.value || '').trim();
    const roomRef = getSyncRoomRef(roomId);
    if (!roomId) {
      setGMStatus('Enter a room ID before connecting.');
      setGMStatusVisual('disconnected');
      return;
    }
    if (!roomRef) {
      setGMStatus('Firebase failed to initialize.');
      setGMStatusVisual('disconnected');
      return;
    }

    disconnectGMRoom();
    activeRoomId = roomId;
    setGMStatus(`Listening to room "${roomId}"...`);
    setGMStatusVisual('pending');
    renderGMRemotePlayers(null);
    setGMLastUpdated(null);

    activeRef = roomRef.child('players');
    activeHandler = (snapshot) => {
      const data = snapshot.val();
      applyGMRoomData(roomId, data);
    };
    activeEffectsRef = roomRef.child('playerEffects');
    activeEffectsHandler = (snapshot) => {
      const data = snapshot.val();
      applyGMEffectsData(roomId, data);
    };

    activeRef.on('value', activeHandler, (error) => {
      setGMStatus(`Firebase listen error: ${error.message}`);
      setGMStatusVisual('disconnected');
    });
    activeEffectsRef.on('value', activeEffectsHandler, (error) => {
      setGMStatus(`Firebase effect listen error: ${error.message}`);
      setGMStatusVisual('disconnected');
    });
  }

  function closeGMEffectModal() {
    gmEffectTargetClientId = '';
    document.getElementById('gm-effect-label').value = '';
    document.getElementById('gm-effect-modifier').value = '';
    document.getElementById('gm-effect-note').value = '';
    document.getElementById('gm-effect-modal')?.classList.remove('show');
  }

  function openGMEffectModal(clientId) {
    if (!activeRoomId) {
      setGMStatus('Connect to a room before applying status effects.');
      setGMStatusVisual('disconnected');
      return;
    }
    const target = gmRemotePlayers.find((entry) => entry.id === clientId);
    if (!target) {
      setGMStatus('Selected player is no longer available.');
      return;
    }
    gmEffectTargetClientId = clientId;
    document.getElementById('gm-effect-label').value = '';
    document.getElementById('gm-effect-modifier').value = '';
    document.getElementById('gm-effect-note').value = '';
    document.getElementById('gm-effect-modal')?.classList.add('show');
  }

  async function saveGMEffect() {
    if (!activeRoomId || !gmEffectTargetClientId) return;
    const label = String(document.getElementById('gm-effect-label')?.value || '').trim();
    const note = String(document.getElementById('gm-effect-note')?.value || '').trim();
    const modifierRaw = String(document.getElementById('gm-effect-modifier')?.value || '').trim();
    const modifier = modifierRaw === '' ? null : parseGMNumericValue(modifierRaw);
    if (!label) {
      setGMStatus('Enter an effect label before applying it.');
      return;
    }
    if (modifierRaw !== '' && modifier === null) {
      setGMStatus('Modifier must be a whole number.');
      return;
    }
    try {
      await setPlayerEffect(activeRoomId, gmEffectTargetClientId, '', {
        label,
        modifier,
        note,
        source: 'GM'
      });
      closeGMEffectModal();
      setGMStatus(`Applied "${label}" to player dossier.`);
      setGMStatusVisual('connected');
    } catch (error) {
      setGMStatus(`Effect apply error: ${error.message}`);
      setGMStatusVisual('disconnected');
    }
  }

  async function removeGMEffect(clientId, effectId) {
    if (!activeRoomId || !clientId || !effectId) return;
    try {
      await removePlayerEffect(activeRoomId, clientId, effectId);
      setGMStatus('Removed status effect from player dossier.');
      setGMStatusVisual('connected');
    } catch (error) {
      setGMStatus(`Effect remove error: ${error.message}`);
      setGMStatusVisual('disconnected');
    }
  }

  async function sendGMRemotePlayerCommand(clientId, command) {
    if (!activeRoomId || !clientId) return;
    try {
      await sendPlayerCommand(activeRoomId, clientId, command);
      setGMStatus(`Sent ${String(command?.label || command?.type || 'update')} to player dossier.`);
      setGMStatusVisual('connected');
    } catch (error) {
      setGMStatus(`Player update error: ${error.message}`);
      setGMStatusVisual('disconnected');
    }
  }

  function closeGMInventoryModal() {
    gmInventoryTargetClientId = '';
    gmInventoryTargetMode = 'remote';
    document.getElementById('gm-item-name').value = '';
    document.getElementById('gm-item-type').value = 'weapon';
    document.getElementById('gm-item-custom-type').value = '';
    document.getElementById('gm-item-stats').value = '';
    document.getElementById('gm-item-info').value = '';
    document.getElementById('gm-item-custom-type-wrap').style.display = 'none';
    document.getElementById('gm-inventory-modal')?.classList.remove('show');
  }

  function toggleGMCustomItemType() {
    const wrap = document.getElementById('gm-item-custom-type-wrap');
    if (!wrap) return;
    wrap.style.display = document.getElementById('gm-item-type')?.value === 'custom' ? 'block' : 'none';
  }

  function openGMInventoryModal(clientId) {
    if (!activeRoomId) {
      setGMStatus('Connect to a room before editing player inventory.');
      return;
    }
    gmInventoryTargetMode = 'remote';
    gmInventoryTargetClientId = clientId;
    closeGMInventoryModal();
    gmInventoryTargetMode = 'remote';
    gmInventoryTargetClientId = clientId;
    document.getElementById('gm-inventory-modal')?.classList.add('show');
  }

  function openGMLocalNpcInventoryModal(npcId) {
    gmInventoryTargetMode = 'local';
    gmInventoryTargetClientId = npcId;
    document.getElementById('gm-item-name').value = '';
    document.getElementById('gm-item-type').value = 'weapon';
    document.getElementById('gm-item-custom-type').value = '';
    document.getElementById('gm-item-stats').value = '';
    document.getElementById('gm-item-info').value = '';
    document.getElementById('gm-item-custom-type-wrap').style.display = 'none';
    document.getElementById('gm-inventory-modal')?.classList.add('show');
  }

  async function saveGMInventoryItem() {
    if (!gmInventoryTargetClientId) return;
    const name = String(document.getElementById('gm-item-name')?.value || '').trim();
    if (!name) {
      setGMStatus('Item name is required.');
      return;
    }
    const typeSelect = document.getElementById('gm-item-type')?.value || 'miscellaneous';
    const rawCategory = typeSelect === 'custom'
      ? (document.getElementById('gm-item-custom-type')?.value || '')
      : typeSelect;
    const category = sanitizeGMCategory(rawCategory);
    const fields = Object.entries(parseGMEditorFields(document.getElementById('gm-item-stats')?.value || ''))
      .map(([label, value]) => ({ label, value }));
    const info = String(document.getElementById('gm-item-info')?.value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const item = {
      category,
      id: buildGMInventoryId(category),
      name,
      fields,
      info
    };
    if (gmInventoryTargetMode === 'local') {
      upsertLocalNpcInventoryItem(gmInventoryTargetClientId, item);
    } else {
      await sendGMRemotePlayerCommand(gmInventoryTargetClientId, {
        type: 'inventoryUpsert',
        label: `inventory ${name}`,
        item
      });
    }
    closeGMInventoryModal();
  }

  async function deleteGMRemoteInventoryItem(clientId, category, itemId) {
    await sendGMRemotePlayerCommand(clientId, {
      type: 'inventoryDelete',
      label: `inventory ${itemId}`,
      item: {
        category,
        id: itemId
      }
    });
  }

  function deleteGMLocalInventoryItem(npcId, category, itemId) {
    deleteLocalNpcInventoryItem(npcId, category, itemId);
  }

  function getGMRollModifierTotal() {
    const base = gmRollModifiers.reduce((sum, modifier) => sum + (modifier.value || 0), 0);
    const selectedKey = gmSelectedRollSubjectKey || document.getElementById('gm-roll-subject-select')?.value || '';
    const combatPenalty = typeof window.getGMCombatPenalty === 'function'
      ? Number(window.getGMCombatPenalty(selectedKey) || 0)
      : 0;
    return base + combatPenalty;
  }

  function renderGMRollModifierList() {
    const node = document.getElementById('gm-roll-mod-list');
    if (!node) return;
    const selectedKey = gmSelectedRollSubjectKey || document.getElementById('gm-roll-subject-select')?.value || '';
    const combatPenalty = typeof window.getGMCombatPenalty === 'function'
      ? Number(window.getGMCombatPenalty(selectedKey) || 0)
      : 0;
    const hasVisiblePenalty = combatPenalty !== 0;
    if (!gmRollModifiers.length && !hasVisiblePenalty) {
      node.innerHTML = '<div class="gm-empty">No modifiers locked in.</div>';
      return;
    }
    const items = gmRollModifiers.map((modifier, index) => `
      <div class="gm-mod-pill">
        <span>${escapeGMValue(modifier.source)} // ${escapeGMValue(modifier.label)} ${modifier.value >= 0 ? '+' : ''}${escapeGMValue(modifier.value)}</span>
        <button type="button" data-gm-remove-mod="${index}">X</button>
      </div>
    `);
    if (hasVisiblePenalty) {
      items.push(`
        <div class="gm-mod-pill">
          <span>FACEDOWN // STAY STRONG PENALTY ${combatPenalty}</span>
        </div>
      `);
    }
    node.innerHTML = items.join('');
  }

  function clearGMRollCinemaTimers() {
    cancelAnimationFrame(gmRollCinemaFrame);
    clearInterval(gmRollCinemaNumberTimer);
    clearTimeout(gmRollCinemaRevealTimer);
    clearTimeout(gmRollCinemaAutoCloseTimer);
    gmRollCinemaFrame = null;
    gmRollCinemaNumberTimer = null;
    gmRollCinemaRevealTimer = null;
    gmRollCinemaAutoCloseTimer = null;
  }

  function updateGMRollExecuteMeter() {
    const fill = document.getElementById('gm-roll-execute-meter-fill');
    const copy = document.getElementById('gm-roll-execute-meter-copy');
    const pct = Math.max(0, Math.min(100, gmRollShakePower));
    if (fill) fill.style.width = `${pct}%`;
    if (copy) {
      copy.textContent = pct < 15
        ? 'Hold and shake to arm the roll.'
        : pct < 45
          ? 'Shake registered. Release to throw.'
          : 'Good shake. Release to launch.';
    }
  }

  function playGMRollCountTick() {
    if (!gmRollCountAudio) {
      gmRollCountAudio = new Audio('audio/count.mp3');
      gmRollCountAudio.preload = 'auto';
    }
    gmRollCountAudio.currentTime = 0;
    gmRollCountAudio.play().catch(() => {});
  }

  function playGMRollBounceTick() {
    if (!gmRollBounceAudios.length) {
      gmRollBounceAudios = [new Audio('audio/bounce1.wav'), new Audio('audio/bounce2.wav')];
      gmRollBounceAudios.forEach((audio) => {
        audio.preload = 'auto';
      });
    }
    const audio = gmRollBounceAudios[Math.floor(Math.random() * gmRollBounceAudios.length)];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function playGMHoverSound() {
    if (!gmHoverAudio) {
      gmHoverAudio = new Audio('audio/menu-hover.mp3');
      gmHoverAudio.preload = 'auto';
    }
    gmHoverAudio.currentTime = 0;
    gmHoverAudio.play().catch(() => {});
  }

  function cancelGMRollExecution() {
    gmRollShakeActive = false;
    gmRollShakePointerId = null;
    gmRollShakeLastPoint = null;
    gmRollShakePower = 0;
    gmPendingRollRequest = null;
    document.getElementById('gm-roll-shake-box')?.classList.remove('shaking');
    const core = document.getElementById('gm-roll-shake-core');
    if (core) core.style.transform = 'translate(0,0) rotate(0deg)';
    updateGMRollExecuteMeter();
    document.getElementById('gm-roll-execute-modal')?.classList.remove('show');
  }

  function closeGMRollCinemaModal() {
    clearGMRollCinemaTimers();
    document.getElementById('gm-roll-cinema-modal')?.classList.remove('show');
  }

  function beginGMRollExecution(sides, qty) {
    gmPendingRollRequest = { sides, qty };
    gmRollShakePower = 0;
    gmRollShakeActive = false;
    gmRollShakePointerId = null;
    gmRollShakeLastPoint = null;
    const label = document.getElementById('gm-roll-shake-label');
    if (label) label.textContent = `${qty}D${sides}`;
    document.getElementById('gm-roll-shake-box')?.classList.remove('shaking');
    const core = document.getElementById('gm-roll-shake-core');
    if (core) core.style.transform = 'translate(0,0) rotate(0deg)';
    updateGMRollExecuteMeter();
    document.getElementById('gm-roll-execute-modal')?.classList.add('show');
  }

  function setGMRollCinemaCards(rawVisible = false, modVisible = false, finalVisible = false) {
    document.getElementById('gm-roll-cinema-raw-card')?.classList.toggle('show', rawVisible);
    document.getElementById('gm-roll-cinema-mod-card')?.classList.toggle('show', modVisible);
    document.getElementById('gm-roll-cinema-final-card')?.classList.toggle('show', finalVisible);
  }

  function renderGMRollCinemaModifiers(modTotal) {
    const list = document.getElementById('gm-roll-cinema-mod-list');
    if (!list) return;
    if (!gmRollModifiers.length) {
      list.innerHTML = '<div class="gm-empty">NO MODIFIERS LOCKED IN</div>';
    } else {
      list.innerHTML = gmRollModifiers.map((mod) => `
        <div class="gm-roll-cinema-mod-line">
          <span>${escapeGMValue(mod.label)}</span>
          <span>${mod.value >= 0 ? '+' : ''}${escapeGMValue(mod.value)}</span>
        </div>`).join('');
    }
    const totalNode = document.getElementById('gm-roll-cinema-mod-total');
    if (totalNode) totalNode.textContent = `${modTotal >= 0 ? '+' : ''}${modTotal}`;
  }

  function animateGMRollCinemaCount(start, end, onComplete) {
    const target = document.getElementById('gm-roll-cinema-final');
    if (!target) return;
    const duration = 650;
    const startTime = performance.now();
    let lastValue = start;
    target.textContent = start;
    const tick = (now) => {
      const pct = Math.min(1, (now - startTime) / duration);
      const value = Math.round(start + ((end - start) * pct));
      if (value !== lastValue) {
        playGMRollCountTick();
        lastValue = value;
      }
      target.textContent = value;
      if (pct < 1) gmRollCinemaFrame = requestAnimationFrame(tick);
      else {
        gmRollCinemaFrame = null;
        if (typeof onComplete === 'function') onComplete();
      }
    };
    gmRollCinemaFrame = requestAnimationFrame(tick);
  }

  function getGMRollDieShapeClass(sides) {
    if (sides === 4) return 'shape-d4';
    if (sides === 8) return 'shape-d8';
    if (sides === 10) return 'shape-d10';
    if (sides === 12) return 'shape-d12';
    if (sides === 20) return 'shape-d20';
    return '';
  }

  function openGMRollCinemaAnimation(sides, qty, rolls, shakePower = 0) {
    clearGMRollCinemaTimers();
    const rawTotal = rolls.reduce((sum, value) => sum + value, 0);
    const modTotal = getGMRollModifierTotal();
    const finalTotal = rawTotal + modTotal;
    const modal = document.getElementById('gm-roll-cinema-modal');
    const stage = document.getElementById('gm-roll-cinema-stage');
    const diceLayer = document.getElementById('gm-roll-cinema-dice');
    if (!modal || !stage || !diceLayer) return;

    document.getElementById('gm-roll-cinema-kicker').textContent = `${qty}D${sides} EXECUTION`;
    document.getElementById('gm-roll-cinema-pool').textContent = `Dice pool: [${rolls.join(', ')}]`;
    document.getElementById('gm-roll-cinema-raw').textContent = '0';
    document.getElementById('gm-roll-cinema-final').textContent = '0';
    renderGMRollCinemaModifiers(modTotal);
    setGMRollCinemaCards(false, false, false);
    document.getElementById('gm-roll-cinema-raw-card')?.classList.remove('emphasis');
    document.getElementById('gm-roll-cinema-final-card')?.classList.remove('emphasis');
    modal.classList.add('show');
    diceLayer.innerHTML = '';

    const stageRect = stage.getBoundingClientRect();
    const dieSize = qty <= 2 ? 76 : qty <= 4 ? 64 : 52;
    const bounds = { w: Math.max(180, stageRect.width - dieSize), h: Math.max(160, stageRect.height - dieSize) };
    const throwBoost = shakePower / 100;
    const diceBodies = rolls.map((value, idx) => {
      const die = document.createElement('div');
      die.className = `gm-roll-cinema-die ${getGMRollDieShapeClass(sides)}`.trim();
      die.style.width = `${dieSize}px`;
      die.style.height = `${dieSize}px`;
      die.style.fontSize = `${Math.max(1.6, dieSize / 27)}rem`;
      die.textContent = Math.max(1, Math.ceil(Math.random() * sides));
      diceLayer.appendChild(die);
      return {
        el: die,
        value,
        x: 12 + Math.random() * 28,
        y: 12 + idx * 8,
        vx: (Math.random() * 5 + 5) + (throwBoost * 6) + (idx * 0.8),
        vy: -(Math.random() * 6 + 2 + throwBoost * 7),
        rotation: (Math.random() * 34) - 17,
        vr: (Math.random() * 12) - 6,
        settled: false,
        lastBounceAt: 0
      };
    });

    gmRollCinemaNumberTimer = setInterval(() => {
      diceBodies.forEach((body) => {
        if (body.settled) return;
        body.el.textContent = Math.max(1, Math.ceil(Math.random() * sides));
      });
    }, 70);

    const gravity = 0.48;
    const friction = 0.992;
    const bounce = 0.74;

    const step = () => {
      let settledCount = 0;
      diceBodies.forEach((body, idx) => {
        if (!body.settled) {
          body.vy += gravity;
          body.x += body.vx;
          body.y += body.vy;
          body.rotation += body.vr;
          body.vx *= friction;
          body.vr *= 0.985;

          let bounced = false;
          if (body.x <= 0) {
            body.x = 0;
            body.vx = Math.abs(body.vx) * bounce;
            bounced = true;
          } else if (body.x >= bounds.w) {
            body.x = bounds.w;
            body.vx = -Math.abs(body.vx) * bounce;
            bounced = true;
          }

          if (body.y <= 0) {
            body.y = 0;
            body.vy = Math.abs(body.vy) * bounce;
            bounced = true;
          } else if (body.y >= bounds.h) {
            body.y = bounds.h;
            body.vy = -Math.abs(body.vy) * bounce;
            body.vx *= 0.96;
            bounced = true;
          }

          const now = performance.now();
          if (bounced && now - body.lastBounceAt > 95) {
            body.lastBounceAt = now;
            playGMRollBounceTick();
          }

          const closeToRest = Math.abs(body.vx) < 0.2 && Math.abs(body.vy) < 0.3 && Math.abs(body.vr) < 0.3;
          if (closeToRest && body.y >= bounds.h - 2) {
            body.settled = true;
            body.vx = 0;
            body.vy = 0;
            body.vr = 0;
            body.el.textContent = body.value;
            body.el.classList.add('settled');
            playGMRollCountTick();
          }
        }

        if (body.settled) {
          settledCount += 1;
          const baseX = (bounds.w / Math.max(1, diceBodies.length)) * idx + ((bounds.w / Math.max(1, diceBodies.length)) / 2);
          body.x += (baseX - body.x) * 0.06;
        }

        body.el.style.transform = `translate(${body.x}px,${body.y}px) rotate(${body.rotation}deg)`;
      });

      if (settledCount >= diceBodies.length) {
        clearInterval(gmRollCinemaNumberTimer);
        gmRollCinemaNumberTimer = null;
        document.getElementById('gm-roll-cinema-raw').textContent = rawTotal;
        setGMRollCinemaCards(true, false, false);
        document.getElementById('gm-roll-cinema-raw-card')?.classList.add('emphasis');
        gmRollCinemaRevealTimer = setTimeout(() => {
          document.getElementById('gm-roll-cinema-raw-card')?.classList.remove('emphasis');
          setGMRollCinemaCards(true, true, true);
          document.getElementById('gm-roll-cinema-final-card')?.classList.add('emphasis');
          animateGMRollCinemaCount(rawTotal, finalTotal, () => {
            tryAutoSendRollToSelectedNpc();
            gmRollCinemaAutoCloseTimer = setTimeout(() => {
              if (gmRollModifiers.length) {
                gmRollModifiers = [];
                renderGMRollModifierList();
              }
            }, 300);
          });
        }, 620);
        gmRollCinemaFrame = null;
        return;
      }

      gmRollCinemaFrame = requestAnimationFrame(step);
    };

    gmRollCinemaFrame = requestAnimationFrame(step);
  }

  function executeGMPendingRoll() {
    if (!gmPendingRollRequest) return;
    const { sides, qty } = gmPendingRollRequest;
    const shakePowerSnapshot = gmRollShakePower;
    document.getElementById('gm-roll-execute-modal')?.classList.remove('show');
    gmPendingRollRequest = null;
    gmRollShakePower = 0;
    updateGMRollExecuteMeter();
    const rolls = Array.from({ length: qty }, () => Math.floor(Math.random() * sides) + 1);
    const raw = rolls.reduce((sum, roll) => sum + roll, 0);
    const modifiers = getGMRollModifierTotal();
    gmCurrentRoll = {
      dice: `${qty}D${sides}`,
      pool: rolls,
      raw,
      modifiers,
      total: raw + modifiers,
      rolledAt: Date.now(),
      source: [
        ...(gmRollModifiers.length
          ? gmRollModifiers.map((modifier) => `${modifier.source}: ${modifier.label}`)
          : ['Manual GM roll']),
        ...((typeof window.getGMCombatPenalty === 'function'
          && Number(window.getGMCombatPenalty(gmSelectedRollSubjectKey || document.getElementById('gm-roll-subject-select')?.value || '') || 0) !== 0)
          ? ['Facedown: Stay Strong penalty']
          : [])
      ].join(' // ')
    };
    renderGMRollDisplay();
    openGMRollCinemaAnimation(sides, qty, rolls, shakePowerSnapshot);
  }

  function handleGMRollShakeStart(event) {
    if (!gmPendingRollRequest) return;
    gmRollShakeActive = true;
    gmRollShakePointerId = event.pointerId;
    gmRollShakeLastPoint = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('shaking');
  }

  function handleGMRollShakeMove(event) {
    if (!gmRollShakeActive || event.pointerId !== gmRollShakePointerId) return;
    const core = document.getElementById('gm-roll-shake-core');
    const dx = event.clientX - gmRollShakeLastPoint.x;
    const dy = event.clientY - gmRollShakeLastPoint.y;
    const dist = Math.hypot(dx, dy);
    gmRollShakePower = Math.min(100, gmRollShakePower + dist * 0.45);
    updateGMRollExecuteMeter();
    const tx = Math.max(-24, Math.min(24, dx * 1.4));
    const ty = Math.max(-24, Math.min(24, dy * 1.4));
    const rot = Math.max(-18, Math.min(18, dx + dy));
    if (core) core.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg)`;
    gmRollShakeLastPoint = { x: event.clientX, y: event.clientY };
  }

  function handleGMRollShakeEnd(event) {
    if (!gmRollShakeActive || event.pointerId !== gmRollShakePointerId) return;
    const box = document.getElementById('gm-roll-shake-box');
    const core = document.getElementById('gm-roll-shake-core');
    gmRollShakeActive = false;
    gmRollShakePointerId = null;
    gmRollShakeLastPoint = null;
    box?.classList.remove('shaking');
    if (core) core.style.transform = 'translate(0,0) rotate(0deg)';
    executeGMPendingRoll();
  }

  function animateGMLocalRollTotal(start, end) {
    const node = document.getElementById('gm-local-roll-total');
    if (!node) return;
    if (gmLocalRollFrame) cancelAnimationFrame(gmLocalRollFrame);
    const duration = 650;
    const startedAt = performance.now();
    node.classList.add('animating');

    const tick = (now) => {
      const pct = Math.min(1, (now - startedAt) / duration);
      const value = Math.round(start + ((end - start) * pct));
      node.textContent = String(value);
      if (pct < 1) {
        gmLocalRollFrame = requestAnimationFrame(tick);
      } else {
        node.textContent = String(end);
        node.classList.remove('animating');
        gmLocalRollFrame = null;
      }
    };

    gmLocalRollFrame = requestAnimationFrame(tick);
  }

  function renderGMRollDisplay() {
    const node = document.getElementById('gm-roll-display');
    if (!node) return;
    if (!gmCurrentRoll?.dice) {
      node.innerHTML = `
        <div class="gm-sheet-title">GM Result</div>
        <div class="gm-roll-empty">No GM roll yet.</div>
      `;
      return;
    }

    const modifiers = gmCurrentRoll.modifiers || 0;
    const modifierText = `${modifiers >= 0 ? '+' : ''}${modifiers}`;
    const pool = `[${(gmCurrentRoll.pool || []).join(', ')}]`;
    node.innerHTML = `
      <div class="gm-roll-head">
        <span class="gm-sheet-title">GM Result</span>
        <span class="gm-roll-dice">${escapeGMValue(gmCurrentRoll.dice)}</span>
      </div>
      <div class="gm-roll-total" id="gm-local-roll-total">${escapeGMValue(gmCurrentRoll.raw)}</div>
      <div class="gm-roll-meta">
        <span>POOL ${escapeGMValue(pool)}</span>
        <span>MOD ${escapeGMValue(modifierText)}</span>
        <span>RAW ${escapeGMValue(gmCurrentRoll.raw)}</span>
      </div>
      <div class="gm-roll-source">${escapeGMValue(gmCurrentRoll.source || 'Manual GM roll')}</div>
    `;
    animateGMLocalRollTotal(Number(gmCurrentRoll.raw || 0), Number(gmCurrentRoll.total || 0));
  }

  function addGMRollModifier(source, label, value) {
    const numericValue = parseGMNumericValue(value);
    if (numericValue === null) return;
    gmRollModifiers.push({
      source: source || 'GM',
      label: label || 'Modifier',
      value: numericValue
    });
    renderGMRollModifierList();
  }

  function removeGMRollModifier(index) {
    gmRollModifiers.splice(index, 1);
    renderGMRollModifierList();
  }

  function clearGMRollModifiers() {
    gmRollModifiers = [];
    renderGMRollModifierList();
  }

  function getGMRollSubjectOptions() {
    const turnCombatants = typeof window.getGMTurnCombatants === 'function' ? window.getGMTurnCombatants() : [];
    const turnNpcs = turnCombatants.filter((entry) => String(entry?.sourceType || '').toLowerCase() === 'npc');
    if (turnNpcs.length) return turnNpcs;
    return (typeof window.getGMLocalNpcs === 'function' ? window.getGMLocalNpcs() : []).map((entry) => ({
      ...JSON.parse(JSON.stringify(entry)),
      combatKey: `npc:${entry.id}`,
      sourceType: 'npc'
    }));
  }

  function renderGMRollSubjectSelect() {
    const select = document.getElementById('gm-roll-subject-select');
    if (!select) return;
    const options = getGMRollSubjectOptions();
    const currentTurnKey = typeof window.getGMCurrentTurnKey === 'function' ? window.getGMCurrentTurnKey() : '';
    if (!options.length) {
      select.innerHTML = '<option value="">No subject available</option>';
      gmSelectedRollSubjectKey = '';
      return;
    }

    if (currentTurnKey && options.some((entry) => entry.combatKey === currentTurnKey)) {
      gmSelectedRollSubjectKey = currentTurnKey;
    } else if (!gmSelectedRollSubjectKey || !options.some((entry) => entry.combatKey === gmSelectedRollSubjectKey)) {
      gmSelectedRollSubjectKey = currentTurnKey && options.some((entry) => entry.combatKey === currentTurnKey)
        ? currentTurnKey
        : options[0].combatKey;
    }

    select.innerHTML = options.map((entry) => `
      <option value="${escapeGMValue(entry.combatKey)}">${escapeGMValue(entry.name || 'Unknown')} // ${escapeGMValue(entry.sourceType?.toUpperCase?.() || entry.role?.toUpperCase?.() || 'NPC')}</option>
    `).join('');
    select.value = gmSelectedRollSubjectKey;
  }

  function getGMSelectedCombatantData() {
    const key = gmSelectedRollSubjectKey || document.getElementById('gm-roll-subject-select')?.value || '';
    if (!key) return null;
    const pool = [
      ...(typeof window.getGMLocalNpcs === 'function' ? window.getGMLocalNpcs() : [])
    ];
    const entry = pool.find((candidate) => candidate.combatKey === key || `player:${candidate.id}` === key || `npc:${candidate.id}` === key);
    if (!entry) return null;
    return {
      ...entry,
      combatKey: entry.combatKey || key
    };
  }

  function requireGMSelectedCombatant() {
    const combatant = getGMSelectedCombatantData();
    if (!combatant) {
      setGMStatus('No roll subject selected for GM preset roll.');
      return null;
    }
    return combatant;
  }

  function getGMCombatantStatValue(combatant, label) {
    const entry = (Array.isArray(combatant?.stats) ? combatant.stats : []).find((item) => String(item?.label || '').trim().toUpperCase() === String(label || '').trim().toUpperCase());
    return parseGMNumericValue(entry?.value) ?? 0;
  }

  function getGMCombatantSkillValue(combatant, ...names) {
    const wanted = names
      .map((name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);
    const entry = (Array.isArray(combatant?.skills) ? combatant.skills : []).find((item) => {
      const normalized = String(item?.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return wanted.some((name) => normalized.includes(name));
    });
    return parseGMNumericValue(entry?.value) ?? 0;
  }

  function setGMPresetRoll(label, modifiers, sides = 10) {
    const qtyInput = document.getElementById('gm-roll-qty');
    if (qtyInput) qtyInput.value = '1';
    gmRollModifiers = modifiers
      .map((modifier) => ({
        source: modifier.source || 'PRESET',
        label: modifier.label || 'Modifier',
        value: parseGMNumericValue(modifier.value)
      }))
      .filter((modifier) => modifier.value !== null);
    renderGMRollModifierList();
    rollGMDice(sides);
    setGMStatus(`${label} preset executed.`);
  }

  function renderGMAimAction() {
    const pips = document.getElementById('gm-aim-pips');
    const aimBtn = document.getElementById('gm-aim-btn');
    if (pips) {
      pips.innerHTML = Array.from({ length: 3 }, (_, idx) => `<span class="gm-aim-pip${idx < gmAimStackPoints ? ' active' : ''}"></span>`).join('');
    }
    if (aimBtn) {
      aimBtn.textContent = gmAimStackPoints > 0 ? 'KEEP AIM' : 'AIM';
      aimBtn.disabled = gmAimStackPoints >= 3;
    }
  }

  function resetGMAimAction() {
    gmAimStackPoints = 0;
    renderGMAimAction();
  }

  function startOrKeepGMAim() {
    if (!requireGMSelectedCombatant()) return;
    if (gmAimStackPoints >= 3) return;
    gmAimStackPoints += 1;
    renderGMAimAction();
    setGMStatus(`Aim stack set to +${gmAimStackPoints}.`);
  }

  function clearGMAim() {
    if (gmAimStackPoints <= 0) return;
    resetGMAimAction();
    setGMStatus('Aim stack cleared.');
  }

  function getGMCombatWeapons(combatant) {
    return Array.isArray(combatant?.inventoryMap?.weapon) ? combatant.inventoryMap.weapon : [];
  }

  function getGMAimHitAccuracy(weapon) {
    if (!weapon) return null;
    const fields = weapon.fields || {};
    for (const key of ['Accuracy', 'Weapon Accuracy', 'WA']) {
      const matchKey = Object.keys(fields).find((fieldKey) => String(fieldKey).trim().toLowerCase() === key.toLowerCase());
      const value = parseGMNumericValue(matchKey ? fields[matchKey] : null);
      if (value !== null) return value;
    }
    return null;
  }

  function openGMAimHitModal() {
    const combatant = requireGMSelectedCombatant();
    if (!combatant) return;
    gmAimHitWeapons = getGMCombatWeapons(combatant);
    const select = document.getElementById('gm-aim-weapon-select');
    const note = document.getElementById('gm-aim-weapon-note');
    if (!select || !note) return;
    if (!gmAimHitWeapons.length) {
      select.innerHTML = '';
      note.textContent = 'No weapon with stored inventory data is available for the current actor.';
    } else {
      select.innerHTML = gmAimHitWeapons.map((weapon, idx) => `<option value="${idx}">${escapeGMValue(weapon.name || `Weapon ${idx + 1}`)}</option>`).join('');
      note.textContent = 'Select a weapon and confirm to attack.';
    }
    document.getElementById('gm-aim-hit-modal')?.classList.add('show');
  }

  function closeGMAimHitModal() {
    document.getElementById('gm-aim-hit-modal')?.classList.remove('show');
  }

  function confirmGMAimHit() {
    const combatant = getGMSelectedCombatantData();
    const select = document.getElementById('gm-aim-weapon-select');
    const weapon = gmAimHitWeapons[parseInt(select?.value, 10)];
    if (!combatant || !weapon) {
      setGMStatus('Aim attack failed: no weapon selected.');
      return;
    }
    const accuracy = getGMAimHitAccuracy(weapon);
    if (accuracy === null) {
      setGMStatus('Aim attack failed: selected weapon has no Accuracy / Weapon Accuracy / WA value.');
      return;
    }
    const aimUsed = gmAimStackPoints;
    closeGMAimHitModal();
    gmRollModifiers = [];
    addGMRollModifier(combatant.name || 'Actor', `${weapon.name || 'Weapon'} Accuracy`, accuracy);
    if (aimUsed > 0) addGMRollModifier(combatant.name || 'Actor', 'Aim', aimUsed);
    resetGMAimAction();
    rollGMDice(10);
  }

  function rollGMAmbushPreset() {
    const combatant = requireGMSelectedCombatant();
    if (!combatant) return;
    setGMPresetRoll('AMBUSH', [
      { source: combatant.name || 'Actor', label: 'Stealth', value: getGMCombatantSkillValue(combatant, 'Stealth') },
      { source: combatant.name || 'Actor', label: 'INT', value: getGMCombatantStatValue(combatant, 'INT') }
    ], 10);
  }

  function rollGMAmbushCounterPreset() {
    const combatant = requireGMSelectedCombatant();
    if (!combatant) return;
    setGMPresetRoll('AMBUSH COUNTER', [
      { source: combatant.name || 'Actor', label: 'Awareness', value: getGMCombatantSkillValue(combatant, 'Awareness', 'AwarenessNotice') }
    ], 10);
  }

  function rollGMSuppressivePreset() {
    const combatant = requireGMSelectedCombatant();
    if (!combatant) return;
    setGMPresetRoll('SUPPRESSIVE FIRE SAVE', [
      { source: combatant.name || 'Actor', label: 'Athletics', value: getGMCombatantSkillValue(combatant, 'Athletics', 'Athletic') },
      { source: combatant.name || 'Actor', label: 'REF', value: getGMCombatantStatValue(combatant, 'REF') }
    ], 10);
  }

  function addCustomGMRollModifier() {
    const labelInput = document.getElementById('gm-roll-custom-label');
    const valueInput = document.getElementById('gm-roll-custom-value');
    const label = (labelInput?.value || '').trim() || 'Custom';
    const value = parseGMNumericValue(valueInput?.value);
    if (value === null) return;
    addGMRollModifier('GM', label, value);
    if (labelInput) labelInput.value = '';
    if (valueInput) valueInput.value = '0';
  }

  function rollGMDice(sides) {
    const qty = Math.max(1, Math.min(20, parseGMNumericValue(document.getElementById('gm-roll-qty')?.value) ?? 1));
    beginGMRollExecution(sides, qty);
  }

  function sendRollToSelectedNpc() {
    const combatant = getGMSelectedCombatantData();
    if (!combatant || !combatant.combatKey?.startsWith('npc:')) {
      setGMStatus('Select an NPC in Roll Subject before sending a GM roll.');
      return;
    }
    if (!gmCurrentRoll?.dice) {
      setGMStatus('No GM roll result available to send.');
      return;
    }
    if (typeof window.applyGMCombatantRoll !== 'function') {
      setGMStatus('Combat board is not ready to receive GM rolls.');
      return;
    }
    window.applyGMCombatantRoll(combatant.combatKey, gmCurrentRoll);
    setGMStatus(`Sent GM roll to ${combatant.name || 'selected NPC'}.`);
  }

  function tryAutoSendRollToSelectedNpc() {
    const combatant = getGMSelectedCombatantData();
    if (!combatant || !combatant.combatKey?.startsWith('npc:')) return;
    if (!gmCurrentRoll?.dice) return;
    if (typeof window.applyGMCombatantRoll !== 'function') return;
    window.applyGMCombatantRoll(combatant.combatKey, gmCurrentRoll);
    setGMStatus(`Auto-sent GM roll to ${combatant.name || 'selected NPC'}.`);
  }

  function removeLocalNpc(npcId) {
    gmLocalNpcs = gmLocalNpcs.filter((npc) => npc.id !== npcId);
    try {
      window.localStorage?.removeItem(getGMNpcSyncKey(npcId));
    } catch (error) {
      console.warn('Failed to clear NPC sync payload.', error);
    }
    renderGMNpcList();
  }

  async function loadGmNpcFile(file) {
    try {
      const lowerName = String(file?.name || '').toLowerCase();
      let parsed = null;
      if (lowerName.endsWith('.zip')) {
        const bundle = await extractGMZipBundle(file);
        if (!bundle.characterText) throw new Error('CHARACTER.TXT NOT FOUND IN NPC ZIP.');
        parsed = parseGMCharacterText(bundle.characterText);
        if (bundle.specialSkillTexts?.length) parsed.specialSkills = bundle.specialSkillTexts.flatMap((text) => parseGMSpecialSkillFile(text));
        bundle.itemTexts.forEach((text) => {
          const itemData = parseGMCharacterText(text);
          mergeGMInventory(parsed.inventory, itemData.inventory);
        });
      } else if (lowerName.endsWith('.txt')) {
        parsed = parseGMCharacterText(await readGMTextFile(file));
      } else {
        throw new Error('Only .txt or .zip files are supported.');
      }

      gmLocalNpcs.push(buildGMNpcEntry(parsed, file?.name || 'NPC'));
      persistGMNpcDossierSync(gmLocalNpcs[gmLocalNpcs.length - 1].id);
      renderGMNpcList();
      setGMStatus(`Local NPC loaded: ${gmLocalNpcs[gmLocalNpcs.length - 1].name}`);
      setGMStatusVisual(activeRef ? 'connected' : 'disconnected');
    } catch (error) {
      setGMStatus(`NPC load error: ${error.message}`);
      setGMStatusVisual('disconnected');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initFirebaseRealtime();
    window.getGMRemotePlayers = () => gmRemotePlayers.map((entry) => JSON.parse(JSON.stringify(entry)));
    window.getGMLocalNpcs = () => gmLocalNpcs.map((entry) => JSON.parse(JSON.stringify(entry)));
    window.addGMRollModifier = addGMRollModifier;
    window.getGMCurrentRoll = () => gmCurrentRoll ? JSON.parse(JSON.stringify(gmCurrentRoll)) : null;
    window.getGMActiveRoomId = () => activeRoomId;

    document.getElementById('gm-connect-btn')?.addEventListener('click', connectGMRoom);
    document.getElementById('gm-room-id')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') connectGMRoom();
    });

    document.getElementById('gm-add-npc-btn')?.addEventListener('click', () => {
      const input = document.getElementById('gm-npc-file-input');
      if (!input) return;
      input.value = '';
      input.click();
    });

    document.getElementById('gm-npc-file-input')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) await loadGmNpcFile(file);
      event.target.value = '';
    });

    document.getElementById('gm-roll-add-mod-btn')?.addEventListener('click', addCustomGMRollModifier);
    document.getElementById('gm-roll-clear-mods-btn')?.addEventListener('click', clearGMRollModifiers);
    document.getElementById('gm-roll-send-active-btn')?.addEventListener('click', sendRollToSelectedNpc);
    document.getElementById('gm-roll-ambush-btn')?.addEventListener('click', rollGMAmbushPreset);
    document.getElementById('gm-roll-ambush-counter-btn')?.addEventListener('click', rollGMAmbushCounterPreset);
    document.getElementById('gm-roll-suppressive-btn')?.addEventListener('click', rollGMSuppressivePreset);
    document.getElementById('gm-aim-btn')?.addEventListener('click', startOrKeepGMAim);
    document.getElementById('gm-clear-aim-btn')?.addEventListener('click', clearGMAim);
    document.getElementById('gm-attack-btn')?.addEventListener('click', openGMAimHitModal);
    document.getElementById('gm-aim-hit-cancel')?.addEventListener('click', closeGMAimHitModal);
    document.getElementById('gm-aim-hit-confirm')?.addEventListener('click', confirmGMAimHit);
    document.getElementById('gm-roll-custom-value')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addCustomGMRollModifier();
    });
    document.getElementById('gm-roll-subject-select')?.addEventListener('change', (event) => {
      gmSelectedRollSubjectKey = String(event.target.value || '');
    });

    document.querySelectorAll('.gm-die-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const sides = parseGMNumericValue(button.getAttribute('data-gm-die'));
        if (sides) rollGMDice(sides);
      });
    });

    document.getElementById('gm-roll-execute-cancel')?.addEventListener('click', cancelGMRollExecution);
    document.getElementById('gm-roll-cinema-close')?.addEventListener('click', closeGMRollCinemaModal);
    document.getElementById('gm-roll-execute-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) cancelGMRollExecution();
    });
    document.getElementById('gm-roll-cinema-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeGMRollCinemaModal();
    });
    document.getElementById('gm-aim-hit-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeGMAimHitModal();
    });
    document.getElementById('gm-effect-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeGMEffectModal();
    });
    document.getElementById('gm-effect-cancel')?.addEventListener('click', closeGMEffectModal);
    document.getElementById('gm-effect-save')?.addEventListener('click', saveGMEffect);
    document.getElementById('gm-item-cancel')?.addEventListener('click', closeGMInventoryModal);
    document.getElementById('gm-item-save')?.addEventListener('click', saveGMInventoryItem);
    document.getElementById('gm-item-type')?.addEventListener('change', toggleGMCustomItemType);
    document.getElementById('gm-inventory-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeGMInventoryModal();
    });

    const gmRollShakeBox = document.getElementById('gm-roll-shake-box');
    if (gmRollShakeBox) {
      gmRollShakeBox.addEventListener('pointerdown', handleGMRollShakeStart);
      gmRollShakeBox.addEventListener('pointermove', handleGMRollShakeMove);
      gmRollShakeBox.addEventListener('pointerup', handleGMRollShakeEnd);
      gmRollShakeBox.addEventListener('pointercancel', handleGMRollShakeEnd);
    }

    document.addEventListener('click', (event) => {
      const pickable = event.target.closest('.gm-sheet-line.pickable');
      if (pickable) {
        const source = pickable.getAttribute('data-gm-roll-source') || 'NPC';
        const label = pickable.getAttribute('data-gm-roll-label') || 'Value';
        const value = parseGMNumericValue(pickable.getAttribute('data-gm-roll-value'));
        if (value !== null) addGMRollModifier(source, label, value);
        return;
      }

      const removeNpcButton = event.target.closest('[data-gm-remove-npc]');
      if (removeNpcButton) {
        removeLocalNpc(removeNpcButton.getAttribute('data-gm-remove-npc'));
        return;
      }

      const openNpcDossierButton = event.target.closest('[data-gm-open-npc-dossier]');
      if (openNpcDossierButton) {
        openGMNpcDossier(openNpcDossierButton.getAttribute('data-gm-open-npc-dossier'));
        return;
      }

      const addEffectButton = event.target.closest('[data-gm-add-effect]');
      if (addEffectButton) {
        openGMEffectModal(addEffectButton.getAttribute('data-gm-add-effect'));
        return;
      }

      const removeEffectButton = event.target.closest('[data-gm-remove-effect]');
      if (removeEffectButton) {
        removeGMEffect(
          removeEffectButton.getAttribute('data-gm-remove-effect'),
          removeEffectButton.getAttribute('data-gm-effect-id')
        );
        return;
      }

      const addItemButton = event.target.closest('[data-gm-add-item]');
      if (addItemButton) {
        openGMInventoryModal(addItemButton.getAttribute('data-gm-add-item'));
        return;
      }

      const addLocalItemButton = event.target.closest('[data-gm-add-local-item]');
      if (addLocalItemButton) {
        openGMLocalNpcInventoryModal(addLocalItemButton.getAttribute('data-gm-add-local-item'));
        return;
      }

      const deleteItemButton = event.target.closest('[data-gm-delete-item]');
      if (deleteItemButton) {
        deleteGMRemoteInventoryItem(
          deleteItemButton.getAttribute('data-gm-delete-item'),
          deleteItemButton.getAttribute('data-gm-item-category'),
          deleteItemButton.getAttribute('data-gm-item-id')
        );
        return;
      }

      const deleteLocalItemButton = event.target.closest('[data-gm-delete-local-item]');
      if (deleteLocalItemButton) {
        deleteGMLocalInventoryItem(
          deleteLocalItemButton.getAttribute('data-gm-delete-local-item'),
          deleteLocalItemButton.getAttribute('data-gm-item-category'),
          deleteLocalItemButton.getAttribute('data-gm-item-id')
        );
        return;
      }

      const removeModButton = event.target.closest('[data-gm-remove-mod]');
      if (removeModButton) {
        removeGMRollModifier(parseInt(removeModButton.getAttribute('data-gm-remove-mod'), 10));
      }
    });

    document.addEventListener('change', (event) => {
      const localEdit = event.target.closest('[data-gm-local-edit]');
      if (localEdit) {
        const type = localEdit.getAttribute('data-gm-local-edit');
        const npcId = localEdit.getAttribute('data-gm-npc-id');
        const label = localEdit.getAttribute('data-gm-label');
        const value = Math.max(0, parseGMNumericValue(localEdit.value) ?? 0);
        updateLocalNpcValue(npcId, type, label, value);
        return;
      }

      const remoteEdit = event.target.closest('[data-gm-remote-edit]');
      if (remoteEdit) {
        const type = remoteEdit.getAttribute('data-gm-remote-edit');
        const clientId = remoteEdit.getAttribute('data-gm-client-id');
        const label = remoteEdit.getAttribute('data-gm-label');
        const value = Math.max(0, parseGMNumericValue(remoteEdit.value) ?? 0);
        if (type === 'setStat') {
          sendGMRemotePlayerCommand(clientId, { type: 'setStat', label, key: label, value });
          return;
        }
        if (type === 'setSkill') {
          sendGMRemotePlayerCommand(clientId, { type: 'setSkill', label, value });
          return;
        }
        if (type === 'setReputation') {
          sendGMRemotePlayerCommand(clientId, { type: 'setReputation', label: 'reputation', value });
          return;
        }
        if (type === 'setWallet') {
          sendGMRemotePlayerCommand(clientId, { type: 'setWallet', label: 'wallet', value });
          return;
        }
        if (type === 'setPhysical') {
          sendGMRemotePlayerCommand(clientId, { type: 'setPhysical', label, field: label, value });
        }
        return;
      }

      const input = event.target.closest('[data-gm-ad-input]');
      if (!input) return;
      const targetType = input.getAttribute('data-gm-target-type');
      if (targetType === 'npc') {
        updateLocalNpcArmorDamage(
          input.getAttribute('data-gm-target-id'),
          input.getAttribute('data-gm-ad-input'),
          input.getAttribute('data-gm-limb'),
          input.value
        );
        return;
      }
      if (targetType === 'player') {
        updateRemotePlayerArmorDamage(
          input.getAttribute('data-gm-target-id'),
          input.getAttribute('data-gm-ad-input'),
          input.getAttribute('data-gm-limb'),
          input.value
        );
      }
    });

    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith(GM_NPC_DOSSIER_SYNC_PREFIX) || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (!payload?.npcId || payload.source === 'gm' || !payload.data) return;
        applyDossierDataToLocalNpc(payload.npcId, payload.data, payload.data?.name?.[0] || 'NPC');
        setGMStatus(`NPC dossier sync received for ${payload.data?.name?.[0] || 'NPC'}.`);
        setGMStatusVisual(activeRef ? 'connected' : 'pending');
      } catch (error) {
        console.warn('Failed to apply NPC dossier sync update.', error);
      }
    });

    renderGMRemotePlayers(null);
    renderGMNpcList();
    renderGMRollModifierList();
    renderGMRollDisplay();
    renderGMAimAction();
    renderGMRollSubjectSelect();
    window.addEventListener('gm-action-updated', renderGMRollSubjectSelect);
    window.addEventListener('gm-monitor-updated', renderGMRollSubjectSelect);
    setGMStatusVisual('disconnected');

    document.addEventListener('mouseover', (event) => {
      const control = event.target.closest('button, a, summary, select');
      if (!control) return;
      if (control === gmHoveredControl) return;
      if (control.contains(event.relatedTarget)) return;
      gmHoveredControl = control;
      playGMHoverSound();
    });

    document.addEventListener('mouseout', (event) => {
      const control = event.target.closest('button, a, summary, select');
      if (!control) return;
      if (control === gmHoveredControl && !control.contains(event.relatedTarget)) {
        gmHoveredControl = null;
      }
    });
  });
})();
