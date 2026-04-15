// Firebase realtime bootstrap for plain HTML pages.
// This file expects the compat scripts to be loaded first:
// firebase-app-compat.js
// firebase-database-compat.js

(function initCyberpunkFirebaseScope() {
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

  window.CP2020_FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.initFirebaseRealtime = initFirebaseRealtime;
  window.getSyncRoomRef = getSyncRoomRef;
})();
