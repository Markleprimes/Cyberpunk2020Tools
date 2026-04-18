function clearRollCinemaTimers() {
  cancelAnimationFrame(rollCinemaFrame);
  clearInterval(rollCinemaNumberTimer);
  clearInterval(rollCinemaCountTimer);
  clearTimeout(rollCinemaRevealTimer);
  clearTimeout(rollCinemaAutoCloseTimer);
  rollCinemaFrame = null;
  rollCinemaNumberTimer = null;
  rollCinemaCountTimer = null;
  rollCinemaRevealTimer = null;
  rollCinemaAutoCloseTimer = null;
}

function updateRollExecuteMeter() {
  const fill = document.getElementById('roll-execute-meter-fill');
  const copy = document.getElementById('roll-execute-meter-copy');
  const pct = Math.max(0, Math.min(100, rollShakePower));
  fill.style.width = `${pct}%`;
  if (copy) {
    copy.textContent = pct < 15
      ? 'Hold and shake to arm the roll.'
      : pct < 45
        ? 'Shake registered. Release to throw.'
        : 'Good shake. Release to launch.';
  }
}

function cancelRollExecution() {
  rollShakeActive = false;
  rollShakePointerId = null;
  rollShakeLastPoint = null;
  rollShakePower = 0;
  pendingRollRequest = null;
  const box = document.getElementById('roll-shake-box');
  const core = document.getElementById('roll-shake-core');
  if (box) box.classList.remove('shaking');
  if (core) core.style.transform = 'translate(0,0) rotate(0deg)';
  updateRollExecuteMeter();
  document.getElementById('roll-execute-modal').classList.remove('show');
}

function closeRollCinemaModal() {
  clearRollCinemaTimers();
  document.getElementById('roll-cinema-modal').classList.remove('show');
}

function beginRollExecution(sides, qty) {
  pendingRollRequest = { sides, qty };
  rollShakePower = 0;
  rollShakeActive = false;
  rollShakePointerId = null;
  rollShakeLastPoint = null;
  document.getElementById('roll-shake-label').textContent = `${qty}D${sides}`;
  document.getElementById('roll-shake-box').classList.remove('shaking');
  document.getElementById('roll-shake-core').style.transform = 'translate(0,0) rotate(0deg)';
  updateRollExecuteMeter();
  document.getElementById('roll-execute-modal').classList.add('show');
}

function executePendingRoll() {
  if (!pendingRollRequest) return;
  const { sides, qty } = pendingRollRequest;
  const shakePowerSnapshot = rollShakePower;
  document.getElementById('roll-execute-modal').classList.remove('show');
  pendingRollRequest = null;
  rollShakePower = 0;
  updateRollExecuteMeter();
  const rolls = Array.from({ length: qty }, () => Math.floor(Math.random() * sides) + 1);
  const raw = rolls.reduce((sum, val) => sum + val, 0);
  const modifiers = getModifierTotal();
  currentRoll = { sides, qty, rolls, result: raw, modifiers, total: raw + modifiers, rolledAt: Date.now() };
  renderRollLab();
  openRollCinemaAnimation(sides, qty, rolls, shakePowerSnapshot);
  showActionLog(`ROLLED ${qty}D${sides} FOR ${currentRoll.result}`);
}

