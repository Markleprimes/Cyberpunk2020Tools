(function initGMFacedownResolution() {
  function getLoser(state) {
    const combatants = Array.isArray(state?.combatants) ? state.combatants : [];
    const results = state?.results || {};
    const ready = combatants
      .map((combatant) => ({
        combatant,
        result: results[combatant.combatKey]
      }))
      .filter((entry) => entry.result?.ready);
    if (ready.length !== 2) return null;
    ready.sort((a, b) => {
      const totalDiff = Number(a.result.total || 0) - Number(b.result.total || 0);
      if (totalDiff !== 0) return totalDiff;
      return String(a.combatant.name || '').localeCompare(String(b.combatant.name || ''));
    });
    return ready[0].combatant;
  }

  function refreshFacedownOutcomeUI() {
    const state = typeof window.getGMFacedownState === 'function' ? window.getGMFacedownState() : null;
    const actions = document.getElementById('gm-facedown-outcome-actions');
    const playerWait = document.getElementById('gm-facedown-player-wait');
    const playerCopy = document.getElementById('gm-facedown-player-copy');
    const confirm = document.getElementById('gm-facedown-confirm');
    const backoff = document.getElementById('gm-facedown-backoff');
    const stay = document.getElementById('gm-facedown-stay');
    if (!actions || !playerWait || !playerCopy || !confirm || !backoff || !stay) return;

    const loser = getLoser(state);
    const npcLoser = loser && String(loser.sourceType || loser.role || '').toLowerCase() === 'npc';
    const playerLoser = loser && String(loser.sourceType || loser.role || '').toLowerCase() === 'player';
    actions.style.display = npcLoser ? 'flex' : 'none';
    playerWait.style.display = playerLoser ? 'block' : 'none';
    confirm.style.display = (npcLoser || playerLoser) ? 'none' : '';
    if (npcLoser) {
      backoff.textContent = `BACK OFF ${String(loser.name || 'NPC').toUpperCase()}`;
      stay.textContent = `STAY STRONG ${String(loser.name || 'NPC').toUpperCase()}`;
      backoff.dataset.gmFacedownLoser = loser.combatKey || '';
      stay.dataset.gmFacedownLoser = loser.combatKey || '';
      playerCopy.textContent = 'Waiting for the player to choose on their dossier.';
    } else if (playerLoser) {
      const label = String(state?.playerChoice?.label || `Waiting for ${String(loser.name || 'player')} to choose on their dossier...`);
      playerCopy.textContent = label;
      backoff.dataset.gmFacedownLoser = '';
      stay.dataset.gmFacedownLoser = '';
    } else {
      backoff.dataset.gmFacedownLoser = '';
      stay.dataset.gmFacedownLoser = '';
      playerCopy.textContent = 'Waiting for the player to choose on their dossier.';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gm-facedown-backoff')?.addEventListener('click', () => {
      const key = document.getElementById('gm-facedown-backoff')?.dataset.gmFacedownLoser || '';
      if (key && typeof window.resolveGMFacedownBackoff === 'function') {
        window.resolveGMFacedownBackoff(key);
      }
    });

    document.getElementById('gm-facedown-stay')?.addEventListener('click', () => {
      if (typeof window.resolveGMFacedownStayStrong === 'function') {
        window.resolveGMFacedownStayStrong();
      }
    });

    window.addEventListener('gm-facedown-updated', refreshFacedownOutcomeUI);
    refreshFacedownOutcomeUI();
  });
})();
