function sanitizeInventoryCategory(value) {
  return String(value || 'miscellaneous').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w.-]/g, '') || 'miscellaneous';
}

function buildInventoryId(category) {
  return `${category}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function normalizeInventorySignedValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\+\d+$/.test(raw)) return raw.slice(1);
  if (/^-?\d+$/.test(raw)) return raw;
  return raw;
}

function normalizeInventoryAttributeRow(label, value) {
  const cleanLabel = String(label || '').trim();
  const cleanValue = normalizeInventorySignedValue(value);
  if (!cleanLabel && !cleanValue) return null;
  if (!cleanLabel) return null;
  return {
    label: cleanLabel,
    value: cleanValue
  };
}

function parseLegacyInventoryFieldEntries(source) {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source
      .map((field) => normalizeInventoryAttributeRow(field?.label, field?.value))
      .filter(Boolean);
  }
  if (typeof source === 'object') {
    return Object.entries(source)
      .map(([label, value]) => normalizeInventoryAttributeRow(label, value))
      .filter(Boolean);
  }
  return [];
}

function parseStructuredInventoryAttributes(source) {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source
      .map((entry) => normalizeInventoryAttributeRow(entry?.label || entry?.target || entry?.name, entry?.value))
      .filter(Boolean);
  }
  if (typeof source === 'object') {
    return Object.entries(source)
      .map(([label, value]) => normalizeInventoryAttributeRow(label, value))
      .filter(Boolean);
  }
  return [];
}

function buildInventoryFieldMap(item) {
  const fieldMap = {};
  [...(item?.active || []), ...(item?.passive || [])].forEach((entry) => {
    if (!entry?.label) return;
    fieldMap[entry.label] = String(entry.value ?? '').trim();
  });
  return fieldMap;
}

function getInventoryAttributeEntries(item, mode = 'all') {
  if (!item) return [];
  if (mode === 'active') return Array.isArray(item.active) ? item.active : [];
  if (mode === 'passive') return Array.isArray(item.passive) ? item.passive : [];
  return [...(Array.isArray(item.active) ? item.active : []), ...(Array.isArray(item.passive) ? item.passive : [])];
}

function classifyLegacyInventoryField(label, value) {
  const descriptor = typeof getInventoryFieldDescriptor === 'function'
    ? getInventoryFieldDescriptor(label, value)
    : null;
  if (descriptor && ['effect', 'armor_sp'].includes(descriptor.kind)) return 'active';
  return 'passive';
}

function normalizeInventoryItemPayload(rawItem, fallbackCategory = 'miscellaneous') {
  const category = sanitizeInventoryCategory(rawItem?.category || fallbackCategory);
  const legacyEntries = parseLegacyInventoryFieldEntries(rawItem?.fields);
  let active = parseStructuredInventoryAttributes(rawItem?.active);
  let passive = parseStructuredInventoryAttributes(rawItem?.passive);

  if (!active.length && !passive.length && legacyEntries.length) {
    legacyEntries.forEach((entry) => {
      if (classifyLegacyInventoryField(entry.label, entry.value) === 'active') active.push(entry);
      else passive.push(entry);
    });
  }

  const item = {
    id: String(rawItem?.id || buildInventoryId(category)).trim() || buildInventoryId(category),
    name: String(rawItem?.name || 'Item').trim() || 'Item',
    active,
    passive,
    info: Array.isArray(rawItem?.info)
      ? rawItem.info.map((line) => String(line || '').trim()).filter(Boolean)
      : []
  };
  item.fields = buildInventoryFieldMap(item);
  return { category, item };
}

function getInventoryFlattenedFieldMap(item) {
  return buildInventoryFieldMap(item || {});
}

function toggleInventoryCustomType() {
  const select = document.getElementById('inventory-item-type');
  const wrap = document.getElementById('inventory-custom-type-wrap');
  if (!select || !wrap) return;
  wrap.style.display = select.value === 'custom' ? 'block' : 'none';
}

function syncInventoryRowRemoveButtons(kind) {
  const rows = [...document.querySelectorAll(`#inventory-${kind}-rows .inventory-attr-row`)];
  rows.forEach((row) => {
    const btn = row.querySelector('.inventory-attr-remove');
    if (!btn) return;
    btn.disabled = rows.length <= 1;
  });
}

