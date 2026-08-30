// =============================================================
// ============ NETWORKING (WebRTC via PeerJS) ===================
// =============================================================
// Two phones on the same wifi (or on entirely separate internet
// connections/cellular) can't open a raw socket to each other directly —
// browsers don't allow that. WebRTC solves this with a peer-to-peer data
// channel, but setting one up requires a tiny bit of "signaling" first
// (the two sides need to swap connection info before they can talk
// directly). PeerJS wraps that signaling step and, for zero-setup demos
// like this one, provides a FREE public signaling broker at
// peerjs.com — no server of your own required. Once connected, all
// actual game traffic (round plans, seeds, chat-free) flows directly
// between the two devices, not through PeerJS's server.
//
// Flow:
//   Host:  Net.hostGame()  -> resolves with a short ROOM CODE to share
//          (spoken out loud, texted, whatever) once a guest connects.
//   Guest: Net.joinGame(code) -> resolves once connected to that host.
//
// Both sides then get the same small message-based API:
//   Net.send(type, payload)              — fire a message to the peer
//   Net.on(type, handler)                 — handler(payload) on receipt
//   Net.isHost / Net.connected
//
// Message types used by the rest of the game (see js/net/pvp.js):
//   'deck'          — after team-select: { deck }
//   'starter'       — after starter-select: { starter: {field, hand} }
//   'plan'          — a round's queued actions: { plan: [...] }
//   'round-seed'    — host -> guest, seed for this round's RNG: { seed }
//   'rematch'       — either side wants to play again
//   'leave'         — graceful disconnect notice

const Net = (() => {
  let peer = null;
  let conn = null;
  let hostFlag = false;
  const handlers = {}; // type -> [fn]

  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
  }

  function off(type, fn) {
    if (!handlers[type]) return;
    handlers[type] = handlers[type].filter(h => h !== fn);
  }

  function emit(type, payload) {
    (handlers[type] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error('Net handler error', type, e); } });
  }

  function send(type, payload) {
    if (!conn || !conn.open) return false;
    try { conn.send({ type, payload }); return true; } catch (e) { console.error('Net send failed', e); return false; }
  }

  function wireConnection(c, onReady, onFail) {
    conn = c;
    conn.on('open', () => { emit('_connected', {}); if (onReady) onReady(); });
    conn.on('data', (msg) => { if (msg && msg.type) emit(msg.type, msg.payload); });
    conn.on('close', () => emit('_disconnected', {}));
    conn.on('error', (err) => { console.error('Net connection error', err); if (onFail) onFail(err); });
  }

  // Short, easy-to-read room codes instead of PeerJS's default long ids.
  // Prefixed so codes never collide with someone else's unrelated PeerJS
  // app using the same public broker.
  function randomRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function ensurePeerJsLoaded() {
    return new Promise((resolve, reject) => {
      if (window.Peer) return resolve();
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('net.err.libLoadFailed'));
      document.head.appendChild(script);
    });
  }

  async function hostGame({ onStatus } = {}) {
    await ensurePeerJsLoaded();
    hostFlag = true;
    const code = randomRoomCode();
    if (onStatus) onStatus('net.status.openingRoom');
    return new Promise((resolve, reject) => {
      peer = new Peer('herovortex-' + code, { debug: 1 });
      peer.on('open', () => {
        if (onStatus) onStatus('net.status.roomOpen');
        resolve({ code });
      });
      peer.on('connection', (c) => {
        wireConnection(c, () => emit('_guestJoined', {}));
      });
      peer.on('error', (err) => {
        if (err && err.type === 'unavailable-id') {
          // Extremely rare collision on the shared broker — try again with a new code.
          peer.destroy();
          hostGame({ onStatus }).then(resolve, reject);
        } else {
          reject(err);
        }
      });
    });
  }

  async function joinGame(code, { onStatus } = {}) {
    await ensurePeerJsLoaded();
    hostFlag = false;
    const cleanCode = String(code).trim().toUpperCase();
    if (onStatus) onStatus('net.status.connecting');
    return new Promise((resolve, reject) => {
      peer = new Peer(undefined, { debug: 1 });
      peer.on('open', () => {
        const c = peer.connect('herovortex-' + cleanCode, { reliable: true });
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error('net.err.noResponse')); }
        }, 12000);
        wireConnection(c,
          () => { if (!settled) { settled = true; clearTimeout(timeout); resolve({ code: cleanCode }); } },
          (err) => { if (!settled) { settled = true; clearTimeout(timeout); reject(err); } }
        );
      });
      peer.on('error', (err) => reject(err));
    });
  }

  function disconnect() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    conn = null; peer = null; hostFlag = false;
  }

  return {
    on, off, send,
    hostGame, joinGame, disconnect,
    get isHost() { return hostFlag; },
    get connected() { return !!(conn && conn.open); }
  };
})();
