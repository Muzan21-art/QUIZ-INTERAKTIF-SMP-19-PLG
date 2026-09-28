/**
 * SMART QUIZ SMP 19 PALEMBANG - Realtime Room Channel
 * Menggunakan BroadcastChannel API & Storage Event untuk sinkronisasi antar-tab/layar
 * Memungkinkan layar guru di proyektor dan layar siswa di tab/perangkat lain sinkron secara live!
 */

class RoomChannel {
  constructor() {
    this.channelName = 'smartquiz_smp19_live_bus';
    this.listeners = new Map();
    this.activeRoom = null;

    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => this.handleMessage(event.data);
    } else {
      this.channel = null;
    }

    // Fallback storage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'smartquiz_live_event' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          this.handleMessage(payload);
        } catch (err) {
          console.error('Storage sync parse error:', err);
        }
      }
    });
  }

  // Kirim event ke seluruh tab/layar yang aktif
  broadcast(action, payload = {}) {
    const message = {
      action,
      payload,
      timestamp: Date.now()
    };

    if (this.channel) {
      this.channel.postMessage(message);
    }

    // Fallback melalui storage
    try {
      localStorage.setItem('smartquiz_live_event', JSON.stringify(message));
    } catch (e) {
      // Ignore quota/private browsing issues
    }

    // Panggil juga listener lokal pada tab saat ini
    this.handleMessage(message);
  }

  // Daftarkan callback event
  on(action, callback) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action).push(callback);
  }

  // Hapus listener
  off(action, callback) {
    if (!this.listeners.has(action)) return;
    const filtered = this.listeners.get(action).filter(cb => cb !== callback);
    this.listeners.set(action, filtered);
  }

  // Internal dispatch
  handleMessage(message) {
    if (!message || !message.action) return;
    const callbacks = this.listeners.get(message.action);
    if (callbacks && Array.isArray(callbacks)) {
      callbacks.forEach(cb => {
        try {
          cb(message.payload, message.timestamp);
        } catch (e) {
          console.error(`Error in listener for ${message.action}:`, e);
        }
      });
    }
  }

  // Simpan / update status room di localStorage agar siswa yang baru join bisa query
  setRoomState(roomData) {
    this.activeRoom = roomData;
    localStorage.setItem(`smartquiz_room_${roomData.pin}`, JSON.stringify(roomData));
    this.broadcast('ROOM_STATE_UPDATED', roomData);
  }

  getRoomState(pin) {
    try {
      const data = localStorage.getItem(`smartquiz_room_${pin}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  removeRoom(pin) {
    localStorage.removeItem(`smartquiz_room_${pin}`);
    this.broadcast('ROOM_CLOSED', { pin });
  }
}

// Global room channel singleton
window.smartChannel = new RoomChannel();