function addInventoryAttributeRow(kind, label = '', value = '') {
  const list = document.getElementById(`inventory-${kind}-rows`);
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'inventory-attr-row';
  row.innerHTML = `
    <input class="create-field-input inventory-attr-label" type="text" maxlength="60" placeholder="${kind === 'active' ? 'REF / Head Armor / BodyLevel' : 'Awareness / Damage / WA'}" value="${escapeHtml(String(label || ''))}" />
    <input class="create-field-input inventory-attr-value" type="text" maxlength="60" placeholder="${kind === 'active' ? '2 / -1 / 8' : '2 / -2 / 4d6+2'}" value="${escapeHtml(String(value || ''))}" />
    <button class="action-btn inventory-attr-remove" type="button">-</button>
  `;
  row.querySelector('.inventory-attr-remove')?.addEventListener('click', () => {
    row.remove();
    if (!list.children.length) addInventoryAttributeRow(kind);
    syncInventoryRowRemoveButtons(kind);
  });
  list.appendChild(row);
  syncInventoryRowRemoveButtons(kind);
}

function resetInventoryAttributeRows(kind, entries = []) {
  const list = document.getElementById(`inventory-${kind}-rows`);
  if (!list) return;
  list.innerHTML = '';
  const source = Array.isArray(entries) && entries.length ? entries : [{ label: '', value: '' }];
  source.forEach((entry) => addInventoryAttributeRow(kind, entry?.label || '', entry?.value || ''));
}

function readInventoryAttributeRows(kind) {
  return [...document.querySelectorAll(`#inventory-${kind}-rows .inventory-attr-row`)]
    .map((row) => normalizeInventoryAttributeRow(
      row.querySelector('.inventory-attr-label')?.value || '',
      row.querySelector('.inventory-attr-value')?.value || ''
    ))
    .filter(Boolean);
}

function openInventoryEditor(category = '', idx = -1) {
  hideInventoryHoverCard();
  closeInventoryDetailModal();
  inventoryEditState = { category, idx };
  const isEditing = category !== '' && idx > -1 && inventory[category]?.[idx];
  const item = isEditing
    ? normalizeInventoryItemPayload({ category, ...inventory[category][idx] }, category).item
    : normalizeInventoryItemPayload({ category: 'weapon', name: '', active: [], passive: [], info: [] }, 'weapon').item;
  document.getElementById('inventory-editor-title').textContent = isEditing ? 'EDIT ITEM' : 'ADD ITEM';
  document.getElementById('inventory-item-name').value = item.name || '';
  const knownTypes = ['weapon', 'cyberware', 'miscellaneous', 'buff'];
  const itemType = isEditing ? sanitizeInventoryCategory(category) : 'weapon';
  document.getElementById('inventory-item-type').value = knownTypes.includes(itemType) ? itemType : 'custom';
  document.getElementById('inventory-custom-type').value = knownTypes.includes(itemType) ? '' : itemType;
  document.getElementById('inventory-item-info').value = (item.info || []).join('\n');
  resetInventoryAttributeRows('active', item.active || []);
  resetInventoryAttributeRows('passive', item.passive || []);
  toggleInventoryCustomType();
  document.getElementById('inventory-editor-modal').classList.add('show');
  document.getElementById('inventory-item-name').focus();
}

function closeInventoryEditor() {
  document.getElementById('inventory-editor-modal')?.classList.remove('show');
  inventoryEditState = null;
}