function handleRollShakeStart(event) {
  if (!pendingRollRequest) return;
  rollShakeActive = true;
  rollShakePointerId = event.pointerId;
  rollShakeLastPoint = { x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add('shaking');
}

function handleRollShakeMove(event) {
  if (!rollShakeActive || event.pointerId !== rollShakePointerId) return;
  const core = document.getElementById('roll-shake-core');
  const dx = event.clientX - rollShakeLastPoint.x;
  const dy = event.clientY - rollShakeLastPoint.y;
  const dist = Math.hypot(dx, dy);
  rollShakePower = Math.min(100, rollShakePower + dist * 0.45);
  updateRollExecuteMeter();
  const tx = Math.max(-24, Math.min(24, dx * 1.4));
  const ty = Math.max(-24, Math.min(24, dy * 1.4));
  const rot = Math.max(-18, Math.min(18, dx + dy));
  core.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg)`;
  rollShakeLastPoint = { x: event.clientX, y: event.clientY };
}

function handleRollShakeEnd(event) {
  if (!rollShakeActive || event.pointerId !== rollShakePointerId) return;
  const box = document.getElementById('roll-shake-box');
  const core = document.getElementById('roll-shake-core');
  rollShakeActive = false;
  rollShakePointerId = null;
  rollShakeLastPoint = null;
  box.classList.remove('shaking');
  core.style.transform = 'translate(0,0) rotate(0deg)';
  executePendingRoll();
}

const rollShakeBox = document.getElementById('roll-shake-box');
if (rollShakeBox) {
  rollShakeBox.addEventListener('pointerdown', handleRollShakeStart);
  rollShakeBox.addEventListener('pointermove', handleRollShakeMove);
  rollShakeBox.addEventListener('pointerup', handleRollShakeEnd);
  rollShakeBox.addEventListener('pointercancel', handleRollShakeEnd);
}

function setRollCinemaCards(rawVisible = false, modVisible = false, finalVisible = false) {
  document.getElementById('roll-cinema-raw-card').classList.toggle('show', rawVisible);
  document.getElementById('roll-cinema-mod-card').classList.toggle('show', modVisible);
  document.getElementById('roll-cinema-final-card').classList.toggle('show', finalVisible);
}

function playRollCountTick() {
  if (!rollCountAudio) {
    rollCountAudio = new Audio('audio/count.mp3');
    rollCountAudio.preload = 'auto';
  }
  rollCountAudio.currentTime = 0;
  rollCountAudio.play().catch(() => {});
}

function playRollBounceTick() {
  if (!rollBounceAudios.length) {
    rollBounceAudios = [new Audio('audio/bounce1.wav'), new Audio('audio/bounce2.wav')];
    rollBounceAudios.forEach((audio) => {
      audio.preload = 'auto';
    });
  }
  const audio = rollBounceAudios[Math.floor(Math.random() * rollBounceAudios.length)];
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function animateRollCinemaCount(start, end, onComplete) {
  clearInterval(rollCinemaCountTimer);
  const target = document.getElementById('roll-cinema-final');
  const duration = 650;
  const startTime = performance.now();
  let lastValue = start;
  target.textContent = start;
  const tick = (now) => {
    const pct = Math.min(1, (now - startTime) / duration);
    const value = Math.round(start + ((end - start) * pct));
    if (value !== lastValue) {
      playRollCountTick();
      lastValue = value;
    }
    target.textContent = value;
    if (pct < 1) {
      rollCinemaFrame = requestAnimationFrame(tick);
    } else {
      rollCinemaFrame = null;
      if (typeof onComplete === 'function') onComplete();
    }
  };
  rollCinemaFrame = requestAnimationFrame(tick);
}

function renderRollCinemaModifiers(modTotal) {
  const list = document.getElementById('roll-cinema-mod-list');
  const displayModifiers = getDisplayRollModifiers();
  if (!displayModifiers.length) {
    list.innerHTML = '<div class="inventory-empty">NO MODIFIERS LOCKED IN</div>';
  } else {
    list.innerHTML = displayModifiers.map((mod) => `
      <div class="roll-cinema-mod-line">
        <span>${escapeHtml(mod.label)}</span>
        <span>${mod.value >= 0 ? '+' : ''}${mod.value}</span>
      </div>`).join('');
  }
  document.getElementById('roll-cinema-mod-total').textContent = `${modTotal >= 0 ? '+' : ''}${modTotal}`;
}

function setPresetRoll(label, modifiers, sides = 10) {
  const rollQty = document.getElementById('roll-qty');
  if (rollQty) rollQty.value = 1;
  rollModifiers = modifiers
    .filter((mod) => parseRollableValue(mod.value) !== null)
    .map((mod) => ({ source: mod.source || 'PRESET', label: mod.label, value: parseRollableValue(mod.value) }));
  renderRollLab();
  showActionLog(`${label} PRESET LOCKED`);
  rollDie(sides);
}

function renderAimAction() {
  const pips = document.getElementById('aim-stack-pips');
  const keepBtn = document.getElementById('aim-keep-btn');
  if (!pips || !keepBtn) return;
  pips.innerHTML = Array.from({ length: 3 }, (_, idx) => `<span class="aim-stack-pip${idx < aimStackPoints ? ' active' : ''}"></span>`).join('');
  keepBtn.textContent = aimStackPoints > 0 ? 'Keep Aim' : 'Aim';
  keepBtn.classList.toggle('disabled', aimStackPoints >= 3);
}

function resetAimAction() {
  aimStackPoints = 0;
  renderAimAction();
}

function clearAimAction() {
  if (aimStackPoints <= 0) return;
  resetAimAction();
  showActionLog('AIM STACK CLEARED');
}

function startAimAction() {
  if (aimStackPoints >= 3) return;
  aimStackPoints = 1;
  renderAimAction();
  showActionLog('AIM ACTION STARTED: +1 AIM');
}

function keepAimAction() {
  if (aimStackPoints <= 0) {
    startAimAction();
    return;
  }
  if (aimStackPoints >= 3) return;
  aimStackPoints += 1;
  renderAimAction();
  showActionLog(`AIM STACK INCREASED TO +${aimStackPoints}`);
}

function attackAimAction() {
  if (aimStackPoints <= 0) return;
  openAimHitModal();
}

function getPersistentPenaltyModifier() {
  const value = typeof window.getPersistentRollPenalty === 'function'
    ? Number(window.getPersistentRollPenalty() || 0)
    : 0;
  return value
    ? { source: 'STATUS', label: 'Facedown Penalty', value, persistent: true }
    : null;
}

function getStatusEffectRollModifiers() {
  return typeof window.getStatusEffectModifiers === 'function'
    ? window.getStatusEffectModifiers()
    : [];
}

function getDisplayRollModifiers() {
  const persistent = getPersistentPenaltyModifier();
  const effectModifiers = getStatusEffectRollModifiers();
  const display = [...rollModifiers];
  if (persistent) display.push(persistent);
  if (effectModifiers.length) display.push(...effectModifiers);
  return display;
}

function getModifierTotal() {
  return getDisplayRollModifiers().reduce((sum, mod) => sum + mod.value, 0);
}

function getRollQuantity() {
  const input = document.getElementById('roll-qty');
  if (!input) return 1;
  return Math.max(1, Math.min(20, parseInt(input.value, 10) || 1));
}

function normalizeRollQty() {
  const input = document.getElementById('roll-qty');
  if (!input) return;
  input.value = getRollQuantity();
}

function changeRollQty(delta) {
  const input = document.getElementById('roll-qty');
  if (!input) return;
  input.value = Math.max(1, Math.min(20, getRollQuantity() + delta));
  showActionLog(`DICE COUNT SET TO ${input.value}`);
}

function renderRollLab() {
  const modList = document.getElementById('modifier-list');
  const displayModifiers = getDisplayRollModifiers();
  const modTotal = currentRoll.sides ? (currentRoll.modifiers ?? getModifierTotal()) : getModifierTotal();
  const qty = currentRoll.qty || getRollQuantity();
  const hasRoll = !!currentRoll.sides;
  document.getElementById('modifier-total').textContent = modTotal;
  document.getElementById('last-die-label').textContent = hasRoll ? `${qty}D${currentRoll.sides}` : 'NONE';
  const total = hasRoll ? (currentRoll.total ?? ((currentRoll.result || 0) + modTotal)) : modTotal;
  document.getElementById('roll-last-summary').textContent = hasRoll
    ? `${qty}D${currentRoll.sides} locked ${currentRoll.result}. Final total ${total}.`
    : `No die rolled yet. Current modifiers total ${modTotal >= 0 ? '+' : ''}${modTotal}.`;
  document.getElementById('roll-last-breakdown').textContent = hasRoll
    ? `Dice pool: [${currentRoll.rolls.join(', ')}]`
    : 'Set the dice count, then click any die button to open the roll cinema.';
  document.getElementById('roll-last-total').textContent = total;
  renderAimAction();
  updateSystemStrip();
  syncCurrentPlayerPresence();
  if (!displayModifiers.length) {
    modList.innerHTML = '<div class="inventory-empty">NO MODIFIERS LOCKED IN</div>';
    return;
  }
  modList.innerHTML = displayModifiers.map((mod, idx) => `
    <div class="modifier-item">
      <span class="modifier-source">${escapeHtml(mod.source)}</span>
      <span class="modifier-name">${escapeHtml(mod.label)}</span>
      <span class="modifier-value">${mod.value >= 0 ? '+' : ''}${mod.value}</span>
      ${mod.persistent ? '' : `<button class="modifier-delete" type="button" onclick="removeRollModifier(${idx})">DELETE</button>`}
    </div>`).join('');
}

function addRollModifier(source, label, value) {
  const parsed = parseRollableValue(value);
  if (parsed === null) return;
  rollModifiers.push({ source, label, value: parsed });
  renderRollLab();
  showActionLog(`ADDED ${label.toUpperCase()} TO ROLL`);
}

function removeRollModifier(idx) {
  const mod = rollModifiers[idx];
  if (!mod) return;
  rollModifiers.splice(idx, 1);
  renderRollLab();
  showActionLog(`REMOVED ${mod.label.toUpperCase()} FROM ROLL`);
}

function clearRollModifiers() {
  rollModifiers = [];
  renderRollLab();
  showActionLog('CLEARED ROLL MODIFIERS');
}

function addCustomRollModifier() {
  const labelInput = document.getElementById('custom-mod-label');
  const valueInput = document.getElementById('custom-mod-value');
  const label = labelInput.value.trim() || 'Custom';
  const value = parseRollableValue(valueInput.value);
  if (value === null) {
    showError('ENTER A NUMBER FOR THE CUSTOM MODIFIER.');
    return;
  }
  rollModifiers.push({ source: 'CUSTOM', label, value });
  labelInput.value = '';
  valueInput.value = '';
  renderRollLab();
  showActionLog(`ADDED CUSTOM MODIFIER ${label.toUpperCase()}`);
}

function getRollDieShapeClass(sides) {
  if (sides === 4) return 'shape-d4';
  if (sides === 8) return 'shape-d8';
  if (sides === 10) return 'shape-d10';
  if (sides === 12) return 'shape-d12';
  if (sides === 20) return 'shape-d20';
  return '';
}

function openRollCinemaAnimation(sides, qty, rolls, shakePower = 0) {
  clearRollCinemaTimers();
  const rawTotal = rolls.reduce((sum, val) => sum + val, 0);
  const modTotal = getModifierTotal();
  const finalTotal = rawTotal + modTotal;
  const modal = document.getElementById('roll-cinema-modal');
  const stage = document.getElementById('roll-cinema-stage');
  const diceLayer = document.getElementById('roll-cinema-dice');
  document.getElementById('roll-cinema-kicker').textContent = `${qty}D${sides} EXECUTION`;
  document.getElementById('roll-cinema-pool').textContent = `Dice pool: [${rolls.join(', ')}]`;
  document.getElementById('roll-cinema-raw').textContent = '0';
  document.getElementById('roll-cinema-final').textContent = '0';
  renderRollCinemaModifiers(modTotal);
  setRollCinemaCards(false, false, false);
  document.getElementById('roll-cinema-raw-card').classList.remove('emphasis');
  document.getElementById('roll-cinema-final-card').classList.remove('emphasis');
  modal.classList.add('show');
  diceLayer.innerHTML = '';

  const stageRect = stage.getBoundingClientRect();
  const dieSize = qty <= 2 ? 76 : qty <= 4 ? 64 : 52;
  const bounds = { w: Math.max(180, stageRect.width - dieSize), h: Math.max(160, stageRect.height - dieSize) };
  const throwBoost = shakePower / 100;
  const diceBodies = rolls.map((value, idx) => {
    const die = document.createElement('div');
    die.className = `roll-cinema-die ${getRollDieShapeClass(sides)}`.trim();
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

  rollCinemaNumberTimer = setInterval(() => {
    diceBodies.forEach((body) => {
      if (!body.settled) body.el.textContent = Math.max(1, Math.ceil(Math.random() * sides));
    });
  }, 58);

  const gravity = 0.48;
  const startTime = performance.now();
  const maybePlayBounce = (body, now) => {
    if (now - body.lastBounceAt < 70) return;
    body.lastBounceAt = now;
    playRollBounceTick();
  };

  const step = (now) => {
    let settledCount = 0;
    diceBodies.forEach((body, idx) => {
      if (body.settled) {
        settledCount += 1;
        return;
      }
      body.vy += gravity;
      body.x += body.vx;
      body.y += body.vy;
      body.rotation += body.vr;

      if (body.x <= 0 || body.x >= bounds.w) {
        body.x = Math.max(0, Math.min(bounds.w, body.x));
        body.vx *= -(0.78 + Math.random() * 0.12);
        body.vr *= -0.8;
        maybePlayBounce(body, now);
      }
      if (body.y <= 0) {
        body.y = 0;
        body.vy *= -0.76;
        maybePlayBounce(body, now);
      }
      if (body.y >= bounds.h) {
        body.y = bounds.h;
        body.vy *= -(0.64 + Math.random() * 0.12);
        body.vx *= 0.94;
        body.vr *= 0.86;
        maybePlayBounce(body, now);
      }

      body.el.style.transform = `translate(${body.x}px,${body.y}px) rotate(${body.rotation}deg)`;
      const speed = Math.abs(body.vx) + Math.abs(body.vy) + Math.abs(body.vr * 0.12);
      const elapsed = now - startTime;
      if (elapsed > (1050 + idx * 40) && body.y >= bounds.h && speed < 2.2) {
        body.settled = true;
        body.el.classList.add('settled');
        body.el.style.transform = `translate(${body.x}px,${body.y}px) rotate(${Math.round((Math.random() * 24) - 12)}deg)`;
        body.el.textContent = body.value;
        playRollCountTick();
        settledCount += 1;
      }
    });

    if (settledCount === diceBodies.length) {
      clearInterval(rollCinemaNumberTimer);
      rollCinemaNumberTimer = null;
      document.getElementById('roll-cinema-raw').textContent = rawTotal;
      setRollCinemaCards(true, false, false);
      document.getElementById('roll-cinema-raw-card').classList.add('emphasis');
      rollCinemaRevealTimer = setTimeout(() => {
        document.getElementById('roll-cinema-raw-card').classList.remove('emphasis');
        setRollCinemaCards(true, true, true);
        document.getElementById('roll-cinema-final-card').classList.add('emphasis');
        animateRollCinemaCount(rawTotal, finalTotal, () => {
          rollCinemaAutoCloseTimer = setTimeout(() => {
            if (rollModifiers.length) {
              rollModifiers = [];
              renderRollLab();
            }
          }, 300);
        });
      }, 420);
      return;
    }

    rollCinemaFrame = requestAnimationFrame(step);
  };
  rollCinemaFrame = requestAnimationFrame(step);
}

function rollFacedown() {
  setPresetRoll('FACEDOWN', [
    { source: 'PRESET', label: 'COOL', value: getEffectiveStatValue('COOL') },
    { source: 'PRESET', label: 'Reputation', value: repValue }
  ], 10);
}

function rollInitiationCheck() {
  setPresetRoll('INITAITION CHECK', [
    { source: 'PRESET', label: 'REF', value: getEffectiveStatValue('REF') }
  ], 10);
}

function rollAmbush() {
  setPresetRoll('AMBUSH', [
    { source: 'PRESET', label: 'Stealth', value: getSkillValueByNames('Stealth') },
    { source: 'PRESET', label: 'INT', value: getEffectiveStatValue('INT') }
  ], 10);
}

function rollAmbushCounter() {
  setPresetRoll('AMBUSH COUNTER', [
    { source: 'PRESET', label: 'Awareness', value: getSkillValueByNames('Awareness', 'AwarenessNotice') }
  ], 10);
}

function rollSuppressiveFireSave() {
  setPresetRoll('SUPRESSIVE FIRE SAVE', [
    { source: 'PRESET', label: 'Athletics', value: getSkillValueByNames('Athletics', 'Athletic') },
    { source: 'PRESET', label: 'REF', value: getEffectiveStatValue('REF') }
  ], 10);
}

function openAimHitModal() {
  const weapons = (inventory.weapon || []).slice();
  aimHitWeapons = weapons;
  const select = document.getElementById('aim-weapon-select');
  const note = document.getElementById('aim-weapon-note');
  if (!weapons.length) {
    select.innerHTML = '';
    if (note) note.textContent = 'No weapons in inventory yet.';
  } else {
    select.innerHTML = weapons.map((weapon, idx) => `<option value="${idx}">${escapeHtml(weapon.name || `Weapon ${idx + 1}`)}</option>`).join('');
    if (note) note.textContent = 'Select a weapon and confirm to attack.';
  }
  document.getElementById('aim-hit-modal').classList.add('show');
  if (weapons.length) select.focus();
}

function closeAimHitModal() {
  document.getElementById('aim-hit-modal').classList.remove('show');
}

function confirmAimHitWeapon() {
  const weapon = aimHitWeapons[parseInt(document.getElementById('aim-weapon-select').value, 10)];
  if (!weapon) {
    showError('SELECT A WEAPON FIRST.');
    return;
  }
  const accuracy = getAimHitAccuracy(weapon);
  if (accuracy === null) {
    showError('SELECTED WEAPON HAS NO ACCURACY, WEAPON ACCURACY, OR WA VALUE.');
    return;
  }
  const aimUsed = aimStackPoints;
  closeAimHitModal();
  rollModifiers.push({ source: 'PRESET', label: `${weapon.name || 'Weapon'} Accuracy`, value: accuracy });
  if (aimUsed > 0) {
    rollModifiers.push({ source: 'PRESET', label: 'Aim', value: aimUsed });
  }
  renderRollLab();
  resetAimAction();
  rollDie(10);
  showActionLog(`AIM ATTACK ROLLED ${weapon.name?.toUpperCase() || 'WEAPON'} ACC ${accuracy >= 0 ? '+' : ''}${accuracy}${aimUsed > 0 ? ` AIM +${aimUsed}` : ''}`);
}

function rollDie(sides) {
  normalizeRollQty();
  beginRollExecution(sides, getRollQuantity());
}
