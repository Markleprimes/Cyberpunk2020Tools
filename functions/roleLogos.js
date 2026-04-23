(function initRoleLogoBadges() {
  const ROLE_KEYS = {
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

  const ROLE_LABELS = {
    solo: 'Solo',
    netrunner: 'Netrunner',
    techie: 'Techie',
    medtech: 'Medtech',
    fixer: 'Fixer',
    media: 'Media',
    cop: 'Cop',
    nomad: 'Nomad',
    rockerboy: 'Rockerboy',
    hobo: 'Hobo'
  };

  let isRendering = false;

  function cleanRole(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function getRoleKey(value) {
    return ROLE_KEYS[cleanRole(value)] || '';
  }

  function getBadgeCareer(badge) {
    const stored = String(badge?.dataset?.career || '').trim();
    if (stored) return stored;
    return String(badge?.textContent || '').trim();
  }

  function applyCareerLogo(value) {
    const badge = document.getElementById('char-career');
    if (!badge || isRendering) return;

    const rawCareer = String(value || getBadgeCareer(badge) || 'UNKNOWN').trim() || 'UNKNOWN';
    const key = getRoleKey(rawCareer);
    isRendering = true;
    badge.dataset.career = rawCareer;
    badge.className = 'career-badge';

    if (!key) {
      badge.innerHTML = `<span class="career-badge-text">${rawCareer}</span>`;
      isRendering = false;
      return;
    }

    badge.classList.add('career-logo-only', `role-${key}`);
    badge.setAttribute('title', ROLE_LABELS[key] || rawCareer);
    badge.setAttribute('aria-label', ROLE_LABELS[key] || rawCareer);
    badge.innerHTML = `<span class="role-logo role-logo-${key}" aria-hidden="true"></span>`;
    isRendering = false;
  }

  window.applyCareerLogo = applyCareerLogo;

  function boot() {
    const badge = document.getElementById('char-career');
    if (!badge) return;
    applyCareerLogo();

    const observer = new MutationObserver(() => {
      if (isRendering) return;
      applyCareerLogo();
    });
    observer.observe(badge, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