function saveInventoryItem() {
  const name = document.getElementById('inventory-item-name').value.trim();
  if (!name) {
    showError('ITEM NAME IS REQUIRED.');
    return;
  }
  const selectValue = document.getElementById('inventory-item-type').value;
  const rawCategory = selectValue === 'custom' ? document.getElementById('inventory-custom-type').value : selectValue;
  const category = sanitizeInventoryCategory(rawCategory);
  if (!category) {
    showError('SELECT OR ENTER AN ITEM TYPE.');
    return;
  }
  const info = document.getElementById('inventory-item-info').value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const existing = inventoryEditState && inventoryEditState.idx > -1 && inventory[inventoryEditState.category]?.[inventoryEditState.idx];
  const { item } = normalizeInventoryItemPayload({
    category,
    id: existing?.id || buildInventoryId(category),
    name,
    active: readInventoryAttributeRows('active'),
    passive: readInventoryAttributeRows('passive'),
    info
  }, category);
  if (existing) {
    inventory[inventoryEditState.category].splice(inventoryEditState.idx, 1);
    if (!inventory[inventoryEditState.category].length) delete inventory[inventoryEditState.category];
  }
  if (!inventory[category]) inventory[category] = [];
  inventory[category].push(item);
  closeInventoryEditor();
  renderInventory();
  renderStats();
  renderSkills();
  renderRep();
  renderWallet();
  renderPhysicalBody();
  renderLimbs();
  renderActiveEffects();
  renderRollLab();
  showActionLog(`${existing ? 'UPDATED' : 'ADDED'} ${name.toUpperCase()} IN INVENTORY`);
}

function parseInventoryAttributeBody(body) {
  return splitTopLevelTokens(body)
    .map((token) => {
      const match = token.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
      if (!match) return null;
      return normalizeInventoryAttributeRow(match[1], cleanValue(match[2]));
    })
    .filter(Boolean);
}

function parseInventoryCategory(body, category) {
  const blocks = extractTopLevelBlocks(body);
  if (blocks.length) return blocks.map((block, idx) => parseInventoryItemBlock(block, category, idx));
  const names = parseNameBlock(body);
  return names.map((name, idx) => normalizeInventoryItemPayload({ id: `${category}${idx + 1}`, name }, category).item);
}

function parseInventoryItemBlock(block, category, idx) {
  const legacyFields = {};
  let name = block.key;
  let info = [];
  let active = [];
  let passive = [];
  splitTopLevelTokens(block.body).forEach((token) => {
    const infoMatch = token.match(/^info\s*:\s*\{([\s\S]*)\}$/i);
    if (infoMatch) {
      info = parseNameBlock(infoMatch[1]);
      return;
    }
    const activeMatch = token.match(/^active\s*:\s*\{([\s\S]*)\}$/i);
    if (activeMatch) {
      active = parseInventoryAttributeBody(activeMatch[1]);
      return;
    }
    const passiveMatch = token.match(/^passive\s*:\s*\{([\s\S]*)\}$/i);
    if (passiveMatch) {
      passive = parseInventoryAttributeBody(passiveMatch[1]);
      return;
    }
    const match = token.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
    if (!match) return;
    const fieldKey = match[1].trim();
    const value = cleanValue(match[2]);
    if (fieldKey.toLowerCase() === 'name') name = value || name;
    else legacyFields[fieldKey] = value;
  });
  return normalizeInventoryItemPayload({
    category,
    id: block.key || `${category}${idx + 1}`,
    name: name || `${category} ${idx + 1}`,
    active,
    passive,
    fields: legacyFields,
    info
  }, category).item;
}

function mergeInventory(newInventory) {
  Object.entries(newInventory || {}).forEach(([category, items]) => {
    if (!Array.isArray(items) || !items.length) return;
    const cleanCategory = sanitizeInventoryCategory(category);
    if (!inventory[cleanCategory]) inventory[cleanCategory] = [];
    items.forEach((item) => {
      inventory[cleanCategory].push(normalizeInventoryItemPayload({ category: cleanCategory, ...item }, cleanCategory).item);
    });
  });
}

function orderedInventoryCategories() {
  const keys = Object.keys(inventory).filter((k) => Array.isArray(inventory[k]) && inventory[k].length);
  return [...INVENTORY_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !INVENTORY_ORDER.includes(k)).sort()];
}

