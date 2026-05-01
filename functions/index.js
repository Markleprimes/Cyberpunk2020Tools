const launcherLoadBtn = document.getElementById('launcher-load-btn');
const launcherFileInput = document.getElementById('launcher-file-input');
const launcherCreateBtn = document.getElementById('launcher-create-btn');
const launcherGmLink = document.getElementById('launcher-gm-link');
const launcherModal = document.getElementById('launcher-modal');
const launcherCancelBtn = document.getElementById('launcher-cancel-btn');
const launcherAuthOpenBtn = document.getElementById('launcher-auth-open-btn');
const launcherAuthModal = document.getElementById('launcher-auth-modal');
const launcherAuthCancelBtn = document.getElementById('launcher-auth-cancel-btn');
const launcherGoogleLoginBtn = document.getElementById('launcher-google-login-btn');
const launcherStatusPillLabel = document.getElementById('launcher-status-pill-label');
const formatGuideOpenBtn = document.getElementById('format-guide-open-btn');
const formatGuideModal = document.getElementById('format-guide-modal');
const formatGuideCloseBtn = document.getElementById('format-guide-close-btn');
const launcherForm = document.getElementById('launcher-form');
const launcherStatus = document.getElementById('launcher-status');
let launcherHoverAudio = null;
let launcherHoveredButton = null;
let currentLauncherUser = null;

function setLauncherStatus(message) {
  launcherStatus.textContent = message;
  launcherStatus.classList.add('show');
}

function clearLauncherStatus() {
  launcherStatus.textContent = '';
  launcherStatus.classList.remove('show');
}
window.setLauncherStatus = setLauncherStatus;
window.clearLauncherStatus = clearLauncherStatus;

function openLauncherModal() {
  clearLauncherStatus();
  document.getElementById('launcher-name').value = '';
  document.getElementById('launcher-street').value = '';
  document.getElementById('launcher-career').value = 'Solo';
  launcherModal.classList.add('show');
  launcherModal.setAttribute('aria-hidden', 'false');
  document.getElementById('launcher-name').focus();
}

function closeLauncherModal() {
  launcherModal.classList.remove('show');
  launcherModal.setAttribute('aria-hidden', 'true');
}

function openLauncherAuthModal() {
  clearLauncherStatus();
  launcherAuthModal.classList.add('show');
  launcherAuthModal.setAttribute('aria-hidden', 'false');
}

function closeLauncherAuthModal() {
  launcherAuthModal.classList.remove('show');
  launcherAuthModal.setAttribute('aria-hidden', 'true');
}

function openFormatGuideModal() {
  formatGuideModal.classList.add('show');
  formatGuideModal.setAttribute('aria-hidden', 'false');
}

function closeFormatGuideModal() {
  formatGuideModal.classList.remove('show');
  formatGuideModal.setAttribute('aria-hidden', 'true');
}

function updateLauncherAuthUi(user) {
  currentLauncherUser = user || null;
  if (user) {
    launcherAuthOpenBtn.hidden = true;
    launcherStatusPillLabel.textContent = user.displayName || user.email || 'SIGNED IN';
    return;
  }
  launcherAuthOpenBtn.hidden = false;
  launcherStatusPillLabel.textContent = 'ACCESS READY';
}

function requireLauncherLogin() {
  if (currentLauncherUser) return true;
  setLauncherStatus('LOG IN WITH GOOGLE FIRST.');
  openLauncherAuthModal();
  return false;
}

function playLauncherHoverSound() {
  if (!launcherHoverAudio) {
    launcherHoverAudio = new Audio('audio/menu-hover.mp3');
    launcherHoverAudio.preload = 'auto';
  }
  launcherHoverAudio.currentTime = 0;
  launcherHoverAudio.play().catch(() => {});
}

document.addEventListener('mouseover', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button === launcherHoveredButton) return;
  if (button.contains(event.relatedTarget)) return;
  launcherHoveredButton = button;
  playLauncherHoverSound();
});

document.addEventListener('mouseout', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button === launcherHoveredButton && !button.contains(event.relatedTarget)) {
    launcherHoveredButton = null;
  }
});

launcherLoadBtn.addEventListener('click', () => {
  if (!requireLauncherLogin()) return;
  clearLauncherStatus();
  launcherFileInput.value = '';
  launcherFileInput.click();
});

launcherFileInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.zip')) {
    extractZipBundle(file).then((bundle) => {
      if (!bundle.characterText) {
        setLauncherStatus('CHARACTER.TXT NOT FOUND IN ZIP.');
        return;
      }
      window.startChippinInTransition({ bundleData: bundle });
    }).catch(() => {
      setLauncherStatus('FAILED TO READ ZIP DOSSIER.');
    });
    return;
  }
  if (!lowerName.endsWith('.txt')) {
    setLauncherStatus('ONLY .TXT OR .ZIP DOSSIERS ARE SUPPORTED.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    window.startChippinInTransition({ rawText: String(loadEvent.target?.result || '') });
  };
  reader.onerror = () => setLauncherStatus('FAILED TO READ DOSSIER FILE.');
  reader.readAsText(file);
});

launcherCreateBtn.addEventListener('click', () => {
  if (!requireLauncherLogin()) return;
  openLauncherModal();
});
launcherCancelBtn.addEventListener('click', closeLauncherModal);
launcherAuthOpenBtn.addEventListener('click', openLauncherAuthModal);
launcherAuthCancelBtn.addEventListener('click', closeLauncherAuthModal);
launcherGoogleLoginBtn.addEventListener('click', async () => {
  launcherGoogleLoginBtn.disabled = true;
  try {
    const user = await window.signInWithGooglePopup();
    updateLauncherAuthUi(user);
    closeLauncherAuthModal();
    setLauncherStatus(`SIGNED IN: ${user?.displayName || user?.email || 'GOOGLE ACCOUNT'}`);
  } catch (error) {
    setLauncherStatus(String(error?.message || 'GOOGLE SIGN-IN FAILED.').toUpperCase());
  } finally {
    launcherGoogleLoginBtn.disabled = false;
  }
});
formatGuideOpenBtn.addEventListener('click', openFormatGuideModal);
formatGuideCloseBtn.addEventListener('click', closeFormatGuideModal);
launcherGmLink.addEventListener('click', (event) => {
  if (requireLauncherLogin()) return;
  event.preventDefault();
});

launcherModal.addEventListener('click', (event) => {
  if (event.target === launcherModal) closeLauncherModal();
});

launcherAuthModal.addEventListener('click', (event) => {
  if (event.target === launcherAuthModal) closeLauncherAuthModal();
});

formatGuideModal.addEventListener('click', (event) => {
  if (event.target === formatGuideModal) closeFormatGuideModal();
});

launcherForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!requireLauncherLogin()) return;
  const name = document.getElementById('launcher-name').value.trim();
  const street = document.getElementById('launcher-street').value.trim();
  const career = document.getElementById('launcher-career').value.trim();
  if (!name || !career) {
    setLauncherStatus('NAME AND CAREER ARE REQUIRED.');
    return;
  }
  closeLauncherModal();
  window.startChippinInTransition({
    characterData: buildLauncherCharacterData(name, street, career)
  });
});

window.initFirebaseRealtime?.();
window.watchFirebaseAuthState?.((user) => {
  updateLauncherAuthUi(user);
});
