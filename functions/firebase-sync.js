// Firebase realtime bootstrap for plain HTML pages.
// This file expects the compat scripts to be loaded first:
// firebase-app-compat.js
// firebase-database-compat.js
// firebase-auth-compat.js (optional on pages that need sign-in UI)

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
    if (firebase.auth) {
      window.cp2020Auth = firebase.auth();
    }
    return database;
  }

  function getFirebaseAuth() {
    if (!ensureFirebaseLoaded()) return null;
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    if (typeof firebase.auth !== 'function') {
      console.warn('Firebase auth compat script is not loaded yet.');
      return null;
    }
    const auth = firebase.auth();
    window.cp2020FirebaseApp = firebase.app();
    window.cp2020Auth = auth;
    return auth;
  }

  function getFirebaseGoogleProvider() {
    if (!ensureFirebaseLoaded() || !firebase.auth) return null;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }

  async function signInWithGooglePopup() {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase auth is unavailable.');
    if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
      throw new Error('Google sign-in needs the hosted site, not a local file URL.');
    }
    try {
      if (auth.setPersistence && firebase.auth?.Auth?.Persistence?.LOCAL) {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      }
    } catch (error) {
      console.warn('Failed to set local auth persistence.', error);
    }
    const provider = getFirebaseGoogleProvider();
    if (!provider) throw new Error('Google auth provider is unavailable.');
    const result = await auth.signInWithPopup(provider);
    return result?.user || auth.currentUser || null;
  }

  async function signOutFirebaseUser() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await auth.signOut();
  }

  function watchFirebaseAuthState(callback) {
    const auth = getFirebaseAuth();
    if (!auth || typeof callback !== 'function') return () => {};
    return auth.onAuthStateChanged((user) => callback(user || null));
  }

  function getFirebaseCurrentUser() {
    return getFirebaseAuth()?.currentUser || null;
  }

  const FIREBASE_KEY_ESCAPE_MAP = {
    '.': '__CP2020_DOT__',
    '#': '__CP2020_HASH__',
    '$': '__CP2020_DOLLAR__',
    '/': '__CP2020_SLASH__',
    '[': '__CP2020_LBRACKET__',
    ']': '__CP2020_RBRACKET__'
  };

  const FIREBASE_KEY_UNESCAPE_MAP = Object.entries(FIREBASE_KEY_ESCAPE_MAP)
    .reduce((acc, [char, token]) => {
      acc[token] = char;
      return acc;
    }, {});

  function sanitizeFirebaseKey(key) {
    return String(key || '').replace(/[.#$/\[\]]/g, (char) => FIREBASE_KEY_ESCAPE_MAP[char] || char);
  }

  function desanitizeFirebaseKey(key) {
    return String(key || '').replace(
      /__CP2020_(?:DOT|HASH|DOLLAR|SLASH|LBRACKET|RBRACKET)__/g,
      (token) => FIREBASE_KEY_UNESCAPE_MAP[token] || token
    );
  }

  function sanitizeFirebaseValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeFirebaseValue(item));
    }
    if (!value || typeof value !== 'object') return value;
    const next = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      next[sanitizeFirebaseKey(key)] = sanitizeFirebaseValue(nestedValue);
    });
    return next;
  }

  function desanitizeFirebaseValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => desanitizeFirebaseValue(item));
    }
    if (!value || typeof value !== 'object') return value;
    const next = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      next[desanitizeFirebaseKey(key)] = desanitizeFirebaseValue(nestedValue);
    });
    return next;
  }

  function getSyncRoomRef(roomId = 'default-room') {
    const db = window.cp2020Database || initFirebaseRealtime();
    if (!db) return null;
    const cleanRoomId = String(roomId || 'default-room').trim() || 'default-room';
    return db.ref(`rooms/${cleanRoomId}`);
  }

  function getUserRootRef(uid) {
    const db = window.cp2020Database || initFirebaseRealtime();
    const cleanUid = String(uid || getFirebaseCurrentUser()?.uid || '').trim();
    if (!db || !cleanUid) return null;
    return db.ref(`users/${cleanUid}`);
  }

  function getUserCharactersRef(uid) {
    const rootRef = getUserRootRef(uid);
    if (!rootRef) return null;
    return rootRef.child('characters');
  }

  async function listUserCharacters(uid) {
    const ref = getUserCharactersRef(uid);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const snapshot = await ref.get();
    return snapshot.val() || {};
  }

  async function getUserCharacter(uid, characterId) {
    const ref = getUserCharactersRef(uid);
    const cleanId = String(characterId || '').trim();
    if (!ref || !cleanId) throw new Error('Character lookup is unavailable.');
    const snapshot = await ref.child(cleanId).get();
    return snapshot.val() || null;
  }

  async function saveUserCharacter(uid, characterId, entry) {
    const ref = getUserCharactersRef(uid);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const cleanId = String(characterId || '').trim();
    const targetRef = cleanId ? ref.child(cleanId) : ref.push();
    const payload = {
      ...(entry || {}),
      updatedAt: Date.now()
    };
    await targetRef.set(payload);
    return { id: targetRef.key, data: payload };
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

  function getCombatSummaryRef(roomId) {
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) return null;
    return roomRef.child('combatSummary');
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

  function watchCombatSummary(roomId, callback) {
    const ref = getCombatSummaryRef(roomId);
    if (!ref || typeof callback !== 'function') return () => {};
    const handler = (snapshot) => callback(snapshot.val() || null);
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  async function setCombatSummary(roomId, summary) {
    const ref = getCombatSummaryRef(roomId);
    if (!ref) throw new Error('Firebase realtime database is unavailable.');
    const payload = {
      ...(summary || {}),
      updatedAt: Date.now()
    };
    await ref.set(payload);
    return payload;
  }

  async function clearCombatSummary(roomId) {
    const ref = getCombatSummaryRef(roomId);
    if (!ref) return;
    await ref.remove();
  }

  window.CP2020_FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.initFirebaseRealtime = initFirebaseRealtime;
  window.getFirebaseAuth = getFirebaseAuth;
  window.getFirebaseGoogleProvider = getFirebaseGoogleProvider;
  window.signInWithGooglePopup = signInWithGooglePopup;
  window.signOutFirebaseUser = signOutFirebaseUser;
  window.watchFirebaseAuthState = watchFirebaseAuthState;
  window.getFirebaseCurrentUser = getFirebaseCurrentUser;
  window.sanitizeFirebaseKey = sanitizeFirebaseKey;
  window.desanitizeFirebaseKey = desanitizeFirebaseKey;
  window.sanitizeFirebaseValue = sanitizeFirebaseValue;
  window.desanitizeFirebaseValue = desanitizeFirebaseValue;
  window.getSyncRoomRef = getSyncRoomRef;
  window.getUserRootRef = getUserRootRef;
  window.getUserCharactersRef = getUserCharactersRef;
  window.listUserCharacters = listUserCharacters;
  window.getUserCharacter = getUserCharacter;
  window.saveUserCharacter = saveUserCharacter;
  window.getPlayerPromptRef = getPlayerPromptRef;
  window.getPlayerEffectsRef = getPlayerEffectsRef;
  window.getPlayerCommandsRef = getPlayerCommandsRef;
  window.getRemoteBreachRef = getRemoteBreachRef;
  window.getCombatSummaryRef = getCombatSummaryRef;
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
  window.watchCombatSummary = watchCombatSummary;
  window.setCombatSummary = setCombatSummary;
  window.clearCombatSummary = clearCombatSummary;
})();
