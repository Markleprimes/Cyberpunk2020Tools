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

  window.CP2020_FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.initFirebaseRealtime = initFirebaseRealtime;
  window.getSyncRoomRef = getSyncRoomRef;
  window.getSyncClientId = getSyncClientId;
  window.connectPlayerPresence = connectPlayerPresence;
  window.updatePlayerPresence = updatePlayerPresence;
  window.disconnectPlayerPresence = disconnectPlayerPresence;
  window.getActivePresenceRoomId = getActivePresenceRoomId;
})();
