function sanitizeInventoryCategory(value) {
  return String(value || 'miscellaneous').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w.-]/g, '') || 'miscellaneous';
}

function buildInventoryId(category) {
  return `${category}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function parseEditorFields(text) {
  const fields = {};
  text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields[key] = value;
  });
  return fields;
}

function serializeEditorFields(fields) {
  return Object.entries(fields || {}).map(([key, value]) => `${key}=${value}`).join('\n');
}

function toggleInventoryCustomType() {
  const select = document.getElementById('inventory-item-type');
  const wrap = document.getElementById('inventory-custom-type-wrap');
  wrap.style.display = select.value === 'custom' ? 'block' : 'none';
}

function openInventoryEditor(category = '', idx = -1) {
  inventoryEditState = { category, idx };
  const isEditing = category !== '' && idx > -1 && inventory[category]?.[idx];
  const item = isEditing ? inventory[category][idx] : { name: '', fields: {}, info: [] };
  document.getElementById('inventory-editor-title').textContent = isEditing ? 'EDIT ITEM' : 'ADD ITEM';
  document.getElementById('inventory-item-name').value = item.name || '';
  const knownTypes = ['weapon', 'cyberware', 'miscellaneous', 'buff'];
  const itemType = isEditing ? category : 'weapon';
  document.getElementById('inventory-item-type').value = knownTypes.includes(itemType) ? itemType : 'custom';
  document.getElementById('inventory-custom-type').value = knownTypes.includes(itemType) ? '' : itemType;
  document.getElementById('inventory-item-stats').value = serializeEditorFields(item.fields);
  document.getElementById('inventory-item-info').value = (item.info || []).join('\n');
  toggleInventoryCustomType();
  document.getElementById('inventory-editor-modal').classList.add('show');
  document.getElementById('inventory-item-name').focus();
}

function closeInventoryEditor() {
  document.getElementById('inventory-editor-modal').classList.remove('show');
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
  const fields = parseEditorFields(document.getElementById('inventory-item-stats').value);
  const info = document.getElementById('inventory-item-info').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const existing = inventoryEditState && inventoryEditState.idx > -1 && inventory[inventoryEditState.category]?.[inventoryEditState.idx];
  const item = { id: existing?.id || buildInventoryId(category), name, fields, info };
  if (existing) {
    inventory[inventoryEditState.category].splice(inventoryEditState.idx, 1);
    if (!inventory[inventoryEditState.category].length) delete inventory[inventoryEditState.category];
  }
  if (!inventory[category]) inventory[category] = [];
  inventory[category].push(item);
  closeInventoryEditor();
  renderInventory();
  showActionLog(`${existing ? 'UPDATED' : 'ADDED'} ${name.toUpperCase()} IN INVENTORY`);
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
    const m = token.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
    if (!m) return;
    const fieldKey = m[1].trim();
    const value = cleanValue(m[2]);
    if (fieldKey.toLowerCase() === 'name') name = value || name;
    else fields[fieldKey] = value;
  });
  return { id: block.key || `${category}${idx + 1}`, name: name || `${category} ${idx + 1}`, fields, info };
}

function mergeInventory(newInventory) {
  Object.entries(newInventory).forEach(([category, items]) => {
    if (!Array.isArray(items) || !items.length) return;
    if (!inventory[category]) inventory[category] = [];
    inventory[category].push(...items);
  });
}

function orderedInventoryCategories() {
  const keys = Object.keys(inventory).filter((k) => Array.isArray(inventory[k]) && inventory[k].length);
  return [...INVENTORY_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !INVENTORY_ORDER.includes(k)).sort()];
}

function getItemNumericField(item, ...fieldNames) {
  const targets = fieldNames.map(normalizeLookup).filter(Boolean);
  for (const [key, value] of Object.entries(item.fields || {})) {
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

function renderInventory() {
  const div = document.getElementById('inventory-list');
  const categories = orderedInventoryCategories();
  if (!categories.length) {
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
        ${items.map((item, idx) => {
    const itemRollName = escapeJsString(item.name || category);
    const categoryKey = escapeJsString(category);
    const statHtml = Object.entries(item.fields || {}).map(([label, value]) => {
      const rollValue = parseRollableValue(value);
      return `
            <div class="inventory-stat${rollValue !== null ? ' pickable' : ''}"${rollValue !== null ? ` title="Add ${escapeHtml(label)} to roll" onclick="addRollModifier('ITEM','${itemRollName}: ${escapeJsString(label)}',${rollValue})"` : ''}>
              <span class="inventory-stat-label">${escapeHtml(humanizeLabel(label))}</span>
              <span class="inventory-stat-value">${escapeHtml(value)}</span>
            </div>`;
    }).join('');
    const infoHtml = (item.info || []).map((line) => `<div class="inventory-info-line">${escapeHtml(line)}</div>`).join('');
    return `
            <details class="inventory-item">
              <summary class="inventory-summary">
                <span class="inventory-badge"></span>
                <span class="inventory-name">${escapeHtml(item.name || humanizeLabel(item.id || category))}</span>
                <span class="inventory-tag">${escapeHtml(humanizeLabel(category))}</span>
                <button class="inventory-edit" type="button" onclick="event.preventDefault();event.stopPropagation();openInventoryEditor('${categoryKey}',${idx})">EDIT</button>
                <button class="inventory-delete" type="button" onclick="event.preventDefault();event.stopPropagation();removeInventoryItem('${categoryKey}',${idx})">DEL</button>
              </summary>
              <div class="inventory-detail">
                ${statHtml ? `<div class="inventory-stats">${statHtml}</div>` : ''}
                ${infoHtml ? `<div class="inventory-info"><div class="inventory-info-title">Description</div>${infoHtml}</div>` : ''}
              </div>
            </details>`;
  }).join('')}
      </div>`;
  }).join('');
  updateSystemStrip();
  syncCurrentPlayerPresence();
}

function removeInventoryItem(category, idx) {
  const item = inventory[category]?.[idx];
  if (!item) return;
  showModal('REMOVE ITEM?', `Delete "${item.name || humanizeLabel(category)}" from inventory?`, () => {
    const removedName = item.name || humanizeLabel(category);
    inventory[category].splice(idx, 1);
    if (!inventory[category].length) delete inventory[category];
    renderInventory();
    showActionLog(`REMOVED ${removedName.toUpperCase()} FROM INVENTORY`);
    closeModal();
  });
}

function serializeInventoryBlock() {
  const categories = orderedInventoryCategories();
  if (!categories.length) return '';
  return `${categories.map((category) => {
    const items = (inventory[category] || []).map((item, idx) => {
      const key = item.id || `${category}${idx + 1}`;
      const fieldLines = [`name="${(item.name || '').replace(/"/g, '\\"')}"`];
      Object.entries(item.fields || {}).forEach(([label, value]) => {
        fieldLines.push(`${label}="${String(value).replace(/"/g, '\\"')}"`);
      });
      if (item.info?.length) {
        fieldLines.push(`info:{ ${item.info.map((line) => `"${String(line).replace(/"/g, '\\"')}"`).join(', ')} }`);
      }
      return `  ${key}:{ ${fieldLines.join(', ')} }`;
    }).join(',\n');
    return `${category}: {\n${items}\n}`;
  }).join('\n\n')}\n\n`;
}
