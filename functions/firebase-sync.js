// Firebase realtime bootstrap for plain HTML pages.
// This file expects the compat scripts to be loaded first:
// firebase-app-compat.js
// firebase-database-compat.js

(function initCyberpunkFirebaseScope() {
  const TAB_ID_STORAGE_KEY = 'cp2020_sync_tab_id';
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAIS55Q4jXZkb_2DGhPTReK68mV7OeBpb4",
    authDomain: "cyberpunk2020online.firebaseapp.com",
    databaseURL: "https://cyberpunk2020online-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "cyberpunk2020online",
    storageBucket: "cyberpunk2020online.firebasestorage.app",
    messagingSenderId: "55358414577",
    appId: "1:55358414577:web:799fcb502ff3a8cc629350",
    measurementId: "G-Y8HQFGGZHK"
  };

  function ensureFirebaseLoaded() {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase compat scripts are not loaded yet.');
      return false;
    }
    return true;
  }

  function initFirebaseRealtime() {
    if (!ensureFirebaseLoaded()) return null;
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    const database = firebase.database();
    window.cp2020FirebaseApp = firebase.app();
    window.cp2020Database = database;
    return database;
  }

  function getSyncRoomRef(roomId = 'default-room') {
    const db = window.cp2020Database || initFirebaseRealtime();
    if (!db) return null;
    const cleanRoomId = String(roomId || 'default-room').trim() || 'default-room';
    return db.ref(`rooms/${cleanRoomId}`);
  }

  function getPlayerPromptRef(roomId, clientId = getSyncClientId()) {
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) return null;
    const cleanClientId = String(clientId || getSyncClientId()).trim() || getSyncClientId();
    return roomRef.child(`playerPrompts/${cleanClientId}`);
  }

  function getPlayerEffectsRef(roomId, clientId = getSyncClientId()) {
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) return null;
    const cleanClientId = String(clientId || getSyncClientId()).trim() || getSyncClientId();
    return roomRef.child(`playerEffects/${cleanClientId}`);
  }

  function getPlayerCommandsRef(roomId, clientId = getSyncClientId()) {
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) return null;
    const cleanClientId = String(clientId || getSyncClientId()).trim() || getSyncClientId();
    return roomRef.child(`playerCommands/${cleanClientId}`);
  }

  function getRemoteBreachRef(roomId, clientId = getSyncClientId()) {
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) return null;
    const cleanClientId = String(clientId || getSyncClientId()).trim() || getSyncClientId();
    return roomRef.child(`remoteBreaches/${cleanClientId}`);
  }

  let runtimeClientId = '';

  function createClientId() {
    return `client-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getSyncClientId() {
    if (runtimeClientId) return runtimeClientId;

    try {
      const existing = window.sessionStorage?.getItem(TAB_ID_STORAGE_KEY);
      if (existing) {
        runtimeClientId = existing;
        return runtimeClientId;
      }

      const created = createClientId();
      window.sessionStorage?.setItem(TAB_ID_STORAGE_KEY, created);
      runtimeClientId = created;
      return runtimeClientId;
    } catch (error) {
      // Fallback for browsers that block sessionStorage in local-file contexts.
    }

    try {
      const existingWindowName = String(window.name || '').trim();
      if (existingWindowName.startsWith('cp2020-tab-')) {
        runtimeClientId = existingWindowName.replace('cp2020-tab-', '');
        return runtimeClientId;
      }

      const created = createClientId();
      window.name = `cp2020-tab-${created}`;
      runtimeClientId = created;
      return runtimeClientId;
    } catch (error) {
      runtimeClientId = createClientId();
      return runtimeClientId;
    }
  }

  function normalizePresencePayload(payload) {
    if (typeof payload === 'string') return { name: payload };
    return { ...(payload || {}) };
  }

  let activePresenceRef = null;
  let activePresenceRoomId = '';

  async function disconnectPlayerPresence() {
    if (!activePresenceRef) return;
    const ref = activePresenceRef;
    activePresenceRef = null;
    activePresenceRoomId = '';
    try {
      await ref.remove();
    } catch (error) {
      console.warn('Failed to remove player presence.', error);
    }
  }

  async function connectPlayerPresence(roomId, payload) {
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) throw new Error('Firebase realtime database is unavailable.');
    await disconnectPlayerPresence();
    const playerRef = roomRef.child(`players/${getSyncClientId()}`);
    const now = Date.now();
    const data = {
      name: 'Unknown',
      updatedAt: now,
      joinedAt: now,
      ...normalizePresencePayload(payload)
    };
    await playerRef.set(data);
    playerRef.onDisconnect().remove();
    activePresenceRef = playerRef;
    activePresenceRoomId = String(roomId || '').trim();
    return data;
  }

  async function updatePlayerPresence(patch) {
    if (!activePresenceRef) return null;
    const nextPatch = {
      ...normalizePresencePayload(patch),
      updatedAt: Date.now()
    };
    await activePresenceRef.update(nextPatch);
    return nextPatch;
  }

  function getActivePresenceRoomId() {
    return activePresenceRoomId;
  }

  function watchPlayerPrompt(roomId, callback, clientId = getSyncClientId()) {
    const ref = getPlayerPromptRef(roomId, clientId);
    if (!ref || typeof callback !== 'function') return () => {};
    const handler = (snapshot) => callback(snapshot.val() || null);
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  async function sendPlayerPrompt(roomId, clientId, prompt) {
    const ref = getPlayerPromptRef(roomId, clientId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const payload = {
      ...(prompt || {}),
      promptId: String(prompt?.promptId || `prompt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`),
      status: String(prompt?.status || 'pending'),
      updatedAt: Date.now()
    };
    await ref.set(payload);
    return payload;
  }

  async function respondToPlayerPrompt(roomId, promptId, response, clientId = getSyncClientId()) {
    const ref = getPlayerPromptRef(roomId, clientId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const snapshot = await ref.get();
    const current = snapshot.val();
    if (!current) return null;
    if (promptId && current.promptId && current.promptId !== promptId) return current;
    const next = {
      ...current,
      status: 'answered',
      response: {
        ...(current.response || {}),
        ...(response || {}),
        respondedAt: Date.now()
      },
      updatedAt: Date.now()
    };
    await ref.set(next);
    return next;
  }

  async function clearPlayerPrompt(roomId, clientId = getSyncClientId()) {
    const ref = getPlayerPromptRef(roomId, clientId);
    if (!ref) return;
    await ref.remove();
  }

  function watchPlayerEffects(roomId, callback, clientId = getSyncClientId()) {
    const ref = getPlayerEffectsRef(roomId, clientId);
    if (!ref || typeof callback !== 'function') return () => {};
    const handler = (snapshot) => callback(snapshot.val() || null);
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  async function setPlayerEffect(roomId, clientId, effectId, effect) {
    const ref = getPlayerEffectsRef(roomId, clientId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const cleanId = String(effectId || `effect-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`).trim();
    const payload = {
      id: cleanId,
      label: String(effect?.label || 'Status Effect').trim() || 'Status Effect',
      note: String(effect?.note || '').trim(),
      source: String(effect?.source || 'GM').trim() || 'GM',
      modifier: effect?.modifier === '' || effect?.modifier === null || typeof effect?.modifier === 'undefined'
        ? null
        : Number(effect.modifier || 0),
      createdAt: Number(effect?.createdAt || Date.now()),
      updatedAt: Date.now()
    };
    await ref.child(cleanId).set(payload);
    return payload;
  }

  async function removePlayerEffect(roomId, clientId, effectId) {
    const ref = getPlayerEffectsRef(roomId, clientId);
    if (!ref || !effectId) return;
    await ref.child(String(effectId).trim()).remove();
  }

  function watchPlayerCommands(roomId, callback, clientId = getSyncClientId()) {
    const ref = getPlayerCommandsRef(roomId, clientId);
    if (!ref || typeof callback !== 'function') return () => {};
    const handler = (snapshot) => callback(snapshot.key, snapshot.val() || null);
    ref.on('child_added', handler);
    return () => ref.off('child_added', handler);
  }

  async function sendPlayerCommand(roomId, clientId, command) {
    const ref = getPlayerCommandsRef(roomId, clientId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const pushRef = ref.push();
    const payload = {
      ...(command || {}),
      commandId: pushRef.key,
      updatedAt: Date.now()
    };
    await pushRef.set(payload);
    return payload;
  }

  async function clearPlayerCommand(roomId, clientId, commandId) {
    const ref = getPlayerCommandsRef(roomId, clientId);
    if (!ref || !commandId) return;
    await ref.child(String(commandId).trim()).remove();
  }

  function watchRemoteBreach(roomId, callback, clientId = getSyncClientId()) {
    const ref = getRemoteBreachRef(roomId, clientId);
    if (!ref || typeof callback !== 'function') return () => {};
    const handler = (snapshot) => callback(snapshot.val() || null);
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  async function setRemoteBreachSession(roomId, clientId, session) {
    const ref = getRemoteBreachRef(roomId, clientId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const payload = {
      ...(session || {}),
      updatedAt: Date.now()
    };
    await ref.set(payload);
    return payload;
  }

  async function updateRemoteBreachSession(roomId, clientId, patch) {
    const ref = getRemoteBreachRef(roomId, clientId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const payload = {
      ...(patch || {}),
      updatedAt: Date.now()
    };
    await ref.update(payload);
    return payload;
  }

  async function clearRemoteBreachSession(roomId, clientId = getSyncClientId()) {
    const ref = getRemoteBreachRef(roomId, clientId);
    if (!ref) return;
    await ref.remove();
  }

  window.CP2020_FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.initFirebaseRealtime = initFirebaseRealtime;
  window.getSyncRoomRef = getSyncRoomRef;
  window.getPlayerPromptRef = getPlayerPromptRef;
  window.getPlayerEffectsRef = getPlayerEffectsRef;
  window.getPlayerCommandsRef = getPlayerCommandsRef;
  window.getRemoteBreachRef = getRemoteBreachRef;
  window.getSyncClientId = getSyncClientId;
  window.connectPlayerPresence = connectPlayerPresence;
  window.updatePlayerPresence = updatePlayerPresence;
  window.disconnectPlayerPresence = disconnectPlayerPresence;
  window.getActivePresenceRoomId = getActivePresenceRoomId;
  window.watchPlayerPrompt = watchPlayerPrompt;
  window.sendPlayerPrompt = sendPlayerPrompt;
  window.respondToPlayerPrompt = respondToPlayerPrompt;
  window.clearPlayerPrompt = clearPlayerPrompt;
  window.watchPlayerEffects = watchPlayerEffects;
  window.setPlayerEffect = setPlayerEffect;
  window.removePlayerEffect = removePlayerEffect;
  window.watchPlayerCommands = watchPlayerCommands;
  window.sendPlayerCommand = sendPlayerCommand;
  window.clearPlayerCommand = clearPlayerCommand;
  window.watchRemoteBreach = watchRemoteBreach;
  window.setRemoteBreachSession = setRemoteBreachSession;
  window.updateRemoteBreachSession = updateRemoteBreachSession;
  window.clearRemoteBreachSession = clearRemoteBreachSession;
})();