function getItemNumericField(item, ...fieldNames) {
  const targets = fieldNames.map(normalizeLookup).filter(Boolean);
  for (const [key, value] of Object.entries(getInventoryFlattenedFieldMap(item))) {
    const lookup = normalizeLookup(key);
    if (targets.some((target) => lookup === target || lookup.includes(target) || target.includes(lookup))) {
      const parsed = parseRollableValue(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function getAimHitAccuracy(item) {
  return getItemNumericField(item, 'Accuracy', 'Weapon Accuracy', 'WA');
}

function refreshInventoryDerivedPanels() {
  if (typeof renderStats === 'function') renderStats();
  if (typeof renderSkills === 'function') renderSkills();
  if (typeof renderRep === 'function') renderRep();
  if (typeof renderWallet === 'function') renderWallet();
  if (typeof renderPhysicalBody === 'function') renderPhysicalBody();
  if (typeof renderLimbs === 'function') renderLimbs();
  if (typeof renderActiveEffects === 'function') renderActiveEffects();
  if (typeof renderRollLab === 'function') renderRollLab();
}

function getInventoryPassiveAttribute(itemId, index) {
  const found = typeof findInventoryItemById === 'function' ? findInventoryItemById(itemId) : null;
  if (!found?.item) return null;
  const attr = Array.isArray(found.item.passive) ? found.item.passive[index] : null;
  if (!attr?.label) return null;
  return { found, attr };
}

function getInventoryPassiveRuntimeDescriptor(label, value) {
  const raw = String(value ?? '').trim();
  const dice = typeof parseDiceFormula === 'function' ? parseDiceFormula(raw) : null;
  if (dice) {
    return {
      kind: 'dice',
      label,
      raw,
      ...dice,
      displayValue: `${dice.qty}D${dice.sides}${dice.flatBonus ? ` ${dice.flatBonus > 0 ? '+' : '-'} ${Math.abs(dice.flatBonus)}` : ''}`
    };
  }
  if (/^[-+]?\d+$/.test(raw)) {
    const numericValue = parseInt(raw, 10) || 0;
    return {
      kind: 'modifier',
      label,
      raw,
      numericValue,
      displayValue: `${numericValue >= 0 ? '+' : ''}${numericValue}`
    };
  }
  return typeof getInventoryFieldDescriptor === 'function'
    ? getInventoryFieldDescriptor(label, value)
    : { kind: 'text', label, raw, displayValue: raw };
}

function addInventoryFieldRollModifier(itemId, fieldLabel, index = null) {
  let item = null;
  let descriptor = null;
  if (index !== null) {
    const passive = getInventoryPassiveAttribute(itemId, index);
    if (!passive) return;
    item = passive.found.item;
    descriptor = getInventoryPassiveRuntimeDescriptor(passive.attr.label, passive.attr.value);
    fieldLabel = passive.attr.label;
  } else {
    const found = typeof findInventoryItemById === 'function' ? findInventoryItemById(itemId) : null;
    if (!found?.item) return;
    item = found.item;
    descriptor = getInventoryFieldDescriptor(fieldLabel, getInventoryFlattenedFieldMap(item)[fieldLabel]);
  }
  if (!descriptor || descriptor.kind !== 'modifier') return;
  addRollModifier('ITEM', `${item.name || 'Item'}: ${fieldLabel}`, descriptor.numericValue);
}

function queueInventoryFieldDice(itemId, fieldLabel, index = null) {
  let item = null;
  let descriptor = null;
  if (index !== null) {
    const passive = getInventoryPassiveAttribute(itemId, index);
    if (!passive) return;
    item = passive.found.item;
    descriptor = getInventoryPassiveRuntimeDescriptor(passive.attr.label, passive.attr.value);
    fieldLabel = passive.attr.label;
  } else {
    const found = typeof findInventoryItemById === 'function' ? findInventoryItemById(itemId) : null;
    if (!found?.item) return;
    item = found.item;
    descriptor = getInventoryFieldDescriptor(fieldLabel, getInventoryFlattenedFieldMap(item)[fieldLabel]);
  }
  if (!descriptor || descriptor.kind !== 'dice') return;
  const logLabel = `${String(item.name || 'ITEM').toUpperCase()} // ${String(fieldLabel).toUpperCase()} ${descriptor.displayValue}`;
  if (typeof queueRollDicePool === 'function') {
    queueRollDicePool(descriptor.dicePool, {
      source: 'ITEM',
      bonus: descriptor.flatBonus,
      bonusLabel: `${item.name || 'Item'}: ${fieldLabel} Bonus`,
      logLabel
    });
  } else {
    descriptor.dicePool.forEach((side) => {
      if (typeof queueRollDie === 'function') queueRollDie(side);
    });
    if (descriptor.flatBonus) {
      addRollModifier('ITEM', `${item.name || 'Item'}: ${fieldLabel} Bonus`, descriptor.flatBonus);
    } else {
      renderRollLab();
    }
    showActionLog(`QUEUED ${logLabel}`);
  }
}

function buildInventoryQuickChips(item) {
  const entries = getInventoryAttributeEntries(item, 'all').slice(0, 3);
  return entries.map((entry) => {
    const descriptor = getInventoryPassiveRuntimeDescriptor(entry.label, entry.value);
    return `
      <span class="inventory-mini-stat">
        <span class="inventory-mini-label">${escapeHtml(humanizeLabel(entry.label))}</span>
        <span class="inventory-mini-value">${escapeHtml(descriptor.displayValue || entry.value)}</span>
      </span>
    `;
  }).join('');
}

function getInventoryItemRecord(category, itemId) {
  const cleanCategory = sanitizeInventoryCategory(category);
  const list = inventory[cleanCategory] || [];
  const idx = list.findIndex((entry) => String(entry?.id || '').trim() === String(itemId || '').trim());
  if (idx < 0) return null;
  return {
    category: cleanCategory,
    idx,
    item: list[idx]
  };
}

function buildInventoryHoverHtml(category, item) {
  return `
    <div class="inventory-hover-title">${escapeHtml(item.name || humanizeLabel(item.id || category))}</div>
    <div class="inventory-hover-type">${escapeHtml(humanizeLabel(category))}</div>
    <div class="inventory-hover-copy">${escapeHtml((item.info || []).join(' ') || 'No description logged.')}</div>
    <div class="inventory-hover-meta">
      <span>${(item.active || []).length} ACTIVE</span>
      <span>${(item.passive || []).length} PASSIVE</span>
    </div>
  `;
}

function showInventoryHoverCard(category, itemId, event) {
  const card = document.getElementById('inventory-hover-card');
  const record = getInventoryItemRecord(category, itemId);
  if (!card || !record?.item) return;
  card.innerHTML = buildInventoryHoverHtml(record.category, record.item);
  card.classList.add('show');
  moveInventoryHoverCard(event);
}

function moveInventoryHoverCard(event) {
  const card = document.getElementById('inventory-hover-card');
  if (!card || !card.classList.contains('show') || !event) return;
  const pad = 18;
  const width = card.offsetWidth || 260;
  const height = card.offsetHeight || 120;
  let left = event.clientX + pad;
  let top = event.clientY + pad;
  if (left + width > window.innerWidth - 12) left = event.clientX - width - pad;
  if (top + height > window.innerHeight - 12) top = event.clientY - height - pad;
  card.style.left = `${Math.max(12, left)}px`;
  card.style.top = `${Math.max(12, top)}px`;
}

function hideInventoryHoverCard() {
  const card = document.getElementById('inventory-hover-card');
  if (!card) return;
  card.classList.remove('show');
}

function renderInventoryDetailAttributes(entries, mode, itemId) {
  if (!entries.length) return '<div class="inventory-empty">NO ATTRIBUTES LOGGED</div>';
  return entries.map((entry, index) => {
    const descriptor = mode === 'passive'
      ? getInventoryPassiveRuntimeDescriptor(entry.label, entry.value)
      : (typeof getInventoryFieldDescriptor === 'function'
        ? getInventoryFieldDescriptor(entry.label, entry.value)
        : { kind: 'text', displayValue: entry.value });
    let action = '';
    if (mode === 'passive') {
      if (descriptor.kind === 'modifier') {
        action = `<button class="inventory-attr-action" type="button" onclick="event.stopPropagation();addInventoryFieldRollModifier('${escapeJsString(itemId)}','${escapeJsString(entry.label)}',${index})">ADD</button>`;
      } else if (descriptor.kind === 'dice') {
        action = `<button class="inventory-attr-action" type="button" onclick="event.stopPropagation();queueInventoryFieldDice('${escapeJsString(itemId)}','${escapeJsString(entry.label)}',${index})">QUEUE</button>`;
      }
    }
    return `
      <div class="inventory-detail-attr inventory-detail-attr-${mode}">
        <div class="inventory-detail-attr-main">
          <div class="inventory-detail-attr-label">${escapeHtml(humanizeLabel(entry.label))}</div>
          <div class="inventory-detail-attr-value">${escapeHtml(descriptor.displayValue || entry.value || '--')}</div>
        </div>
        ${mode === 'active' ? '<span class="inventory-detail-lock">AUTO</span>' : action}
      </div>
    `;
  }).join('');
}

function openInventoryDetailModal(category, itemId) {
  const record = getInventoryItemRecord(category, itemId);
  if (!record?.item) return;
  hideInventoryHoverCard();
  const modal = document.getElementById('inventory-detail-modal');
  const item = normalizeInventoryItemPayload({ category: record.category, ...record.item }, record.category).item;
  modal.dataset.category = record.category;
  modal.dataset.itemId = item.id || '';
  document.getElementById('inventory-detail-name').textContent = item.name || 'Item';
  document.getElementById('inventory-detail-type').textContent = humanizeLabel(record.category);
  document.getElementById('inventory-detail-copy').textContent = (item.info || []).join(' ') || 'No description logged.';
  document.getElementById('inventory-detail-active').innerHTML = renderInventoryDetailAttributes(item.active || [], 'active', item.id || '');
  document.getElementById('inventory-detail-passive').innerHTML = renderInventoryDetailAttributes(item.passive || [], 'passive', item.id || '');
  modal.classList.add('show');
}

function closeInventoryDetailModal() {
  document.getElementById('inventory-detail-modal')?.classList.remove('show');
}

function editCurrentInventoryDetailItem() {
  const modal = document.getElementById('inventory-detail-modal');
  const category = modal?.dataset?.category || '';
  const itemId = modal?.dataset?.itemId || '';
  if (!category || !itemId) return;
  const record = getInventoryItemRecord(category, itemId);
  if (!record) return;
  closeInventoryDetailModal();
  openInventoryEditor(record.category, record.idx);
}

function deleteCurrentInventoryDetailItem() {
  const modal = document.getElementById('inventory-detail-modal');
  const category = modal?.dataset?.category || '';
  const itemId = modal?.dataset?.itemId || '';
  if (!category || !itemId) return;
  const record = getInventoryItemRecord(category, itemId);
  if (!record) return;
  removeInventoryItem(record.category, record.idx);
}

function renderInventory() {
  const div = document.getElementById('inventory-list');
  const categories = orderedInventoryCategories();
  if (!categories.length) {
    hideInventoryHoverCard();
    closeInventoryDetailModal();
    div.innerHTML = '<div class="inventory-empty">[ NO INVENTORY LOADED ]</div>';
    updateSystemStrip();
    syncCurrentPlayerPresence();
    return;
  }
  div.innerHTML = categories.map((category) => {
    const items = inventory[category] || [];
    return `
      <div class="inventory-category">
        <div class="inventory-category-title">
          <span>${escapeHtml(humanizeLabel(category))}</span>
          <span class="inventory-category-count">${items.length} ITEM${items.length === 1 ? '' : 'S'}</span>
        </div>
        <div class="inventory-card-grid">
            ${items.map((item, idx) => `
              <article class="inventory-card"
                onmouseenter="showInventoryHoverCard('${escapeJsString(category)}','${escapeJsString(item.id || '')}', event)"
                onmousemove="moveInventoryHoverCard(event)"
                onmouseleave="hideInventoryHoverCard()"
                onclick="openInventoryDetailModal('${escapeJsString(category)}','${escapeJsString(item.id || '')}')">
                <div class="inventory-card-head">
                  <div class="inventory-card-name">${escapeHtml(item.name || humanizeLabel(item.id || category))}</div>
                  <div class="inventory-card-tags">
                    <span class="inventory-card-tag">${(item.active || []).length}A</span>
                    <span class="inventory-card-tag inventory-card-tag-passive">${(item.passive || []).length}P</span>
                  </div>
                </div>
                <div class="inventory-card-type">${escapeHtml(humanizeLabel(category))}</div>
              </article>
            `).join('')}
          </div>
        </div>
      `;
  }).join('');
  updateSystemStrip();
  syncCurrentPlayerPresence();
  refreshInventoryDerivedPanels();
}

function removeInventoryItem(category, idx) {
  const item = inventory[category]?.[idx];
  if (!item) return;
  showModal('REMOVE ITEM?', `Delete "${item.name || humanizeLabel(category)}" from inventory?`, () => {
    const removedName = item.name || humanizeLabel(category);
    if (typeof clearInventoryFieldEffectsForItem === 'function') clearInventoryFieldEffectsForItem(item.id);
    inventory[category].splice(idx, 1);
    if (!inventory[category].length) delete inventory[category];
    closeInventoryDetailModal();
    renderInventory();
    renderStats();
    renderSkills();
    renderRep();
    renderWallet();
    renderPhysicalBody();
    renderLimbs();
    renderActiveEffects();
    renderRollLab();
    showActionLog(`REMOVED ${removedName.toUpperCase()} FROM INVENTORY`);
    closeModal();
  });
}

function serializeInventoryAttributes(entries) {
  return (entries || [])
    .map((entry) => `${String(entry.label || '').replace(/"/g, '\\"')}="${String(entry.value || '').replace(/"/g, '\\"')}"`)
    .join(', ');
}

function serializeInventoryBlock() {
  const categories = orderedInventoryCategories();
  if (!categories.length) return '';
  return `${categories.map((category) => {
    const items = (inventory[category] || []).map((rawItem, idx) => {
      const item = normalizeInventoryItemPayload({ category, ...rawItem }, category).item;
      const key = item.id || `${category}${idx + 1}`;
      const fieldLines = [`name="${String(item.name || '').replace(/"/g, '\\"')}"`];
      if (item.active?.length) fieldLines.push(`active:{ ${serializeInventoryAttributes(item.active)} }`);
      if (item.passive?.length) fieldLines.push(`passive:{ ${serializeInventoryAttributes(item.passive)} }`);
      if (item.info?.length) {
        fieldLines.push(`info:{ ${item.info.map((line) => `"${String(line).replace(/"/g, '\\"')}"`).join(', ')} }`);
      }
      return `  ${key}:{ ${fieldLines.join(', ')} }`;
    }).join(',\n');
    return `${category}: {\n${items}\n}`;
  }).join('\n\n')}\n\n`;
}

window.normalizeInventoryItemPayload = normalizeInventoryItemPayload;
window.getInventoryAttributeEntries = getInventoryAttributeEntries;
window.getInventoryFlattenedFieldMap = getInventoryFlattenedFieldMap;
window.showInventoryHoverCard = showInventoryHoverCard;
window.moveInventoryHoverCard = moveInventoryHoverCard;
window.hideInventoryHoverCard = hideInventoryHoverCard;
window.openInventoryDetailModal = openInventoryDetailModal;
window.closeInventoryDetailModal = closeInventoryDetailModal;
window.editCurrentInventoryDetailItem = editCurrentInventoryDetailItem;
window.deleteCurrentInventoryDetailItem = deleteCurrentInventoryDetailItem;
window.addInventoryAttributeRow = addInventoryAttributeRow;
