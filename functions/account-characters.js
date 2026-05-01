(function initAccountCharacterLauncher() {
  const savesPanel = document.getElementById('launcher-saves-panel');
  const savesList = document.getElementById('launcher-saves-list');
  const savesEmpty = document.getElementById('launcher-saves-empty');
  let activeCharacterRef = null;
  let activeCharacterHandler = null;

  function clearCharacterWatcher() {
    if (activeCharacterRef && activeCharacterHandler) {
      activeCharacterRef.off('value', activeCharacterHandler);
    }
    activeCharacterRef = null;
    activeCharacterHandler = null;
  }

  function normalizeCharacterEntry(id, entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    const bundleData = payload.bundleData || source.bundleData || null;
    const rawText = payload.rawText || source.rawText || '';
    const characterData = payload.characterData || source.characterData || source.sheetData || null;
    const savedAt = meta.updatedAt || source.updatedAt || source.savedAt || source.updatedAtMs || 0;
    return {
      id,
      name: String(meta.name || source.name || characterData?.name?.[0] || 'Unnamed Character').trim() || 'Unnamed Character',
      career: String(meta.career || source.career || characterData?.career?.[0] || 'Unknown').trim() || 'Unknown',
      note: String(meta.note || source.note || '').trim(),
      savedAt,
      rawText,
      bundleData,
      characterData
    };
  }

  function renderEmptyState(message) {
    savesList.innerHTML = '';
    savesEmpty.textContent = message;
    savesList.appendChild(savesEmpty);
  }

  function launchSavedCharacter(entry) {
    if (entry.bundleData) {
      window.startChippinInTransition({ bundleData: entry.bundleData });
      return;
    }
    if (entry.rawText) {
      window.startChippinInTransition({ rawText: entry.rawText });
      return;
    }
    if (entry.characterData) {
      window.startChippinInTransition({
        characterData: window.desanitizeFirebaseValue?.(entry.characterData) || entry.characterData
      });
      return;
    }
    if (typeof window.setLauncherStatus === 'function') {
      window.setLauncherStatus('THIS SAVE DOES NOT HAVE A DOSSIER PAYLOAD YET.');
    }
  }

  function renderCharacterEntries(entries) {
    if (!entries.length) {
      renderEmptyState('No saved characters in this account yet.');
      return;
    }
    savesList.innerHTML = '';
    entries.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'launcher-save-card';
      const savedLabel = entry.savedAt
        ? new Date(entry.savedAt).toLocaleString()
        : 'No save timestamp';
      const hasPayload = Boolean(entry.bundleData || entry.rawText || entry.characterData);
      card.innerHTML = `
        <div class="launcher-save-main">
          <div class="launcher-save-name">${escapeHtml(entry.name)}</div>
          <div class="launcher-save-meta">${escapeHtml(entry.career)} // ${escapeHtml(savedLabel)}</div>
          <div class="launcher-save-copy">${escapeHtml(entry.note || (hasPayload ? 'Stored dossier payload ready to launch.' : 'Metadata only. Save payload wiring comes next.'))}</div>
        </div>
        <button class="launcher-btn launcher-save-open" type="button" ${hasPayload ? '' : 'disabled'}><span class="launcher-btn-mark">&#9654;</span><span>OPEN DOSSIER</span></button>
      `;
      card.querySelector('button')?.addEventListener('click', () => launchSavedCharacter(entry));
      savesList.appendChild(card);
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function watchUserCharacters(user) {
    clearCharacterWatcher();
    if (!savesPanel) return;
    if (!user?.uid) {
      savesPanel.hidden = true;
      return;
    }
    savesPanel.hidden = false;
    renderEmptyState('Loading saved characters...');
    const ref = window.getUserCharactersRef?.(user.uid);
    if (!ref) {
      renderEmptyState('Character save storage is not ready yet.');
      return;
    }
    activeCharacterRef = ref;
    activeCharacterHandler = (snapshot) => {
      const data = snapshot.val() || {};
      const entries = Object.entries(data)
        .map(([id, value]) => normalizeCharacterEntry(id, value))
        .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
      renderCharacterEntries(entries);
    };
    ref.on('value', activeCharacterHandler);
  }

  window.watchFirebaseAuthState?.((user) => {
    watchUserCharacters(user || null);
  });

  watchUserCharacters(window.getFirebaseCurrentUser?.() || null);
})();
