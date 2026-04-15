(function initGMPage() {
  let activeRef = null;
  let activeHandler = null;

  function setGMStatus(message) {
    const node = document.getElementById('gm-status');
    if (node) node.textContent = message;
  }

  function setGMLastUpdated(value) {
    const node = document.getElementById('gm-updated');
    if (!node) return;
    if (!value) {
      node.textContent = '--';
      return;
    }
    const date = new Date(value);
    node.textContent = Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function setGMPayload(data) {
    const node = document.getElementById('gm-payload');
    if (!node) return;
    node.textContent = data ? JSON.stringify(data, null, 2) : 'No data yet.';
  }

  function disconnectGMRoom() {
    if (activeRef && activeHandler) {
      activeRef.off('value', activeHandler);
    }
    activeRef = null;
    activeHandler = null;
  }

  function connectGMRoom() {
    const roomId = (document.getElementById('gm-room-id')?.value || 'test-room').trim() || 'test-room';
    const roomRef = getSyncRoomRef(roomId);
    if (!roomRef) {
      setGMStatus('Firebase failed to initialize.');
      return;
    }

    disconnectGMRoom();
    setGMStatus(`Listening to room "${roomId}"...`);
    setGMPayload(null);
    setGMLastUpdated(null);

    activeRef = roomRef.child('player');
    activeHandler = (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setGMStatus(`Connected to "${roomId}" but no player data yet.`);
        setGMPayload(null);
        setGMLastUpdated(null);
        return;
      }
      setGMStatus(`Live data received from "${roomId}".`);
      setGMPayload(data);
      setGMLastUpdated(data.updatedAt || data.timestamp || null);
    };

    activeRef.on('value', activeHandler, (error) => {
      setGMStatus(`Firebase listen error: ${error.message}`);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initFirebaseRealtime();
    const connectButton = document.getElementById('gm-connect-btn');
    if (connectButton) {
      connectButton.addEventListener('click', connectGMRoom);
    }

    const roomInput = document.getElementById('gm-room-id');
    if (roomInput) {
      roomInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') connectGMRoom();
      });
    }

    connectGMRoom();
  });
})();
