(function initAccountSaveBrowser() {
  const modal = document.getElementById('account-save-browser-modal');
  const listNode = document.getElementById('account-save-browser-list');

  if (!modal || !listNode) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeCharacterEntry(id, entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
    const payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    const characterData = payload.characterData || source.characterData || source.sheetData || null;
    const savedAt = Number(meta.updatedAt || source.updatedAt || source.savedAt || 0) || 0;
    return {
      id,
      payload,
      characterData,
      savedAt,
      name: String(meta.name || characterData?.name?.[0] || 'Unnamed Character').trim() || 'Unnamed Character',
      career: String(meta.career || characterData?.career?.[0] || 'Unknown').trim() || 'Unknown',
      note: String(meta.note || source.note || '').trim()
    };
  }

  function renderSaveBrowserMessage(message) {
    listNode.innerHTML = `<div class="inventory-empty">${escapeHtml(message)}</div>`;
  }

  function closeAccountSaveBrowser() {
    modal.classList.remove('show');
  }

  async function openAccountSaveBrowser() {
    const user = window.getFirebaseCurrentUser?.();
    if (!user?.uid) {
      window.showError?.('LOG IN WITH GOOGLE TO LOAD ACCOUNT DOSSIERS.');
      return;
    }

    modal.classList.add('show');
    renderSaveBrowserMessage('LOADING SAVED CHARACTERS...');

    try {
      const rawEntries = await window.listUserCharacters?.(user.uid);
      const entries = Object.entries(rawEntries || {})
        .map(([id, value]) => normalizeCharacterEntry(id, value))
        .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));

      if (!entries.length) {
        renderSaveBrowserMessage('NO SAVED CHARACTERS IN THIS ACCOUNT.');
        return;
      }

      listNode.innerHTML = '';
      entries.forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'account-save-card';
        const savedLabel = entry.savedAt
          ? new Date(entry.savedAt).toLocaleString()
          : 'No save timestamp';
        button.innerHTML = `
          <div class="account-save-card-main">
            <div class="account-save-card-name">${escapeHtml(entry.name)}</div>
            <div class="account-save-card-meta">${escapeHtml(entry.career)} // ${escapeHtml(savedLabel)}</div>
            <div class="account-save-card-copy">${escapeHtml(entry.note || 'Saved account dossier ready to load.')}</div>
          </div>
        `;
        button.addEventListener('click', async () => {
          try {
            const fullEntry = await window.getUserCharacter?.(user.uid, entry.id);
            const sourceEntry = fullEntry || entry;
            const didLoad = window.loadAccountCharacterEntry?.(sourceEntry, entry.id);
            if (didLoad) closeAccountSaveBrowser();
          } catch (error) {
            window.showError?.(`FAILED TO LOAD ACCOUNT DOSSIER: ${error.message || 'UNKNOWN ERROR'}`);
          }
        });
        listNode.appendChild(button);
      });
    } catch (error) {
      console.warn('Failed to list saved account characters.', error);
      renderSaveBrowserMessage(`FAILED TO READ ACCOUNT SAVES: ${error.message || 'UNKNOWN ERROR'}`);
    }
  }

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeAccountSaveBrowser();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('show')) {
      closeAccountSaveBrowser();
    }
  });

  window.openAccountSaveBrowser = openAccountSaveBrowser;
  window.closeAccountSaveBrowser = closeAccountSaveBrowser;
})();
