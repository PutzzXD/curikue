import * as THREE from 'three';
import { buildSnowWorld } from './snow.js';
import { buildAngkasaWorld } from './angkasa.js';
import { buildLavaMap, updateLavaMap } from './lava.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

// Firebase multiplayer: memakai project PARKOUR 3D yang sudah terdaftar.
const firebaseConfig = {
  apiKey: 'AIzaSyB7ue_o-x-QSc92vR6Zu5sCEAJiGt6QUeU',
  authDomain: 'game3d-66134.firebaseapp.com',
  databaseURL: 'https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'game3d-66134',
  storageBucket: 'game3d-66134.firebasestorage.app',
  messagingSenderId: '229970848153',
  appId: '1:229970848153:web:13c9626e65a84c6c300b08'
};
const firebaseApp = initializeApp(firebaseConfig);
const multiplayerAuth = getAuth(firebaseApp);
const multiplayerDb = getDatabase(firebaseApp);

// ===== Helper aman: tidak crash kalau elemen tidak ada di HTML =====
function setElDisplay(id, value) { const el = document.getElementById(id); if (el) el.style.display = value; }
function hideStartupSplash() {
  const s = document.getElementById('startup-loading');
  if (!s) return;
  s.classList.add('is-hidden');
  s.style.pointerEvents = 'none';
  setTimeout(() => { try { s.remove(); } catch (e) { s.style.display = 'none'; } }, 500);
}
// Pengaman terakhir: apa pun yang terjadi, splash awal pasti hilang maksimal 15 detik.
setTimeout(hideStartupSplash, 15000);


// ============ EFEK SUARA (WEB AUDIO API) ============
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function ensureAudioContext() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playJumpSound() {
  try {
    ensureAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function playStepSound() {
  try {
    ensureAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.07);
  } catch (e) {}
}

// ============ BACKGROUND MUSIC + VAULT MUSIC SELECTOR ============
const vaultMusicTracks = {
  amatekam: './putzzdev.mp3',
  luklukluk: './putzzdev2.mp3'
};
let selectedVaultMusic = 'amatekam';
const backgroundMusic = new Audio(vaultMusicTracks[selectedVaultMusic]);
backgroundMusic.loop = true;
backgroundMusic.preload = 'auto';
backgroundMusic.volume = 0.35;

let backgroundMusicStarted = false;
let userPausedMusic = false;
function startBackgroundMusic() {
  if (userPausedMusic || !backgroundMusic.paused) return;
  const playAttempt = backgroundMusic.play();
  if (playAttempt && typeof playAttempt.then === 'function') {
    playAttempt.then(() => {
      backgroundMusicStarted = true;
    }).catch(() => {
      // Autoplay mungkin diblokir sampai ada interaksi pemain.
    });
  }
}

window.getSelectedVaultMusic = function() {
  return selectedVaultMusic;
};
window.isVaultMusicPlaying = function() {
  return !backgroundMusic.paused;
};
window.toggleVaultMusic = function() {
  if (backgroundMusic.paused) {
    userPausedMusic = false;
    const p = backgroundMusic.play();
    if (p && typeof p.then === 'function') p.then(() => { backgroundMusicStarted = true; }).catch(() => {});
  } else {
    userPausedMusic = true;
    backgroundMusic.pause();
  }
  if (document.getElementById('music-modal')?.style.display === 'block') renderStandaloneMusic();
};
window.getVaultMusicVolume = function() { return backgroundMusic.volume; };
window.setVaultMusicVolume = function(v) { backgroundMusic.volume = Math.max(0, Math.min(1, Number(v) || 0)); };
window.selectVaultMusic = function(trackId) {
  if (!Object.prototype.hasOwnProperty.call(vaultMusicTracks, trackId)) return;
  const shouldPlay = true;
  userPausedMusic = false;
  selectedVaultMusic = trackId;
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  backgroundMusic.src = vaultMusicTracks[trackId];
  backgroundMusic.load();
  backgroundMusicStarted = false;
  if (shouldPlay) {
    const playAttempt = backgroundMusic.play();
    if (playAttempt && typeof playAttempt.then === 'function') {
      playAttempt.then(() => {
        backgroundMusicStarted = true;
      }).catch(() => {
        // Browser dapat memblokir autoplay; interaksi berikutnya akan mencoba lagi.
      });
    }
  }
  const activeTab = document.querySelector('.vault-tab-btn.active');
  if (document.getElementById('music-modal')?.style.display === 'block') renderStandaloneMusic();
  if (typeof showToast === 'function') {
    showToast('🎵 Memutar ' + (trackId === 'amatekam' ? 'Amatekam' : 'Luk Luk Luk'));
  }
};

document.addEventListener('DOMContentLoaded', startBackgroundMusic, { once: true });
document.addEventListener('pointerdown', startBackgroundMusic, { capture: true });
document.addEventListener('keydown', startBackgroundMusic, { capture: true });

// ============ 1. KONFIGURASI FIREBASE ============
const FIREBASE_URL = "https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app/";
const DEV_USERNAME = "putzzdev";
const ADMIN_PLAYER_ID = "123456";
// Nilai mahkota akun admin dibuat konsisten antara profil dan leaderboard.
const ADMIN_FIXED_CROWNS = 9999999;

// ID dibuat oleh sistem, bukan dari input pemain.
async function createUniquePlayerId() {
  const res = await fetch(`${FIREBASE_URL}players.json`);
  if (!res.ok) throw new Error('Tidak bisa memeriksa ID pemain');
  const players = await res.json() || {};
  const used = new Set(Object.values(players).map(p => String(p?.playerId || '')).filter(Boolean));
  for (let i = 0; i < 80; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    if (id !== ADMIN_PLAYER_ID && !used.has(id)) return id;
  }
  throw new Error('Gagal membuat ID unik. Coba lagi.');
}

async function ensurePlayerId(userKey, data) {
  const isAdmin = userKey === DEV_USERNAME;
  const playerId = isAdmin ? ADMIN_PLAYER_ID : (!data.playerId || String(data.playerId) === ADMIN_PLAYER_ID ? await createUniquePlayerId() : String(data.playerId));
  if (String(data.playerId || '') !== playerId || !!data.isDev !== isAdmin) {
    await fetch(`${FIREBASE_URL}players/${userKey}.json`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, isDev: isAdmin })
    });
  }
  return { ...data, playerId, isDev: isAdmin };
} 

let playerData = { 
  username: "", 
  isDev: false, 
  coins: 0,
  crowns: 0,
  inventory: ['baju_default', 'celana_default', 'sepatu_default', 'efek_lari_default', 'efek_lompat_default', 'aks_none'],
  equipped: {
    baju: 'baju_default',
    celana: 'celana_default',
    sepatu: 'sepatu_default',
    efek_lari: 'efek_lari_default',
    efek_lompat: 'efek_lompat_default',
    aksesoris: 'aks_none'
  }
};

let gameState = 'LOGIN'; 
let isGameStarted = false; 

const SHOP_ITEMS = {
  baju: [
    { id: 'baju_default', name: 'Baju Biru Tua', price: 0, color: 0x2c3e50 },
    { id: 'baju_merah', name: 'Baju Merah', price: 150, color: 0xff0000 },
    { id: 'baju_hijau', name: 'Baju Hijau', price: 150, color: 0x00ff00 },
    { id: 'baju_emas', name: 'Baju Emas', price: 300, color: 0xffd700 },
    { id: 'baju_spiderman', name: 'Kostum Spiderman', price: 1500, color: 0xd91e2b, web: true },
    { id: 'baju_batman', name: 'Kostum Batman', price: 1600, color: 0x2b2f3a, bat: true, suit: 'bat' },
    { id: 'baju_ironman', name: 'Kostum Ironman', price: 4000, color: 0xb01020, iron: true },
    { id: 'baju_thor', name: 'Kostum Thor', price: 3000, color: 0x3b4252, thor: true, suit: 'mail' },
    { id: 'baju_hulk', name: 'Kostum Hulk', price: 3500, color: 0x57b84a, hulk: true },
    { id: 'baju_ultraman', name: 'Kostum Ultraman', price: 4500, color: 0xd9e0e8, ultra: true, suit: 'mail' },
    { id: 'baju_godzilla', name: 'Kostum Godzilla', price: 5000, color: 0x315b42, godzilla: true },
    { id: 'baju_ramenraider', name: 'Kostum Ramen Raider', price: 4000, color: 0xd98a32, ramen: true },
    { id: 'baju_saitama', name: 'Kostum Saitama — One Punch Man', price: 12000, color: 0xffd21a, saitama: true },
    { id: 'baju_developer', name: 'DEVELOPER — Eksklusif Admin', price: 0, color: 0x101b35, dev: true, suit: 'mail' }
  ],
  celana: [
    { id: 'celana_default', name: 'Celana Hitam', price: 0, color: 0x1a1a1c },
    { id: 'celana_biru', name: 'Celana Jeans', price: 150, color: 0x1e3a8a },
    { id: 'celana_putih', name: 'Celana Putih', price: 150, color: 0xffffff },
    { id: 'celana_spiderman', name: 'Celana Spiderman', price: 250, color: 0x1d3f9a, web: true },
    { id: 'celana_batman', name: 'Celana Batman', price: 250, color: 0x23252e }
  ],
  sepatu: [
    { id: 'sepatu_default', name: 'Sepatu Merah', price: 0, color: 0xa61c2b },
    { id: 'sepatu_neon', name: 'Sepatu Neon', price: 200, color: 0x00ffcc },
    { id: 'sepatu_emas', name: 'Sepatu Emas', price: 400, color: 0xffd700 },
    { id: 'sepatu_spiderman', name: 'Sepatu Spiderman', price: 250, color: 0xc4122f },
    { id: 'sepatu_batman', name: 'Sepatu Batman', price: 250, color: 0x0f0f13 }
  ],
  efek: [
    { id: 'efek_lari_default', name: 'Tanpa Efek Lari', price: 0, type: 'lari' },
    { id: 'efek_lari_api', name: 'Jejak Api', price: 300, type: 'lari', color: 0xff3300 },
    { id: 'efek_lompat_default', name: 'Tanpa Efek Lompat', price: 0, type: 'lompat' },
    { id: 'efek_lompat_es', name: 'Ledakan Es', price: 300, type: 'lompat', color: 0x00ffff }
  ],
  aksesoris: [
    { id: 'aks_none', name: 'Tanpa Aksesoris', price: 0 },
    { id: 'aks_topeng_spider', name: 'Topeng Spiderman', price: 400 },
    { id: 'aks_topeng_batman', name: 'Topeng Batman', price: 400 },
    { id: 'aks_kacamata', name: 'Kacamata Hitam', price: 150 },
    { id: 'aks_topi', name: 'Topi Merah', price: 200 },
    { id: 'aks_mahkota', name: 'Mahkota Emas', price: 500 },
    { id: 'aks_jubah', name: 'Jubah Merah', price: 350 }
  ],
  gamepass: [
    { id: 'gp_dorong', name: 'Gamepass Dorong Teman', price: 10000000, gamepass: true, desc: 'Dorong teman saat balapan (tombol 🫸 / tombol E)' }
  ]
};

// ============ FUNGSI FETCH GLOBAL CHAT ============
async function fetchGlobalChat() {
  try {
    const res = await fetch(`${FIREBASE_URL}chats.json?orderBy="$key"&limitToLast=20`);
    const data = await res.json();
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    
    if (data) {
      Object.values(data).forEach(msg => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<span class="name ${msg.isDev ? 'dev' : ''}">${msg.name}: </span><span class="text">${msg.text}</span>`;
        chatMessages.appendChild(div);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (e) {
    console.log("Gagal mengambil chat:", e);
  }
}

// ============ 2. FUNGSI NOTIFIKASI CUSTOM (TOAST) ============
let toastTimer = null;
function showToast(message, duration = 2000) {
  const toast = document.getElementById('custom-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, duration); 
}

// ============ 3. SETUP DOM & EVENT LISTENER ============
window.addEventListener('DOMContentLoaded', () => {
  const loginMsg = document.getElementById('login-msg');
  const regMsg = document.getElementById('reg-msg');
  const profileModal = document.getElementById('profile-modal');
  const shopModal = document.getElementById('shop-modal');
  const vaultModal = document.getElementById('vault-modal');
  
  const chatBox = document.getElementById('chat-box');
  const chatToggle = document.getElementById('chat-toggle');
  
  chatToggle.addEventListener('click', () => {
    const isHidden = chatBox.style.display === 'none' || chatBox.style.display === '';
    chatBox.style.display = isHidden ? 'flex' : 'none';
    chatToggle.textContent = isHidden ? '❌ Tutup Chat' : '💬 Chat Global';
  });

  document.getElementById('chat-send').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text.length === 0) return;
    const payload = { name: playerData.username, isDev: playerData.isDev, text: text, time: Date.now() };
    fetch(`${FIREBASE_URL}chats.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    input.value = '';
  });

  document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('chat-send').click(); });

  document.getElementById('btn-profile').addEventListener('click', () => {
    profileModal.style.display = profileModal.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('close-modal').addEventListener('click', () => { profileModal.style.display = 'none'; });
  document.getElementById('btn-logout').addEventListener('click', () => { localStorage.removeItem('parkour_user'); location.reload(); });

  document.getElementById('btn-shop').addEventListener('click', () => {
    shopModal.style.display = 'flex';
    const firstTab = document.querySelector('.shop-tab-btn');
    if (firstTab && !document.querySelector('.shop-tab-btn[data-cat="aksesoris"]')) {
      const tb = firstTab.cloneNode(true); tb.dataset.cat = 'aksesoris'; tb.textContent = '🎩 Aksesoris'; tb.classList.remove('active');
      tb.addEventListener('click', (e) => { document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); renderShopTab('aksesoris'); });
      firstTab.parentNode.appendChild(tb);
    }
    if (firstTab && !document.querySelector('.shop-tab-btn[data-cat="gamepass"]')) {
      const gb = firstTab.cloneNode(true); gb.dataset.cat = 'gamepass'; gb.textContent = '🎫 Gamepass'; gb.classList.remove('active');
      gb.addEventListener('click', (e) => { document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); renderShopTab('gamepass'); });
      firstTab.parentNode.appendChild(gb);
    }
    renderShopTab('baju'); 
  });
  document.getElementById('close-shop').addEventListener('click', () => { shopModal.style.display = 'none'; });
  document.getElementById('btn-vault').addEventListener('click', () => { vaultModal.style.display = 'flex'; renderVaultTab('baju'); });
  document.getElementById('close-vault').addEventListener('click', () => { vaultModal.style.display = 'none'; });
  const musicModal = document.getElementById('music-modal');
  const btnMusic = document.getElementById('btn-music');
  if (btnMusic && musicModal) btnMusic.addEventListener('click', () => { renderStandaloneMusic(); musicModal.style.display = 'block'; });
  const closeMusic = document.getElementById('close-music');
  if (closeMusic && musicModal) closeMusic.addEventListener('click', () => { musicModal.style.display = 'none'; });
  document.querySelectorAll('.vault-tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.vault-tab-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active'); renderVaultTab(e.currentTarget.dataset.cat);
  }));

  document.querySelectorAll('.shop-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderShopTab(e.target.dataset.cat);
    });
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    // Di room, tombol ini hanya meminta host memulai. Semua pemain baru mulai
    // setelah startAt tersinkron dari Firebase.
    if (roomCode && !roomStartAt) {
      if (roomMeta && roomMeta.host === mpUid) hostStart().catch(e => showToast(mpErr(e)));
      else showToast('Menunggu pembuat room memulai permainan.');
      return;
    }
    if (gachaBusy || loadingActive) return;
    requestFullscreenAndLock();
    document.getElementById('btn-start-game').style.display = 'none';
    document.getElementById('btn-shop').style.display = 'none';
    document.getElementById('btn-vault').style.display = 'none';
    setElDisplay('btn-music', 'none');
    document.getElementById('in-game-controls').style.display = 'block'; setLobbyOnlyHud(false);
    chatBox.style.display = 'none'; 
    chatToggle.textContent = '💬 Chat Global';
    profileModal.style.display = 'none';
    shopModal.style.display = 'none';
    // GACHA MAP: room memakai hasil gacha host (tersimpan di meta.map) agar semua pemain satu map.
    const roomMap = roomMeta && roomMeta.map;
    const pickedMap = (roomCode && roomStartAt) ? ((roomMap === 'snow' && snowWorld) ? 'snow' : (roomMap === 'angkasa' && angkasaWorld) ? 'angkasa' : 'lava') : rollMap();
    gachaBusy = true;
    playMapGacha(pickedMap, roomCode ? 900 : 1500, () => {
      gachaBusy = false;
      showLoadingScreen(() => {
        applyMap(pickedMap);
        isGameStarted = true;
        onGameBegin();
        setElDisplay('btn-exit-lobby', 'flex');
        camera.position.set(0, 4, 8);
        controls.target.set(0, 1.5, 0);
      });
    });
  });

  // --- PROSES REGISTRASI & LOGIN ---
  document.getElementById('btn-register').addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const pinConfirm = document.getElementById('reg-pin-confirm').value.trim();

    if (username.length < 3) { regMsg.textContent = "Username minimal 3 karakter!"; regMsg.className = "msg error"; return; }
    if (pin.length !== 6 || isNaN(pin)) { regMsg.textContent = "PIN harus 6 angka!"; regMsg.className = "msg error"; return; }
    if (pin !== pinConfirm) { regMsg.textContent = "PIN tidak cocok!"; regMsg.className = "msg error"; return; }

    regMsg.textContent = "Mendaftarkan..."; regMsg.className = "msg";
    document.getElementById('btn-register').disabled = true;

    const userKey = username.toLowerCase();
    const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;

    try {
      const checkRes = await fetch(firebaseUrl);
      const existing = await checkRes.json();
      if (existing) {
        regMsg.textContent = "Username sudah dipakai!"; regMsg.className = "msg error";
        document.getElementById('btn-register').disabled = false; return;
      }
      { const ar = await fetch(`${FIREBASE_URL}usernames/${encodeURIComponent(userKey)}.json`, { cache: 'no-store' }); // nama yang sudah dipakai lewat ganti nama
        if (ar.ok && await ar.json()) { regMsg.textContent = "Username sudah dipakai!"; regMsg.className = "msg error"; document.getElementById('btn-register').disabled = false; return; } }
      const playerId = userKey === DEV_USERNAME ? ADMIN_PLAYER_ID : await createUniquePlayerId();
      const newPlayerData = { username, pin, playerId, isDev: (userKey === DEV_USERNAME), coins: 0, inventory: playerData.inventory, equipped: playerData.equipped };
      const saveRes = await fetch(firebaseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlayerData) });
      if (!saveRes.ok) throw new Error('Gagal menyimpan akun');

      regMsg.textContent = "Registrasi berhasil! Silakan Masuk."; regMsg.className = "msg success";
      document.getElementById('reg-username').value = '';
      document.getElementById('reg-pin').value = '';
      document.getElementById('reg-pin-confirm').value = '';
      setTimeout(() => { document.getElementById('tab1').checked = true; }, 1500);
    } catch(e) {
      regMsg.textContent = "Gagal daftar. Cek koneksi."; regMsg.className = "msg error";
    }
    document.getElementById('btn-register').disabled = false;
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (username.length < 3) { loginMsg.textContent = "Username minimal 3 karakter!"; loginMsg.className = "msg error"; return; }
    if (pin.length !== 6 || isNaN(pin)) { loginMsg.textContent = "PIN harus 6 angka!"; loginMsg.className = "msg error"; return; }

    loginMsg.textContent = "Memproses..."; loginMsg.className = "msg";
    document.getElementById('btn-login').disabled = true;

    let userKey = username.toLowerCase();

    try {
      userKey = await resolveUserKey(username); // bisa login dengan nama lama maupun nama baru
      const res = await fetch(`${FIREBASE_URL}players/${userKey}.json`);
      const data = await res.json();
      if (!data) {
        loginMsg.textContent = "Akun tidak ditemukan. Silakan Daftar."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      if (data.pin !== pin) {
        loginMsg.textContent = "PIN salah! Coba lagi."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      const verifiedData = await ensurePlayerId(userKey, data);
      playerData = { ...playerData, ...verifiedData, inventory: verifiedData.inventory || playerData.inventory, equipped: verifiedData.equipped || playerData.equipped };
      playerData.userKey = userKey; // kunci akun permanen
      localStorage.setItem('parkour_user', JSON.stringify({ username: userKey, isDev: data.isDev }));
      tryAutoLandscape();
      startLobby();
    } catch(e) {
      loginMsg.textContent = "Gagal konek ke server."; loginMsg.className = "msg error";
      document.getElementById('btn-login').disabled = false;
    }
  });

  // AUTO LOGIN + SPLASH AWAL (durasi 10 detik)
  const SPLASH_DURATION = 10000; // 10 detik
  const splash = document.getElementById('startup-loading');
  const splashBar = document.getElementById('startup-bar');
  const splashStatus = document.getElementById('startup-status');
  const splashStartedAt = performance.now();
  let splashDone = false;

  // Progress bar berjalan sesuai waktu, penuh tepat di 10 detik.
  const splashTimer = splash ? setInterval(() => {
    const f = Math.min(1, (performance.now() - splashStartedAt) / SPLASH_DURATION);
    if (splashBar) splashBar.style.width = Math.max(8, f * 100).toFixed(0) + '%';
    if (splashStatus && !splashDone) {
      splashStatus.textContent = f < 0.35 ? 'Menyiapkan permainan...'
        : f < 0.7 ? 'Memeriksa akun dan menyiapkan lobby...'
        : 'Hampir selesai...';
    }
  }, 100) : null;

  // Jalankan callback setelah splash minimal tampil 10 detik, lalu sembunyikan splash.
  function finishSplash(afterWait) {
    const wait = Math.max(0, SPLASH_DURATION - (performance.now() - splashStartedAt));
    setTimeout(() => {
      splashDone = true;
      clearInterval(splashTimer);
      if (splashBar) splashBar.style.width = '100%';
      try { if (afterWait) afterWait(); }
      catch (err) { console.error('Gagal membuka lobby/login setelah splash:', err); setElDisplay('auth-container', 'flex'); }
      finally { hideStartupSplash(); }
    }, wait);
  }

  const savedSession = localStorage.getItem('parkour_user');
  if (savedSession) {
    let session = null;
    try { session = JSON.parse(savedSession); }
    catch (e) { localStorage.removeItem('parkour_user'); }

    if (session && session.username) {
      const sessAbort = new AbortController();
      const sessTimeout = setTimeout(() => sessAbort.abort(), 8000);
      fetch(`${FIREBASE_URL}players/${String(session.username).toLowerCase()}.json`, { signal: sessAbort.signal })
        .then(res => {
          clearTimeout(sessTimeout);
          if (!res.ok) throw new Error('Gagal memeriksa sesi akun');
          return res.json();
        })
        .then(async data => {
          if (!data) {
            localStorage.removeItem('parkour_user');
            finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
            return;
          }
          const verifiedData = await ensurePlayerId(String(session.username).toLowerCase(), data);
          playerData = { ...playerData, ...verifiedData, inventory: verifiedData.inventory || playerData.inventory, equipped: verifiedData.equipped || playerData.equipped };
          playerData.userKey = String(session.username).toLowerCase(); // kunci akun permanen
          if (splashStatus) splashStatus.textContent = 'Lobby siap! Memasuki permainan...';
          finishSplash(() => { startLobby(); });
        })
        .catch(err => {
          console.warn('Auto-login gagal:', err);
          finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
        });
    } else {
      finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
    }
  } else {
    finishSplash(() => { document.getElementById('auth-container').style.display = 'flex'; });
  }
});

// ============ KELUAR KE LOBBY (tombol kecil kanan atas saat bermain) ============
async function returnToLobby() {
  if (gameState === 'LOBBY') return;
  if (roomCode) { try { await leaveRoom(false); } catch (e) { console.warn(e); } }
  gameState = 'LOBBY';
  flyMode = false; flyUp = flyDown = false;
  const fc = document.getElementById('fly-ctrl'); if (fc) fc.style.display = 'none';
  const adFly = document.getElementById('ad-fly'); if (adFly) { adFly.classList.remove('on'); adFly.textContent = '✈️ Terbang: OFF (F)'; }
  finishMs = null; deathFrozenMs = null; roomRunReset = 0; soloStart = 0;
  try { guards.forEach(gd => gd.reset()); } catch (e) {}
  if (character) { character.visible = true; character.position.set(0, 0.25, 0); character.rotation.y = 0; }
  if (physics) physics.velocityY = 0;
  moveVel.set(0, 0); knock.set(0, 0);
  checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
  ['overlay', 'countdown', 'race-timer'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.getElementById('in-game-controls').style.display = 'none';
  setElDisplay('btn-exit-lobby', 'none');
  document.getElementById('btn-start-game').style.display = 'flex';
  document.getElementById('btn-shop').style.display = 'flex';
  document.getElementById('btn-vault').style.display = 'flex';
  setElDisplay('btn-music', 'flex');
  document.getElementById('chat-container').style.display = 'flex';
  setLobbyOnlyHud(true);
  if (parkourWorldGroup) parkourWorldGroup.visible = false;
  if (snowWorldGroup) snowWorldGroup.visible = false;
  if (angkasaWorldGroup) angkasaWorldGroup.visible = false;
  if (angkasaController) angkasaController.reset(physics);
  if (lobbyWorldGroup) lobbyWorldGroup.visible = true;
  if (scene) { scene.background = new THREE.Color(0x10182b); scene.fog = null; }
  if (camera && controls) { camera.position.set(0, 3.8, 9.5); controls.target.set(0, 1.45, 0); }
  updateRoomUI();
}
window.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btn-exit-lobby');
  if (b) b.addEventListener('click', () => { returnToLobby(); });
});

// ============ LOADING SCREEN (saat tekan MULAI) ============
let loadingActive = false;
function showLoadingScreen(done) {
  if (loadingActive) return; loadingActive = true;
  let el = document.getElementById('loading-screen');
  if (!el) {
    const css = document.createElement('style');
    css.textContent = '#loading-screen{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(circle at 50% 40%,#2a2f55,#0d0f1f);color:#fff;font-family:sans-serif;transition:opacity .35s}#ls-title{font:900 clamp(28px,8vw,52px) sans-serif;letter-spacing:2px;text-shadow:0 0 24px #3b6cf6}#ls-spin{width:54px;height:54px;border-radius:50%;border:6px solid rgba(255,255,255,.18);border-top-color:#00e0a0;animation:lsspin 0.9s linear infinite}@keyframes lsspin{to{transform:rotate(360deg)}}#ls-barwrap{width:min(78vw,420px);height:16px;border-radius:10px;background:rgba(255,255,255,.14);overflow:hidden}#ls-bar{height:100%;width:0;border-radius:10px;background:linear-gradient(90deg,#3b6cf6,#00e0a0);transition:width .1s linear}#ls-text{font-size:14px;opacity:.9}#ls-tip{max-width:80vw;text-align:center;font-size:13px;color:#ffd166;min-height:34px}';
    document.head.appendChild(css);
    el = document.createElement('div'); el.id = 'loading-screen';
    el.innerHTML = '<div id="ls-title">🏃 PARKOUR 3D</div><div id="ls-spin"></div><div id="ls-barwrap"><div id="ls-bar"></div></div><div id="ls-text"></div><div id="ls-tip"></div>';
    document.body.appendChild(el);
  }
  const bar = document.getElementById('ls-bar'), txt = document.getElementById('ls-text'), tip = document.getElementById('ls-tip');
  const steps = ['Menyiapkan arena...', 'Memasang jebakan...', 'Mengunci laser & penjaga...', 'Membangun labirin...', 'Menyiapkan karakter...', 'Siap!'];
  const tips = ['💡 Kotak yang berkedip aneh biasanya palsu, jangan percaya!', '💡 Lompat dua kali untuk jarak lebih jauh.', '💡 Di labirin, salah lorong = ditembak NPC.', '💡 Checkpoint hijau menyimpan progresmu.', '💡 Jatuh ke lava? Badanmu hancur, semua pemain bisa lihat 😹'];
  tip.textContent = tips[Math.floor(Math.random() * tips.length)];
  el.style.opacity = '1'; el.style.display = 'flex';
  try { if (renderer && scene && camera) renderer.compile(scene, camera); } catch (e) { /* abaikan */ }
  const t0 = performance.now(), DUR = 2200; let finished = false;
  const tick = () => {
    const f = Math.min(1, (performance.now() - t0) / DUR), e = 1 - Math.pow(1 - f, 2);
    bar.style.width = (e * 100).toFixed(0) + '%';
    txt.textContent = steps[Math.min(steps.length - 1, Math.floor(f * steps.length))] + ' ' + (e * 100).toFixed(0) + '%';
    if (f < 1) { requestAnimationFrame(tick); return; }
    if (finished) return; finished = true;
    setTimeout(() => {
      try { done(); }
      catch (err) { console.error('Gagal memulai game:', err); }
      finally { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; loadingActive = false; }, 380); }
    }, 150);
  };
  tick();
}

// Elemen profil, saldo, dan tombol zoom hanya tampil di lobby.
function setLobbyOnlyHud(show) {
  const display = show ? '' : 'none';
  const profile = document.getElementById('btn-profile');
  if (profile) profile.style.display = display;
  const coins = document.getElementById('coin-amount');
  if (coins) {
    let coinWrap = coins.closest('#coin-box, .coin-box, .hud-coins, .coin-display, [data-hud="coins"]') || coins.parentElement;
    if (coinWrap) coinWrap.style.display = display;
  }
  const zoom = document.getElementById('zoom-ctrl');
  if (zoom) zoom.remove();
  const friendLaunch = document.getElementById('ps-launcher');
  const inviteLaunch = document.getElementById('ps-invite-launcher');
  if (friendLaunch) friendLaunch.style.display = show ? 'flex' : 'none';
  if (inviteLaunch) inviteLaunch.style.display = show ? 'flex' : 'none';
}

// ===== MAHKOTA KEMENANGAN =====
const DEFAULT_LEADERBOARD_MIN_CROWNS = 3;
let leaderboardMinCrowns = DEFAULT_LEADERBOARD_MIN_CROWNS;
function ensureCrownProfileUI() {
  const btn = document.getElementById('btn-profile');
  if (btn && !document.getElementById('profile-avatar-crown')) {
    const avatar = document.createElement('span'); avatar.id = 'profile-avatar-crown'; avatar.textContent = '👤';
    btn.insertBefore(avatar, btn.firstChild);
  }
  if (btn && !document.getElementById('hud-crowns')) {
    const crowns = document.createElement('span'); crowns.id = 'hud-crowns';
    crowns.style.cssText = 'display:inline-flex;align-items:center;gap:2px;margin-left:3px;font-size:12px;white-space:nowrap';
    btn.appendChild(crowns);
  }
  const modal = document.getElementById('profile-modal');
  if (modal && !document.getElementById('modal-crowns')) {
    const row = document.createElement('p'); row.id = 'modal-crowns'; row.style.cssText = 'color:#ffd76a;font-weight:700';
    const status = document.getElementById('modal-status')?.parentElement;
    if (status) status.insertAdjacentElement('afterend', row); else modal.appendChild(row);
  }
  if (!document.getElementById('crown-profile-style')) {
    const style = document.createElement('style'); style.id = 'crown-profile-style';
    style.textContent = '#profile-avatar-crown{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#34466c,#151b2d);border:2px solid #ffd76a;font-size:17px;position:relative}#hud-crowns{color:#ffd76a;text-shadow:0 1px 4px #000}#modal-crowns{font-size:15px!important;color:#ffd76a!important}';
    document.head.appendChild(style);
  }
}
function updateCrownProfileUI() {
  ensureCrownProfileUI();
  const count = accountKey() === DEV_USERNAME ? ADMIN_FIXED_CROWNS : Math.max(0, Math.floor(Number(playerData.crowns) || 0));
  const hud = document.getElementById('hud-crowns');
  if (hud) hud.textContent = `👑 ${count}`;
  const modal = document.getElementById('modal-crowns');
  if (modal) modal.textContent = `Mahkota kemenangan: ${'👑'.repeat(Math.min(count, 8))}${count > 8 ? ` ×${count}` : ''} (${count})`;
}
async function loadCrownSettings() {
  try {
    const value = await socialGet('settings/leaderboardMinCrowns');
    leaderboardMinCrowns = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : DEFAULT_LEADERBOARD_MIN_CROWNS;
  } catch (_) { leaderboardMinCrowns = DEFAULT_LEADERBOARD_MIN_CROWNS; }
}
async function awardWinCrown() {
  const key = myPlayerKey();
  if (!key) return;
  if (key === DEV_USERNAME) {
    playerData.crowns = ADMIN_FIXED_CROWNS;
    await socialPatch(`players/${key}`, { crowns: ADMIN_FIXED_CROWNS, lastWinAt: Date.now() });
    await socialPatch(`leaderboard/${key}`, { crowns: ADMIN_FIXED_CROWNS }).catch(() => {});
    updateCrownProfileUI();
    refreshSoloLeaderboard(true).catch(() => {});
    showToast(`🏆 Akun admin: ${ADMIN_FIXED_CROWNS.toLocaleString('id-ID')} mahkota`, 2800);
    return;
  }
  // Baca nilai terbaru agar mahkota yang sudah diatur admin tidak tertimpa data lama.
  const latest = await socialGet(`players/${key}`).catch(() => null) || {};
  const next = Math.max(0, Math.floor(Number(latest.crowns ?? playerData.crowns) || 0)) + 1;
  await socialPatch(`players/${key}`, { crowns: next, lastWinAt: Date.now() });
  playerData.crowns = next;
  updateCrownProfileUI();
  // Simpan juga salinan di node leaderboard supaya penyaringan dan tampilan selalu sinkron.
  await socialPatch(`leaderboard/${key}`, { crowns: next }).catch(() => {});
  refreshSoloLeaderboard(true).catch(() => {});
  showToast(`🏆 MENANG! Kamu mendapat 1 mahkota (${next})`, 2800);
}

// ============ 4. FUNGSI LOBI & SHOP ============
function startLobby() {
  tryAutoLandscape();
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('game-ui').style.display = 'block';
  gameState = 'LOBBY'; 
  if (!playerData.inventory.includes('aks_none')) playerData.inventory.push('aks_none');
  const isOwnerAccount = accountKey() === DEV_USERNAME;
  if (isOwnerAccount && !playerData.inventory.includes('baju_developer')) {
    playerData.inventory.push('baju_developer');
    updatePlayerFirebase().catch(err => console.warn('Gagal menyimpan kostum Developer ke Vault:', err));
  }
  if (!playerData.equipped.aksesoris) playerData.equipped.aksesoris = 'aks_none';
  document.getElementById('hud-username').textContent = playerData.username;
  updateCrownProfileUI();
  if (accountKey() === DEV_USERNAME) {
    playerData.crowns = ADMIN_FIXED_CROWNS;
    socialPatch(`players/${DEV_USERNAME}`, { crowns: ADMIN_FIXED_CROWNS, crownsUpdatedAt: Date.now() }).catch(() => {});
    socialPatch(`leaderboard/${DEV_USERNAME}`, { crowns: ADMIN_FIXED_CROWNS }).catch(() => {});
    updateCrownProfileUI();
  }
  loadCrownSettings().then(() => refreshSoloLeaderboard(true)).catch(() => {});
  document.getElementById('coin-amount').textContent = playerData.coins || 0;
  document.getElementById('modal-username').textContent = `${playerData.username} · ID ${playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : 'belum tersedia')}`;
  ensureRenameProfileUI();
  
  if (playerData.isDev) {
    document.getElementById('hud-verified').style.display = 'flex';
    document.getElementById('modal-status').textContent = "Developer ✔";
  } else {
    document.getElementById('modal-status').textContent = "Player Biasa";
    document.getElementById('modal-status').style.color = "#ccc";
  }
  document.getElementById('btn-start-game').style.display = 'flex';
  document.getElementById('btn-shop').style.display = 'flex';
  document.getElementById('btn-vault').style.display = 'flex';
  setElDisplay('btn-music', 'flex');
  document.getElementById('in-game-controls').style.display = 'none'; setLobbyOnlyHud(true);
  document.getElementById('chat-container').style.display = 'flex';

  fetchGlobalChat();
  setInterval(fetchGlobalChat, 3000);

  init3DGame();
  if (parkourWorldGroup) parkourWorldGroup.visible = false;
  if (lobbyWorldGroup) lobbyWorldGroup.visible = true;
  scene.fog = null;
  character.position.set(0, 0.25, 0); character.rotation.y = 0;
  camera.position.set(0, 3.8, 9.5);
  controls.target.set(0, 1.45, 0);
  buildRoomUI();
  setLobbyOnlyHud(true);
}

function renderShopTab(category) {
  const container = document.getElementById('shop-items-container');
  container.innerHTML = '';
  
  let visibleCount = 0;
  if (category === 'gamepass') {
    SHOP_ITEMS.gamepass.forEach(item => {
      const owned = playerData.inventory.includes(item.id);
      const div = document.createElement('div'); div.className = 'shop-item';
      div.innerHTML = `<div class="color-preview" style="background:#2a2f45;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:44px">🫸</div><div class="item-name">${item.name}</div><div class="item-price" style="font-size:11px">${item.desc}</div>${owned ? '<div class="item-price owned-label">SUDAH DIMILIKI</div><button class="shop-buy-btn" disabled>AKTIF</button>' : `<div class="item-price">🪙 ${item.price}</div><button class="shop-buy-btn" onclick="buyItem('gamepass', '${item.id}', ${item.price})">BELI (${item.price})</button>`}`;
      container.appendChild(div);
    });
    return;
  }
  SHOP_ITEMS[category].forEach(item => {
    if (item.adminOnly || item.id === 'baju_developer') return;
    const isOwned = playerData.inventory.includes(item.id);
    if (isOwned) return; // item yang sudah dibeli pindah ke Vault
    const isEquipped = Object.values(playerData.equipped).includes(item.id);
    visibleCount++;
    const div = document.createElement('div');
    div.className = 'shop-item';
    
    const previewHTML = `<div class="color-preview" style="background:#2a2f45;border-radius:14px;display:flex;align-items:center;justify-content:center">${itemIcon(category, item)}</div>`;

    let btnHTML = '';
    if (isEquipped) {
      btnHTML = `<button class="shop-buy-btn" disabled>DIPAKAI</button>`;
    } else if (isOwned) {
      btnHTML = `<button class="shop-buy-btn" onclick="equipItem('${category}', '${item.id}')">PAKAI</button>`;
    } else {
      btnHTML = `<button class="shop-buy-btn" onclick="buyItem('${category}', '${item.id}', ${item.price})">BELI (${item.price})</button>`;
    }

    div.innerHTML = `${previewHTML}<div class="item-name">${item.name}</div>${item.price > 0 ? `<div class="item-price">🪙 ${item.price}</div>` : '<div class="item-price">GRATIS</div>'}${btnHTML}`;
    container.appendChild(div);
  });
  if (!visibleCount) container.innerHTML = '<div class="inventory-empty">Semua item kategori ini sudah kamu miliki. Cek Vault!</div>';
}

function renderStandaloneMusic() {
  const container = document.getElementById('music-track-list');
  if (!container) return;
  const tracks = [
    { id: 'amatekam', name: 'Amatekam', file: 'putzzdev.mp3' },
    { id: 'luklukluk', name: 'Luk Luk Luk', file: 'putzzdev2.mp3' }
  ];
  const selected = window.getSelectedVaultMusic ? window.getSelectedVaultMusic() : 'amatekam';
  const playing = window.isVaultMusicPlaying && window.isVaultMusicPlaying();
  const vol = window.getVaultMusicVolume ? Math.round(window.getVaultMusicVolume() * 100) : 35;
  const controls = `
    <div style="background:#1b2640;border:1px solid #42516b;border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <button type="button" class="shop-buy-btn" style="width:auto;min-width:110px" onclick="toggleVaultMusic()">${playing ? '⏸ JEDA' : '▶ LANJUT'}</button>
      <label style="flex:1;min-width:120px;font-size:12px;color:#aab7cc">🔊 Volume
        <input type="range" min="0" max="100" value="${vol}" style="width:100%" oninput="setVaultMusicVolume(this.value/100)">
      </label>
    </div>`;
  container.innerHTML = controls + tracks.map(track => `
    <div style="background:#222b40;border:1px solid #42516b;border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div><div style="font-weight:bold;font-size:16px">🎵 ${track.name}</div><div style="font-size:11px;color:#aab7cc;margin-top:4px">${track.file}</div></div>
      <button type="button" class="shop-buy-btn" style="width:auto;min-width:118px" onclick="selectVaultMusic('${track.id}');renderStandaloneMusic()">${selected === track.id && playing ? 'SEDANG DIPUTAR' : 'PUTAR LAGU'}</button>
    </div>`).join('');
}

function renderVaultTab(category) {
  const container = document.getElementById('vault-items-container');
  if (!container) return;
  container.innerHTML = '';



  let visibleCount = 0;
  (SHOP_ITEMS[category] || []).forEach(item => {
    if (!playerData.inventory.includes(item.id)) return;
    visibleCount++;
    const isEquipped = Object.values(playerData.equipped).includes(item.id);
    const div = document.createElement('div'); div.className = 'shop-item';
    const previewHTML = `<div class="color-preview" style="background:#2a2f45;border-radius:14px;display:flex;align-items:center;justify-content:center">${itemIcon(category, item)}</div>`;
    const btnHTML = isEquipped
      ? '<button class="shop-buy-btn" disabled>DIPAKAI</button>'
      : `<button class="shop-buy-btn" onclick="equipItem('${category}', '${item.id}')">PAKAI</button>`;
    div.innerHTML = `${previewHTML}<div class="item-name">${item.name}</div><div class="item-price owned-label">SUDAH DIMILIKI</div>${btnHTML}`;
    container.appendChild(div);
  });
  if (!visibleCount) container.innerHTML = '<div class="inventory-empty">Belum ada item di kategori ini.</div>';
}

window.buyItem = async function(category, itemId, price) {
  if (itemId === 'baju_developer') { showToast('🔒 Kostum Developer tidak dijual'); return; }
  if (playerData.inventory.includes(itemId)) { showToast('Sudah dimiliki'); return; }
  if (playerData.coins < price) { showToast("❌ Koin kamu tidak cukup!"); return; }
  playerData.coins -= price;
  playerData.inventory.push(itemId);
  await updatePlayerFirebase();
  document.getElementById('coin-amount').textContent = playerData.coins;
  renderShopTab(category);
  if (document.getElementById('vault-modal').style.display === 'flex') renderVaultTab(category);
  showToast("✅ Berhasil dibeli!");
};

window.equipItem = async function(category, itemId) {
  if (itemId === 'baju_developer' && accountKey() !== DEV_USERNAME) {
    showToast('🔒 Kostum Developer khusus akun admin');
    return;
  }
  let equipKey = category;
  if (category === 'efek') equipKey = itemId.includes('lari') ? 'efek_lari' : 'efek_lompat';
  
  playerData.equipped[equipKey] = itemId;
  await updatePlayerFirebase();
  updateCharacterVisuals();
  renderShopTab(category);
  if (document.getElementById('vault-modal').style.display === 'flex') renderVaultTab(category);
  showToast("✅ Item berhasil dipakai!");
};

async function updatePlayerFirebase() {
  const userKey = accountKey(); // kunci akun permanen (bukan nama tampilan)
  const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;
  await fetch(firebaseUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coins: playerData.coins, inventory: playerData.inventory, equipped: playerData.equipped, savedCheckpoint: playerData.savedCheckpoint || null, savedCheckpointSnow: playerData.savedCheckpointSnow || null })
  });
}

// ============ 5. UPDATE VISUAL KARAKTER ============
const webTexCache = {};
function getWebTex(hex) {
  if (webTexCache[hex]) return webTexCache[hex];
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.scale(2, 2);
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); }
  for (let j = 0; j < 256; j += 32) for (let i = 0; i < 256; i += 64) { x.beginPath(); x.moveTo(i, j); x.quadraticCurveTo(i + 32, j + 10, i + 64, j); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (webTexCache[hex] = t);
}

function makeSpiderLogoTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.strokeStyle = '#111'; x.fillStyle = '#111'; x.lineWidth = 6; x.lineCap = 'round';
  for (const s of [-1, 1]) for (const [ex, ey] of [[48, -44], [58, -14], [58, 16], [46, 46]]) {
    x.beginPath(); x.moveTo(64, 66); x.quadraticCurveTo(64 + s * ex * 0.5, 66 + ey - 14, 64 + s * ex, 66 + ey); x.stroke();
  }
  x.beginPath(); x.ellipse(64, 74, 11, 22, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(64, 46, 8, 0, Math.PI * 2); x.fill();
  const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8; return lt;
}

function makeBatLogoTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f5c400'; x.beginPath(); x.ellipse(64, 64, 60, 38, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#111'; x.lineWidth = 5; x.stroke();
  x.fillStyle = '#111'; x.beginPath();
  x.moveTo(64, 42); x.lineTo(70, 36); x.lineTo(72, 44); x.quadraticCurveTo(92, 40, 110, 54); x.quadraticCurveTo(100, 58, 96, 72);
  x.quadraticCurveTo(90, 64, 82, 68); x.quadraticCurveTo(76, 68, 72, 82); x.lineTo(64, 72); x.lineTo(56, 82);
  x.quadraticCurveTo(52, 68, 46, 68); x.quadraticCurveTo(38, 64, 32, 72); x.quadraticCurveTo(28, 58, 18, 54);
  x.quadraticCurveTo(36, 40, 56, 44); x.lineTo(58, 36); x.closePath(); x.fill();
  const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = 8; return lt;
}

// ===== HD: tekstur kain/rantai, environment map untuk logam, helper kostum =====
let envTex = null;
const suitTexCache = {};
function getSuitTex(kind, hex) {
  const key = kind + hex; if (suitTexCache[key]) return suitTexCache[key];
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, S, S);
  if (kind === 'mail') { // zirah rantai
    for (let j = 0; j < S; j += 14) for (let i = (j / 14 % 2) * 7; i < S; i += 14) {
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2.5; x.beginPath(); x.arc(i + 7, j + 7, 6, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1; x.beginPath(); x.arc(i + 6, j + 6, 5, Math.PI, Math.PI * 1.6); x.stroke();
    }
  } else { // jahitan otot ala armor kain
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3;
    for (let j = 0; j < S; j += 56) { x.beginPath(); x.moveTo(0, j); x.quadraticCurveTo(S / 2, j + 16, S, j); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 2;
    for (let j = 8; j < S; j += 56) { x.beginPath(); x.moveTo(0, j); x.quadraticCurveTo(S / 2, j + 16, S, j); x.stroke(); }
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2;
    for (let i = 0; i < S; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (suitTexCache[key] = t);
}
function applyItemMat(m, it) {
  const tex = it.web ? getWebTex(it.color) : it.suit ? getSuitTex(it.suit, it.color) : null;
  const metal = it.dev ? 0.82 : it.iron ? 0.75 : it.thor ? 0.55 : 0;
  m.map = tex; m.color.setHex(tex ? 0xffffff : it.color);
  m.bumpMap = tex; m.bumpScale = 0.6;
  m.metalness = metal; m.roughness = it.iron ? 0.28 : it.thor ? 0.4 : (tex ? 0.55 : 0.7);
  m.envMap = (metal || tex) && envTex ? envTex : null; m.envMapIntensity = it.iron ? 1.1 : it.thor ? 0.9 : 0.3;
  m.needsUpdate = true;
}
function pickCostume(eq) {
  const pick = (cat, def) => SHOP_ITEMS[cat].find(i => i.id === eq[cat]) || SHOP_ITEMS[cat].find(i => i.id === def);
  const baju = pick('baju', 'baju_default'), iron = !!baju.iron, thor = !!baju.thor, hulk = !!baju.hulk;
  const pac = !!baju.pac, saitama = !!baju.saitama;
  const celana = saitama ? { color: 0xc92532, iron: false } : pac ? { color: 0xffd800 } : iron ? { color: 0xb01020, iron: true } : thor ? { color: 0x2a2d33 } : hulk ? { color: 0x6b3fa0 } : pick('celana', 'celana_default');
  const sepatu = saitama ? { color: 0xc92532 } : pac ? { color: 0x1a1a8c } : iron ? { color: 0xd4a017, iron: true } : thor ? { color: 0x4a3320 } : hulk ? { color: 0x57b84a } : pick('sepatu', 'sepatu_default');
  return { baju, celana, sepatu, iron, thor, hulk, saitama };
}
const costumeParts = { spider: [], bat: [], iron: [], thor: [], hulk: [], ultra: [], godzilla: [], ramen: [], pac: [], saitama: [] };
function setCostumeVis(baju, get) {
  const on = { saitama: !!baju.saitama, spider: baju.id === 'baju_spiderman', bat: baju.id === 'baju_batman', iron: !!baju.iron, thor: !!baju.thor, hulk: !!baju.hulk, ultra: !!baju.ultra, godzilla: !!baju.godzilla, ramen: !!baju.ramen, pac: !!baju.pac };
  for (const k in costumeParts) costumeParts[k].forEach(o => { const n = get(o); if (n) n.visible = on[k]; });
}

// tubuh Hulk: kulit hijau, otot besar (badan/lengan/kaki melebar), tangan besar
function applyBodyType(root, P, hulk) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const t = o.userData.type;
    if (t === 'kulit') { o.material.color.setHex(hulk ? 0x57b84a : 0xffd1b3); if (o.userData.hand) o.scale.setScalar(hulk ? 1.7 : 1); }
    else if (t === 'rambut') o.material.color.setHex(hulk ? 0x141a12 : 0xd1d1d6);
    else if (t === 'baju') o.scale.set(hulk ? 1.4 : 1, 1, hulk ? 1.4 : 1);
    else if (t === 'celana') o.scale.set(hulk ? 1.3 : 1, 1, hulk ? 1.3 : 1);
  });
  P.armL.position.x = hulk ? -0.58 : -0.4; P.armR.position.x = hulk ? 0.58 : 0.4;
  P.legL.position.x = hulk ? -0.2 : -0.15; P.legR.position.x = hulk ? 0.2 : 0.15;
}

const ACC_ICONS = {
  aks_topeng_batman: '<path d="M14 56V26Q14 12 32 12Q50 12 50 26V56Q42 46 32 46Q22 46 14 56Z" fill="#15151c"/><path d="M14 26L10 4L27 13ZM50 26L54 4L37 13Z" fill="#15151c"/><path d="M19 30L29 34L19 37Z" fill="#fff"/><path d="M45 30L35 34L45 37Z" fill="#fff"/>',
  aks_none: '<circle cx="32" cy="32" r="20" fill="none" stroke="#888" stroke-width="4"/><path d="M18 46L46 18" stroke="#888" stroke-width="4"/>',
  aks_topeng_spider: '<circle cx="32" cy="32" r="24" fill="#d91e2b"/><path d="M32 8V56M9 32H55M14 16Q32 24 50 16M14 48Q32 40 50 48" stroke="rgba(0,0,0,.45)" stroke-width="1" fill="none"/><path d="M13 27Q21 19 29 31Q20 37 13 27Z" fill="#fff" stroke="#111" stroke-width="2"/><path d="M51 27Q43 19 35 31Q44 37 51 27Z" fill="#fff" stroke="#111" stroke-width="2"/>',
  aks_kacamata: '<rect x="6" y="24" width="22" height="14" rx="4" fill="#111"/><rect x="36" y="24" width="22" height="14" rx="4" fill="#111"/><path d="M28 29H36" stroke="#111" stroke-width="3"/>',
  aks_topi: '<path d="M12 40Q12 14 34 14Q54 14 54 40Z" fill="#e53935"/><path d="M30 40H62Q62 47 50 47H30Z" fill="#b71c1c"/>',
  aks_mahkota: '<path d="M8 48L12 18L24 32L32 14L40 32L52 18L56 48Z" fill="#ffd700" stroke="#b8860b" stroke-width="2" stroke-linejoin="round"/>',
  aks_jubah: '<path d="M20 8H44L54 56Q32 48 10 56Z" fill="#c0132b" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>'
};
const SHAPES = {
  baju: 'M20 8 L8 16 L13 27 L19 24 L19 56 L45 56 L45 24 L51 27 L56 16 L44 8 Q32 16 20 8 Z',
  celana: 'M18 8 H46 L50 56 H35 L32 28 L29 56 H14 Z',
  sepatu: 'M8 34 H27 L33 26 H42 L44 34 Q58 36 58 46 V52 H8 Z'
};
function itemIcon(cat, it) {
  let inner = '';
  if (it.id === 'baju_developer') {
    inner = '<path d="M20 8L8 16L13 28L19 24V56H45V24L51 28L56 16L44 8Q32 16 20 8Z" fill="#101b35" stroke="#54dfff" stroke-width="2"/><path d="M32 17L35 25L44 26L37 32L39 41L32 36L25 41L27 32L20 26L29 25Z" fill="#ffd76a"/><path d="M18 48H46" stroke="#54dfff" stroke-width="3"/><text x="32" y="57" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">DEV</text>';
    return `<svg viewBox="0 0 64 64" style="width:80%;height:80%">${inner}</svg>`;
  }
  if (SHAPES[cat]) {
    const col = '#' + it.color.toString(16).padStart(6, '0'), d = SHAPES[cat];
    inner = `<defs><clipPath id="cp-${it.id}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${col}" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (it.web) inner += `<g clip-path="url(#cp-${it.id})" stroke="rgba(0,0,0,.5)" stroke-width=".8" fill="none"><path d="M32 4V60M20 4V60M44 4V60M8 4V60M56 4V60M4 16Q32 24 60 16M4 28Q32 36 60 28M4 40Q32 48 60 40M4 52Q32 60 60 52"/></g>`;
    if (it.iron && cat === 'baju') inner += '<path d="M20 8L8 16L13 27L19 24Z" fill="#d4a017"/><path d="M44 8L56 16L51 27L45 24Z" fill="#d4a017"/><circle cx="32" cy="30" r="5" fill="#9ff3ff" stroke="#d4a017" stroke-width="2"/><rect x="19" y="46" width="26" height="4" fill="#d4a017"/>';
    if (it.hulk && cat === 'baju') inner += '<path d="M24 24Q32 34 40 24" stroke="#2c6b27" stroke-width="2" fill="none"/><circle cx="25" cy="28" r="5" fill="#6fd35f"/><circle cx="39" cy="28" r="5" fill="#6fd35f"/><path d="M32 32V46M26 38H38M27 44H37" stroke="#2c6b27" stroke-width="1.5"/><rect x="19" y="47" width="26" height="5" fill="#6b3fa0"/>';
    if (it.thor && cat === 'baju') inner += '<path d="M20 8L8 16L13 27L19 24Z" fill="#c9d1d9"/><path d="M44 8L56 16L51 27L45 24Z" fill="#c9d1d9"/><circle cx="25" cy="29" r="5.5" fill="#dfe6ec" stroke="#7b8794" stroke-width="1.5"/><circle cx="39" cy="29" r="5.5" fill="#dfe6ec" stroke="#7b8794" stroke-width="1.5"/><rect x="19" y="46" width="26" height="4" fill="#4a2f1b"/><rect x="28" y="38" width="8" height="5" rx="1" fill="#6b7480"/><path d="M33 33L29 38H32L30 43L36 36H33Z" fill="#4aa8ff"/>';
    if (it.bat && cat === 'baju') inner += '<rect x="19" y="47" width="26" height="4" fill="#f5c400"/><ellipse cx="32" cy="30" rx="8" ry="5" fill="#f5c400" stroke="#111"/><path d="M32 26L33 25L33.5 26.5Q38 26 40 28Q38 28.5 37 31Q35 30 34 31L32 33L30 31Q29 30 27 31Q26 28.5 24 28Q26 26 30.5 26.5L31 25Z" fill="#111"/>';
    if (it.ultra && cat === 'baju') inner += '<path d="M20 8L32 18L44 8L39 56H25Z" fill="#d52c3a"/><circle cx="32" cy="34" r="5" fill="#5cecff" stroke="#fff" stroke-width="2"/>';
    if (it.godzilla && cat === 'baju') inner += '<path d="M32 8L24 20L29 19L22 31L29 28L25 44L39 44L35 28L42 31L35 19L40 20Z" fill="#a8d96a" stroke="#183d2b" stroke-width="1.5"/>';
    if (it.pac && cat === 'baju') inner += '<circle cx="32" cy="32" r="11" fill="#111"/><path d="M32 32L42 27.5A11 11 0 1 0 42 36.5Z" fill="#ffd800"/><circle cx="34" cy="26.5" r="1.5" fill="#111"/><circle cx="46" cy="32" r="1.6" fill="#ffd800"/>';
    if (it.ramen && cat === 'baju') inner += '<path d="M17 25Q32 34 47 25L43 48Q32 55 21 48Z" fill="#f2c56c" stroke="#7d3c1c" stroke-width="2"/><path d="M19 24Q32 14 45 24" fill="none" stroke="#fff0bd" stroke-width="3"/><path d="M25 20L37 11M29 21L41 12" stroke="#8b5528" stroke-width="2"/>';
    if (it.web && cat === 'baju') inner += '<g stroke="#111" stroke-width="1.6" fill="#111" stroke-linecap="round"><ellipse cx="32" cy="35" rx="2.6" ry="5"/><circle cx="32" cy="28.5" r="1.8"/><path fill="none" d="M32 33L24 28M32 35L23 35M32 37L24 42M32 38L25 46M32 33L40 28M32 35L41 35M32 37L40 42M32 38L39 46"/></g>';
  } else if (cat === 'aksesoris') inner = ACC_ICONS[it.id] || '';
  else inner = `<text x="32" y="44" font-size="34" text-anchor="middle">${it.id.includes('api') ? '🔥' : (it.id.includes('_es') ? '❄️' : '✨')}</text>`;
  return `<svg viewBox="0 0 64 64" style="width:80%;height:80%">${inner}</svg>`;
}

function updateCharacterVisuals() {
  if (!character) return;
  const ap = (child, item) => applyItemMat(child.material, item);
  const { baju, iron, thor, celana: celanaV, sepatu: sepatuV } = pickCostume(playerData.equipped);
  character.traverse((child) => {
    if (!child.isMesh) return;
    if (child.userData.type === 'baju') ap(child, baju);
    if (child.userData.type === 'celana') ap(child, celanaV);
    if (child.userData.type === 'sepatu') ap(child, sepatuV);
  });
  setCostumeVis(baju, o => o);
  character.traverse(o => { if (o.isMesh && o.userData.type === 'rambut') o.visible = !baju.saitama; });
  applyBodyType(character, { armL: leftArmPivot, armR: rightArmPivot, legL: leftLegPivot, legR: rightLegPivot }, baju.hulk);
  const a = playerData.equipped.aksesoris || 'aks_none';
  Object.keys(acc).forEach(id => { acc[id].visible = !(iron || thor) && id === a; });
  if (nameSprite) updateCharacterNameSprite(playerData.username, playerData.isDev);
  mpSyncEquipped();
}

// ============ 6. EFEK PARTIKEL ============
function createTrailEffect() {
  if (playerData.equipped.efek_lari === 'efek_lari_default') return;
  const item = SHOP_ITEMS.efek.find(i => i.id === playerData.equipped.efek_lari);
  if (!item || !item.color) return;
  
  const geo = new THREE.SphereGeometry(0.12, 8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 2, transparent: true, opacity: 1 });
  const particle = new THREE.Mesh(geo, mat);
  
  particle.position.copy(character.position);
  particle.position.y += 0.3;
  particle.position.x += (Math.random() - 0.5) * 0.4;
  particle.position.z += (Math.random() - 0.5) * 0.4;
  
  scene.add(particle);
  trailParticles.push({ mesh: particle, life: 0.6, startColor: new THREE.Color(0xffff00), endColor: new THREE.Color(0xff0000) });
}

function createJumpEffect() {
  if (playerData.equipped.efek_lompat === 'efek_lompat_default') return;
  const item = SHOP_ITEMS.efek.find(i => i.id === playerData.equipped.efek_lompat);
  if (!item || !item.color) return;
  
  for(let i=0; i<20; i++) {
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 3, transparent: true, opacity: 1 });
    const particle = new THREE.Mesh(geo, mat);
    
    particle.position.copy(character.position);
    particle.position.y += 0.2;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1.5;
    
    particle.userData = { vx: Math.cos(angle) * speed, vy: Math.random() * 2 + 0.5, vz: Math.sin(angle) * speed };
    scene.add(particle);
    jumpParticles.push({ mesh: particle, life: 0.8 });
  }
}

// ============ 7. SETUP 3D & GAME LOOP ============
let scene, camera, renderer, character, nameSprite, controls;
let parkourWorldGroup = null, lobbyWorldGroup = null, lobbyAccentRing = null;
let platforms = [], physics, lavaMat;
let leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, headGroup;
let joystickVector = new THREE.Vector2(0, 0);
let isRunning = false;
let trailParticles = [], jumpParticles = [];
let laserBeam = null; // Objek Laser NPC
let rig, leftElbow, rightElbow, leftKnee, rightKnee;
let lavaMapVisuals = null;
// Efek visual dan kamera khusus map Lava; tidak menyentuh sistem kostum/mahkota.

let sq = { x: 0, v: 0 }, moveVel = new THREE.Vector2(0, 0), wasGrounded = true, laserState = 'off';
const LASER_Z = -44, LASER_Y = 9.3;
let FIN_Y = 1e9, checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
let usedCheckpointMat = null;
let activatedCheckpoints = new WeakSet(); // Setiap platform checkpoint hanya aktif sekali per putaran
let hazards = [], hitCD = 0, capePivot, spiderLogoGrp, acc = {};
const knock = new THREE.Vector2();
let batGrp, capeB, ironHelm, ironBody, thorHelm, thorBody, capeT;
let MAZE_H = 12, MAZE_Z = -101;
let zoomDir = 0, guards = [], mazeHinted = false, WIN = { x: 0, y: 0, z: -77 };
// Sistem multi-map (gacha): map aktif + dunia tiap map. Lihat blok SNOW-MODULE.
let currentMap = 'lava', lavaWorld = null, snowWorld = null, snowWorldGroup = null, snowController = null, angkasaWorld = null, angkasaWorldGroup = null, angkasaController = null, curGroundPlat = null, gachaBusy = false;
const ROASTS = {
  hit: ['Wah, pemain PALING BERUNTUNG hari ini... beruntung kena bola berduri 🍀😹', 'Beruntung banget ya, dilempar sejauh itu. Gratis lho 🚀😹', 'Selamat! Kamu terpilih jadi korban palang berputar 🏆💀', 'Keberuntungan kamu emang nggak ada obat, ketabrak mulu 🍀🤣'],
  fall: ['Beruntung banget jatuh ke lava, hangat kan? 🔥😹', 'Pemain paling beruntung sedunia: jatuh dari tempat yang sama lagi 🍀💀', 'Mantap, rekor jatuh terbaru! Lava bangga sama kamu 🏅🔥'],
  fake: ['Beruntung banget ketipu kotak palsu, yang asli malah kamu lewatin 😹🍀', 'Kotak palsu aja kamu percaya, pantes paling beruntung 🤣👻', 'Insting kamu emang paling beruntung... beruntung salah terus 🍀👻'],
  laser: ['Lasernya nyala sebentar, kamu tetap kena. Bakat langka 🍀💥', 'Kena laser lagi? Rekor kesialan paling beruntung 🏅💥', 'Tinggal lompat doang lho, beruntung banget kamu 😹⚡'],
  snowshot: ['Ditembak NPC salju! Harusnya ngumpet di balik dinding es 🧊🔫', 'NPC: "waktu habis, sayang" ❄️🔫', 'Berdiri di tempat terbuka pas NPC nembak? Dingin banget 🥶💥', 'Dinding esnya ada buat dipakai, bukan dipandang 🧊😹'],
  shot: ['Ditembak NPC gara-gara salah belok. Beruntung banget kamu 🍀🔫', 'Peta nggak bisa dibaca, tapi pistolnya akurat. Beruntung kamu 😹🔫', 'NPC: "makasih udah nyasar ke sini" 🔫💀', 'Satu lorong benar, kamu pilih yang salah. Pecah rekor 🏅🔫']
};
const isAdminUser = () => !!(playerData && (playerData.isDev === true || accountKey() === DEV_USERNAME));
// Pemain biasa di-roasting; admin/dev tidak (admin cuma dapat pesan biasa)
function roast(kind, plain) {
  if (isAdminUser()) { if (plain) showToast(plain); return; }
  const arr = ROASTS[kind];
  showToast(arr[Math.floor(Math.random() * arr.length)]);
}
let flyMode = false, godMode = false, flyUp = false, flyDown = false, flySpeed = 14;

function respawn() {
  resetRunTimer();
  reviveLocal();
  character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z);
  physics.velocityY = 0; moveVel.set(0, 0); knock.set(0, 0); guards.forEach(gd => gd.reset()); gameState = 'PLAYING';
  document.getElementById('overlay').style.display = 'none';
}

// ===== ADMIN PANEL (khusus Putzzdev) =====
function setupAdminPanel() {
  // Gunakan flag admin dari akun ATAU username pemilik; trim/case-insensitive agar panel tidak hilang karena format data.
  if (!isAdminUser() || document.getElementById('admin-btn')) return;
  const css = document.createElement('style');
  css.textContent = '#admin-wrap{position:fixed;top:54px;right:10px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:sans-serif}#admin-btn{padding:8px 12px;border:0;border-radius:10px;background:#ff3366;color:#fff;font-weight:700;cursor:grab;touch-action:none}#admin-panel{width:220px;padding:12px;border-radius:12px;background:rgba(15,15,25,.92);color:#fff;display:none;flex-direction:column;gap:8px;font-size:13px}#admin-title{cursor:grab;padding:4px 0;touch-action:none;user-select:none}#admin-panel button{padding:8px;border:0;border-radius:8px;background:#2d3550;color:#fff}#admin-panel button.on{background:#00b86b}#admin-roast{font-size:12px;color:#ffd166}#fly-ctrl{position:fixed;z-index:9999;right:14px;top:45%;display:none;flex-direction:column;gap:10px}#fly-ctrl button{width:56px;height:56px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;font-size:24px}';
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.id = 'admin-wrap';
  const btn = document.createElement('button'); btn.id = 'admin-btn'; btn.textContent = '🛠️ Admin';
  const panel = document.createElement('div'); panel.id = 'admin-panel';
  panel.innerHTML = '<b id="admin-title">☰ Admin Panel - Putzzdev (geser)</b><button id="ad-fly">✈️ Terbang: OFF (F)</button><label>Kecepatan: <span id="ad-spd">14</span><input id="ad-speed" type="range" min="5" max="40" value="14" style="width:100%"></label><button id="ad-god">🛡️ Anti-mati: OFF</button><button data-tp="start">📍 Ke Start</button><button data-tp="hub">📍 Ke Hub Tower</button><button data-tp="top">🏁 Ke Puncak Tower</button><button data-tp="maze">🧩 Ke Labirin</button><button data-tp="finish">🎉 Ke Finish</button><button id="ad-coin">🪙 +1000 Koin</button><hr style="width:100%;border-color:#46516b"><b>👑 PENGATURAN MAHKOTA</b><label>Batas masuk leaderboard<input id="ad-crown-min" type="number" min="0" max="999999" value="3" style="width:100%;padding:7px;border-radius:6px"></label><button id="ad-crown-save-min">Simpan batas ke Firebase</button><label>Username pemain<input id="ad-crown-user" type="text" placeholder="username" style="width:100%;padding:7px;border-radius:6px"></label><label>Jumlah mahkota<input id="ad-crown-count" type="number" min="0" max="999999" value="0" style="width:100%;padding:7px;border-radius:6px"></label><button id="ad-crown-set">Atur mahkota pemain</button>';
  const fc = document.createElement('div'); fc.id = 'fly-ctrl';
  fc.innerHTML = '<button id="fly-up">▲</button><button id="fly-down">▼</button>';
  wrap.append(btn, panel); document.body.append(wrap, fc);

  // Geser panel: tahan & seret tombol Admin atau judul panel
  let moved = false;
  const makeDrag = (handle) => handle.addEventListener('pointerdown', (e) => {
    const r = wrap.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
    moved = false; wrap.style.right = 'auto'; wrap.style.left = r.left + 'px'; wrap.style.top = r.top + 'px';
    handle.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
      if (!moved) return;
      wrap.style.left = Math.max(0, Math.min(innerWidth - wrap.offsetWidth, ev.clientX - ox)) + 'px';
      wrap.style.top = Math.max(0, Math.min(innerHeight - wrap.offsetHeight, ev.clientY - oy)) + 'px';
    };
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
  makeDrag(btn); makeDrag(document.getElementById('admin-title'));
  btn.onclick = () => { if (moved) { moved = false; return; } panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; };
  const setFly = (v) => {
    flyMode = v; fc.style.display = v ? 'flex' : 'none'; flyUp = flyDown = false; physics.velocityY = 0;
    const b = document.getElementById('ad-fly'); b.classList.toggle('on', v); b.textContent = '✈️ Terbang: ' + (v ? 'ON' : 'OFF') + ' (F)';
  };
  document.getElementById('ad-fly').onclick = () => setFly(!flyMode);
  document.getElementById('ad-speed').oninput = (e) => { flySpeed = +e.target.value; document.getElementById('ad-spd').textContent = flySpeed; };
  document.getElementById('ad-god').onclick = (e) => { godMode = !godMode; e.target.classList.toggle('on', godMode); e.target.textContent = '🛡️ Anti-mati: ' + (godMode ? 'ON' : 'OFF'); };
  panel.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => {
    const d = (currentMap === 'snow' && snowWorld ? snowWorld.tp : { start: [0, 0.25, 0], hub: [0, 13.75, -68], top: [0, FIN_Y, -77], maze: [-2, FIN_Y, -85], finish: [WIN.x, FIN_Y, WIN.z] })[b.dataset.tp];
    character.position.set(...d); physics.velocityY = 0; moveVel.set(0, 0);
    if (gameState === 'GAMEOVER') { resetRunTimer(); reviveLocal(); gameState = 'PLAYING'; document.getElementById('overlay').style.display = 'none'; }
  });
  document.getElementById('ad-coin').onclick = () => {
    playerData.coins = (playerData.coins || 0) + 1000; updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins; showToast('🪙 +1000 koin');
  };
  document.getElementById('ad-crown-min').value = String(leaderboardMinCrowns);
  document.getElementById('ad-crown-save-min').onclick = async () => {
    const value = Math.max(0, Math.floor(Number(document.getElementById('ad-crown-min').value) || 0));
    try {
      await socialPatch('settings', { leaderboardMinCrowns: value });
      leaderboardMinCrowns = value;
      await refreshSoloLeaderboard(true);
      showToast(`✅ Minimal leaderboard: ${value} mahkota`);
    } catch (e) { showToast('Gagal menyimpan pengaturan mahkota'); }
  };
  document.getElementById('ad-crown-set').onclick = async () => {
    const key = document.getElementById('ad-crown-user').value.trim().toLowerCase();
    const count = Math.max(0, Math.floor(Number(document.getElementById('ad-crown-count').value) || 0));
    if (!/^[a-z0-9_]{3,15}$/.test(key)) { showToast('Masukkan username yang valid'); return; }
    try {
      const exists = await socialGet(`players/${key}`);
      if (!exists) { showToast('Username tidak ditemukan'); return; }
      await socialPatch(`players/${key}`, { crowns: count, crownsUpdatedAt: Date.now() });
      await socialPatch(`leaderboard/${key}`, { crowns: count });
      if (key === myPlayerKey()) { playerData.crowns = count; updateCrownProfileUI(); }
      await refreshSoloLeaderboard(true);
      showToast(`👑 Mahkota ${key} diatur menjadi ${count}`);
    } catch (e) { showToast('Gagal mengatur mahkota di Firebase'); }
  };
  const hold = (id, up) => {
    const el = document.getElementById(id), set = (v) => { if (up) flyUp = v; else flyDown = v; };
    el.onpointerdown = () => set(true);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => set(false)));
  };
  hold('fly-up', true); hold('fly-down', false);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyF' && gameState === 'PLAYING') setFly(!flyMode);
    if (e.code === 'Space') flyUp = true;
    if (e.code.startsWith('Shift')) flyDown = true;
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') flyUp = false; if (e.code.startsWith('Shift')) flyDown = false; });
}

function spawnDust(n) {
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.7 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mat);
    m.position.copy(character.position); m.position.y += 0.1;
    m.position.x += (Math.random() - 0.5) * 0.7; m.position.z += (Math.random() - 0.5) * 0.7;
    scene.add(m); trailParticles.push({ mesh: m, life: 0.5 });
  }
}

// ===== BADAN HANCUR (jatuh ke lava) — ikut tampil di layar pemain lain =====
const shardGeos = [new THREE.BoxGeometry(1, 1, 1), new THREE.CapsuleGeometry(0.4, 0.5, 2, 6), new THREE.TetrahedronGeometry(0.8), new THREE.SphereGeometry(0.5, 8, 6)];
const debris = [];
function spawnShatter(pos, eq) {
  if (!scene) return;
  const c = pickCostume(eq || {}), metal = c.baju.iron ? 0.75 : c.baju.thor ? 0.55 : 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const px = pos.x, py = pos.y, pz = pos.z;
  const groups = [ // [warna, jumlah, y0, y1, sebaran x, ukuran, logam]
    [c.hulk ? 0x57b84a : 0xffd1b3, 6, 2.0, 2.4, 0.15, 0.2, 0], [c.hulk ? 0x141a12 : 0xd1d1d6, 4, 2.3, 2.5, 0.15, 0.14, 0],
    [c.baju.color, 10, 1.0, 1.9, 0.3, 0.26, metal], [c.baju.color, 6, 1.2, 1.9, 0.55, 0.2, metal],
    [c.hulk ? 0x57b84a : 0xffd1b3, 2, 1.0, 1.4, 0.55, 0.16, 0], [c.celana.color, 8, 0.3, 0.9, 0.2, 0.22, 0], [c.sepatu.color, 4, 0.05, 0.3, 0.25, 0.2, 0]
  ];
  if (c.iron) groups.push([0xd4a017, 6, 1.0, 2.2, 0.4, 0.15, 0.8]);
  if (c.thor) groups.push([0xc9d1d9, 6, 1.0, 2.4, 0.4, 0.15, 0.85], [0xc0132b, 4, 1.2, 2.0, 0.4, 0.22, 0]);
  for (const [color, n, y0, y1, sx, size, mt] of groups) for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: mt, transparent: true, opacity: 1, envMap: mt && envTex ? envTex : null });
    const m = new THREE.Mesh(shardGeos[Math.floor(Math.random() * shardGeos.length)], mat), sc = size * rnd(0.7, 1.3);
    m.scale.set(sc * rnd(0.7, 1.3), sc * rnd(0.7, 1.3), sc * rnd(0.7, 1.3));
    m.position.set(px + rnd(-sx, sx), py + rnd(y0, y1), pz + rnd(-0.25, 0.25));
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(m);
    debris.push({ mesh: m, vx: (m.position.x - px) * 9 + rnd(-2, 2), vy: rnd(3, 10), vz: (m.position.z - pz) * 9 + rnd(-2, 2), rx: rnd(-12, 12), ry: rnd(-12, 12), rz: rnd(-12, 12), life: 1, sink: false });
  }
  while (debris.length > 160) { const o = debris.shift(); scene.remove(o.mesh); o.mesh.material.dispose(); }
  for (let i = 0; i < 14; i++) { // percikan lava
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7722 : 0xffcc33, transparent: true, opacity: 1 }));
    m.position.set(px, py + rnd(0, 1.5), pz);
    const ang = Math.random() * Math.PI * 2, sp = rnd(1.5, 5);
    m.userData = { vx: Math.cos(ang) * sp, vy: rnd(2, 7), vz: Math.sin(ang) * sp };
    scene.add(m); jumpParticles.push({ mesh: m, life: 1 });
  }
}
function updateDebris(delta) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i], m = d.mesh;
    if (d.sink) { m.position.y -= delta * 0.6; d.life -= delta * 1.6; }
    else {
      d.vy -= 22 * delta;
      m.position.x += d.vx * delta; m.position.y += d.vy * delta; m.position.z += d.vz * delta;
      m.rotation.x += d.rx * delta; m.rotation.y += d.ry * delta; m.rotation.z += d.rz * delta;
      if (m.position.y < -7.6) { m.position.y = -7.6; d.sink = true; }
      d.life -= delta * 0.35;
    }
    m.material.opacity = Math.min(1, d.life * 1.2);
    if (d.life <= 0) { scene.remove(m); m.material.dispose(); debris.splice(i, 1); }
  }
}
function shatterLocal() {
  if (!character || !character.visible) return;
  spawnShatter(character.position, myEquipped());
  character.visible = false;
  if (myRef) update(myRef, { deadAt: serverNow() }).catch(() => {});
}
function reviveLocal() {
  if (character) character.visible = true;
  if (myRef) update(myRef, { deadAt: null }).catch(() => {});
}

function tryAutoLandscape() {
  // Penguncian orientasi dicoba otomatis; browser tertentu hanya mengizinkannya
  // setelah interaksi pengguna atau saat mode fullscreen.
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      const result = screen.orientation.lock('landscape');
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  } catch (e) { /* orientasi otomatis tidak didukung browser */ }
}

function requestFullscreenAndLock() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().then(() => {
      tryAutoLandscape();
    }).catch(e => console.log(e));
  } else {
    tryAutoLandscape();
  }
}

function init3DGame() {
  if (renderer) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a24);
  scene.fog = new THREE.Fog(0x1a1a24, 20, 150);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  try { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) { console.warn('Env map gagal:', e); }
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 50, 10);
  sun.castShadow = true;
  scene.add(sun);

  // Map Lava visual dipisah ke lava.js agar modul map mudah dirawat.
  lavaMapVisuals = buildLavaMap(scene);
  lavaMat = lavaMapVisuals.lavaMat;

  const platformMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.8 });
  const breakableMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
  const movingMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.7 });
  const trapMat = new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.5 }); // Warna platform jebakan

  function createPlatform(x, y, z, width, depth, type = 'static', tell = 0, shape = 'box') {
    const height = 0.5;
    const geo = shape === 'box' ? new THREE.BoxGeometry(width, height, depth) : new THREE.CylinderGeometry(width / 2, width / 2, height, shape === 'hex' ? 6 : 32);
    const base = shape === 'round' ? roundMat : (shape === 'hex' ? hexMat : platformMat);
    let mat = base;
    if (type.includes('moving')) mat = movingMat;
    if (type === 'fake') {
      // Kotak palsu memakai tampilan material yang sama seperti kotak asli.
      // Tidak ada transparansi atau efek berkedip sebelum pemain mendekat.
      mat = base.clone();
      mat.transparent = false;
      mat.opacity = 1;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);

    platforms.push({ 
      mesh, width, depth, type, 
      startX: x, startY: y, startZ: z, 
      range: 2.5, speed: 1.5, phase: (platforms.length * 2.39996) % (Math.PI * 2), 
      isFallen: false, tell, revealTimer: 0, dx: 0, r: shape === 'round' ? width / 2 : (shape === 'hex' ? width * 0.45 : 0) 
    });
  }

  const roundMat = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.6 });
  const hexMat = new THREE.MeshStandardMaterial({ color: 0x5a3a7a, roughness: 0.6 });
  const hazMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe02030, emissive: 0x551018, roughness: 0.5 });

  // Palang berputar: lompati atau terpental
  function addSweeper(cx, py, cz, len, speed) {
    const barY = py + 0.25 + 0.65;
    const g = new THREE.Group(); g.position.set(cx, barY, cz); scene.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 16), hazMat); post.position.y = -0.325; g.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 12), redMat); bar.rotation.z = Math.PI / 2; g.add(bar);
    for (const sd of [-1, 1]) { const capE = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), hazMat); capE.position.x = sd * len / 2; g.add(capE); }
    let a = 0;
    hazards.push({
      update(t) { a = t * speed; g.rotation.y = -a; },
      test(pp) {
        const dx = pp.x - cx, dz = pp.z - cz, c = Math.cos(a), sn = Math.sin(a);
        const along = dx * c + dz * sn, perp = -dx * sn + dz * c;
        if (Math.abs(along) < len / 2 + 0.2 && Math.abs(perp) < 0.5 && pp.y < barY + 0.2 && pp.y + 1.9 > barY - 0.2) { const sg = perp >= 0 ? 1 : -1; return { x: -sn * sg, z: c * sg }; }
        return null;
      }
    });
  }

  // Bola berduri berayun
  function addPendulum(px, py, pz, axis, L = 4.4) {
    const pivotY = py + 0.25 + L + 0.8;
    const g = new THREE.Group(); g.position.set(px, pivotY, pz); scene.add(g);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 6), hazMat); rope.position.y = -L / 2; g.add(rope);
    const ball = new THREE.Group(); ball.position.y = -L; g.add(ball);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.6, roughness: 0.4 })));
    for (let i = 0; i < 14; i++) {
      const yy = 1 - (i / 13) * 2, rr = Math.sqrt(1 - yy * yy), ang = i * 2.399963;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), redMat);
      const dir = new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
      sp.position.copy(dir).multiplyScalar(0.72); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); ball.add(sp);
    }
    let th = 0;
    hazards.push({
      update(t) { th = 0.85 * Math.sin(t * 1.6 + px); if (axis === 'x') g.rotation.z = th; else g.rotation.x = -th; },
      test(pp) {
        const bx = px + (axis === 'x' ? L * Math.sin(th) : 0), by = pivotY - L * Math.cos(th), bz = pz + (axis === 'z' ? L * Math.sin(th) : 0);
        const cy = Math.min(Math.max(by, pp.y + 0.2), pp.y + 1.7);
        if (Math.hypot(pp.x - bx, cy - by, pp.z - bz) < 1.0) { const hx = pp.x - bx, hz = pp.z - bz, l = Math.hypot(hx, hz) || 1; return { x: hx / l, z: hz / l }; }
        return null;
      }
    });
  }

  // ============ JALUR PARKOUR DENGAN JEBAKAN KIRI/KANAN & LASER NPC ============
  createPlatform(0, 0, 0, 8, 8, 'static');         // Start
  createPlatform(0, 1.5, -8, 5, 5, 'static', 0, 'round'); addPendulum(0, 1.5, -8, 'x');
  
  // Jebakan Kiri / Kanan Pertama (Kiri jebakan jatuh, Kanan aman)
  createPlatform(-2.5, 3, -15, 3.5, 3.5, 'fake', 0.9);  // KOTAK PALSU (jelas)
  createPlatform(2.5, 3, -15, 3.5, 3.5, 'static');       // AMAN

  createPlatform(0, 4.5, -22, 6, 6, 'moving_x', 0, 'hex'); addPendulum(0, 4.5, -22, 'z');

  // Jebakan Tebak-tebakan Kedua (Kiri aman, Kanan jebakan jatuh)
  createPlatform(-2.5, 6, -29, 3.5, 3.5, 'static');      // AMAN
  createPlatform(2.5, 6, -29, 3.5, 3.5, 'fake', 0.6); // KOTAK PALSU (sedang)

  // 3 kotak: hanya kiri yang asli
  createPlatform(-3.5, 7.5, -36, 3, 5, 'static');
  createPlatform(0, 7.5, -36, 3, 5, 'fake', 0.4);
  createPlatform(3.5, 7.5, -36, 3, 5, 'fake', 0.4);
  
  // Area Laser NPC Tembak Otomatis
  createPlatform(0, 9, -44, 6, 6, 'static');
  
  // Buat Visual Laser Beam NPC
  const laserGeo = new THREE.BoxGeometry(7, 0.2, 0.2);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  laserBeam = new THREE.Mesh(laserGeo, laserMat);
  laserBeam.position.set(0, 9.3, -44);
  scene.add(laserBeam);
  [-3.6, 3.6].forEach(ex => {
    const em = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0x00ffff, emissiveIntensity: 0.6 }));
    em.position.set(ex, 9.6, LASER_Z); scene.add(em);
  });

  createPlatform(0, 10.5, -52, 5, 5, 'moving_y', 0, 'round');
  // Jembatan kaca: tiap baris 1 asli, 1 palsu (hampir tak terlihat, cuma sesekali berkedip)
  createPlatform(-2, 12, -58, 3.2, 2.5, 'static'); createPlatform(2, 12, -58, 3.2, 2.5, 'fake', 0.15);
  createPlatform(-2, 12, -61.5, 3.2, 2.5, 'fake', 0.05); createPlatform(2, 12, -61.5, 3.2, 2.5, 'static');
  createPlatform(0, 13.5, -68, 8, 8, 'static');
  const checkMat = new THREE.MeshStandardMaterial({ color: 0x22aa55, emissive: 0x22aa55, emissiveIntensity: 0.4 });
  usedCheckpointMat = new THREE.MeshStandardMaterial({ color: 0x666677, emissive: 0x222233, emissiveIntensity: 0.12, roughness: 0.85 });
  const markCheckpoint = () => { const c = platforms[platforms.length - 1]; c.checkpoint = true; c.checkpointActivated = false; c.checkpointReadyMaterial = checkMat; c.mesh.material = checkMat; };
  markCheckpoint(); // Hub = checkpoint

  // ===== TOWER SPIRAL ala obby Roblox: muter naik ke atas =====
  const TC = { x: 0, z: -77 }, TR = 9, TN = 58, TDY = 1.1, TDA = 0.55;
  let ty = 13.5, ta = Math.PI / 2;
  const SH = ['box', 'round', 'hex'];
  const tHash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
  for (let i = 1; i <= TN; i++) {
    ta += TDA; ty += TDY;
    const rx = Math.cos(ta), rz = Math.sin(ta), cx = TC.x + rx * TR, cz = TC.z + rz * TR;
    const hard = i > 29; // paruh atas: kotak palsu nyaris identik, pilihan 3 jalur, bola berduri, kotak asli yang ikut berkedip (pengecoh)
    const tell = hard ? 0.02 : Math.max(0.05, 0.5 - i * 0.015);
    const sh = SH[i % 3], w = sh === 'box' ? 3.2 : 3.6;
    const choice = (n, gap) => {
      const real = Math.floor(tHash(i) * n); // posisi kotak asli acak tapi tetap (bisa dihafal)
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * gap;
        createPlatform(TC.x + rx * (TR + off), ty, TC.z + rz * (TR + off), w, w, k === real ? 'static' : 'fake', tell, sh);
      }
    };
    if (i % 5 === 0) {
      choice(hard ? 3 : 2, hard ? 3.8 : 5.6);
    } else if (i % 8 === 0) {
      createPlatform(cx, ty, cz, 4, 4, 'static', 0, 'round'); markCheckpoint();
    } else if (i % 11 === 6) {
      createPlatform(cx, ty, cz, 5.4, 5.4, 'static', 0, 'round'); addSweeper(cx, ty, cz, 4.6, 1.5 + i * 0.02);
    } else if (hard && i % 9 === 4) {
      createPlatform(cx, ty, cz, 4.4, 4.4, 'static', 0, 'round'); addPendulum(cx, ty, cz, i % 2 ? 'x' : 'z');
    } else if (hard && i % 7 === 2) {
      choice(2, 5.6);
    } else if (i % 7 === 3) {
      createPlatform(cx, ty, cz, w, w, 'moving_y', 0, sh); platforms[platforms.length - 1].range = hard ? 1.4 : 0.9;
    } else {
      createPlatform(cx, ty, cz, w, w, 'static', 0, sh);
      if (hard && i % 3 === 1) {
        const d = platforms[platforms.length - 1];
        d.decoy = true;
        d.mesh.material = d.mesh.material.clone();
        d.mesh.material.transparent = false;
        d.mesh.material.opacity = 1;
      }
    }
  }
  createPlatform(TC.x + Math.cos(ta) * 6.3, ty + 0.55, TC.z + Math.sin(ta) * 6.3, 3, 3, 'static'); // penghubung
  const FY = ty + 1.1; FIN_Y = FY + 0.25;
  createPlatform(TC.x, FY, TC.z, 8, 8, 'static'); // PUNCAK / FINISH
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, FY - 12.25, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a3a }));
  pillar.position.set(TC.x, (12 + FY - 0.25) / 2, TC.z); scene.add(pillar);
  { const tp = platforms.find(pl => Math.abs(pl.mesh.position.x - TC.x) < 0.01 && Math.abs(pl.mesh.position.z - TC.z) < 0.01 && Math.abs(pl.mesh.position.y - FY) < 0.01); if (tp) { tp.checkpoint = true; tp.checkpointActivated = false; tp.checkpointReadyMaterial = checkMat; tp.mesh.material = checkMat; } }

  // ===== LABIRIN DI ATAS TOWER (salah lorong = ditembak NPC) =====
  const MN = 12, CS = 4, mcx = 0, MH = MN * CS / 2, mcz = -89 - MH, wallH = 7, floorTop = FY + 0.25, EC = Math.floor(MN / 2) - 1;
  MAZE_H = MH; MAZE_Z = mcz;
  WIN = { x: mcx - MH + CS / 2 + CS * (EC + 1), y: FY, z: mcz - MH - 4 };
  createPlatform(mcx - MH + CS / 2 + CS * EC, FY, -85, 4, 8, 'static'); markCheckpoint(); // jembatan = checkpoint
  createPlatform(mcx, FY, mcz, 2 * MH, 2 * MH, 'static');   // lantai labirin
  createPlatform(WIN.x, FY, WIN.z, 8, 8, 'static'); // area finish setelah labirin

  const cells = [];
  for (let r = 0; r < MN; r++) { cells[r] = []; for (let c = 0; c < MN; c++) cells[r][c] = { n: true, e: true, s: true, w: true, v: false }; }
  let seed = 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stack = [[0, EC]]; cells[0][EC].v = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1], nb = [];
    if (r > 0 && !cells[r - 1][c].v) nb.push([r - 1, c, 'n', 's']);
    if (r < MN - 1 && !cells[r + 1][c].v) nb.push([r + 1, c, 's', 'n']);
    if (c > 0 && !cells[r][c - 1].v) nb.push([r, c - 1, 'w', 'e']);
    if (c < MN - 1 && !cells[r][c + 1].v) nb.push([r, c + 1, 'e', 'w']);
    if (!nb.length) { stack.pop(); continue; }
    const [nr, nc, d1, d2] = nb[Math.floor(rnd() * nb.length)];
    cells[r][c][d1] = false; cells[nr][nc][d2] = false; cells[nr][nc].v = true; stack.push([nr, nc]);
  }
  cells[0][EC].n = false; cells[MN - 1][EC + 1].s = false; // pintu masuk & keluar

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5b6180, roughness: 0.8 });
  const addWall = (x, z, w, d) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    mesh.position.set(x, floorTop + wallH / 2, z); scene.add(mesh);
    platforms.push({ mesh, width: w, depth: d, type: 'wall', hh: wallH / 2, startX: x, startY: mesh.position.y, startZ: z, range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: 0 });
  };
  const cxOf = (c) => mcx - MH + CS / 2 + CS * c, czOf = (r) => mcz + MH - CS / 2 - CS * r;
  for (let r = 0; r < MN; r++) for (let c = 0; c < MN; c++) {
    const k = cells[r][c], x = cxOf(c), z = czOf(r);
    if (r === 0 && k.n) addWall(x, z + 2, CS + 0.6, 0.6);
    if (c === 0 && k.w) addWall(x - 2, z, 0.6, CS + 0.6);
    if (k.s) addWall(x, z - 2, CS + 0.6, 0.6);
    if (k.e) addWall(x + 2, z, 0.6, CS + 0.6);
  }

  // Atap labirin menutup pandangan dari luar, tetapi tidak mengubah jalur/collision maze.
  const mazeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(2 * MH + 1.2, 0.55, 2 * MH + 1.2),
    new THREE.MeshStandardMaterial({ color: 0x241b22, roughness: 0.92, metalness: 0.12 })
  );
  mazeRoof.position.set(mcx, floorTop + wallH + 0.3, mcz);
  mazeRoof.receiveShadow = true; mazeRoof.castShadow = true; scene.add(mazeRoof);
  const roofGlow = new THREE.Mesh(
    new THREE.BoxGeometry(2 * MH - 1.5, 0.08, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xff4b12 })
  );
  roofGlow.position.set(mcx, floorTop + wallH + 0.02, mcz);
  scene.add(roofGlow);

  // jalur benar (BFS pintu masuk -> keluar); semua sel di luar jalur = lorong salah
  const key = (r, c) => r + ',' + c;
  const nbrs = (r, c) => { const o = [], k = cells[r][c]; if (!k.n && r > 0) o.push([r - 1, c]); if (!k.s && r < MN - 1) o.push([r + 1, c]); if (!k.w && c > 0) o.push([r, c - 1]); if (!k.e && c < MN - 1) o.push([r, c + 1]); return o; };
  const prev = { [key(0, EC)]: null }, bq = [[0, EC]];
  while (bq.length) { const [r, c] = bq.shift(); for (const [nr, nc] of nbrs(r, c)) if (!(key(nr, nc) in prev)) { prev[key(nr, nc)] = [r, c]; bq.push([nr, nc]); } }
  const onPath = new Set(); for (let cur = [MN - 1, EC + 1]; cur; cur = prev[key(cur[0], cur[1])]) onPath.add(key(cur[0], cur[1]));
  // checkpoint di tengah labirin (1/3 dan 2/3 jalur benar) supaya tidak mulai dari awal terus
  const pathArr = [...onPath].map(sk => sk.split(',').map(Number)).reverse();
  [Math.floor(pathArr.length / 3), Math.floor(pathArr.length * 2 / 3)].forEach(ix => {
    const [pr, pc] = pathArr[ix];
    createPlatform(cxOf(pc), FY + 0.01, czOf(pr), 2.4, 2.4, 'static', 0, 'round');
    const pd = platforms.pop(); platforms.unshift(pd); pd.checkpoint = true; pd.checkpointActivated = false; pd.checkpointReadyMaterial = checkMat; pd.mesh.material = checkMat;
  });

  // NPC penembak berdiri di ujung buntu tiap cabang lorong salah
  const AIM_TIME = 1.1;
  function makeGuard(gx, gz, set) {
    const g = new THREE.Group(); g.position.set(gx, floorTop, gz); scene.add(g);
    const armor = new THREE.MeshStandardMaterial({ color: 0x1f2740, metalness: 0.5, roughness: 0.4 });
    const add = (geo, mat, x, y, z, par = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
    add(new THREE.CapsuleGeometry(0.3, 0.8, 4, 12), armor, 0, 1.4, 0);
    add(new THREE.SphereGeometry(0.28, 20, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a35, metalness: 0.4 }), 0, 2.4, 0);
    add(new THREE.BoxGeometry(0.4, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2200 }), 0, 2.42, 0.22);
    for (const sd of [-1, 1]) add(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), armor, sd * 0.15, 0.5, 0);
    add(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), armor, -0.42, 1.55, 0);
    const armR = new THREE.Group(); armR.position.set(0.4, 1.95, 0); armR.rotation.x = -1.45; g.add(armR);
    add(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), armor, 0, -0.35, 0, armR);
    add(new THREE.BoxGeometry(0.13, 0.36, 0.16), new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.7 }), 0, -0.82, 0, armR);
    const muzzle = add(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x66f6ff }), 0, -1.02, 0, armR);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.9 }));
    beam.visible = false; scene.add(beam);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const setBeam = (pp, rad) => { muzzle.getWorldPosition(A); B.set(pp.x, pp.y + 1.2, pp.z); D.subVectors(B, A); const len = D.length() || 0.01; beam.position.copy(A).addScaledVector(D, 0.5); beam.scale.set(rad, len, rad); beam.quaternion.setFromUnitVectors(UP, D.normalize()); };
    let state = 'idle', timer = 0;
    return {
      reset() { state = 'idle'; timer = 0; beam.visible = false; },
      update(delta, pp, t, canKill) {
        const col = Math.floor((pp.x - (mcx - MH)) / CS), row = Math.floor(((mcz + MH) - pp.z) / CS);
        const inside = pp.y > FY - 1 && pp.y < FY + 4 && set.has(key(row, col));
        if (state === 'idle') {
          g.rotation.y = Math.sin(t * 0.8 + gx) * 0.5;
          if (inside) { // salah jalan: NPC langsung menembak, tanpa jeda bidik
            g.rotation.y = Math.atan2(pp.x - gx, pp.z - gz);
            state = 'fire'; timer = 0; setBeam(pp, 0.12); beam.material.color.setHex(0x66f6ff); beam.visible = true;
            showToast('🔫 Salah lorong!');
            return canKill;
          }
          return false;
        }
        let df = Math.atan2(pp.x - gx, pp.z - gz) - g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
        g.rotation.y += df * (1 - Math.exp(-delta * 10));
        timer += delta;
        if (state === 'aim') {
          if (!inside) { this.reset(); return false; }
          setBeam(pp, 0.03); beam.material.color.setHex(0xff2200); beam.visible = Math.sin(timer * 30) > -0.3;
          if (timer >= AIM_TIME) { state = 'fire'; timer = 0; setBeam(pp, 0.12); beam.material.color.setHex(0x66f6ff); beam.visible = true; return canKill; }
        } else if (state === 'fire') {
          setBeam(pp, 0.12);
          if (timer > 0.35) this.reset();
        }
        return false;
      }
    };
  }
  const seen = new Set();
  for (const pk of onPath) {
    const [pr, pc] = pk.split(',').map(Number);
    for (const [r0, c0] of nbrs(pr, pc)) {
      if (onPath.has(key(r0, c0)) || seen.has(key(r0, c0))) continue;
      const set = new Set([key(r0, c0)]), dq = [[r0, c0, 0]]; let deep = [r0, c0, 0]; seen.add(key(r0, c0));
      while (dq.length) {
        const [r, c, d] = dq.shift(); if (d > deep[2]) deep = [r, c, d];
        for (const [nr, nc] of nbrs(r, c)) if (!onPath.has(key(nr, nc)) && !set.has(key(nr, nc))) { set.add(key(nr, nc)); seen.add(key(nr, nc)); dq.push([nr, nc, d + 1]); }
      }
      guards.push(makeGuard(cxOf(deep[1]), czOf(deep[0]), set));
    }
  }
      // Puncak / Finish

  // FINISH LINE
  const finishLine = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1 }));
  finishLine.position.set(WIN.x, FY + 0.3, WIN.z); scene.add(finishLine);

  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), poleMat); leftPole.position.set(WIN.x - 4, FY + 3, WIN.z); scene.add(leftPole);
  const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), poleMat); rightPole.position.set(WIN.x + 4, FY + 3, WIN.z); scene.add(rightPole);

  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 15; ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#00ff00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PUTZZDEV MENGAKUI', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = 'bold 90px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('KAMU JAGO!', canvas.width / 2, canvas.height / 2 + 50);

  const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, emissive: 0x00ff00, emissiveIntensity: 0.2 }));
  board.position.set(WIN.x, FY + 4, WIN.z); scene.add(board);

  // Pisahkan arena parkour dari area lobby. Seluruh logika arena tetap utuh;
  // hanya visibilitas grup yang berganti saat pemain menekan MULAI.
  parkourWorldGroup = new THREE.Group();
  parkourWorldGroup.name = 'PARKOUR_WORLD';
  [...scene.children].forEach(obj => { scene.remove(obj); parkourWorldGroup.add(obj); });
  scene.add(parkourWorldGroup);
  parkourWorldGroup.visible = false;
  lavaWorld = { platforms, hazards, guards, laserBeam, FIN_Y, WIN, MAZE_H, MAZE_Z };
  try { const builtSnow = buildSnowWorld(THREE, scene, { runElapsedMs, insidePlat, showToast }); snowWorld = builtSnow.world; snowWorldGroup = builtSnow.group; snowController = builtSnow.controller; } catch (e) { console.error('Map Salju gagal dibuat, hanya Lava yang aktif:', e); snowWorld = null; snowController = null; if (snowWorldGroup) { scene.remove(snowWorldGroup); snowWorldGroup = null; } }
  try { const builtAngkasa = buildAngkasaWorld(THREE, scene, { showToast }); angkasaWorld = builtAngkasa.world; angkasaWorldGroup = builtAngkasa.group; angkasaController = builtAngkasa.controller; } catch (e) { console.error('Map Angkasa gagal dibuat:', e); angkasaWorld = null; angkasaController = null; if (angkasaWorldGroup) { scene.remove(angkasaWorldGroup); angkasaWorldGroup = null; } }

  lobbyWorldGroup = new THREE.Group();
  lobbyWorldGroup.name = 'FREE_FIRE_STYLE_LOBBY';
  scene.add(lobbyWorldGroup);
  lobbyWorldGroup.add(new THREE.HemisphereLight(0xd9e9ff, 0x182039, 1.25));
  const lobbyKey = new THREE.DirectionalLight(0xffffff, 1.8); lobbyKey.position.set(-7, 14, 9); lobbyKey.castShadow = true; lobbyWorldGroup.add(lobbyKey);
  const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x202b45, metalness: 0.35, roughness: 0.62 });
  const lobbyFloor = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 0.7, 64), lobbyFloorMat);
  lobbyFloor.position.y = -0.38; lobbyFloor.receiveShadow = true; lobbyFloor.castShadow = true; lobbyWorldGroup.add(lobbyFloor);
  const lobbyInner = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.12, 64), new THREE.MeshStandardMaterial({ color: 0x34486c, metalness: 0.45, roughness: 0.42 }));
  lobbyInner.position.y = 0.02; lobbyInner.receiveShadow = true; lobbyWorldGroup.add(lobbyInner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15.5, 0.12, 12, 96), new THREE.MeshBasicMaterial({ color: 0x42d9ff }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.08; lobbyWorldGroup.add(rim);
  lobbyAccentRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.045, 10, 64), new THREE.MeshBasicMaterial({ color: 0xb36bff }));
  lobbyAccentRing.rotation.x = Math.PI / 2; lobbyAccentRing.position.set(0, 0.12, 0); lobbyWorldGroup.add(lobbyAccentRing);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 0.8), new THREE.MeshStandardMaterial({ color: 0x10182b, metalness: 0.25, roughness: 0.7 }));
  backWall.position.set(0, 4.1, -10); lobbyWorldGroup.add(backWall);
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
  const signCtx = signCanvas.getContext('2d');
  signCtx.fillStyle = '#10182b'; signCtx.fillRect(0, 0, 1024, 256);
  signCtx.strokeStyle = '#42d9ff'; signCtx.lineWidth = 12; signCtx.strokeRect(12, 12, 1000, 232);
  signCtx.textAlign = 'center'; signCtx.textBaseline = 'middle'; signCtx.font = 'bold 100px sans-serif'; signCtx.fillStyle = '#ffffff'; signCtx.fillText('PARKOUR 3D', 512, 112);
  signCtx.font = 'bold 34px sans-serif'; signCtx.fillStyle = '#42d9ff'; signCtx.fillText('LOBBY', 512, 194);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 5.3, -9.55); lobbyWorldGroup.add(sign);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), new THREE.MeshStandardMaterial({ color: 0x293957, metalness: 0.55, roughness: 0.35 }));
    pillar.position.set(side * 10, 2.7, -7); lobbyWorldGroup.add(pillar);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.12, 1.28), new THREE.MeshBasicMaterial({ color: side < 0 ? 0x42d9ff : 0xb36bff }));
    glow.position.set(side * 10, 4.5, -7); lobbyWorldGroup.add(glow);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.45, 32), new THREE.MeshStandardMaterial({ color: 0x34486c, metalness: 0.5, roughness: 0.35 }));
    pad.position.set(side * 5.3, 0.25, -1.2); lobbyWorldGroup.add(pad);
  }
  const lobbyMark = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshBasicMaterial({ color: 0x172744 }));
  lobbyMark.rotation.x = -Math.PI / 2; lobbyMark.position.y = 0.095; lobbyWorldGroup.add(lobbyMark);
  lobbyWorldGroup.visible = true;
  scene.background = new THREE.Color(0x10182b); scene.fog = null;

  character = new THREE.Group();
  character.position.set(0, 0.25, 0);
  scene.add(character);

  physics = { velocityY: 0, isGrounded: true, gravity: -32, jumpForce: 13, coyoteTime: 0, jumpCount: 0, maxJumps: 2 };

  const matSkin = new THREE.MeshStandardMaterial({ color: 0xffd1b3 });
  const matShirt = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
  const matPants = new THREE.MeshStandardMaterial({ color: 0x1a1a1c });
  const matShoe = new THREE.MeshStandardMaterial({ color: 0xa61c2b });
  const matEyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const matPupil = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const matHair = new THREE.MeshStandardMaterial({ color: 0xd1d1d6, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 16, 48), matShirt); torso.position.y = 1.4; torso.castShadow = true; torso.userData.type = 'baju'; character.add(torso);
  headGroup = new THREE.Group(); headGroup.position.y = 2.2; character.add(headGroup);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), matSkin); head.userData.type = 'kulit'; head.castShadow = true; headGroup.add(head);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); leftEye.position.set(-0.1, 0.05, 0.27); headGroup.add(leftEye);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); leftPupil.position.set(-0.1, 0.05, 0.31); headGroup.add(leftPupil);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); rightEye.position.set(0.1, 0.05, 0.27); headGroup.add(rightEye);
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); rightPupil.position.set(0.1, 0.05, 0.31); headGroup.add(rightPupil);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 16), matSkin); nose.userData.type = 'kulit'; nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.02, 0.3); headGroup.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), matPupil); mouth.position.set(0, -0.12, 0.28); headGroup.add(mouth);

  const hairGroup = new THREE.Group(); headGroup.add(hairGroup);
  const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.6), matHair); baseHair.position.y = 0.02; baseHair.castShadow = true; hairGroup.add(baseHair);
  const bangGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
  const bangLeft = new THREE.Mesh(bangGeo, matHair); bangLeft.position.set(-0.15, 0.15, 0.24); bangLeft.rotation.set(0.2, 0, -0.3); hairGroup.add(bangLeft);
  const bangCenter = new THREE.Mesh(bangGeo, matHair); bangCenter.position.set(0, 0.2, 0.27); bangCenter.rotation.set(0.1, 0, 0); bangCenter.scale.set(1.2, 1, 1.2); hairGroup.add(bangCenter);
  const bangRight = new THREE.Mesh(bangGeo, matHair); bangRight.position.set(0.15, 0.15, 0.24); bangRight.rotation.set(0.2, 0, 0.3); hairGroup.add(bangRight);
  hairGroup.traverse(o => { if (o.isMesh) o.userData.type = 'rambut'; });

  const makeArm = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.8, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 10, 28), matShirt); up.position.y = -0.22; up.castShadow = true; up.userData.type = 'baju'; pivot.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -0.42; pivot.add(elbow);
    const low = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.25, 10, 28), matShirt); low.position.y = -0.2; low.castShadow = true; low.userData.type = 'baju'; elbow.add(low);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 24), matSkin); hand.userData.type = 'kulit'; hand.userData.hand = true; hand.position.y = -0.43; elbow.add(hand);
    return { pivot, elbow };
  };
  const makeLeg = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.9, 0);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.21, 10, 28), matPants); th.position.y = -0.2; th.castShadow = true; th.userData.type = 'celana'; pivot.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 10, 28), matPants); sh.position.y = -0.2; sh.castShadow = true; sh.userData.type = 'celana'; knee.add(sh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.35), matShoe); shoe.position.set(0, -0.41, 0.05); shoe.userData.type = 'sepatu'; knee.add(shoe);
    return { pivot, knee };
  };
  const la = makeArm(-0.4), ra = makeArm(0.4), ll = makeLeg(-0.15), rl = makeLeg(0.15);
  leftArmPivot = la.pivot; leftElbow = la.elbow; rightArmPivot = ra.pivot; rightElbow = ra.elbow;
  leftLegPivot = ll.pivot; leftKnee = ll.knee; rightLegPivot = rl.pivot; rightKnee = rl.knee;

  // "rig" membungkus badan: bisa miring, memantul & squash tanpa mengubah posisi kaki/collision
  rig = new THREE.Group();
  [torso, headGroup, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot].forEach(o => rig.add(o));
  character.add(rig);

  // ===== AKSESORIS & KOSTUM SPIDERMAN =====
  const accMat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const A = (id, parent) => { const g = new THREE.Group(); g.visible = false; parent.add(g); acc[id] = g; return g; };

  const mask = A('aks_topeng_spider', headGroup);
  mk(new THREE.SphereGeometry(0.36, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, map: getWebTex(0xd91e2b), roughness: 0.6 }), 0, 0.02, -0.01, mask);
  for (const s of [-1, 1]) {
    const o = mk(new THREE.SphereGeometry(0.1, 16, 12), accMat(0x111111), s * 0.13, 0.07, 0.335, mask); o.scale.set(1.5, 1, 0.35); o.rotation.z = -s * 0.4;
    const l = mk(new THREE.SphereGeometry(0.085, 16, 12), accMat(0xffffff, { emissive: 0x444444 }), s * 0.13, 0.07, 0.35, mask); l.scale.set(1.35, 0.85, 0.35); l.rotation.z = -s * 0.4;
  }
  const gl = A('aks_kacamata', headGroup);
  for (const s of [-1, 1]) mk(new THREE.BoxGeometry(0.16, 0.09, 0.03), accMat(0x111111), s * 0.1, 0.05, 0.335, gl);
  mk(new THREE.BoxGeometry(0.06, 0.02, 0.03), accMat(0x111111), 0, 0.07, 0.335, gl);

  const cap = A('aks_topi', headGroup);
  mk(new THREE.SphereGeometry(0.335, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), accMat(0xe53935), 0, 0.04, 0, cap);
  const brim = mk(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), accMat(0xb71c1c), 0, 0.12, 0.28, cap); brim.scale.set(1, 1, 0.8);

  const crown = A('aks_mahkota', headGroup), gold = accMat(0xffd700, { metalness: 0.7, roughness: 0.3 });
  mk(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 20), gold, 0, 0.38, 0, crown);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mk(new THREE.ConeGeometry(0.05, 0.16, 8), gold, Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2, crown); }

  capePivot = A('aks_jubah', rig); capePivot.position.set(0, 1.95, -0.3);
  mk(new THREE.BoxGeometry(0.7, 1.1, 0.05), accMat(0xc0132b, { side: THREE.DoubleSide }), 0, -0.55, 0, capePivot);

  spiderLogoGrp = new THREE.Group(); spiderLogoGrp.visible = false; rig.add(spiderLogoGrp);
  const logoMat = new THREE.MeshBasicMaterial({ map: makeSpiderLogoTex(), transparent: true, depthWrite: false });
  const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), logoMat); lf.position.set(0, 1.62, 0.305); spiderLogoGrp.add(lf);
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), logoMat); lb.position.set(0, 1.62, -0.305); lb.rotation.y = Math.PI; spiderLogoGrp.add(lb);

  // ===== BATMAN =====
  const cowl = A('aks_topeng_batman', headGroup), cowlMat = accMat(0x15151c, { roughness: 0.5 });
  mk(new THREE.SphereGeometry(0.35, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58), cowlMat, 0, 0.02, -0.01, cowl);
  for (const sd of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(0.07, 0.3, 8), cowlMat, sd * 0.17, 0.4, 0, cowl); ear.rotation.z = -sd * 0.15;
    const eye = mk(new THREE.SphereGeometry(0.07, 12, 8), accMat(0xffffff, { emissive: 0xaaaaaa }), sd * 0.12, 0.07, 0.34, cowl); eye.scale.set(1.5, 0.6, 0.3); eye.rotation.z = sd * 0.35;
  }
  batGrp = new THREE.Group(); batGrp.visible = false; rig.add(batGrp);
  const yel = accMat(0xf5c400, { metalness: 0.3 });
  mk(new THREE.CylinderGeometry(0.315, 0.315, 0.09, 24), yel, 0, 1.05, 0, batGrp);
  mk(new THREE.BoxGeometry(0.1, 0.1, 0.03), yel, 0, 1.05, 0.32, batGrp);
  const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), new THREE.MeshBasicMaterial({ map: makeBatLogoTex(), transparent: true, depthWrite: false }));
  bl.position.set(0, 1.62, 0.305); batGrp.add(bl);
  capeB = new THREE.Group(); capeB.position.set(0, 1.95, -0.3); batGrp.add(capeB);
  mk(new THREE.BoxGeometry(0.7, 1.15, 0.05), accMat(0x15151c, { side: THREE.DoubleSide }), 0, -0.575, 0, capeB);

  // ===== IRONMAN (armor penuh: helm, reaktor arc, bahu emas) =====
  const ironRed = accMat(0xb01020, { metalness: 0.75, roughness: 0.28 }), ironGold = accMat(0xd4a017, { metalness: 0.8, roughness: 0.25 });
  ironHelm = new THREE.Group(); ironHelm.visible = false; headGroup.add(ironHelm);
  mk(new THREE.SphereGeometry(0.36, 32, 24), ironRed, 0, 0.02, -0.01, ironHelm);
  const ifc = mk(new THREE.SphereGeometry(0.3, 24, 18), ironGold, 0, -0.02, 0.25, ironHelm); ifc.scale.set(0.78, 0.95, 0.45);
  for (const sd of [-1, 1]) { const ey = mk(new THREE.BoxGeometry(0.11, 0.03, 0.02), accMat(0xffffff, { emissive: 0xbfefff, emissiveIntensity: 1 }), sd * 0.1, 0.06, 0.372, ironHelm); ey.rotation.z = sd * 0.2; }
  ironBody = new THREE.Group(); ironBody.visible = false; rig.add(ironBody);
  const reactor = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshBasicMaterial({ color: 0x9ff3ff })); reactor.position.set(0, 1.62, 0.31); ironBody.add(reactor);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 8, 24), ironGold); rg.position.set(0, 1.62, 0.31); ironBody.add(rg);
  for (const sd of [-1, 1]) mk(new THREE.SphereGeometry(0.13, 16, 12), ironGold, sd * 0.4, 1.95, 0, ironBody);
  mk(new THREE.CylinderGeometry(0.315, 0.315, 0.08, 24), ironGold, 0, 1.05, 0, ironBody);

  // ===== HD: detail tambahan semua kostum + THOR =====
  ironRed.envMap = envTex; ironGold.envMap = envTex; yel.envMap = envTex; ironRed.envMapIntensity = ironGold.envMapIntensity = 1.1;
  costumeParts.spider.push(spiderLogoGrp); costumeParts.bat.push(batGrp); costumeParts.iron.push(ironHelm, ironBody);
  const grp = (parent, list) => { const g = new THREE.Group(); g.visible = false; parent.add(g); list.push(g); return g; };
  const steel = accMat(0xc9d1d9, { metalness: 0.9, roughness: 0.22, envMap: envTex, envMapIntensity: 1 });
  const darkSteel = accMat(0x4b525c, { metalness: 0.85, roughness: 0.35, envMap: envTex, envMapIntensity: 0.9 });
  const leather = accMat(0x4a2f1b, { roughness: 0.8 });
  const blackSuit = accMat(0x101016, { roughness: 0.55 });
  const glowBlue = accMat(0x4aa8ff, { emissive: 0x4aa8ff, emissiveIntensity: 1.6 });

  for (const [el, sd] of [[leftElbow, -1], [rightElbow, 1]]) {
    // Spiderman: web-shooter di pergelangan
    const ws = grp(el, costumeParts.spider);
    mk(new THREE.CylinderGeometry(0.092, 0.092, 0.1, 20), accMat(0x2b2b33, { metalness: 0.5 }), 0, -0.33, 0, ws);
    mk(new THREE.SphereGeometry(0.03, 10, 8), accMat(0xffffff, { emissive: 0xaaddff, emissiveIntensity: 0.8 }), 0, -0.33, 0.085, ws);
    // Ironman: sarung tangan emas + repulsor
    const ig = grp(el, costumeParts.iron);
    mk(new THREE.CylinderGeometry(0.098, 0.088, 0.3, 28), ironGold, 0, -0.22, 0, ig);
    mk(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 28), ironRed, 0, -0.06, 0, ig);
    mk(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0x9ff3ff }), 0, -0.47, 0.088, ig);
    // Batman: gauntlet + sirip
    const bg = grp(el, costumeParts.bat);
    mk(new THREE.CylinderGeometry(0.095, 0.09, 0.3, 24), blackSuit, 0, -0.22, 0, bg);
    for (let i = 0; i < 3; i++) { const fin = mk(new THREE.BoxGeometry(0.015, 0.07, 0.12), blackSuit, 0, -0.14 - i * 0.07, -0.13, bg); fin.rotation.x = 0.4; }
    // Thor: bracer baja
    const tg = grp(el, costumeParts.thor);
    mk(new THREE.CylinderGeometry(0.1, 0.09, 0.24, 28), steel, 0, -0.26, 0, tg);
    const br = mk(new THREE.TorusGeometry(0.1, 0.012, 8, 28), darkSteel, 0, -0.14, 0, tg); br.rotation.x = Math.PI / 2;
  }
  // Batman: kantong sabuk utilitas
  for (let i = -2; i <= 2; i++) { const a = i * 0.32, p = mk(new THREE.BoxGeometry(0.1, 0.1, 0.07), yel, Math.sin(a) * 0.335, 1.05, Math.cos(a) * 0.335, batGrp); p.rotation.y = a; }
  // Ironman: pelat perut
  for (let i = 0; i < 3; i++) mk(new THREE.BoxGeometry(0.26 - i * 0.03, 0.05, 0.04), ironGold, 0, 1.38 - i * 0.1, 0.285, ironBody);

  // THOR: helm bersayap
  thorHelm = grp(headGroup, costumeParts.thor);
  mk(new THREE.SphereGeometry(0.36, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.4), steel, 0, 0.02, -0.01, thorHelm);
  const hrim = mk(new THREE.TorusGeometry(0.342, 0.022, 10, 48), darkSteel, 0, 0.131, -0.01, thorHelm); hrim.rotation.x = Math.PI / 2;
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = mk(new THREE.ConeGeometry(0.055, 0.42 - i * 0.06, 8), steel, sd * (0.4 + i * 0.01), 0.2 + i * 0.045, -0.02, thorHelm);
    w.rotation.z = -sd * (1.15 + i * 0.22); w.scale.z = 0.35;
  }
  // THOR: zirah dada, bahu, sabuk
  thorBody = grp(rig, costumeParts.thor);
  for (const sd of [-1, 1]) {
    const disc = mk(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 32), steel, sd * 0.125, 1.7, 0.285, thorBody); disc.rotation.x = Math.PI / 2;
    const dr = mk(new THREE.TorusGeometry(0.095, 0.012, 8, 32), darkSteel, sd * 0.125, 1.7, 0.3, thorBody);
    const pd = mk(new THREE.SphereGeometry(0.135, 24, 16), steel, sd * 0.4, 1.95, 0, thorBody); pd.scale.set(1, 0.8, 1.1);
  }
  const emb = mk(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), darkSteel, 0, 1.52, 0.285, thorBody); emb.rotation.x = Math.PI / 2;
  mk(new THREE.CylinderGeometry(0.315, 0.315, 0.1, 32), leather, 0, 1.05, 0, thorBody);
  mk(new THREE.BoxGeometry(0.1, 0.09, 0.03), steel, 0, 1.05, 0.318, thorBody);
  // THOR: jubah merah
  capeT = new THREE.Group(); capeT.visible = false; capeT.position.set(0, 1.95, -0.3); rig.add(capeT); costumeParts.thor.push(capeT);
  mk(new THREE.BoxGeometry(0.78, 1.3, 0.05), accMat(0xc0132b, { side: THREE.DoubleSide, roughness: 0.85 }), 0, -0.65, 0, capeT);
  // THOR: palu Mjolnir di tangan kanan
  const hammer = grp(rightElbow, costumeParts.thor); hammer.position.set(0, -0.43, 0.04); hammer.rotation.x = -0.25;
  mk(new THREE.CylinderGeometry(0.026, 0.026, 0.66, 14), leather, 0, 0.2, 0, hammer);
  for (let i = 0; i < 5; i++) mk(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 14), blackSuit, 0, -0.05 + i * 0.045, 0, hammer);
  mk(new THREE.SphereGeometry(0.04, 12, 8), steel, 0, -0.13, 0, hammer);
  const lp = mk(new THREE.TorusGeometry(0.04, 0.008, 8, 16), leather, 0, -0.17, 0, hammer); lp.rotation.y = Math.PI / 2;
  mk(new THREE.BoxGeometry(0.4, 0.2, 0.2), darkSteel, 0, 0.58, 0, hammer);
  for (const sd of [-1, 1]) mk(new THREE.BoxGeometry(0.045, 0.23, 0.23), steel, sd * 0.2225, 0.58, 0, hammer);
  for (const dy of [-0.06, 0.06]) mk(new THREE.BoxGeometry(0.3, 0.03, 0.205), steel, 0, 0.58 + dy, 0, hammer);
  mk(new THREE.BoxGeometry(0.31, 0.012, 0.206), glowBlue, 0, 0.58, 0, hammer);

  // HULK: otot, pinggang celana ungu, alis marah
  const hulkSkin = accMat(0x57b84a, { roughness: 0.55 }), hulkDark = accMat(0x2c6b27, { roughness: 0.6 }), hulkPurple = accMat(0x6b3fa0, { roughness: 0.8 });
  const hulkBody = grp(rig, costumeParts.hulk);
  for (const sd of [-1, 1]) {
    const pec = mk(new THREE.SphereGeometry(0.17, 24, 16), hulkSkin, sd * 0.15, 1.68, 0.3, hulkBody); pec.scale.set(1, 0.8, 0.7);
    const trap = mk(new THREE.SphereGeometry(0.17, 20, 14), hulkSkin, sd * 0.3, 1.98, -0.02, hulkBody); trap.scale.set(1, 0.7, 1);
    mk(new THREE.SphereGeometry(0.2, 24, 16), hulkSkin, sd * 0.58, 1.9, 0, hulkBody);
    for (let i = 0; i < 3; i++) { const ab = mk(new THREE.SphereGeometry(0.09, 16, 12), hulkSkin, sd * 0.1, 1.45 - i * 0.14, 0.38, hulkBody); ab.scale.set(1, 0.8, 0.5); }
  }
  mk(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 40), hulkPurple, 0, 1.0, 0, hulkBody);
  const hulkHead = grp(headGroup, costumeParts.hulk);
  for (const sd of [-1, 1]) { const brow = mk(new THREE.BoxGeometry(0.16, 0.05, 0.08), hulkDark, sd * 0.09, 0.13, 0.275, hulkHead); brow.rotation.z = sd * 0.3; }

  // ===== KOSTUM ULTRAMAN: helm perak, mata bercahaya, color timer, garis merah =====
  const ultraSilver = accMat(0xcbd5df, { metalness: 0.82, roughness: 0.24, envMap: envTex, envMapIntensity: 1.15 });
  const ultraRed = accMat(0xb92335, { metalness: 0.38, roughness: 0.34 });
  const ultraGlow = new THREE.MeshStandardMaterial({ color: 0x8ff6ff, emissive: 0x28cfff, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.22 });
  const ultraHead = grp(headGroup, costumeParts.ultra);
  mk(new THREE.SphereGeometry(0.355, 36, 28), ultraSilver, 0, 0.015, -0.015, ultraHead);
  for (const sd of [-1, 1]) {
    const eye = mk(new THREE.SphereGeometry(0.09, 20, 14), ultraGlow, sd * 0.135, 0.055, 0.318, ultraHead); eye.scale.set(1.15, 0.62, 0.34);
    const brow = mk(new THREE.BoxGeometry(0.055, 0.25, 0.055), ultraSilver, sd * 0.19, 0.29, 0.02, ultraHead); brow.rotation.z = -sd * 0.24;
  }
  const ultraCrest = mk(new THREE.ConeGeometry(0.055, 0.23, 8), ultraSilver, 0, 0.36, 0.02, ultraHead); ultraCrest.rotation.z = Math.PI;
  const ultraChest = grp(rig, costumeParts.ultra);
  mk(new THREE.SphereGeometry(0.09, 24, 16), ultraGlow, 0, 1.62, 0.31, ultraChest).scale.set(0.8, 1.2, 0.35);
  mk(new THREE.TorusGeometry(0.115, 0.018, 10, 32), ultraRed, 0, 1.62, 0.31, ultraChest);
  for (const sd of [-1, 1]) {
    const stripe = mk(new THREE.BoxGeometry(0.11, 0.65, 0.035), ultraRed, sd * 0.22, 1.48, 0.285, ultraChest); stripe.rotation.z = -sd * 0.22;
    const shoulder = mk(new THREE.SphereGeometry(0.145, 20, 14), ultraSilver, sd * 0.4, 1.93, 0, ultraChest); shoulder.scale.set(1.1, 0.65, 1);
    const bracer = grp(sd < 0 ? leftElbow : rightElbow, costumeParts.ultra);
    mk(new THREE.CylinderGeometry(0.105, 0.095, 0.26, 24), ultraSilver, 0, -0.23, 0, bracer);
    mk(new THREE.TorusGeometry(0.098, 0.014, 8, 24), ultraRed, 0, -0.12, 0, bracer).rotation.x = Math.PI / 2;
  }

  // ===== KOSTUM GODZILLA HD: armor bersisik dari kepala sampai kaki =====
  // Semua bagian berada di group terpisah agar hanya muncul saat kostum Godzilla dipakai.
  const godSkin = accMat(0x252a2c, { roughness: 0.9 });
  const godScale = accMat(0x343b3d, { roughness: 0.82 });
  const godDark = accMat(0x171c1e, { roughness: 0.94 });
  const godClaw = accMat(0x0d1113, { roughness: 0.58, metalness: 0.12 });
  const godGlow = accMat(0x087d83, {
    color: 0x159da0, emissive: 0x087e91, emissiveIntensity: 0.72,
    roughness: 0.38, metalness: 0.12
  });
  const godSpine = accMat(0x1b777b, {
    color: 0x29aeb1, emissive: 0x087e91, emissiveIntensity: 0.85,
    roughness: 0.36, metalness: 0.16
  });

  // Tekstur mikro-sisik untuk memberi permukaan kulit reptil yang lebih kaya.
  const godTexCanvas = document.createElement('canvas');
  godTexCanvas.width = godTexCanvas.height = 512;
  const gtx = godTexCanvas.getContext('2d');
  gtx.fillStyle = '#303638'; gtx.fillRect(0, 0, 512, 512);
  for (let gy = -12; gy < 540; gy += 18) {
    for (let gx = -12 + ((Math.floor(gy / 18) % 2) * 9); gx < 540; gx += 18) {
      gtx.fillStyle = 'rgba(5,10,12,0.34)';
      gtx.beginPath(); gtx.ellipse(gx, gy, 7, 5.2, 0, 0, Math.PI * 2); gtx.fill();
      gtx.strokeStyle = 'rgba(145,160,157,0.17)'; gtx.lineWidth = 1.5;
      gtx.beginPath(); gtx.arc(gx - 1, gy - 1, 5.4, Math.PI * 1.05, Math.PI * 1.9); gtx.stroke();
    }
  }
  const godTex = new THREE.CanvasTexture(godTexCanvas);
  godTex.wrapS = godTex.wrapT = THREE.RepeatWrapping;
  godTex.repeat.set(2, 2); godTex.colorSpace = THREE.SRGBColorSpace;
  godTex.anisotropy = 8;
  godSkin.map = godTex; godSkin.bumpMap = godTex; godSkin.bumpScale = 0.075;
  godSkin.needsUpdate = true;
  godScale.map = godTex; godScale.bumpMap = godTex; godScale.bumpScale = 0.055;
  godScale.needsUpdate = true;

  const godHead = grp(headGroup, costumeParts.godzilla);
  // Kubah kepala menutupi rambut dan kepala avatar, dengan moncong reptil lebar.
  const skull = mk(new THREE.SphereGeometry(0.365, 48, 32), godSkin, 0, 0.015, 0.005, godHead);
  skull.scale.set(1.12, 0.96, 1.08);
  const jaw = mk(new THREE.SphereGeometry(0.255, 36, 24), godDark, 0, -0.17, 0.12, godHead);
  jaw.scale.set(1.18, 0.42, 1.15);
  const snout = mk(new THREE.SphereGeometry(0.225, 40, 28), godScale, 0, -0.105, 0.255, godHead);
  snout.scale.set(1.25, 0.58, 1.2);
  const mouthLine = mk(new THREE.BoxGeometry(0.36, 0.018, 0.025), godClaw, 0, -0.205, 0.43, godHead);
  for (const sd of [-1, 1]) {
    const cheek = mk(new THREE.SphereGeometry(0.145, 24, 18), godScale, sd * 0.245, -0.075, 0.12, godHead);
    cheek.scale.set(0.72, 0.78, 0.82);
    const eyeSocket = mk(new THREE.SphereGeometry(0.075, 24, 16), godDark, sd * 0.145, 0.075, 0.292, godHead);
    eyeSocket.scale.set(1.22, 0.72, 0.42);
    const eye = mk(new THREE.SphereGeometry(0.035, 20, 14), accMat(0xd7b75a, { emissive: 0x6e4b12, emissiveIntensity: 0.45 }), sd * 0.145, 0.075, 0.323, godHead);
    eye.scale.set(1.25, 0.55, 0.35);
    for (let j = 0; j < 2; j++) {
      const nostril = mk(new THREE.SphereGeometry(0.018, 12, 8), godDark, sd * (0.07 + j * 0.055), -0.115, 0.49, godHead);
      nostril.scale.set(1, 0.6, 0.5);
    }
    const brow = mk(new THREE.BoxGeometry(0.19, 0.075, 0.11), godSkin, sd * 0.15, 0.16, 0.29, godHead);
    brow.rotation.z = -sd * 0.16;
    // Tonjolan kecil di sisi kepala.
    const temple = mk(new THREE.ConeGeometry(0.07, 0.19, 8), godDark, sd * 0.29, 0.12, -0.03, godHead);
    temple.rotation.z = -sd * 0.95;
  }

  // Leher dan armor dada/perut menutup baju avatar.
  const godTorso = grp(rig, costumeParts.godzilla);
  const neck = mk(new THREE.CylinderGeometry(0.23, 0.29, 0.42, 32), godSkin, 0, 1.94, 0, godTorso);
  neck.rotation.x = -0.08;
  const chest = mk(new THREE.SphereGeometry(0.43, 40, 28), godSkin, 0, 1.62, 0.015, godTorso);
  chest.scale.set(1.08, 0.9, 0.83);
  const belly = mk(new THREE.SphereGeometry(0.35, 36, 24), godScale, 0, 1.27, 0.025, godTorso);
  belly.scale.set(1.03, 0.95, 0.8);
  for (let row = 0; row < 4; row++) {
    const rib = mk(new THREE.TorusGeometry(0.275 - row * 0.012, 0.012, 8, 32, Math.PI), godDark, 0, 1.48 - row * 0.105, 0.23, godTorso);
    rib.rotation.x = Math.PI / 2;
    rib.scale.set(1.05, 0.72, 1);
  }
  for (const sd of [-1, 1]) {
    const shoulder = mk(new THREE.SphereGeometry(0.22, 32, 22), godScale, sd * 0.43, 1.88, 0, godTorso);
    shoulder.scale.set(1.12, 0.78, 1.08);
    // Segmen armor lengan atas dan bawah.
    const upperArmor = grp(sd < 0 ? leftArmPivot : rightArmPivot, costumeParts.godzilla);
    const upper = mk(new THREE.CapsuleGeometry(0.135, 0.27, 8, 24), godSkin, 0, -0.22, 0, upperArmor);
    upper.scale.set(1.14, 1.04, 1.1);
    const elbowArmor = grp(sd < 0 ? leftElbow : rightElbow, costumeParts.godzilla);
    const fore = mk(new THREE.CapsuleGeometry(0.12, 0.26, 8, 24), godScale, 0, -0.2, 0, elbowArmor);
    fore.scale.set(1.13, 1.04, 1.12);
    const wrist = mk(new THREE.TorusGeometry(0.105, 0.025, 10, 28), godDark, 0, -0.36, 0, elbowArmor);
    wrist.rotation.x = Math.PI / 2;
    // Cakar tiga jari yang mengarah ke depan.
    for (let k = -1; k <= 1; k++) {
      const finger = mk(new THREE.CapsuleGeometry(0.025, 0.105, 5, 12), godSkin, k * 0.055, -0.435, 0.035, elbowArmor);
      finger.rotation.z = k * -0.18;
      const nail = mk(new THREE.ConeGeometry(0.026, 0.105, 9), godClaw, k * 0.055, -0.49, 0.09, elbowArmor);
      nail.rotation.x = Math.PI;
    }
    // Armor paha, tulang kering, dan kaki/cakar.
    const legPivot = sd < 0 ? leftLegPivot : rightLegPivot;
    const kneePivot = sd < 0 ? leftKnee : rightKnee;
    const thigh = grp(legPivot, costumeParts.godzilla);
    const thighPlate = mk(new THREE.CapsuleGeometry(0.155, 0.25, 8, 24), godSkin, 0, -0.2, 0, thigh);
    thighPlate.scale.set(1.18, 1.08, 1.12);
    const shin = grp(kneePivot, costumeParts.godzilla);
    const shinPlate = mk(new THREE.CapsuleGeometry(0.135, 0.24, 8, 24), godScale, 0, -0.2, 0, shin);
    shinPlate.scale.set(1.2, 1.08, 1.12);
    const foot = mk(new THREE.SphereGeometry(0.16, 28, 18), godSkin, 0, -0.405, 0.1, shin);
    foot.scale.set(1.25, 0.58, 1.5);
    for (let toe = -1; toe <= 1; toe++) {
      const talon = mk(new THREE.ConeGeometry(0.035, 0.15, 9), godClaw, toe * 0.085, -0.425, 0.255, shin);
      talon.rotation.x = Math.PI / 2;
      talon.rotation.z = toe * 0.16;
    }
    // Sisik kecil berlapis di sisi bahu dan paha.
    for (let n = 0; n < 3; n++) {
      const scale = mk(new THREE.ConeGeometry(0.075, 0.13, 6), godDark, sd * (0.48 + n * 0.025), 1.78 - n * 0.13, 0.06, godTorso);
      scale.rotation.z = -sd * 0.7;
    }
  }

  // Ekor tebal beruas, melengkung ke belakang, lengkap dengan sirip di bagian atas.
  const godTail = new THREE.Group();
  godTail.position.set(0, 1.02, -0.22);
  godTorso.add(godTail);
  const tailSections = [
    { z: -0.23, r: 0.235, len: 0.48 },
    { z: -0.61, r: 0.19, len: 0.48 },
    { z: -0.98, r: 0.145, len: 0.43 },
    { z: -1.31, r: 0.095, len: 0.34 },
    { z: -1.57, r: 0.045, len: 0.22 }
  ];
  tailSections.forEach((part, i) => {
    const section = mk(new THREE.SphereGeometry(part.r, 28, 20), godSkin, 0, -0.035 - i * 0.025, part.z, godTail);
    section.scale.set(1, 0.88, part.len / (part.r * 2));
    if (i < 4) {
      const ridge = mk(new THREE.ConeGeometry(part.r * 0.72, 0.13 - i * 0.018, 7), godScale, 0, part.r * 0.72, part.z, godTail);
      ridge.rotation.x = -0.12;
    }
  });
  const tailTip = mk(new THREE.ConeGeometry(0.055, 0.28, 9), godDark, 0, -0.02, -1.78, godTail);
  tailTip.rotation.x = -Math.PI / 2;

  // Sirip punggung besar seperti Godzilla pada foto, dari tengkuk sampai ujung ekor.
  const dorsal = grp(rig, costumeParts.godzilla);
  const dorsalRows = [
    { y: 2.12, z: -0.16, w: 0.105, h: 0.28 },
    { y: 1.91, z: -0.19, w: 0.15, h: 0.38 },
    { y: 1.68, z: -0.2, w: 0.19, h: 0.43 },
    { y: 1.43, z: -0.2, w: 0.18, h: 0.38 },
    { y: 1.2, z: -0.2, w: 0.15, h: 0.32 },
    { y: 0.99, z: -0.22, w: 0.12, h: 0.25 }
  ];
  dorsalRows.forEach((d, i) => {
    const plate = mk(new THREE.ConeGeometry(d.w, d.h, 5), godSpine, 0, d.y, d.z, dorsal);
    plate.rotation.x = -0.18; plate.rotation.z = Math.PI;
    plate.scale.set(1.15, 1, 0.58);
    const inner = mk(new THREE.ConeGeometry(d.w * 0.58, d.h * 0.68, 5), godGlow, 0, d.y + 0.015, d.z + 0.035, dorsal);
    inner.rotation.x = -0.18; inner.rotation.z = Math.PI;
    inner.scale.set(1.08, 1, 0.42);
  });
  // Deretan sirip kecil melanjutkan punggung hingga ekor.
  for (let i = 0; i < 5; i++) {
    const z = -0.48 - i * 0.25;
    const fin = mk(new THREE.ConeGeometry(0.095 - i * 0.012, 0.22 - i * 0.025, 5), godSpine, 0, 1.02 - i * 0.025, z, godTail);
    fin.rotation.z = Math.PI; fin.rotation.x = -0.15;
  }
  // ===== KOSTUM RAMEN RAIDER: helm mangkuk ramen, mie, sumpit dan emblem =====
  const ramenBowl = accMat(0xd94a32, { roughness: 0.42, metalness: 0.12 });
  const ramenCream = accMat(0xffe3a3, { roughness: 0.68 });
  const ramenNoodle = accMat(0xe9b84f, { roughness: 0.8 });
  const ramenDark = accMat(0x66351f, { roughness: 0.7 });
  const ramenHead = grp(headGroup, costumeParts.ramen);
  mk(new THREE.CylinderGeometry(0.27, 0.22, 0.22, 32), ramenBowl, 0, 0.18, 0, ramenHead);
  mk(new THREE.TorusGeometry(0.255, 0.025, 8, 32), ramenCream, 0, 0.295, 0, ramenHead);
  const broth = mk(new THREE.CircleGeometry(0.235, 32), ramenCream, 0, 0.302, 0, ramenHead); broth.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const noodle = mk(new THREE.TorusGeometry(0.065 + (i % 2) * 0.012, 0.012, 6, 18), ramenNoodle, Math.cos(i * 1.25) * 0.105, 0.325, Math.sin(i * 1.25) * 0.105, ramenHead); noodle.rotation.x = Math.PI / 2;
  }
  const chopstick1 = mk(new THREE.CylinderGeometry(0.012, 0.018, 0.52, 8), ramenDark, -0.12, 0.48, -0.02, ramenHead);
  const chopstick2 = mk(new THREE.CylinderGeometry(0.012, 0.018, 0.52, 8), ramenDark, -0.02, 0.48, -0.02, ramenHead);
  chopstick1.rotation.z = -0.42; chopstick2.rotation.z = -0.24;
  const ramenChest = grp(rig, costumeParts.ramen);
  const emblem = mk(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 32), ramenCream, 0, 1.62, 0.3, ramenChest); emblem.rotation.x = Math.PI / 2;
  mk(new THREE.TorusGeometry(0.075, 0.012, 8, 24), ramenBowl, 0, 1.62, 0.325, ramenChest);
  mk(new THREE.TorusGeometry(0.045, 0.012, 8, 20), ramenNoodle, 0, 1.62, 0.34, ramenChest);
  for (const sd of [-1, 1]) {
    const shoulder = mk(new THREE.SphereGeometry(0.15, 18, 12), ramenBowl, sd * 0.4, 1.9, 0, ramenChest); shoulder.scale.set(1.2, 0.7, 1);
    const wrist = grp(sd < 0 ? leftElbow : rightElbow, costumeParts.ramen);
    mk(new THREE.CylinderGeometry(0.1, 0.09, 0.24, 20), ramenCream, 0, -0.23, 0, wrist);
    mk(new THREE.TorusGeometry(0.095, 0.012, 8, 20), ramenBowl, 0, -0.12, 0, wrist).rotation.x = Math.PI / 2;
  }
  const ramenScarf = grp(rig, costumeParts.ramen);
  const scarf = mk(new THREE.BoxGeometry(0.62, 0.13, 0.12), ramenCream, 0, 2.02, 0.02, ramenScarf); scarf.rotation.z = 0.04;
  const scarfTail = mk(new THREE.BoxGeometry(0.13, 0.42, 0.07), ramenCream, 0.32, 1.79, -0.02, ramenScarf); scarfTail.rotation.z = -0.18;

  // ===== KOSTUM PACMAN: helm bola kuning dengan mulut terbuka, mata, emblem dada, dan titik makanan =====
  const pacYellow = accMat(0xffd800, { roughness: 0.4, emissive: 0x332a00, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const pacBlack = accMat(0x0b0b12, { roughness: 0.5 });
  const pacHead = grp(headGroup, costumeParts.pac);
  mk(new THREE.SphereGeometry(0.37, 32, 24, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1), pacYellow, 0, 0.02, 0, pacHead);
  mk(new THREE.SphereGeometry(0.045, 12, 10), pacBlack, 0.213, 0.213, 0.234, pacHead);
  mk(new THREE.SphereGeometry(0.045, 12, 10), pacBlack, -0.213, 0.213, 0.234, pacHead);
  const pacChest = grp(rig, costumeParts.pac);
  const pacDisc = mk(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 32), pacBlack, 0, 1.62, 0.3, pacChest); pacDisc.rotation.x = Math.PI / 2;
  const pacMouth = mk(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 32, 1, false, Math.PI / 2 + 0.5, Math.PI * 2 - 1.0), pacYellow, 0, 1.62, 0.322, pacChest); pacMouth.rotation.x = Math.PI / 2;

  // ===== SAITAMA / ONE PUNCH MAN: jumpsuit kuning, sarung tangan & sepatu merah, jubah putih =====
  const saitamaYellow = accMat(0xffd21a, { roughness: 0.48 });
  const saitamaRed = accMat(0xc92532, { roughness: 0.42 });
  const saitamaWhite = accMat(0xf3f5f7, { roughness: 0.78, side: THREE.DoubleSide });
  const saitamaDark = accMat(0x252832, { metalness: 0.35, roughness: 0.55 });
  const saitamaSuit = grp(rig, costumeParts.saitama);
  const suitTorso = mk(new THREE.CylinderGeometry(0.285, 0.31, 0.72, 24), saitamaYellow, 0, 1.62, 0, saitamaSuit);
  suitTorso.scale.set(1.05, 1, 0.78);
  mk(new THREE.SphereGeometry(0.30, 20, 14), saitamaYellow, 0, 1.96, 0, saitamaSuit).scale.set(1.05, 0.52, 0.78);
  // Garis resleting dan sabuk khas kostum Saitama
  mk(new THREE.BoxGeometry(0.025, 0.43, 0.012), saitamaDark, 0, 1.66, 0.247, saitamaSuit);
  mk(new THREE.BoxGeometry(0.58, 0.075, 0.035), saitamaDark, 0, 1.28, 0.02, saitamaSuit);
  mk(new THREE.BoxGeometry(0.12, 0.10, 0.04), saitamaWhite, 0, 1.28, 0.045, saitamaSuit);
  // Kerah putih dan dua kancing kecil
  const collar = mk(new THREE.TorusGeometry(0.19, 0.035, 8, 24), saitamaWhite, 0, 2.00, 0, saitamaSuit);
  collar.rotation.x = Math.PI / 2;
  for (const yy of [1.78, 1.62, 1.46]) mk(new THREE.SphereGeometry(0.018, 8, 8), saitamaWhite, 0.045, yy, 0.255, saitamaSuit);
  // Sarung tangan merah menempel ke pivot lengan agar ikut animasi
  for (const [arm, side] of [[leftArmPivot,-1],[rightArmPivot,1]]) {
    const gloveGroup = grp(arm, costumeParts.saitama);
    const glove = mk(new THREE.SphereGeometry(0.125, 16, 12), saitamaRed, 0, -0.48, 0, gloveGroup);
    glove.scale.set(1, 1.15, 0.9);
    mk(new THREE.CylinderGeometry(0.105, 0.105, 0.11, 16), saitamaWhite, 0, -0.34, 0, gloveGroup);
    const shoulder = mk(new THREE.SphereGeometry(0.16, 16, 12), saitamaYellow, side * -0.02, -0.02, 0, gloveGroup);
    shoulder.scale.set(1.18, 0.72, 0.9);
  }
  // Sepatu bot merah dan pelindung kaki kuning pada kedua kaki
  for (const leg of [leftLegPivot, rightLegPivot]) {
    const bootGroup = grp(leg, costumeParts.saitama);
    mk(new THREE.CylinderGeometry(0.13, 0.14, 0.28, 18), saitamaRed, 0, -0.43, 0.025, bootGroup);
    mk(new THREE.BoxGeometry(0.23, 0.10, 0.30), saitamaRed, 0, -0.57, 0.07, bootGroup);
    mk(new THREE.CylinderGeometry(0.115, 0.12, 0.12, 16), saitamaYellow, 0, -0.23, 0, bootGroup);
  }
  // Jubah putih lebar dari bahu sampai betis, berada di belakang karakter
  const saitamaCape = grp(rig, costumeParts.saitama);
  saitamaCape.position.set(0, 1.98, -0.22);
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.22, 0.02); capeShape.quadraticCurveTo(-0.42, -0.35, -0.38, -1.15);
  capeShape.quadraticCurveTo(0, -1.28, 0.38, -1.15); capeShape.quadraticCurveTo(0.42, -0.35, 0.22, 0.02);
  capeShape.closePath();
  const capeMesh = new THREE.Mesh(new THREE.ShapeGeometry(capeShape, 12), saitamaWhite);
  capeMesh.position.z = -0.035; saitamaCape.add(capeMesh);
  mk(new THREE.SphereGeometry(0.11, 16, 12), saitamaWhite, -0.25, -0.02, 0.02, saitamaCape);
  mk(new THREE.SphereGeometry(0.11, 16, 12), saitamaWhite, 0.25, -0.02, 0.02, saitamaCape);

  updateCharacterVisuals();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.minDistance = 1.0; controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.enableZoom = true; controls.zoomSpeed = 1.8; controls.rotateSpeed = 0.9;
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }; // 1 jari = putar kamera, 2 jari = cubit zoom

  // Kamera dapat diputar dengan geser satu jari dan di-zoom dengan cubit dua jari.
  // Tidak ada tombol zoom +/- agar layar permainan lebih bersih.

  controls.domElement.addEventListener('pointerdown', function(e) {
    if (!isGameStarted) return;
    const x = e.clientX, y = e.clientY;
    const w = window.innerWidth, h = window.innerHeight;
    if ((x < 180 && y > h - 180) || (x > w - 220 && y > h - 160)) e.stopImmediatePropagation();
  }, { capture: true });

  const joystickArea = document.getElementById('joystick-area');
  const joystickKnob = document.getElementById('joystick-knob');
  let joystickActive = false;
  const maxDist = 40;

  function updateKnob(x, y) {
    const dist = Math.sqrt(x*x + y*y);
    if (dist > maxDist) { x = (x / dist) * maxDist; y = (y / dist) * maxDist; }
    joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    joystickVector.x = x / maxDist; joystickVector.y = -y / maxDist;
  }

  // Analog hanya mengikuti JARINYA SENDIRI (identifier), jadi geser layar dengan jari lain tidak mengganggu
  let joyId = null;
  const findTouch = (list) => { for (const tc of list) if (tc.identifier === joyId) return tc; return null; };
  const moveKnobTo = (cx, cy) => { const rect = joystickArea.getBoundingClientRect(); updateKnob(cx - (rect.left + rect.width / 2), cy - (rect.top + rect.height / 2)); };
  const handleEnd = () => { joystickActive = false; joyId = null; joystickVector.set(0, 0); joystickKnob.style.transform = 'translate(-50%, -50%)'; };

  joystickArea.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (joyId !== null) return;
    const tc = e.changedTouches[0]; joyId = tc.identifier; joystickActive = true; moveKnobTo(tc.clientX, tc.clientY);
  }, { passive: false });
  joystickArea.addEventListener('touchmove', (e) => { const tc = findTouch(e.changedTouches); if (!tc) return; e.preventDefault(); moveKnobTo(tc.clientX, tc.clientY); }, { passive: false });
  const endTouch = (e) => { if (findTouch(e.changedTouches)) handleEnd(); };
  joystickArea.addEventListener('touchend', endTouch);
  joystickArea.addEventListener('touchcancel', endTouch);

  let mouseJoy = false; // desktop
  joystickArea.addEventListener('mousedown', (e) => { e.preventDefault(); mouseJoy = true; moveKnobTo(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (mouseJoy) moveKnobTo(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (mouseJoy) { mouseJoy = false; handleEnd(); } });

  // Sistem lompatan 2 tahap: satu lompatan dari tanah + satu lompatan di udara.
  // Hitungan tidak di-reset saat karakter masih naik, supaya double jump konsisten di HP maupun PC.
  const triggerPlayerJump = () => {
    if (gameState !== 'PLAYING' || flyMode || !physics) return;
    const maxJumps = Math.max(2, Number(physics.maxJumps) || 2);
    let usedJumps = Math.max(0, Number(physics.jumpCount) || 0);
    if (physics.isGrounded) usedJumps = 0;
    if (usedJumps >= maxJumps) return;
    physics.jumpCount = usedJumps + 1;
    physics.velocityY = physics.jumpForce;
    physics.isGrounded = false;
    playJumpSound(); sq.v = 6;
    if (physics.jumpCount === 1) spawnDust(5);
    createJumpEffect();
  };
  const jumpButton = document.getElementById('btn-jump');
  jumpButton.style.touchAction = 'none';
  jumpButton.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    triggerPlayerJump();
  });

  const btnRun = document.getElementById('btn-run');
  btnRun.addEventListener('touchstart', (e) => { e.preventDefault(); isRunning = true; });
  btnRun.addEventListener('touchend', (e) => { e.preventDefault(); isRunning = false; });
  btnRun.addEventListener('pointerdown', (e) => { isRunning = true; });
  btnRun.addEventListener('pointerup', (e) => { isRunning = false; });
  btnRun.addEventListener('pointerleave', (e) => { isRunning = false; });

  document.getElementById('btn-restart').addEventListener('click', () => { if (gameState === 'WIN') location.reload(); else respawn(); });
  document.getElementById('overlay').style.display = 'none';

  updateCharacterNameSprite(playerData.username, playerData.isDev);
  buildLobbyLeaderboard();
  updateLobbyLeaderboard();
  refreshSoloLeaderboard(true).catch(() => {});
  if (!window.__soloLeaderboardTimer) window.__soloLeaderboardTimer = setInterval(() => { if (!roomCode) refreshSoloLeaderboard(); }, 10000);
  setupAdminPanel();
  animate();
}

function insidePlat(p, x, z, pad) {
  const m = p.mesh.position;
  if (p.r) return Math.hypot(x - m.x, z - m.z) < p.r + pad;
  return x + pad > m.x - p.width / 2 && x - pad < m.x + p.width / 2 && z + pad > m.z - p.depth / 2 && z - pad < m.z + p.depth / 2;
}

function checkGroundCollision(x, z, y) {
  const feetY = y; const tolerance = 0.3;
  for (let p of platforms) {
    if (p.isFallen || p.type === 'fake') continue;
    if (insidePlat(p, x, z, 0)) {
      const topY = p.mesh.position.y + (p.hh || 0.25);
      if (feetY >= topY - tolerance && feetY <= topY + 0.5) return { y: topY, platform: p };
    }
  }
  return null;
}

function checkWallCollision(x, z, y) {
  const radius = 0.35; const feetY = y;
  for (let p of platforms) {
    if (p.isFallen || p.type === 'fake') continue;
    const hh = p.hh || 0.25, topY = p.mesh.position.y + hh, bottomY = p.mesh.position.y - hh;
    if (feetY < topY - 0.1 && feetY > bottomY - 1 && insidePlat(p, x, z, radius)) return true;
  }
  return false;
}

function showOverlay(title, desc, color) {
  const t = document.getElementById('overlay-title');
  t.textContent = title; t.style.color = color; t.style.fontSize = ''; t.style.maxWidth = ''; t.style.textAlign = ''; t.style.lineHeight = '';
  document.getElementById('overlay-desc').textContent = desc;
  document.getElementById('overlay').style.display = 'flex';
}

// Pengganti tulisan GAME OVER: kalimat roasting, lalu "Coba lagi" di bawahnya (admin/dev tidak di-roasting)
function showGameOver(kind) {
  const arr = ROASTS[kind];
  const msg = isAdminUser() ? '💥 Kena!' : arr[Math.floor(Math.random() * arr.length)];
  showOverlay(msg, 'Coba lagi 👇', '#ff3333');
  const t = document.getElementById('overlay-title');
  t.style.fontSize = 'clamp(22px, 6vw, 34px)'; t.style.maxWidth = '90vw'; t.style.textAlign = 'center'; t.style.lineHeight = '1.3';
}

function updateCharacterNameSprite(username, isDev) {
  if (!character) return;
  if (nameSprite) { character.remove(nameSprite); scene.remove(nameSprite); nameSprite.material.map.dispose(); nameSprite.material.dispose(); }
  const bj = SHOP_ITEMS.baju.find(i => i.id === playerData.equipped.baju);
  const label = bj ? (bj.web ? '🕸️ ' : bj.bat ? '🦇 ' : bj.iron ? '🤖 ' : bj.thor ? '⚡ ' : bj.hulk ? '💚 ' : '👕 ') + bj.name : '';
  const canvasName = document.createElement('canvas');
  canvasName.width = 512; canvasName.height = 176;
  const ctxName = canvasName.getContext('2d');
  ctxName.clearRect(0, 0, 512, 176);
  ctxName.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctxName.beginPath(); ctxName.roundRect(10, 10, 492, 88, 20); ctxName.fill();
  ctxName.font = 'bold 50px sans-serif'; ctxName.fillStyle = '#ffffff'; ctxName.textAlign = 'center'; ctxName.textBaseline = 'middle';
  ctxName.fillText(username, 256, 54);
  if (isDev) {
    ctxName.beginPath(); ctxName.arc(430, 54, 28, 0, Math.PI * 2); ctxName.fillStyle = '#1DA1F2'; ctxName.fill();
    ctxName.strokeStyle = '#ffffff'; ctxName.lineWidth = 4; ctxName.stroke();
    ctxName.beginPath(); ctxName.moveTo(418, 54); ctxName.lineTo(426, 64); ctxName.lineTo(444, 44); ctxName.strokeStyle = '#ffffff'; ctxName.lineWidth = 6; ctxName.lineCap = 'round'; ctxName.lineJoin = 'round'; ctxName.stroke();
  }
  if (label) {
    ctxName.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctxName.beginPath(); ctxName.roundRect(60, 106, 392, 56, 16); ctxName.fill();
    ctxName.font = 'bold 30px sans-serif'; ctxName.fillStyle = '#ffd166'; ctxName.fillText(label, 256, 135);
  }
  const textureName = new THREE.CanvasTexture(canvasName);
  nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureName, depthTest: false, depthWrite: false }));
  nameSprite.position.set(0, 3.3, 0);
  nameSprite.scale.set(2, 0.6875, 1);
  character.add(nameSprite);
}

// ============ MULTIPLAYER ROOM: kode lobby, host yang memulai, waktu sinkron ============
const MAX_PLAYERS = 8, ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOBBY_SLOTS = [[-1.7, 0], [1.7, 0], [-3.4, 0], [3.4, 0], [0, 2], [-1.7, 2], [1.7, 2], [-3.4, 2], [3.4, 2]];
const SPAWN = [[0, 0], [-1.5, 0], [1.5, 0], [-3, 0], [3, 0], [-1.5, 1.5], [1.5, 1.5], [0, 1.5]];
let mpUid = null, mpReady = false, mpOffset = 0;
let roomCode = null, roomMeta = null, roomPlayers = {}, roomUnsub = null, roomStartAt = null, roomStarted = false;
let lobbyLeaderboardGroup = null, lobbyLeaderboardTexture = null, lobbyLeaderboardCanvas = null, lobbyLeaderboardCtx = null, lobbyLeaderboardLastKey = '';
const lobbyLeaderboardAvatars = new Map();
let deathFrozenMs = null, roomRunReset = 0;
// Waktu berjalan sejak mulai/respawn terakhir
function rawElapsedMs() {
  return roomStartAt ? Math.max(0, serverNow() - Math.max(roomStartAt, roomRunReset)) : Math.max(0, performance.now() - soloStart);
}
// Saat mati (GAMEOVER) timer dibekukan, tidak lanjut jalan
function runElapsedMs() {
  if (finishMs != null) return finishMs;
  if (gameState === 'GAMEOVER') { if (deathFrozenMs == null) deathFrozenMs = rawElapsedMs(); return deathFrozenMs; }
  return rawElapsedMs();
}
// Timer ikut di-reset ke 00:00.0 setiap karakter di-reset/respawn
function resetRunTimer() {
  deathFrozenMs = null;
  if (roomStartAt) roomRunReset = serverNow(); else soloStart = performance.now();
}
let myRef = null, myJoinedAt = 0, mpLastSend = 0, mpEquipTimer = null, soloStart = 0, finishMs = null, lastLobbyCount = -1, rpCollapsed = false;
let soloLeaderboardEntries = [], soloLeaderboardLoading = false, soloLeaderboardLastFetch = 0;
let personalRunScore = 0;
const remotePlayers = new Map(), announcedFinish = new Set(), tmpV = new THREE.Vector3();
const serverNow = () => Date.now() + mpOffset;
const genCode = () => Array.from({ length: 5 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
const sortedIds = () => Object.keys(roomPlayers).sort((a, b) => ((roomPlayers[a].joinedAt || 0) - (roomPlayers[b].joinedAt || 0)) || a.localeCompare(b));
const myEquipped = () => ({ baju: playerData.equipped.baju, celana: playerData.equipped.celana, sepatu: playerData.equipped.sepatu, aksesoris: playerData.equipped.aksesoris || 'aks_none' });
function mpErr(e) { const m = String((e && (e.code || e.message)) || e); return /permission/i.test(m) ? 'Izin ditolak Firebase. Cek Rules (lihat README).' : m.replace(/^Error: /, ''); }

async function ensureMp() {
  if (mpReady) return;
  try { mpUid = (await signInAnonymously(multiplayerAuth)).user.uid; }
  catch (e) { console.warn('Anonymous auth gagal, lanjut tanpa auth:', e); mpUid = 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  onValue(ref(multiplayerDb, '.info/serverTimeOffset'), (sn) => { mpOffset = sn.val() || 0; });
  mpReady = true;
}

async function createRoom() {
  await ensureMp();
  let code = null;
  for (let i = 0; i < 6; i++) { const c = genCode(); if (!(await get(ref(multiplayerDb, `rooms/${c}/meta`))).exists()) { code = c; break; } }
  if (!code) throw new Error('Gagal membuat kode, coba lagi');
  await set(ref(multiplayerDb, `rooms/${code}/meta`), { host: mpUid, hostName: String(playerData.username).slice(0, 18), createdAt: Date.now() });
  await enterRoom(code);
}

async function joinRoom(code) {
  await ensureMp();
  const meta = await get(ref(multiplayerDb, `rooms/${code}/meta`));
  if (!meta.exists()) throw new Error('Kode room tidak ditemukan');
  if (Date.now() - (meta.val().createdAt || 0) > 6 * 3600 * 1000) throw new Error('Room sudah kedaluwarsa');
  const ps = await get(ref(multiplayerDb, `rooms/${code}/players`));
  if (ps.exists() && Object.keys(ps.val()).length >= MAX_PLAYERS) throw new Error('Room penuh (maks ' + MAX_PLAYERS + ')');
  await enterRoom(code);
}

async function enterRoom(code) {
  roomCode = code; roomStarted = false; roomStartAt = null; announcedFinish.clear();
  myRef = ref(multiplayerDb, `rooms/${code}/players/${mpUid}`);
  await onDisconnect(myRef).remove();
  myJoinedAt = Date.now();
  await set(myRef, { username: String(playerData.username).slice(0, 18), userKey: accountKey(), playerId: String(playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : '')), isDev: !!playerData.isDev, equipped: myEquipped(), status: 'LOBBY', joinedAt: myJoinedAt, updatedAt: Date.now() });
  roomUnsub = onValue(ref(multiplayerDb, `rooms/${code}`), onRoomSnapshot, (err) => { console.error(err); setRoomMsg(mpErr(err)); });
  rpCollapsed = true; // setelah masuk room, panel langsung mengecil
  updateRoomUI();
}

function onRoomSnapshot(sn) {
  const room = sn.val();
  if (!room || !room.meta) { if (roomCode && !roomStarted) { leaveRoom(true); setRoomMsg('Room ditutup'); } return; }
  roomMeta = room.meta; roomPlayers = room.players || {};
  if (!roomPlayers[roomMeta.host]) { // host keluar: pemain paling lama jadi host baru
    const ids = sortedIds();
    if (ids[0] === mpUid) update(ref(multiplayerDb, `rooms/${roomCode}/meta`), { host: mpUid, hostName: String(playerData.username).slice(0, 18) }).catch(() => {});
  }
  updateRoomUI(); updateRemoteAvatars();
  if (roomMeta.startAt && !roomStarted) { // host menekan MULAI (atau kamu gabung saat game sudah jalan)
    roomStarted = true; roomStartAt = roomMeta.startAt;
    document.getElementById('btn-start-game').click();
  }
}

async function hostStart() {
  if (!roomCode || !roomMeta || roomMeta.host !== mpUid || roomMeta.startAt) return;
  if (Object.keys(roomPlayers || {}).length < 2) {
    showToast('Tunggu teman menerima undangan dan masuk lobby dulu.');
    return;
  }
  await update(ref(multiplayerDb, `rooms/${roomCode}/meta`), { startAt: serverNow() + 4500, map: rollMap() });
}

async function leaveRoom(silent) {
  const code = roomCode; if (!code) return;
  const alone = Object.keys(roomPlayers).length <= 1;
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  try {
    if (myRef) { await onDisconnect(myRef).cancel(); await remove(myRef); }
    if (alone && !silent) await remove(ref(multiplayerDb, `rooms/${code}`));
  } catch (e) { console.warn(e); }
  for (const id of [...remotePlayers.keys()]) disposeAvatar(id);
  roomCode = null; roomMeta = null; roomPlayers = {}; myRef = null; roomStartAt = null; roomStarted = false; lastLobbyCount = -1; rpCollapsed = false;
  if (camera && controls) { camera.position.set(0, 3.8, 9.5); controls.target.set(0, 1.45, 0); }
  updateRoomUI();
}

function mpSyncEquipped() {
  if (!myRef) return;
  clearTimeout(mpEquipTimer);
  mpEquipTimer = setTimeout(() => update(myRef, { equipped: myEquipped() }).catch(() => {}), 400);
}

// dipanggil tombol start (solo) ATAU saat host memulai room
function onGameBegin() {
  setLobbyOnlyHud(false);
  // Tampilkan tepat SATU map aktif. Sebelumnya parkourWorldGroup ikut
  // dinyalakan untuk Angkasa sehingga lantai/lava map lama terlihat menembus.
  if (parkourWorldGroup) parkourWorldGroup.visible = currentMap === 'lava';
  if (snowWorldGroup) snowWorldGroup.visible = currentMap === 'snow';
  if (angkasaWorldGroup) angkasaWorldGroup.visible = currentMap === 'angkasa';
  if (lobbyWorldGroup) lobbyWorldGroup.visible = false;
  if (scene) {
    if (currentMap === 'snow') {
      scene.background = new THREE.Color(0xbcd8ee);
      scene.fog = new THREE.Fog(0xbcd8ee, 30, 190);
    } else if (currentMap === 'angkasa') {
      if (angkasaController && angkasaController.enter) angkasaController.enter(scene);
      else { scene.background = new THREE.Color(0x000000); scene.fog = null; }
    } else {
      scene.background = new THREE.Color(0x1a1a24);
      scene.fog = new THREE.Fog(0x1a1a24, 20, 150);
    }
  }
  const rp = document.getElementById('room-panel'); if (rp) rp.style.display = 'none';
  finishMs = null; deathFrozenMs = null; roomRunReset = 0;
  personalRunScore = 0;
  activatedCheckpoints = new WeakSet();
  // Reset warna/status checkpoint hanya saat putaran baru dimulai. Respawn tidak meresetnya.
  platforms.forEach(pl => { if (pl.checkpoint) { pl.checkpointActivated = false; if (pl.checkpointReadyMaterial) pl.mesh.material = pl.checkpointReadyMaterial; } });
  checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
  if (camera && controls) { camera.position.set(0, 4, 8); controls.target.set(0, 1.5, 0); }
  if (roomCode && roomStartAt) {
    const idx = Math.max(0, sortedIds().indexOf(mpUid)), sp = SPAWN[idx % SPAWN.length];
    character.position.set(sp[0], 0.25, sp[1]); checkpoint.x = sp[0]; checkpoint.z = sp[1];
    gameState = serverNow() < roomStartAt ? 'COUNTDOWN' : 'PLAYING';
    update(myRef, { status: 'PLAYING', deadAt: null }).catch(() => {});
  } else {
    soloStart = performance.now(); gameState = 'PLAYING'; character.position.set(0, 0.25, 0); checkpoint.x = 0; checkpoint.z = 0;
    restoreSavedCheckpoint();
  }
}
// Pulihkan checkpoint terakhir (mode solo): karakter muncul di checkpoint tersimpan, bukan di awal.
function restoreSavedCheckpoint() {
  const sc = currentMap === 'snow' ? playerData.savedCheckpointSnow : playerData.savedCheckpoint; // checkpoint tiap map terpisah
  if (!sc || roomCode) return;
  const pl = platforms.find(p => p.checkpoint && Math.abs(p.mesh.position.x - sc.px) < 0.06 && Math.abs(p.mesh.position.y - sc.py) < 0.06 && Math.abs(p.mesh.position.z - sc.pz) < 0.06);
  if (!pl) return;
  pl.checkpointActivated = true; activatedCheckpoints.add(pl);
  if (usedCheckpointMat) pl.mesh.material = usedCheckpointMat;
  checkpoint = { p: pl, set: true, x: pl.mesh.position.x, y: sc.y, z: pl.mesh.position.z };
  character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z);
  physics.velocityY = 0; moveVel.set(0, 0); knock.set(0, 0);
  if (camera && controls) { controls.target.set(checkpoint.x, checkpoint.y + 1.5, checkpoint.z); camera.position.set(checkpoint.x, checkpoint.y + 4, checkpoint.z + 8); }
  showToast('📍 Lanjut dari checkpoint terakhir');
}

function scoreFromTime(ms) {
  // Semakin cepat menyelesaikan parkour, semakin tinggi skor.
  return Math.max(0, 100000 - Math.floor(Math.max(0, ms) / 100));
}

async function savePersonalBest(score, timeMs) {
  const key = accountKey();
  if (!key) return;
  const latestRes = await fetch(`${FIREBASE_URL}leaderboard/${key}.json`, { cache: 'no-store' });
  if (!latestRes.ok) throw new Error('Gagal membaca rekor sebelumnya');
  const latestProfile = await latestRes.json() || {};
  const oldScore = Number(latestProfile.bestScore) || 0;
  // Rekor hanya diganti jika skor baru lebih tinggi; skor lebih rendah tidak menimpa rekor.
  if (score <= oldScore) {
    playerData.bestScore = oldScore;
    playerData.bestTimeMs = Number(latestProfile.bestTimeMs) || 0;
    return;
  }
  playerData.bestScore = score;
  playerData.bestTimeMs = Math.round(timeMs);
  const res = await fetch(`${FIREBASE_URL}leaderboard/${key}.json`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: String(playerData.username || key).slice(0, 18), playerId: String(playerData.playerId || ''), isDev: !!playerData.isDev, equipped: myEquipped(), crowns: Math.max(0, Number(playerData.crowns) || 0), bestScore: score, bestTimeMs: Math.round(timeMs), updatedAt: Date.now() })
  });
  if (!res.ok) throw new Error('Gagal menyimpan rekor leaderboard');
  refreshSoloLeaderboard(true).catch(() => {});
}

function onFinish() {
  if (finishMs != null) return;
  finishMs = rawElapsedMs();
  personalRunScore = scoreFromTime(finishMs);
  if (myRef) update(myRef, { finishMs: Math.round(finishMs), score: personalRunScore }).catch(() => {});
  awardWinCrown().catch(e => { console.warn('Mahkota kemenangan gagal disimpan:', e); showToast('⚠️ Mahkota gagal disimpan ke Firebase'); });
  if (currentMap === 'lava') savePersonalBest(personalRunScore, finishMs).catch(e => console.warn('Simpan rekor gagal:', e)); // leaderboard lama khusus map Lava
  updateLobbyLeaderboard();
}
function finishSummary() {
  if (!roomCode) return '';
  return ' • Peringkat #' + (Object.entries(roomPlayers).filter(([id, p]) => id !== mpUid && p.finishMs != null && p.finishMs < finishMs).length + 1);
}

function tickMultiplayer() {
  if (gameState === 'COUNTDOWN' && roomStartAt) {
    const left = roomStartAt - serverNow(), el = document.getElementById('countdown');
    if (left <= 0) { gameState = 'PLAYING'; if (el) el.style.display = 'none'; showToast('🏁 MULAI!'); }
    else if (el) { el.style.display = 'flex'; el.textContent = Math.ceil(left / 1000); }
  }
  if (!roomCode || !myRef || !character || !(gameState === 'PLAYING' || gameState === 'GAMEOVER' || gameState === 'WIN')) return;
  const now = performance.now(); if (now - mpLastSend < 100) return; mpLastSend = now;
  update(myRef, { x: +character.position.x.toFixed(2), y: +character.position.y.toFixed(2), z: +character.position.z.toFixed(2), rot: +character.rotation.y.toFixed(2), status: 'PLAYING', username: String(playerData.username).slice(0, 18), userKey: accountKey(), playerId: String(playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : '')), isDev: !!playerData.isDev, joinedAt: myJoinedAt, updatedAt: Date.now() }).catch(() => {});
}

// ----- avatar pemain lain (kostum ikut dipakai) -----
function disposeAvatar(id) {
  const av = remotePlayers.get(id); if (!av) return;
  scene.remove(av);
  const u = av.userData;
  (u.mats || []).forEach(m => m.dispose());
  if (u.label) { u.label.material.map.dispose(); u.label.material.dispose(); }
  remotePlayers.delete(id);
}
function makeLabelSprite(o) { // o: { name, owner, host, costume }
  const c = document.createElement('canvas'); c.width = 512; c.height = 176; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.roundRect(10, 10, 492, 88, 20); x.fill();
  x.textBaseline = 'middle'; x.textAlign = 'left';
  const prefix = o.host ? '👑 ' : '';
  x.font = 'bold 46px sans-serif'; const w1 = x.measureText(prefix + o.name).width;
  let w2 = 0, w3 = 0;
  if (o.owner) { x.font = 'bold 30px sans-serif'; w2 = x.measureText(' owner').width; w3 = 62; }
  let cx = 256 - (w1 + w2 + w3) / 2;
  x.font = 'bold 46px sans-serif'; x.fillStyle = '#ffffff'; x.fillText(prefix + o.name, cx, 56); cx += w1;
  if (o.owner) {
    x.font = 'bold 30px sans-serif'; x.fillStyle = '#ffd166'; x.fillText(' owner', cx, 58); cx += w2 + 8;
    // centang biru digambar langsung (bukan emoji) supaya tampil di semua HP
    x.beginPath(); x.arc(cx + 22, 54, 24, 0, Math.PI * 2); x.fillStyle = '#1DA1F2'; x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.stroke();
    x.beginPath(); x.moveTo(cx + 11, 54); x.lineTo(cx + 19, 63); x.lineTo(cx + 34, 44); x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke();
  }
  if (o.costume) {
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.roundRect(60, 106, 392, 56, 16); x.fill();
    x.font = 'bold 30px sans-serif'; x.fillStyle = '#ffd166'; x.textAlign = 'center'; x.fillText(o.costume, 256, 135);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false }));
  sp.position.y = 3.3; sp.scale.set(2, 0.6875, 1); return sp;
}
function applyRemoteCostume(u, eq) {
  const { baju, iron, thor, celana: cV, sepatu: sV } = pickCostume(eq);
  const ap = applyItemMat;
  u.model.traverse((o) => {
    if (!o.isMesh) return;
    const t = o.userData.type;
    if (t === 'baju') ap(o.material, baju); else if (t === 'celana') ap(o.material, cV); else if (t === 'sepatu') ap(o.material, sV);
  });
  const vis = (orig, v) => { const c = u.map.get(orig); if (c) c.visible = v; };
  setCostumeVis(baju, o => u.map.get(o));
  applyBodyType(u.model, u.parts, baju.hulk);
  const a = eq.aksesoris || 'aks_none';
  Object.keys(acc).forEach(id => vis(acc[id], !(iron || thor) && id === a));
  u.costumeName = baju.name;
}
function makeRemotePlayer(uid, data) {
  const eq = data.equipped || {};
  const model = character.clone(true), map = new Map();
  const walk = (a, b) => { map.set(a, b); a.children.forEach((ch, i) => { if (b.children[i]) walk(ch, b.children[i]); }); };
  walk(character, model);
  const ns = map.get(nameSprite); if (ns) model.remove(ns); // label karakter lokal tidak ikut
  const mm = new Map(), mats = [];
  model.traverse((o) => { if (o.material) { if (!mm.has(o.material)) { const c = o.material.clone(); mm.set(o.material, c); mats.push(c); } o.material = mm.get(o.material); } });
  model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.set(1, 1, 1);
  const P = (o) => map.get(o);
  const parts = { rig: P(rig), head: P(headGroup), armL: P(leftArmPivot), armR: P(rightArmPivot), legL: P(leftLegPivot), legR: P(rightLegPivot), elL: P(leftElbow), elR: P(rightElbow), knL: P(leftKnee), knR: P(rightKnee), capes: [P(capePivot), P(capeB), P(capeT)].filter(Boolean) };
  [parts.rig, parts.head, parts.armL, parts.armR, parts.legL, parts.legR, parts.elL, parts.elR, parts.knL, parts.knR, ...parts.capes].forEach(o => o && o.rotation.set(0, 0, 0));
  parts.rig.position.set(0, 0, 0); parts.rig.scale.set(1, 1, 1);
  const g = new THREE.Group(); g.add(model);
  Object.assign(g.userData, { eqKey: JSON.stringify(eq), model, map, mats, parts, ph: Math.random() * 6, spd: 0, last: new THREE.Vector3(), lastY: 0, d: data, slot: [0, 0], spawn: [0, 0], first: true });
  applyRemoteCostume(g.userData, eq);
  scene.add(g); remotePlayers.set(uid, g); return g;
}
function updateRemoteAvatars() {
  if (!scene || !character) return;
  const ids = sortedIds(), others = ids.filter(id => id !== mpUid), alive = new Set(others);
  others.forEach((id, i) => {
    const d = roomPlayers[id]; if (!d) return;
    let av = remotePlayers.get(id);
    if (av && av.userData.eqKey !== JSON.stringify(d.equipped || {})) { disposeAvatar(id); av = null; }
    let fresh = false;
    if (!av) { av = makeRemotePlayer(id, d); fresh = true; av.userData.deadAt = d.deadAt || null; av.visible = !d.deadAt; }
    const u = av.userData; u.d = d;
    if (!fresh) {
      if (d.deadAt && u.deadAt !== d.deadAt) { // pemain lain jatuh ke lava: badannya hancur di layar kita juga
        u.deadAt = d.deadAt;
        if (serverNow() - d.deadAt < 6000) spawnShatter(d.x != null ? tmpV.set(Number(d.x) || 0, Number(d.y) || 0, Number(d.z) || 0) : av.position, d.equipped);
        av.visible = false;
      } else if (!d.deadAt && u.deadAt) { u.deadAt = null; av.visible = true; u.first = true; }
    } u.slot = LOBBY_SLOTS[i % LOBBY_SLOTS.length]; u.spawn = SPAWN[ids.indexOf(id) % SPAWN.length];
    const lbl = { name: String(d.username || 'Pemain').slice(0, 14), owner: !!d.isDev, host: !!(roomMeta && roomMeta.host === id), costume: u.costumeName };
    const text = JSON.stringify(lbl);
    if (u.labelText !== text) {
      if (u.label) { av.remove(u.label); u.label.material.map.dispose(); u.label.material.dispose(); }
      u.label = makeLabelSprite(lbl); u.labelText = text; av.add(u.label);
    }
    if (d.finishMs != null && !announcedFinish.has(id)) { announcedFinish.add(id); showToast('🏁 ' + String(d.username || 'Pemain') + ' berhasil finish!'); }
  });
  for (const id of [...remotePlayers.keys()]) if (!alive.has(id)) disposeAvatar(id);
  if (gameState === 'LOBBY' && remotePlayers.size !== lastLobbyCount && camera) { // zoom out otomatis supaya semua pemain kelihatan
    lastLobbyCount = remotePlayers.size;
    camera.position.set(0, 3.8 + 0.2 * lastLobbyCount, 9.5 + 1.2 * lastLobbyCount); controls.target.set(0, 1.45, 0.35 * lastLobbyCount);
  }
}
function animateRemotePlayers(delta) {
  if (!remotePlayers.size) return;
  const blend = 1 - Math.exp(-delta * 12), now = performance.now() / 1000, inGame = !!roomStartAt;
  for (const av of remotePlayers.values()) {
    const u = av.userData, d = u.d || {};
    let rot;
    if (inGame && d.status === 'PLAYING' && d.x != null) { tmpV.set(Number(d.x) || 0, Number(d.y) || 0, Number(d.z) || 0); rot = Number(d.rot) || 0; }
    else if (inGame) { tmpV.set(u.spawn[0], 0.25, u.spawn[1]); rot = 0; }
    else { tmpV.set(u.slot[0], 0.25, u.slot[1]); rot = character ? character.rotation.y : 0; }
    if (u.first || av.position.distanceTo(tmpV) > 14) { av.position.copy(tmpV); u.first = false; u.last.copy(tmpV); u.lastY = tmpV.y; }
    else av.position.lerp(tmpV, blend);
    av.rotation.y += Math.atan2(Math.sin(rot - av.rotation.y), Math.cos(rot - av.rotation.y)) * blend;
    const dt = Math.max(delta, 1e-3), hv = Math.hypot(av.position.x - u.last.x, av.position.z - u.last.z) / dt, vy = (av.position.y - u.lastY) / dt;
    u.last.copy(av.position); u.lastY = av.position.y; u.spd += (hv - u.spd) * 0.2;
    const air = Math.abs(vy) > 2.5, k = 1 - Math.exp(-delta * 14), P = u.parts;
    u.ph += delta * u.spd * 1.7;
    const moving = u.spd > 0.4, runK = Math.min(1, Math.max(0, (u.spd - 5) / 4));
    let lH = 0, rH = 0, lK = 0, rK = 0, lA = 0, rA = 0, lE = -0.15, rE = -0.15, armZ = 0.1, bob = 0, lean = 0, twist = 0, headY = 0;
    if (air) { lH = -0.5; rH = 0.4; lK = 0.6; rK = 0.5; lA = rA = -1.4; lE = rE = -0.5; armZ = 0.6; lean = 0.1; }
    else if (moving) {
      const sn = Math.sin(u.ph), cs = Math.cos(u.ph), amp = 0.55 + runK * 0.4;
      lH = sn * amp; rH = -sn * amp; lK = Math.max(0, -cs) * (0.7 + runK * 0.8) + 0.08; rK = Math.max(0, cs) * (0.7 + runK * 0.8) + 0.08;
      lA = -sn * amp * 0.9; rA = sn * amp * 0.9; lE = -(0.25 + runK * 0.9) - Math.max(0, sn) * 0.3; rE = -(0.25 + runK * 0.9) - Math.max(0, -sn) * 0.3;
      bob = Math.abs(sn) * (0.05 + runK * 0.05); lean = 0.06 + runK * 0.2; twist = -sn * (0.12 + runK * 0.1); armZ = 0.12;
    } else {
      const br = Math.sin(now * 2.2 + u.ph);
      bob = br * 0.008; lA = Math.sin(now * 1.3 + u.ph) * 0.04; rA = -lA; armZ = 0.1 + br * 0.015; lE = rE = -0.12; headY = Math.sin(now * 0.5 + u.ph) * 0.35;
    }
    const dm = (o, key, v) => { if (o) o[key] += (v - o[key]) * k; };
    dm(P.legL.rotation, 'x', lH); dm(P.legR.rotation, 'x', rH); dm(P.knL.rotation, 'x', lK); dm(P.knR.rotation, 'x', rK);
    dm(P.armL.rotation, 'x', lA); dm(P.armR.rotation, 'x', rA); dm(P.elL.rotation, 'x', lE); dm(P.elR.rotation, 'x', rE);
    dm(P.armL.rotation, 'z', -armZ); dm(P.armR.rotation, 'z', armZ); dm(P.head.rotation, 'y', headY);
    dm(P.rig.position, 'y', bob); dm(P.rig.rotation, 'x', lean); dm(P.rig.rotation, 'y', twist);
    const capeX = 0.08 + u.spd * 0.05 + (air ? 0.4 : 0);
    P.capes.forEach(cp => dm(cp.rotation, 'x', capeX));
  }
}


// ----- Papan leaderboard 3D di belakang karakter (sinkron per-room) -----
function buildLobbyLeaderboard() {
  if (lobbyLeaderboardGroup || !lobbyWorldGroup || !character) return;

  lobbyLeaderboardGroup = new THREE.Group();
  lobbyLeaderboardGroup.name = 'LOBBY_ONLINE_LEADERBOARD';
  // Di belakang karakter utama, tepat di belakang area START dan menghadap pemain.
  lobbyLeaderboardGroup.position.set(0, 0, -6.35);
  lobbyLeaderboardGroup.rotation.y = 0;
  lobbyWorldGroup.add(lobbyLeaderboardGroup);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x10182b, metalness: 0.62, roughness: 0.32 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.55, 5.55), frameMat);
  frame.position.set(0, 2.78, -0.06);
  frame.castShadow = true;
  frame.receiveShadow = true;
  lobbyLeaderboardGroup.add(frame);

  lobbyLeaderboardCanvas = document.createElement('canvas');
  lobbyLeaderboardCanvas.width = 1024;
  lobbyLeaderboardCanvas.height = 1024;
  lobbyLeaderboardCtx = lobbyLeaderboardCanvas.getContext('2d');
  lobbyLeaderboardTexture = new THREE.CanvasTexture(lobbyLeaderboardCanvas);
  lobbyLeaderboardTexture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(5.35, 5.35),
    new THREE.MeshBasicMaterial({ map: lobbyLeaderboardTexture, transparent: false, side: THREE.DoubleSide })
  );
  panel.position.set(0, 2.78, 0.075);
  lobbyLeaderboardGroup.add(panel);

  // Lampu tepi agar papan mudah terlihat di lobby.
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x42d9ff });
  for (const [x, y, z, w, h, d] of [
    [0, 5.48, 0.12, 5.4, 0.045, 0.05],
    [0, 0.08, 0.12, 5.4, 0.045, 0.05],
    [-2.68, 2.78, 0.12, 0.045, 5.4, 0.05],
    [2.68, 2.78, 0.12, 0.045, 5.4, 0.05]
  ]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
    edge.position.set(x, y, z);
    lobbyLeaderboardGroup.add(edge);
  }
}

function createLeaderboardAvatar(data) {
  const eq = data.equipped || {};
  const model = character.clone(true);
  const map = new Map();
  const walk = (a, b) => {
    map.set(a, b);
    a.children.forEach((ch, i) => { if (b.children[i]) walk(ch, b.children[i]); });
  };
  walk(character, model);

  const ns = map.get(nameSprite);
  if (ns) model.remove(ns);

  const materialMap = new Map(), mats = [];
  model.traverse((obj) => {
    if (!obj.material) return;
    if (!materialMap.has(obj.material)) {
      const cloned = obj.material.clone();
      materialMap.set(obj.material, cloned);
      mats.push(cloned);
    }
    obj.material = materialMap.get(obj.material);
  });

  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);

  const P = (obj) => map.get(obj);
  const parts = {
    rig: P(rig), head: P(headGroup),
    armL: P(leftArmPivot), armR: P(rightArmPivot),
    legL: P(leftLegPivot), legR: P(rightLegPivot),
    elL: P(leftElbow), elR: P(rightElbow),
    knL: P(leftKnee), knR: P(rightKnee),
    capes: [P(capePivot), P(capeB), P(capeT)].filter(Boolean)
  };
  [parts.rig, parts.head, parts.armL, parts.armR, parts.legL, parts.legR,
    parts.elL, parts.elR, parts.knL, parts.knR, ...parts.capes]
    .forEach(obj => obj && obj.rotation.set(0, 0, 0));

  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(0.16);
  holder.userData = { model, map, mats, parts, eqKey: JSON.stringify(eq) };
  applyRemoteCostume(holder.userData, eq);
  return holder;
}

function disposeLeaderboardAvatar(id) {
  const avatar = lobbyLeaderboardAvatars.get(id);
  if (!avatar) return;
  if (lobbyLeaderboardGroup) lobbyLeaderboardGroup.remove(avatar);
  (avatar.userData.mats || []).forEach(mat => mat.dispose());
  lobbyLeaderboardAvatars.delete(id);
}

async function refreshSoloLeaderboard(force = false) {
  if (soloLeaderboardLoading || ( !force && Date.now() - soloLeaderboardLastFetch < 10000)) return;
  soloLeaderboardLoading = true;
  try {
    const [data, profiles] = await Promise.all([
      socialGet('leaderboard').catch(() => ({})),
      socialGet('players').catch(() => ({}))
    ]);
    await loadCrownSettings();
    soloLeaderboardEntries = Object.entries(data || {})
      .filter(([key, p]) => p && Number(p.bestScore) > 0 && Number(p.crowns ?? profiles?.[key]?.crowns ?? 0) >= leaderboardMinCrowns)
      .map(([key, p]) => ({
        id: key, username: String(p.username || key).slice(0, 18),
        playerId: String(p.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : '------')),
        isDev: !!p.isDev, equipped: p.equipped || {}, crowns: key === DEV_USERNAME ? ADMIN_FIXED_CROWNS : Math.max(0, Number(profiles?.[key]?.crowns ?? p.crowns) || 0),
        bestScore: Number(p.bestScore) || 0, bestTimeMs: Number(p.bestTimeMs) || 0,
        finishMs: Number(p.bestTimeMs) || null
      }))
      .sort((a, b) => b.crowns - a.crowns || String(a.username).localeCompare(String(b.username)))
      .slice(0, MAX_PLAYERS);
    soloLeaderboardLastFetch = Date.now();
    if (!roomCode) updateLobbyLeaderboard();
  } catch (e) { console.warn('Leaderboard solo belum dapat dimuat:', e); }
  finally { soloLeaderboardLoading = false; }
}

function updateLobbyLeaderboard() {
  if (!lobbyLeaderboardGroup || !lobbyLeaderboardCtx || !lobbyLeaderboardTexture) return;

  const sourcePlayers = roomCode ? (roomPlayers || {}) : Object.fromEntries(soloLeaderboardEntries.map(p => [p.id, p]));
  const ids = Object.keys(sourcePlayers).sort((a, b) => {
    const pa = sourcePlayers[a] || {}, pb = sourcePlayers[b] || {};
    if (!roomCode) return (Number(pb.crowns) || 0) - (Number(pa.crowns) || 0) || String(pa.username || '').localeCompare(String(pb.username || ''));
    const af = Number.isFinite(Number(pa.finishMs)) && pa.finishMs != null;
    const bf = Number.isFinite(Number(pb.finishMs)) && pb.finishMs != null;
    if (af && bf) return Number(pb.score || 0) - Number(pa.score || 0) || Number(pa.finishMs) - Number(pb.finishMs);
    if (af !== bf) return af ? -1 : 1;
    return (pa.joinedAt || 0) - (pb.joinedAt || 0);
  }).slice(0, MAX_PLAYERS);

  const entries = ids.map((id, index) => {
    const p = sourcePlayers[id] || {};
    const finished = roomCode ? (p.finishMs != null && Number.isFinite(Number(p.finishMs))) : Number(p.bestScore) > 0;
    const score = roomCode ? (Number(p.score) || 0) : (Number(p.bestScore) || 0);
    const timeMs = roomCode ? (Number(p.finishMs) || 0) : (Number(p.bestTimeMs) || 0);
    return {
      id, index, name: String(p.username || 'Pemain').slice(0, 18),
      crowns: Math.max(0, Math.floor(Number(p.crowns) || 0)), finished, score, timeMs,
      host: !!(roomMeta && roomMeta.host === id),
      isMe: roomCode ? id === mpUid : id === accountKey(),
      eqKey: JSON.stringify(p.equipped || {})
    };
  });
  const key = JSON.stringify({ roomCode, entries: entries.map(e => [e.id, e.name, e.finished, e.score, e.timeMs, e.host, e.isMe, e.eqKey, e.crowns]) });
  if (key === lobbyLeaderboardLastKey) return;
  lobbyLeaderboardLastKey = key;

  // Gambar ulang panel papan.
  const c = lobbyLeaderboardCanvas, x = lobbyLeaderboardCtx;
  x.clearRect(0, 0, c.width, c.height);
  const grad = x.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#142747'); grad.addColorStop(1, '#080f20');
  x.fillStyle = grad; x.fillRect(0, 0, 1024, 1024);
  x.strokeStyle = '#42d9ff'; x.lineWidth = 12; x.strokeRect(12, 12, 1000, 1000);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 76px sans-serif'; x.fillStyle = '#ffffff';
  x.fillText('LEADERBOARD', 512, 82);
  x.font = 'bold 30px sans-serif'; x.fillStyle = '#42d9ff';
  x.fillText(roomCode ? `ROOM ${roomCode}  •  ${entries.length}/${MAX_PLAYERS} PEMAIN` : `JUMLAH MAHKOTA • MIN. ${leaderboardMinCrowns} 👑`, 512, 142);
  x.strokeStyle = 'rgba(66,217,255,.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(55, 188); x.lineTo(969, 188); x.stroke();

  if (!entries.length) {
    x.fillStyle = '#dce8ff'; x.font = 'bold 38px sans-serif';
    x.fillText(roomCode ? 'MENUNGGU PEMAIN' : 'BELUM ADA REKOR', 512, 470);
    x.font = '28px sans-serif'; x.fillStyle = '#8fa9d4';
    x.fillText(roomCode ? 'Mulai lomba untuk melihat peringkat' : 'Selesaikan parkour untuk masuk leaderboard', 512, 525);
  } else {
    entries.forEach((e, i) => {
      const top = 205 + i * 99;
      x.fillStyle = e.isMe ? 'rgba(66,217,255,.20)' : (i % 2 ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.085)');
      x.beginPath(); x.roundRect(42, top, 940, 88, 18); x.fill();
      x.fillStyle = i === 0 && e.finished ? '#ffd166' : '#42d9ff';
      x.font = '900 42px sans-serif'; x.textAlign = 'left';
      x.fillText(String(i + 1).padStart(2, '0'), 72, top + 44);
      x.fillStyle = '#ffffff'; x.font = 'bold 36px sans-serif';
      const name = (e.host ? '👑 ' : '') + e.name + (e.isMe ? ' (KAMU)' : '');
      x.fillText(name, 178, top + 34, 500);
      x.textAlign = 'left'; x.font = '22px sans-serif'; x.fillStyle = '#8fb9dc';
      x.fillText('ID ' + String((sourcePlayers[e.id] || {}).playerId || (e.name.toLowerCase() === DEV_USERNAME ? ADMIN_PLAYER_ID : '------')), 180, top + 67, 460);
      x.textAlign = 'right'; x.font = '900 30px sans-serif';
      x.fillStyle = '#ffd76a';
      x.fillText('👑 ' + String(e.crowns), 950, top + 44);
    });
  }
  lobbyLeaderboardTexture.needsUpdate = true;

  // Miniatur karakter 3D asli (termasuk wajah dan kostum) ditampilkan di depan tiap baris.
  const alive = new Set(entries.map(e => e.id));
  for (const id of [...lobbyLeaderboardAvatars.keys()]) if (!alive.has(id)) disposeLeaderboardAvatar(id);
  entries.forEach((e, i) => {
    const p = sourcePlayers[e.id] || {};
    let avatar = lobbyLeaderboardAvatars.get(e.id);
    if (avatar && avatar.userData.eqKey !== e.eqKey) {
      disposeLeaderboardAvatar(e.id);
      avatar = null;
    }
    if (!avatar) {
      avatar = createLeaderboardAvatar(p);
      lobbyLeaderboardAvatars.set(e.id, avatar);
      lobbyLeaderboardGroup.add(avatar);
    }
    // Board group diputar menghadap tengah lobby; posisi ini berada sedikit di depan permukaan papan.
    avatar.position.set(-1.95, 4.62 - i * 0.495, 0.22);
    avatar.rotation.y = 0;
    avatar.visible = true;
  });
}

// ----- SISTEM TEMAN, PENCARIAN, DAN UNDANGAN -----
let playerSearchBusy = false;
let socialPollTimer = null;
let socialPollBusy = false;
let activeInviteKey = '';
let lastInviteToastStamp = '', lastRequestSig = null;
const myPlayerKey = () => accountKey();
const socialUrl = path => `${FIREBASE_URL}${path}.json`;

async function socialGet(path) {
  const res = await fetch(socialUrl(path), { cache: 'no-store' });
  if (!res.ok) throw new Error('Firebase tidak merespons');
  return await res.json();
}
async function socialPatch(path, data) {
  const res = await fetch(socialUrl(path), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Gagal menyimpan data sosial');
  return res;
}
function safeSocialText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ===== GANTI NAMA PROFIL =====
// Akun punya dua hal: KUNCI AKUN (permanen: dipakai pertemanan, leaderboard, presence, undangan, inventory, koin)
// dan NAMA TAMPILAN (bisa diganti). Ganti nama hanya mengubah nama tampilan -> semua data & pertemanan tetap utuh.
// Nama baru juga bisa dipakai untuk login (indeks `usernames/<nama>` -> kunci akun); nama lama tetap bisa dipakai login.
// Ganti nama pertama GRATIS, kedua dan seterusnya 10.000 koin.
const RENAME_COST = 10000, NAME_MIN = 3, NAME_MAX = 18;
function accountKey() { return String((playerData && (playerData.userKey || playerData.username)) || '').trim().toLowerCase(); }
async function resolveUserKey(name) { // nama (asli atau hasil ganti nama) -> kunci akun
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return lower;
  try {
    const r = await fetch(`${FIREBASE_URL}usernames/${encodeURIComponent(lower)}.json`, { cache: 'no-store' });
    if (r.ok) { const k = await r.json(); if (typeof k === 'string' && k) return k; }
  } catch (e) { /* offline: pakai nama apa adanya */ }
  return lower;
}
const fmtCoins = (n) => Number(n || 0).toLocaleString('id-ID');
const renameCount = () => Math.max(0, Math.floor(Number(playerData.nameChanges) || 0));
const nextRenameCost = () => renameCount() === 0 ? 0 : RENAME_COST;
function validateNewName(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN) return { ok: false, msg: `Nama minimal ${NAME_MIN} karakter` };
  if (name.length > NAME_MAX) return { ok: false, msg: `Nama maksimal ${NAME_MAX} karakter` };
  if (!/^[A-Za-z0-9_ -]+$/.test(name)) return { ok: false, msg: 'Hanya huruf, angka, spasi, _ dan -' };
  const key = name.toLowerCase();
  if (key.replace(/[ _-]/g, '').includes(DEV_USERNAME)) return { ok: false, msg: 'Nama itu tidak boleh dipakai' };
  return { ok: true, name, key };
}
let renameBusy = false;
async function changeDisplayName(rawName) {
  if (renameBusy) return { ok: false, msg: 'Sedang memproses…' };
  const v = validateNewName(rawName);
  if (!v.ok) return v;
  const me = accountKey();
  if (!me) return { ok: false, msg: 'Akun tidak valid' };
  if (me === DEV_USERNAME || playerData.isDev) return { ok: false, msg: 'Akun admin tidak bisa mengganti nama' };
  if (v.name === String(playerData.username || '')) return { ok: false, msg: 'Itu sudah jadi namamu sekarang' };
  const cost = nextRenameCost(), coins = Math.floor(Number(playerData.coins) || 0);
  if (coins < cost) return { ok: false, msg: `❌ Koin tidak cukup (butuh 🪙 ${fmtCoins(cost)})` };
  renameBusy = true;
  const enc = encodeURIComponent, oldName = String(playerData.username || ''), oldNameKey = oldName.trim().toLowerCase();
  const json = { 'Content-Type': 'application/json' };
  let claimed = false;
  try {
    if (v.key !== me) { // nama harus belum dipakai akun lain (kunci akun maupun nama hasil ganti nama)
      const [acc, alias] = await Promise.all([socialGet(`players/${enc(v.key)}`), socialGet(`usernames/${enc(v.key)}`)]);
      if (acc || (alias && alias !== me)) return { ok: false, msg: 'Nama itu sudah dipakai pemain lain' };
      const put = await fetch(socialUrl(`usernames/${enc(v.key)}`), { method: 'PUT', headers: json, body: JSON.stringify(me) });
      if (!put.ok) throw new Error('Gagal memesan nama');
      claimed = alias !== me;                                  // jika sebelumnya sudah milik sendiri, jangan dihapus saat batal
      if ((await socialGet(`usernames/${enc(v.key)}`)) !== me) { claimed = false; return { ok: false, msg: 'Nama itu baru saja diambil pemain lain' }; }
    }
    const newCoins = coins - cost, newCount = renameCount() + 1;
    const res = await fetch(socialUrl(`players/${enc(me)}`), { method: 'PATCH', headers: json, body: JSON.stringify({ username: v.name, coins: newCoins, nameChanges: newCount, nameChangedAt: Date.now() }) });
    if (!res.ok) throw new Error('Gagal menyimpan nama baru');
    claimed = false;                                           // berhasil: pemesanan nama dipertahankan
    playerData.username = v.name; playerData.coins = newCoins; playerData.nameChanges = newCount;
    refreshNameUI();
    propagateNewName(me, v.name, oldNameKey, v.key).catch(e => console.warn('Sebar nama baru sebagian gagal:', e));
    return { ok: true, name: v.name, cost };
  } catch (e) {
    if (claimed) fetch(socialUrl(`usernames/${enc(v.key)}`), { method: 'DELETE' }).catch(() => {});
    return { ok: false, msg: e.message || 'Gagal mengganti nama' };
  } finally { renameBusy = false; }
}
function refreshNameUI() { // perbarui semua tampilan nama milik sendiri
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('hud-username', playerData.username);
  set('modal-username', `${playerData.username} · ID ${playerData.playerId || (playerData.isDev ? ADMIN_PLAYER_ID : 'belum tersedia')}`);
  set('coin-amount', playerData.coins || 0);
  try { if (nameSprite) updateCharacterNameSprite(playerData.username, playerData.isDev); } catch (e) {}
  ensureRenameProfileUI();
}
async function propagateNewName(me, name, oldNameKey, newKey) { // nama baru tampil di teman, leaderboard, presence, room
  const enc = encodeURIComponent, json = { 'Content-Type': 'application/json' }, tasks = [];
  if (oldNameKey && oldNameKey !== me && oldNameKey !== newKey) { // lepas nama lama hasil ganti nama sebelumnya
    tasks.push(socialGet(`usernames/${enc(oldNameKey)}`).then(cur => cur === me ? fetch(socialUrl(`usernames/${enc(oldNameKey)}`), { method: 'DELETE' }) : null));
  }
  const friends = await socialGet(`friends/${enc(me)}`).catch(() => null);
  for (const fk of Object.keys(friends || {})) { // catatan "temanku" di sisi teman, hanya jika masih ada (tidak menghidupkan lagi pertemanan yang sudah dihapus)
    tasks.push(socialGet(`friends/${enc(fk)}/${enc(me)}`).then(e => e ? socialPatch(`friends/${enc(fk)}/${enc(me)}`, { username: name }) : null));
  }
  tasks.push(socialGet(`leaderboard/${enc(me)}`).then(e => e ? socialPatch(`leaderboard/${enc(me)}`, { username: name.slice(0, 18) }) : null));
  tasks.push(socialPatch(`presence/${enc(me)}`, { username: name }));
  try { // sedang di room: nama baru langsung terlihat pemain lain
    if (typeof roomCode !== 'undefined' && roomCode && myRef) {
      update(myRef, { username: name.slice(0, 18) }).catch(() => {});
      if (typeof roomMeta !== 'undefined' && roomMeta && roomMeta.host === mpUid) update(ref(multiplayerDb, `rooms/${roomCode}/meta`), { hostName: name.slice(0, 18) }).catch(() => {});
    }
  } catch (e) {}
  await Promise.allSettled(tasks);
  try { refreshSoloLeaderboard(true).catch(() => {}); } catch (e) {}
}
function ensureRenameProfileUI() {
  const anchor = document.getElementById('modal-username');
  if (!anchor) return;
  let row = document.getElementById('rename-row');
  if (!row) {
    row = document.createElement('div'); row.id = 'rename-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 10px';
    const btn = document.createElement('button'); btn.id = 'btn-rename'; btn.type = 'button'; btn.textContent = '✏️ Ganti Nama';
    btn.style.cssText = 'padding:7px 12px;border:0;border-radius:10px;background:linear-gradient(135deg,#3aa0ff,#7a5cff);color:#fff;font-weight:700;cursor:pointer';
    btn.onclick = openRenameDialog;
    const hint = document.createElement('small'); hint.id = 'rename-hint'; hint.style.cssText = 'opacity:.85;font-size:12px';
    row.append(btn, hint);
    anchor.insertAdjacentElement('afterend', row);
  }
  const locked = !!(playerData.isDev || accountKey() === DEV_USERNAME);
  document.getElementById('btn-rename').disabled = locked;
  document.getElementById('btn-rename').style.opacity = locked ? '0.5' : '1';
  document.getElementById('rename-hint').textContent = locked ? 'Akun admin tidak bisa ganti nama' : (nextRenameCost() === 0 ? 'Gratis untuk pertama kali' : `Biaya 🪙 ${fmtCoins(RENAME_COST)}`);
}
function openRenameDialog() {
  let ov = document.getElementById('rename-overlay');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'rename-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72)';
    ov.innerHTML = '<section style="width:min(360px,100%);background:#141a2e;border:2px solid #7fd6ff;border-radius:16px;padding:18px;color:#fff;font-family:sans-serif;box-sizing:border-box">'
      + '<div style="font-size:18px;font-weight:800;margin-bottom:6px">✏️ Ganti Nama</div>'
      + '<div id="rn-cur" style="font-size:13px;opacity:.85;margin-bottom:10px"></div>'
      + '<input id="rn-input" type="text" maxlength="' + NAME_MAX + '" autocomplete="off" placeholder="Nama baru (3-' + NAME_MAX + ' karakter)" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:2px solid #3b4a78;background:#0d1224;color:#fff;font-size:16px;outline:none">'
      + '<div id="rn-cost" style="margin:10px 0 4px;font-weight:700;color:#ffd76a"></div>'
      + '<div id="rn-msg" style="min-height:18px;font-size:13px;color:#ff8a8a;margin-bottom:8px"></div>'
      + '<div style="display:flex;gap:8px"><button id="rn-cancel" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:#2a3354;color:#fff;font-weight:700;cursor:pointer">Batal</button>'
      + '<button id="rn-ok" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:linear-gradient(135deg,#3aa0ff,#7a5cff);color:#fff;font-weight:700;cursor:pointer">Ganti</button></div>'
      + '<div style="margin-top:10px;font-size:11px;opacity:.7">Teman, koin, kostum, dan rekor tetap aman. Nama lama tetap bisa dipakai untuk login.</div></section>';
    document.body.appendChild(ov);
    const input = ov.querySelector('#rn-input'), msg = ov.querySelector('#rn-msg'), ok = ov.querySelector('#rn-ok');
    ['keydown', 'keyup', 'keypress'].forEach(ev => input.addEventListener(ev, e => e.stopPropagation()));
    ov.querySelector('#rn-cancel').onclick = () => { ov.style.display = 'none'; };
    const submit = async () => {
      if (ok.disabled) return;
      ok.disabled = true; msg.style.color = '#9ad7ff'; msg.textContent = 'Memproses…';
      const r = await changeDisplayName(input.value);
      ok.disabled = false;
      if (!r.ok) { msg.style.color = '#ff8a8a'; msg.textContent = r.msg || 'Gagal'; return; }
      ov.style.display = 'none';
      showToast(`✅ Nama diganti menjadi ${r.name}` + (r.cost ? ` (−${fmtCoins(r.cost)} koin)` : ' (gratis)'));
    };
    ok.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }
  const cost = nextRenameCost();
  ov.querySelector('#rn-cur').textContent = `Nama sekarang: ${playerData.username}`;
  ov.querySelector('#rn-cost').textContent = cost === 0 ? '🎁 Ganti nama pertama: GRATIS' : `Biaya: 🪙 ${fmtCoins(cost)} (koinmu: ${fmtCoins(playerData.coins)})`;
  ov.querySelector('#rn-msg').textContent = ''; ov.querySelector('#rn-input').value = '';
  ov.style.display = 'flex';
  setTimeout(() => ov.querySelector('#rn-input').focus(), 50);
}
// ===== END GANTI NAMA =====

async function loadMyFriends() {
  const key = myPlayerKey();
  if (!key) return {};
  return await socialGet(`friends/${key}`) || {};
}
async function addFriend(targetKey, targetName) {
  const me = myPlayerKey();
  if (!me || !targetKey || targetKey === me) return;
  const friends = await loadMyFriends();
  if (friends[targetKey]) { showToast('Kalian sudah berteman'); return; }
  const existing = await socialGet(`friendRequests/${targetKey}/${me}`).catch(() => null);
  if (existing?.status === 'pending') { showToast('Permintaan teman sudah dikirim'); return; }
  const stamp = Date.now();
  await socialPatch(`friendRequests/${targetKey}`, { [me]: { from: me, fromName: playerData.username, to: targetKey, toName: targetName, sentAt: stamp, status: 'pending' } });
  showToast(`Permintaan pertemanan dikirim ke ${targetName}`);
  const q = document.getElementById('ps-query'); if (q?.value) searchGlobalPlayers(q.value);
}
async function respondFriendRequest(requestKey, accept) {
  const me = myPlayerKey();
  const req = await socialGet(`friendRequests/${me}/${requestKey}`).catch(() => null);
  if (!req || req.status !== 'pending') return;
  if (accept) {
    const stamp = Date.now();
    await Promise.all([
      socialPatch(`friends/${me}`, { [requestKey]: { username: req.fromName || requestKey, addedAt: stamp } }),
      socialPatch(`friends/${requestKey}`, { [me]: { username: playerData.username, addedAt: stamp } })
    ]);
  }
  await socialPatch(`friendRequests/${me}/${requestKey}`, { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() });
  showToast(accept ? `✓ ${req.fromName || requestKey} sekarang temanmu` : 'Permintaan pertemanan ditolak');
  await renderFriendsList();
  await renderIncomingFriendRequests();
}
async function renderIncomingFriendRequests() {
  const list = document.getElementById('ps-requests');
  if (!list) return;
  const requests = await socialGet(`friendRequests/${myPlayerKey()}`).catch(() => ({}));
  const pending = Object.entries(requests || {}).filter(([, r]) => r?.status === 'pending');
  list.replaceChildren();
  if (!pending.length) { list.textContent = 'Tidak ada permintaan pertemanan.'; return; }
  pending.forEach(([key, req]) => {
    const row = document.createElement('div'); row.className = 'ps-result';
    const info = document.createElement('div'); info.className = 'ps-info';
    const name = document.createElement('b'); name.textContent = req.fromName || key;
    socialGet(`players/${encodeURIComponent(key)}/username`).then(n => { if (n) name.textContent = n; }).catch(() => {}); // nama terbaru pengirim
    const meta = document.createElement('small'); meta.textContent = 'Ingin berteman denganmu'; info.append(name, meta);
    const actions = document.createElement('div'); actions.className = 'ps-friend-actions';
    const yes = document.createElement('button'); yes.className = 'ps-action'; yes.textContent = '✓'; yes.title = 'Terima';
    yes.onclick = () => respondFriendRequest(key, true).catch(e => showToast(e.message));
    const no = document.createElement('button'); no.className = 'ps-remove'; no.textContent = '×'; no.title = 'Tolak';
    no.onclick = () => respondFriendRequest(key, false).catch(e => showToast(e.message));
    actions.append(yes, no); row.append(info, actions); list.append(row);
  });
}
async function removeFriend(targetKey) {
  const me = myPlayerKey();
  await Promise.all([
    fetch(socialUrl(`friends/${me}/${targetKey}`), { method: 'DELETE' }),
    fetch(socialUrl(`friends/${targetKey}/${me}`), { method: 'DELETE' })
  ]);
  showToast('Teman dihapus');
  await renderFriendsList();
}
async function sendGameInvite(targetKey, targetName) {
  if (roomCode && roomMeta && roomMeta.host !== mpUid) {
    showToast('Hanya pembuat room yang bisa mengundang teman.');
    return;
  }
  if (roomCode && (roomStarted || roomMeta?.startAt)) {
    showToast('Permainan sudah dimulai. Selesaikan dulu sebelum mengundang.');
    return;
  }
  if (!roomCode) {
    showToast('Menyiapkan lobby untuk undangan…');
    await createRoom();
  }
  const invite = { from: myPlayerKey(), fromName: playerData.username, to: targetKey, roomCode, sentAt: Date.now(), status: 'pending' };
  await socialPatch(`gameInvites/${targetKey}`, { [myPlayerKey()]: invite });
  showToast(`Undangan dikirim ke ${targetName}`);
}

// ----- PROFIL PUBLIK PEMAIN (fitur periksa akun / stalking) -----
function ensurePublicProfileModal() {
  if (document.getElementById('public-player-profile')) return;
  const css = document.createElement('style');
  css.id = 'public-player-profile-style';
  css.textContent = `#public-player-profile{position:fixed;inset:0;z-index:10030;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);font-family:sans-serif}#public-player-card{width:min(360px,100%);max-height:82vh;overflow:auto;padding:20px;border:1px solid rgba(66,217,255,.7);border-radius:18px;background:linear-gradient(145deg,#172a49,#080f20);box-shadow:0 12px 40px #0009;color:#fff}#pp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}#pp-title{font-size:18px;font-weight:900;color:#42d9ff}#pp-close{border:0;border-radius:8px;background:#34435c;color:#fff;width:32px;height:32px;font-size:20px}#pp-avatar{width:64px;height:64px;margin:0 auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#355b87,#141c30);border:2px solid #ffd76a;font-size:30px}#pp-name{text-align:center;font-size:21px;font-weight:900;overflow-wrap:anywhere}#pp-role{text-align:center;color:#a9c9ff;font-size:12px;margin:5px 0 15px}#pp-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}#pp-stats .pp-stat{padding:11px;border-radius:10px;background:rgba(255,255,255,.07);text-align:center}#pp-stats b{display:block;font-size:19px;color:#ffd76a}#pp-stats small{color:#aab9d0}#pp-outfit{margin-top:12px;padding:11px;border-radius:10px;background:rgba(255,255,255,.06);font-size:13px;line-height:1.7}#pp-status{text-align:center;margin-top:12px;color:#8fffc1;font-size:12px}`;
  document.head.appendChild(css);
  const overlay = document.createElement('div'); overlay.id = 'public-player-profile';
  overlay.innerHTML = `<section id="public-player-card"><div id="pp-head"><span id="pp-title">👤 PROFIL PEMAIN</span><button id="pp-close" type="button">×</button></div><div id="pp-avatar">👤</div><div id="pp-name">Pemain</div><div id="pp-role">PLAYER</div><div id="pp-stats"><div class="pp-stat"><b id="pp-crowns">👑 0</b><small>Mahkota</small></div><div class="pp-stat"><b id="pp-coins">🪙 0</b><small>Koin</small></div><div class="pp-stat"><b id="pp-items">0</b><small>Item dimiliki</small></div><div class="pp-stat"><b id="pp-id">------</b><small>ID pemain</small></div></div><div id="pp-outfit">Kostum: -</div><div id="pp-status">Data profil publik</div></section>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
  document.getElementById('pp-close').onclick = () => { overlay.style.display = 'none'; };
}
function getEquippedPublicNames(profile) {
  const eq = profile?.equipped || {};
  const categories = [['baju','baju'],['celana','celana'],['sepatu','sepatu'],['aksesoris','aksesoris']];
  return categories.map(([key, cat]) => {
    const id = eq[key];
    const item = (SHOP_ITEMS[cat] || []).find(x => x.id === id);
    return item ? item.name : (id ? String(id).replace(/^(baju|celana|sepatu|aks_)/,'').replaceAll('_',' ') : 'Default');
  }).join(' · ');
}
async function inspectPlayerAccount(playerKey, fallbackName = '') {
  const key = String(playerKey || '').trim().toLowerCase();
  if (!key || key === myPlayerKey()) { showToast('Itu akun kamu sendiri'); return; }
  ensurePublicProfileModal();
  const overlay = document.getElementById('public-player-profile');
  overlay.style.display = 'flex';
  document.getElementById('pp-name').textContent = fallbackName || key;
  document.getElementById('pp-role').textContent = 'Memuat profil…';
  document.getElementById('pp-status').textContent = 'Mengambil data publik dari Firebase…';
  try {
    const profile = await socialGet(`players/${key}`);
    if (!profile) throw new Error('Akun tidak ditemukan');
    const username = String(profile.username || fallbackName || key).slice(0, 24);
    const crowns = Math.max(0, Math.floor(Number(profile.crowns) || 0));
    const coins = Math.max(0, Math.floor(Number(profile.coins) || 0));
    const inventory = Array.isArray(profile.inventory) ? profile.inventory : [];
    document.getElementById('pp-name').textContent = username;
    document.getElementById('pp-role').textContent = profile.isDev ? 'DEVELOPER ✔' : 'PLAYER';
    document.getElementById('pp-crowns').textContent = `👑 ${crowns}`;
    document.getElementById('pp-coins').textContent = `🪙 ${coins.toLocaleString('id-ID')}`;
    document.getElementById('pp-items').textContent = String(inventory.length);
    document.getElementById('pp-id').textContent = String(profile.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : '------'));
    document.getElementById('pp-outfit').textContent = `Kostum dipakai: ${getEquippedPublicNames(profile)}`;
    document.getElementById('pp-status').textContent = 'Profil publik · PIN dan data login tidak ditampilkan';
  } catch (e) {
    document.getElementById('pp-role').textContent = 'PROFIL TIDAK TERSEDIA';
    document.getElementById('pp-status').textContent = e.message || 'Gagal memuat profil';
  }
}

async function searchGlobalPlayers(query) {
  const q = String(query || '').trim().toLowerCase();
  const result = document.getElementById('player-search-results');
  if (!result) return;
  if (!q) { result.textContent = 'Masukkan username atau ID pemain.'; return; }
  if (playerSearchBusy) return;
  playerSearchBusy = true;
  result.textContent = 'Mencari pemain…';
  try {
    const [players, friends] = await Promise.all([socialGet('players'), loadMyFriends()]);
    const matches = Object.entries(players || {}).filter(([key, pl]) => {
      const name = String(pl?.username || key).toLowerCase();
      const id = String(pl?.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : ''));
      return key !== myPlayerKey() && (name.includes(q) || (q.length === 6 && id === q));
    }).slice(0, 8);
    result.replaceChildren();
    if (!matches.length) { result.textContent = 'Pemain tidak ditemukan.'; return; }
    for (const [key, pl] of matches) {
      const outgoing = await socialGet(`friendRequests/${key}/${myPlayerKey()}`).catch(() => null);
      const row = document.createElement('div'); row.className = 'ps-result';
      const info = document.createElement('div'); info.className = 'ps-info';
      const name = document.createElement('b'); name.textContent = String(pl.username || key);
      const meta = document.createElement('small'); meta.textContent = `ID: ${String(pl.playerId || (key === DEV_USERNAME ? ADMIN_PLAYER_ID : '------'))} · ${key === DEV_USERNAME || pl.isDev ? 'ADMIN' : 'PLAYER'}`;
      info.append(name, meta);
      const actions = document.createElement('div'); actions.className = 'ps-friend-actions';
      const inspect = document.createElement('button'); inspect.className = 'ps-action'; inspect.textContent = '👁'; inspect.title = 'Periksa akun';
      inspect.onclick = () => inspectPlayerAccount(key, String(pl.username || key)).catch(e => showToast(e.message));
      actions.appendChild(inspect);
      const action = document.createElement('button'); action.className = 'ps-action ps-add'; action.title = friends[key] ? 'Sudah berteman' : 'Tambah teman';
      if (friends[key]) { action.textContent = '✓'; action.disabled = true; action.title = 'Sudah berteman'; }
      else if (outgoing?.status === 'pending') { action.textContent = '⌛'; action.disabled = true; action.title = 'Menunggu diterima'; }
      else { action.textContent = '+'; action.title = 'Kirim permintaan teman'; action.onclick = () => { action.disabled = true; action.textContent = '…'; addFriend(key, String(pl.username || key)).then(() => { action.textContent = '⌛'; action.title = 'Menunggu diterima'; }).catch(e => { action.disabled = false; action.textContent = '+'; showToast(e.message); }); }; }
      actions.appendChild(action); row.append(info, actions); result.appendChild(row);
    }
  } catch (e) {
    result.textContent = 'Gagal mencari. Periksa koneksi Firebase.';
    console.warn('Pencarian pemain gagal:', e);
  } finally { playerSearchBusy = false; }
}

async function renderFriendsList() {
  const list = document.getElementById('ps-friends');
  if (!list) return;
  try {
    const friends = await loadMyFriends();
    list.replaceChildren();
    const entries = Object.entries(friends);
    if (!entries.length) { list.textContent = 'Belum ada teman. Terima permintaan dari menu cari teman.'; return; }
    for (const [key, saved] of entries) {
      const profile = await socialGet(`players/${key}`).catch(() => null);
      if (!profile) continue;
      const row = document.createElement('div'); row.className = 'ps-result';
      const info = document.createElement('div'); info.className = 'ps-info';
      row.dataset.friendKey = key;
      const name = document.createElement('b'); name.textContent = String(profile.username || saved.username || key);
      const dot = document.createElement('span'); dot.className = 'ps-dot'; dot.dataset.key = key; name.prepend(dot);
      const meta = document.createElement('small'); meta.textContent = `ID: ${String(profile.playerId || '------')}`;
      info.append(name, meta);
      const inspect = document.createElement('button'); inspect.className = 'ps-action'; inspect.textContent = '👁'; inspect.title = 'Periksa akun';
      inspect.onclick = () => inspectPlayerAccount(key, String(profile.username || key)).catch(e => showToast(e.message));
      const invite = document.createElement('button'); invite.className = 'ps-action ps-invite'; invite.textContent = '+'; invite.title = 'Undang ke room';
      invite.onclick = () => sendGameInvite(key, String(profile.username || key)).catch(e => showToast(e.message));
      const removeBtn = document.createElement('button'); removeBtn.className = 'ps-remove'; removeBtn.textContent = '×'; removeBtn.title = 'Hapus teman';
      removeBtn.onclick = () => removeFriend(key).catch(e => showToast(e.message));
      const actions = document.createElement('div'); actions.className = 'ps-friend-actions'; actions.append(inspect, invite, removeBtn);
      row.append(info, actions); list.append(row);
    }
    friendKeysCache = new Set(entries.map(([k]) => k));
    applyFriendPresence();
  } catch (e) { list.textContent = 'Gagal memuat daftar teman.'; }
}

function showGameInvite(inviteKey, invite) {
  const overlay = document.getElementById('social-invite-overlay');
  if (!overlay || !invite || invite.status !== 'pending') return;
  activeInviteKey = inviteKey;
  document.getElementById('social-invite-name').textContent = `${invite.fromName || inviteKey} mengundangmu bermain!`;
  document.getElementById('social-invite-room').textContent = `ROOM ${invite.roomCode || '-----'}`;
  overlay.style.display = 'flex';
  overlay.dataset.inviter = inviteKey;
  overlay.dataset.room = String(invite.roomCode || '');
}
async function pollSocialNotifications() {
  if (socialPollBusy || !myPlayerKey() || gameState === 'LOGIN') return;
  socialPollBusy = true;
  try {
    const [invites, requests] = await Promise.all([
      socialGet(`gameInvites/${myPlayerKey()}`).catch(() => ({})),
      socialGet(`friendRequests/${myPlayerKey()}`).catch(() => ({}))
    ]);
    const pendingInvite = Object.entries(invites || {}).find(([, v]) => v?.status === 'pending');
    if (pendingInvite) {
      const stamp = pendingInvite[0] + ':' + (pendingInvite[1].sentAt || '');
      if (stamp !== lastInviteToastStamp) { lastInviteToastStamp = stamp; showToast(`📨 ${pendingInvite[1].fromName || pendingInvite[0]} mengundangmu main!`, 1000); }
      showGameInvite(pendingInvite[0], pendingInvite[1]);
    }
    const pendingRequests = Object.entries(requests || {}).filter(([, v]) => v?.status === 'pending');
    const reqSig = pendingRequests.map(([k]) => k).sort().join(',');
    if (reqSig !== lastRequestSig) { lastRequestSig = reqSig; await renderIncomingFriendRequests(); }
    const badge = document.getElementById('ps-notif-count');
    if (badge) { badge.textContent = String(pendingRequests.length); badge.style.display = pendingRequests.length ? 'inline-flex' : 'none'; }
  } catch (e) { console.warn('Polling notifikasi:', e); }
  finally { socialPollBusy = false; }
}
async function respondGameInvite(accept) {
  const overlay = document.getElementById('social-invite-overlay');
  if (!overlay) return;
  const from = overlay.dataset.inviter, code = overlay.dataset.room;
  overlay.style.display = 'none';
  await socialPatch(`gameInvites/${myPlayerKey()}/${from}`, { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() });
  if (accept) {
    if (!code) { showToast('Kode room tidak valid'); return; }
    try {
      if (roomCode) await leaveRoom(true);
      await joinRoom(code);
      showToast('Berhasil masuk lobby! Tunggu host memulai permainan.');
    }
    catch (e) { showToast('Tidak bisa bergabung: ' + e.message); }
  }
}

function buildPlayerSearchUI() {
  if (document.getElementById('player-search')) { renderFriendsList(); return; }
  const css = document.createElement('style');
  css.textContent = `#player-search{position:fixed;top:58px;right:58px;left:auto;z-index:58;width:min(310px,calc(100vw - 24px));max-height:75vh;overflow:auto;padding:10px;background:rgba(9,16,31,.95);border:1px solid rgba(66,217,255,.55);border-radius:13px;color:#fff;font:13px sans-serif;box-shadow:0 8px 28px #0006;backdrop-filter:blur(8px);display:none}#ps-head{display:flex;align-items:center;justify-content:space-between;font-weight:900;color:#42d9ff;margin-bottom:7px}#ps-close{border:0;background:#263a59;color:#fff;border-radius:7px;width:27px;height:27px;font-size:17px}#ps-launcher{position:fixed;top:16px;right:16px;left:auto;z-index:59;width:34px;height:34px;border:1px solid rgba(66,217,255,.75);border-radius:50%;background:rgba(9,16,31,.92);color:#42d9ff;font-size:18px;font-weight:900;box-shadow:0 3px 12px #0008;display:flex;align-items:center;justify-content:center}#ps-launcher:active{transform:scale(.94)}#ps-invite-launcher{position:fixed;top:58px;right:16px;z-index:59;width:34px;height:34px;border:1px solid rgba(255,190,80,.8);border-radius:50%;background:rgba(28,20,10,.92);color:#ffd166;font-size:16px;box-shadow:0 3px 12px #0008;display:flex;align-items:center;justify-content:center}#player-friends{position:fixed;top:58px;right:58px;left:auto;z-index:58;width:min(310px,calc(100vw - 24px));max-height:75vh;overflow:auto;padding:10px;background:rgba(9,16,31,.96);border:1px solid rgba(255,190,80,.55);border-radius:13px;color:#fff;font:13px sans-serif;box-shadow:0 8px 28px #0006;display:none}#pf-head{display:flex;justify-content:space-between;align-items:center;color:#ffd166;font-weight:900;margin-bottom:8px}#pf-close{border:0;background:#263a59;color:#fff;border-radius:7px;width:27px;height:27px;font-size:17px}#ps-controls{display:flex;gap:6px}#ps-query{min-width:0;flex:1;padding:9px;border-radius:8px;border:1px solid #52627d;background:#101b30;color:#fff;outline:none}#ps-submit,.ps-action{border:0;border-radius:8px;padding:7px 10px;background:#167bd4;color:#fff;font-weight:800;font-size:11px}.ps-action:disabled{background:#176b51;color:#b8ffe3}.ps-add{width:27px;height:27px;min-width:27px!important;padding:0!important;border-radius:50%!important;font-size:17px!important;line-height:27px}.ps-result{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:8px;background:rgba(255,255,255,.07)}.ps-info{display:flex;flex-direction:column;gap:3px;min-width:0}.ps-info b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ps-info small{color:#9fb4d5}#player-search-results,#ps-friends{display:flex;flex-direction:column;gap:5px;margin-top:7px;max-height:170px;overflow:auto}.ps-empty{padding:9px;color:#aab9d0;text-align:center}.ps-section{display:flex;align-items:center;justify-content:space-between;color:#42d9ff;font-weight:900;margin-top:12px;margin-bottom:5px}.ps-friend-actions{display:flex;gap:4px}.ps-invite{font-size:18px;min-width:32px;padding:3px}.ps-remove{border:0;border-radius:7px;background:#632d3c;color:#fff;font-size:18px;min-width:28px}.ps-notif{background:#e23c55;color:#fff;border-radius:50%;padding:2px 6px;font-size:10px}#social-invite-overlay{position:fixed;inset:0;z-index:10020;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.68);backdrop-filter:blur(5px);padding:18px}#social-invite-card{width:min(360px,100%);padding:24px;border:1px solid #42d9ff;border-radius:20px;background:linear-gradient(145deg,#142747,#080f20);box-shadow:0 0 35px #168bd766;color:#fff;text-align:center;font-family:sans-serif}#social-invite-card h2{margin:0 0 12px;color:#42d9ff}#social-invite-name{font-size:16px;font-weight:800}#social-invite-room{margin:15px 0;color:#a9c9ff;font-weight:900;letter-spacing:3px}.social-invite-actions{display:flex;gap:9px}.social-invite-actions button{flex:1;border:0;border-radius:10px;padding:12px;color:white;font-weight:900}.si-accept{background:#078b61}.si-decline{background:#713447}`;
  document.head.appendChild(css);
  const launcher = document.createElement('button'); launcher.id = 'ps-launcher'; launcher.type = 'button'; launcher.title = 'Cari teman'; launcher.textContent = '👤';
  const box = document.createElement('section'); box.id = 'player-search';
  box.innerHTML = `<div id="ps-head"><span>🔎 CARI TEMAN <span id="ps-notif-count" class="ps-notif" style="display:none">0</span></span><button id="ps-close" title="Tutup">×</button></div><div id="ps-controls"><input id="ps-query" maxlength="30" placeholder="Username / ID 6 digit" autocomplete="off"><button id="ps-submit">CARI</button></div><div id="player-search-results"><div class="ps-empty">Cari pemain lalu kirim permintaan teman.</div></div><div class="ps-section">PERMINTAAN MASUK</div><div id="ps-requests">Memuat permintaan…</div>`;
  const inviteLauncher = document.createElement('button'); inviteLauncher.id = 'ps-invite-launcher'; inviteLauncher.type = 'button'; inviteLauncher.title = 'Teman saya & undang bermain'; inviteLauncher.textContent = '👥';
  const friendsBox = document.createElement('section'); friendsBox.id = 'player-friends';
  friendsBox.innerHTML = `<div id="pf-head"><span>✉ TEMAN SAYA · UNDANG MAIN</span><button id="pf-close" title="Tutup">×</button></div><div id="ps-friends">Memuat teman…</div>`;
  document.body.append(launcher, inviteLauncher, box, friendsBox);
  inviteLauncher.onclick = () => { const open = friendsBox.style.display !== 'block'; friendsBox.style.display = open ? 'block' : 'none'; if (open) renderFriendsList(); };
  launcher.onclick = () => { const open = box.style.display !== 'block'; box.style.display = open ? 'block' : 'none'; if (open) renderIncomingFriendRequests(); };
  document.getElementById('ps-close').onclick = () => { box.style.display = 'none'; };
  document.getElementById('pf-close').onclick = () => { friendsBox.style.display = 'none'; };
  const overlay = document.createElement('div'); overlay.id = 'social-invite-overlay';
  overlay.innerHTML = `<div id="social-invite-card"><h2>🎮 UNDANGAN MAIN</h2><div id="social-invite-name">Pemain mengundangmu</div><div id="social-invite-room">ROOM -----</div><div class="social-invite-actions"><button class="si-decline" id="social-invite-no">TOLAK</button><button class="si-accept" id="social-invite-yes">GABUNG</button></div></div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById('ps-query');
  document.getElementById('ps-submit').onclick = () => searchGlobalPlayers(input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') searchGlobalPlayers(input.value); });
  document.getElementById('social-invite-no').onclick = () => respondGameInvite(false).catch(e => showToast(e.message));
  document.getElementById('social-invite-yes').onclick = () => respondGameInvite(true).catch(e => showToast(e.message));
  renderFriendsList();
  pollSocialNotifications();
  if (socialPollTimer) clearInterval(socialPollTimer);
  socialPollTimer = setInterval(pollSocialNotifications, 1000); // cek server tiap 1 detik
  startPresenceSystem();
}

// ----- STATUS ONLINE TEMAN (dicek ke server tiap 1 detik) -----
let friendKeysCache = new Set(), presenceTimer = null, presenceBeat = 0, presenceBusy = false;
const presenceSeen = new Map(); // key -> { v: nilai lastSeen terakhir, at: waktu lokal saat berubah }
const PRESENCE_TIMEOUT = 7000;
function isFriendOnline(key) { const p = presenceSeen.get(key); return !!p && p.v > 0 && (performance.now() - p.at) < PRESENCE_TIMEOUT; }
function applyFriendPresence() {
  document.querySelectorAll('.ps-dot').forEach(dot => {
    const on = isFriendOnline(dot.dataset.key);
    dot.classList.toggle('on', on); dot.title = on ? 'Online' : 'Offline';
    const small = dot.closest('.ps-info')?.querySelector('small');
    if (small) small.dataset.online = on ? '1' : '0';
  });
}
async function presenceTick() {
  if (presenceBusy || !myPlayerKey() || gameState === 'LOGIN') return;
  presenceBusy = true;
  try {
    presenceBeat++;
    if (presenceBeat % 2 === 0) socialPatch(`presence/${myPlayerKey()}`, { lastSeen: Date.now(), username: playerData.username }).catch(() => {});
    const box = document.getElementById('player-friends');
    if (box && box.style.display === 'block') {
      const all = await socialGet('presence').catch(() => null);
      if (all) for (const key of friendKeysCache) {
        const v = Number(all[key]?.lastSeen) || 0, prev = presenceSeen.get(key);
        if (!prev || prev.v !== v) presenceSeen.set(key, { v, at: performance.now() });
      }
      applyFriendPresence();
    }
  } finally { presenceBusy = false; }
}
function startPresenceSystem() {
  if (!document.getElementById('presence-css')) {
    const st = document.createElement('style'); st.id = 'presence-css';
    st.textContent = `.ps-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#6b7280;margin-right:6px;box-shadow:0 0 0 1px #0006}.ps-dot.on{background:#22e27a;box-shadow:0 0 7px #22e27a}#btn-push{position:fixed;right:22px;bottom:150px;z-index:60;width:62px;height:62px;border-radius:50%;border:2px solid #ffd166;background:rgba(28,20,10,.85);color:#ffd166;font-size:28px;display:none;align-items:center;justify-content:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent}#btn-push:active{transform:scale(.92)}#btn-push.cd{opacity:.4}`;
    document.head.appendChild(st);
  }
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(presenceTick, 1000);
  presenceTick();
  window.addEventListener('pagehide', () => { try { fetch(socialUrl(`presence/${myPlayerKey()}`), { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastSeen: 0 }) }); } catch (e) {} });
  buildPushButton();
}

// ----- GAMEPASS DORONG TEMAN -----
// Dorongan dikirim lewat node pemain sendiri (rooms/<kode>/players/<uid>/push), lalu korban
// yang membaca dan menerapkan hentakan di sisinya (memakai vektor 'knock' yang sudah ada).
const PUSH_RANGE = 3.2, PUSH_COOLDOWN = 1500, PUSH_FORCE = 30;
let pushSeq = 0, lastPushAt = 0;
const handledPush = new Map(); // uid pendorong -> seq terakhir
const hasPushPass = () => playerData.inventory.includes('gp_dorong');
function tryPushNearestFriend() {
  if (!hasPushPass()) { showToast('🔒 Beli Gamepass Dorong di Shop dulu'); return; }
  if (!roomCode || !myRef || gameState !== 'PLAYING') return;
  const now = performance.now();
  if (now - lastPushAt < PUSH_COOLDOWN) return;
  let best = null, bestD = PUSH_RANGE;
  for (const [id, av] of remotePlayers) {
    const d = roomPlayers[id]; if (!d || d.deadAt || !av.visible) continue;
    if (!friendKeysCache.has(String(d.userKey || d.username || '').trim().toLowerCase())) continue;
    const dist = Math.hypot(av.position.x - character.position.x, av.position.z - character.position.z);
    if (dist < bestD && Math.abs(av.position.y - character.position.y) < 2.5) { best = id; bestD = dist; }
  }
  if (!best) { showToast('Tidak ada teman di dekatmu', 1000); return; }
  lastPushAt = now; pushSeq++;
  const btn = document.getElementById('btn-push'); if (btn) { btn.classList.add('cd'); setTimeout(() => btn.classList.remove('cd'), PUSH_COOLDOWN); }
  update(myRef, { push: { target: best, seq: pushSeq, t: Date.now() } }).catch(() => {});
  showToast('🫸 Dorong ' + String(roomPlayers[best]?.username || 'teman') + '!', 1000);
}
function applyIncomingPushes() {
  if (!roomCode || !character || gameState !== 'PLAYING' || godMode || flyMode) return;
  for (const [id, d] of Object.entries(roomPlayers)) {
    if (id === mpUid || !d || !d.push || d.push.target !== mpUid) continue;
    if (handledPush.get(id) === d.push.seq) continue;
    handledPush.set(id, d.push.seq);
    if (Math.abs(Date.now() - (d.push.t || 0)) > 5000) continue; // dorongan basi diabaikan
    if (d.x == null) continue;
    let dx = character.position.x - Number(d.x), dz = character.position.z - Number(d.z);
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    knock.set(dx * PUSH_FORCE, dz * PUSH_FORCE); physics.velocityY = 7; physics.isGrounded = false; sq.v = -4;
    showToast('🫸 ' + String(d.username || 'Teman') + ' mendorongmu!', 1000);
  }
}
function buildPushButton() {
  if (document.getElementById('btn-push')) return;
  const b = document.createElement('button'); b.id = 'btn-push'; b.type = 'button'; b.textContent = '🫸'; b.title = 'Dorong teman (E)';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); tryPushNearestFriend(); });
  document.body.appendChild(b);
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) tryPushNearestFriend(); });
  setInterval(() => { b.style.display = (hasPushPass() && roomCode && gameState === 'PLAYING') ? 'flex' : 'none'; applyIncomingPushes(); }, 120);
}

// ----- UI room -----
function setRoomMsg(m) { const el = document.getElementById('rp-msg'); if (el) el.textContent = m || ''; }
function updateRoomUI() {
  updateLobbyLeaderboard();
  const inLobby = gameState === 'LOBBY';
  const startButton = document.getElementById('btn-start-game');
  if (startButton && inLobby) {
    const hostCanStart = !!roomCode && !!roomMeta && roomMeta.host === mpUid && !roomMeta.startAt;
    startButton.style.display = roomCode ? (hostCanStart ? 'flex' : 'none') : 'flex';
    startButton.title = roomCode ? (hostCanStart ? 'Mulai permainan bersama teman di lobby' : 'Menunggu pembuat room') : 'Mulai permainan solo';
  }
  const panel = document.getElementById('room-panel'); if (!panel) return;
  panel.style.display = inLobby ? 'flex' : 'none';
  panel.classList.toggle('rp-collapsed', rpCollapsed);
  document.getElementById('rp-min').textContent = rpCollapsed ? '▢' : '—';
  document.getElementById('rp-qstart').style.display = (rpCollapsed && roomCode && roomMeta && roomMeta.host === mpUid && !roomMeta.startAt) ? 'block' : 'none';
  document.getElementById('rp-title').textContent = roomCode ? '🎮 Room ' + roomCode + ' · ' + Object.keys(roomPlayers).length + ' pemain' : '🎮 Mabar';
  document.getElementById('rp-menu').style.display = roomCode ? 'none' : 'flex';
  document.getElementById('rp-room').style.display = roomCode ? 'flex' : 'none';
  if (!roomCode) return;
  document.getElementById('rp-codetext').textContent = roomCode;
  const list = document.getElementById('rp-list'); list.innerHTML = '';
  const ids = sortedIds();
  ids.forEach(id => {
    const p = roomPlayers[id], row = document.createElement('div'); row.className = 'rp-player';
    row.textContent = (roomMeta && roomMeta.host === id ? '👑 ' : '🧍 ') + String(p.username || 'Pemain') + (p.isDev ? ' ✔' : '') + (id === mpUid ? ' (kamu)' : '');
    list.appendChild(row);
  });
  const isHost = !!roomMeta && roomMeta.host === mpUid;
  const st = document.getElementById('rp-start'); st.style.display = isHost ? 'block' : 'none'; st.textContent = '▶ MULAI (' + ids.length + ' pemain)';
  document.getElementById('rp-wait').style.display = isHost ? 'none' : 'flex';
}
function buildRoomUI() {
  // UI room/mabar disembunyikan. Room dibuat otomatis saat pemain mengundang teman.
  buildPlayerSearchUI();
  if (document.getElementById('countdown')) return;
  const css = document.createElement('style');
  css.textContent = `#countdown{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;font:900 140px sans-serif;color:#fff;text-shadow:0 0 30px #3b6cf6;pointer-events:none}
`;
  document.head.appendChild(css);
  const cd = document.createElement('div'); cd.id = 'countdown';
  document.body.append(cd);
}

window.addEventListener('pagehide', () => { if (myRef) remove(myRef).catch(() => {}); });

// ===== SNOW-MODULE-BEGIN =====
// =====================================================================
// SISTEM GACHA MAP + MAP SALJU
// Modul tambahan: map Lava lama tidak diubah. Setiap map punya dunia sendiri
// (grup 3D, daftar platform, checkpoint, NPC). applyMap() hanya menukar
// variabel aktif (platforms, guards, hazards, FIN_Y, WIN) sesuai hasil gacha,
// sehingga seluruh sistem lama (kontrol, kamera, respawn, multiplayer) tetap
// memakai kode yang sama.
// =====================================================================
const MAP_LABELS = { lava: { icon: '🌋', name: 'MAP LAVA', color: '#ff6a2a' }, snow: { icon: '❄️', name: 'MAP SALJU', color: '#7fd6ff' }, angkasa: { icon: '🚀', name: 'MAP ANGKASA', color: '#a78bfa' } };

// Gacha: hanya memilih map yang benar-benar tersedia.
function rollMap() { const available = ['lava']; if (snowWorld) available.push('snow'); if (angkasaWorld) available.push('angkasa'); return available[Math.floor(Math.random() * available.length)]; }

// Animasi gacha singkat sebelum loading screen. done() dipanggil setelah hasil tampil.
function playMapGacha(result, spinMs, done) {
  let finished = false;
  const finish = () => { if (finished) return; finished = true; try { done(); } catch (e) { console.error(e); } };
  try {
    if (!document.getElementById('gacha-css')) {
      const css = document.createElement('style'); css.id = 'gacha-css';
      css.textContent = '#map-gacha{position:fixed;inset:0;z-index:10001;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(circle at 50% 40%,#25305a,#0b0d1c);color:#fff;font-family:sans-serif;text-align:center}'
        + '#gc-title{font-size:clamp(22px,6vw,34px);font-weight:800;letter-spacing:2px}'
        + '#gc-slot{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:230px;padding:18px 26px;border-radius:18px;border:3px solid #fff;background:rgba(255,255,255,.08);transition:border-color .2s,box-shadow .2s}'
        + '#gc-icon{font-size:clamp(54px,16vw,84px);line-height:1}#gc-name{font-size:clamp(20px,5.5vw,28px);font-weight:800}'
        + '#gc-sub{font-size:15px;opacity:.85}#gc-slot.spin{animation:gcshake .18s linear infinite}@keyframes gcshake{0%{transform:translateY(-3px)}50%{transform:translateY(3px)}100%{transform:translateY(-3px)}}';
      document.head.appendChild(css);
    }
    let el = document.getElementById('map-gacha');
    if (!el) {
      el = document.createElement('div'); el.id = 'map-gacha';
      el.innerHTML = '<div id="gc-title">🎰 GACHA MAP</div><div id="gc-slot" class="spin"><span id="gc-icon">❔</span><span id="gc-name">...</span></div><div id="gc-sub">Mengacak map...</div>';
      document.body.appendChild(el);
    }
    const slot = document.getElementById('gc-slot'), icon = document.getElementById('gc-icon'), nm = document.getElementById('gc-name'), sub = document.getElementById('gc-sub');
    el.style.display = 'flex'; slot.classList.add('spin'); slot.style.borderColor = '#fff'; slot.style.boxShadow = 'none'; sub.textContent = 'Mengacak map...';
    const keys = ['lava', ...(snowWorld ? ['snow'] : []), ...(angkasaWorld ? ['angkasa'] : [])]; let k = 0;
    const iv = setInterval(() => { k = (k + 1) % keys.length; const m = MAP_LABELS[keys[k]]; icon.textContent = m.icon; nm.textContent = m.name; }, 95);
    setTimeout(() => {
      clearInterval(iv);
      const m = MAP_LABELS[result] || MAP_LABELS.lava;
      icon.textContent = m.icon; nm.textContent = m.name; slot.classList.remove('spin');
      slot.style.borderColor = m.color; slot.style.boxShadow = '0 0 32px ' + m.color; sub.textContent = 'Kamu mendapat ' + m.name + '!';
      setTimeout(() => { el.style.display = 'none'; finish(); }, 750);
    }, spinMs);
  } catch (e) { console.warn('Animasi gacha gagal:', e); finish(); }
}

// Menukar dunia aktif. Dipanggil tepat sebelum onGameBegin().
function applyMap(id) {
  if (id === 'snow' && !snowWorld) id = 'lava';
  if (id === 'angkasa' && !angkasaWorld) id = 'lava';
  const w = id === 'snow' ? snowWorld : (id === 'angkasa' ? angkasaWorld : lavaWorld);
  if (!w) return;
  currentMap = id;

  // Fitur lari (sprint) dimatikan khusus di map Angkasa.
  // Map Lava dan Salju tetap memakai tombol lari seperti biasa.
  const runButton = document.getElementById('btn-run');
  if (runButton) runButton.style.display = id === 'angkasa' ? 'none' : '';
  isRunning = false;

  platforms = w.platforms; hazards = w.hazards; guards = w.guards || []; laserBeam = w.laserBeam || null;
  FIN_Y = w.FIN_Y; WIN = w.WIN; MAZE_H = w.MAZE_H || 0; MAZE_Z = w.MAZE_Z || 0;
  laserState = 'off'; curGroundPlat = null;
  if (parkourWorldGroup) parkourWorldGroup.visible = id === 'lava';
  if (snowWorldGroup) snowWorldGroup.visible = id === 'snow';
  if (angkasaWorldGroup) angkasaWorldGroup.visible = id === 'angkasa';
  if (id === 'snow' && snowController) snowController.reset();
  if (angkasaController) angkasaController.reset(physics);
  if (id === 'angkasa' && scene) {
    if (angkasaController && angkasaController.enter) angkasaController.enter(scene);
    else { scene.background = new THREE.Color(0x000000); scene.fog = null; }
  } else if (scene) {
    // Kembalikan latar default game untuk Lava/Snow; efek khusus map tetap
    // dikelola oleh modul map masing-masing.
    scene.background = new THREE.Color(0x1a1a24);
    scene.fog = new THREE.Fog(0x1a1a24, 20, 150);
  }
  try { guards.forEach(gd => gd.reset()); } catch (e) {}
}
// ===== ICE MAP BUILDER MOVED TO snow.js =====

const clock = new THREE.Clock();
let walkTime = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  const t = roomStartAt ? Math.max(0, (serverNow() - roomStartAt) / 1000) : clock.getElapsedTime();
  // Timer visual di HUD dihapus: progres kemenangan menggunakan mahkota.
  tickMultiplayer();
  if (snowController) snowController.updateHud({ currentMap, gameState });
  animateRemotePlayers(delta);
  if (lobbyAccentRing && gameState === 'LOBBY') lobbyAccentRing.rotation.z += delta * 0.12;
  if (scene && camera) renderer.render(scene, camera);

  // Animasi Berkedip pada Laser NPC
  if (laserBeam) {
    const lc = t % 2.9; // 1.2s mati -> 0.8s peringatan (garis oranye) -> 0.9s menembak
    laserState = lc < 1.2 ? 'off' : (lc < 2.0 ? 'warn' : 'fire');
    laserBeam.visible = laserState !== 'off' && !(laserState === 'warn' && Math.sin(t * 40) > 0.4);
    laserBeam.material.color.setHex(laserState === 'fire' ? 0x00ffff : 0xff5500);
    const th = laserState === 'fire' ? 1 : 0.2;
    laserBeam.scale.set(1, th, th);
  }

  for (let i = trailParticles.length - 1; i >= 0; i--) {
    let p = trailParticles[i];
    p.life -= delta;
    p.mesh.scale.multiplyScalar(1 - delta * 3);
    p.mesh.material.opacity = p.life * 1.5;
    if (p.startColor && p.endColor) {
      p.mesh.material.color.lerpColors(p.startColor, p.endColor, 1 - (p.life / 0.6));
    }
    p.mesh.position.y += delta * 1.5;
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); trailParticles.splice(i, 1); }
  }

  updateDebris(delta);
  for (let i = jumpParticles.length - 1; i >= 0; i--) {
    let p = jumpParticles[i];
    p.life -= delta;
    p.mesh.position.x += p.mesh.userData.vx * delta;
    p.mesh.position.y += p.mesh.userData.vy * delta;
    p.mesh.position.z += p.mesh.userData.vz * delta;
    p.mesh.userData.vy -= 6 * delta;
    p.mesh.material.opacity = p.life * 1.5;
    p.mesh.scale.multiplyScalar(1 - delta * 1.5);
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); jumpParticles.splice(i, 1); }
  }

  if (gameState === 'LOBBY') {
    character.position.y = 0.25 + Math.sin(t * 2) * 0.02;
    headGroup.rotation.y = Math.sin(t * 0.5) * 0.3;
    controls.update();
    return;
  }

  if (gameState !== 'PLAYING') return;

  const speed = flyMode ? flySpeed : (isRunning ? 9 : 5);
  let isMoving = false;

  platforms.forEach(p => {
    if (p.type === 'moving_x') { const nx = p.startX + Math.sin(t * p.speed + p.phase) * p.range; p.dx = nx - p.mesh.position.x; p.mesh.position.x = nx; }
    else if (p.type === 'moving_y') p.mesh.position.y = p.startY + Math.sin(t * p.speed + p.phase) * p.range;
    else if (p.type === 'fake') {
      // Setelah terpicu, kotak menghilang tepat 2 detik lalu muncul kembali.
      p.revealTimer = Math.max(0, p.revealTimer - delta);
      p.mesh.visible = p.revealTimer <= 0;
    }
    else if (p.decoy) {
      // Kotak asli pengecoh juga tetap stabil, tanpa efek berkedip.
      p.mesh.visible = true;
      p.mesh.material.opacity = 1;
    }
  });

  hazards.forEach(h => h.update(t));
  if (currentMap === 'snow' && snowController) snowController.update(delta, {
    curGroundPlat, physics, character, godMode, flyMode, hitCD, knock
  });
  if (currentMap === 'angkasa' && angkasaController) angkasaController.update(delta, {
    curGroundPlat, physics, character, godMode, flyMode, hitCD, knock
  });
  if (!mazeHinted && character.position.y > FIN_Y - 1 && Math.abs(character.position.x) < MAZE_H && character.position.z < -89 && character.position.z > MAZE_Z - MAZE_H) { mazeHinted = true; showToast('🧩 SALAH BEGO,MAMPUS'); }
  for (const gd of guards) { if (gd.update(delta, character.position, t, !godMode && !flyMode)) { gameState = 'GAMEOVER'; showGameOver(currentMap === 'snow' ? 'snowshot' : 'shot'); break; } }
  hitCD = Math.max(0, hitCD - delta); knock.multiplyScalar(Math.exp(-delta * 2.5));
  if (hitCD <= 0 && !godMode && !flyMode) for (const h of hazards) {
    const n = h.test(character.position);
    if (n) { knock.set(n.x * 26, n.z * 26); physics.velocityY = 13; physics.isGrounded = false; hitCD = 1.2; sq.v = -5; break; }
  }
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

  const preVy = physics.velocityY;
  let nextX = character.position.x; let nextZ = character.position.z;
  let desX = 0, desZ = 0;
  if (Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1) {
    const moveX = forward.x * joystickVector.y + right.x * joystickVector.x;
    const moveZ = forward.z * joystickVector.y + right.z * joystickVector.x;
    const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
    desX = (moveX / len) * speed; desZ = (moveZ / len) * speed;
    let diff = Math.atan2(moveX, moveZ) - character.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    character.rotation.y += diff * (1 - Math.exp(-delta * 16));
    if (isRunning && Math.random() < 0.3) createTrailEffect();
  }
  // Map Salju: permukaan es licin = percepatan/pengereman lebih kecil. Map Lava tidak terpengaruh (gp = null).
  const gp = (currentMap === 'snow' && !flyMode && physics.isGrounded && curGroundPlat && curGroundPlat.grip) ? curGroundPlat.grip : null;
  const accel = 1 - Math.exp(-delta * ((desX || desZ) ? 11 * (gp ? gp[0] : 1) : 14 * (gp ? gp[1] : 1)));
  moveVel.x += (desX - moveVel.x) * accel; moveVel.y += (desZ - moveVel.y) * accel;
  const hSpeed = moveVel.length();
  isMoving = hSpeed > 0.4;
  nextX += (moveVel.x + knock.x) * delta; nextZ += (moveVel.y + knock.y) * delta;

  if (flyMode || !checkWallCollision(nextX, character.position.z, character.position.y)) character.position.x = nextX;
  if (flyMode || !checkWallCollision(character.position.x, nextZ, character.position.y)) character.position.z = nextZ;

  const groundData = flyMode ? null : checkGroundCollision(character.position.x, character.position.z, character.position.y);
  curGroundPlat = groundData ? groundData.platform : null;
  if (groundData && physics.velocityY <= 0) {
    character.position.y = groundData.y;
    physics.velocityY = 0; physics.isGrounded = true; physics.jumpCount = 0;
    if (groundData.platform.type === 'moving_x') character.position.x += groundData.platform.dx;
    if (groundData.platform.checkpoint && !groundData.platform.checkpointActivated && !activatedCheckpoints.has(groundData.platform)) {
      // Tandai platform secara permanen untuk putaran ini agar tidak aktif ulang setelah pemain jatuh/respawn.
      groundData.platform.checkpointActivated = true;
      activatedCheckpoints.add(groundData.platform);
      const m = groundData.platform.mesh.position;
      checkpoint = { p: groundData.platform, set: true, x: m.x, y: groundData.y, z: m.z };
      if (usedCheckpointMat) groundData.platform.mesh.material = usedCheckpointMat;
      showToast('✅ Checkpoint tersimpan!');
      if (!roomCode) { // mode solo: posisi checkpoint disimpan ke akun, jadi tetap di sini walau keluar game
        const sv = { px: +m.x.toFixed(3), py: +m.y.toFixed(3), pz: +m.z.toFixed(3), y: +groundData.y.toFixed(3) };
        if (currentMap === 'snow') playerData.savedCheckpointSnow = sv; else playerData.savedCheckpoint = sv; // checkpoint Salju terpisah dari Lava
        updatePlayerFirebase().catch(() => {});
      }
    }
  } else {
    physics.isGrounded = false;
  }

  if (flyMode) {
    physics.velocityY = 0;
    character.position.y += ((flyUp ? 1 : 0) - (flyDown ? 1 : 0)) * flySpeed * 0.8 * delta;
  } else if (!physics.isGrounded) {
    physics.velocityY += physics.gravity * delta;
    character.position.y += physics.velocityY * delta;
    const landingData = checkGroundCollision(character.position.x, character.position.z, character.position.y + 0.5);
    if (landingData && character.position.y <= landingData.y) {
      character.position.y = landingData.y; physics.velocityY = 0; physics.isGrounded = true; physics.jumpCount = 0;
    }
  }

  // CEK APAKAH TERKENA LASER NPC (Posisi Z sekitar -44 dan laser sedang menyala)
  if (physics.isGrounded && !wasGrounded && preVy < -4) { const imp = Math.min(1, -preVy / 22); sq.v = -imp * 8; spawnDust(4 + Math.round(imp * 6)); }
  wasGrounded = physics.isGrounded;

  // Kotak palsu: menghilang saat pemain sedang turun dan hampir mendarat.
  // Pemicu berada sedikit di atas permukaan agar kotak hilang sebelum diinjak.
  platforms.forEach(p => {
    if (p.type !== 'fake' || p.revealTimer > 0 || !p.mesh.visible) return;

    const m = p.mesh.position;
    const topY = m.y + (p.hh || 0.25);
    const insideX = Math.abs(character.position.x - m.x) < p.width / 2 - 0.08;
    const insideZ = Math.abs(character.position.z - m.z) < p.depth / 2 - 0.08;
    const approachingLanding =
      physics.velocityY <= 0 &&
      character.position.y >= topY - 0.1 &&
      character.position.y <= topY + 1.35;

    if (insideX && insideZ && approachingLanding) {
      p.revealTimer = 2.0;
      p.mesh.visible = false;
      roast('fake', ' Kotak palsu!');
    }
  });

  // Laser hanya mengenai jika sedang menembak & kamu tidak melompatinya
  if (!godMode && !flyMode && laserState === 'fire' && Math.abs(character.position.z - LASER_Z) < 0.5 && Math.abs(character.position.x) < 3.5 && character.position.y > 8 && character.position.y < LASER_Y + 0.25) {
    gameState = 'GAMEOVER';
    showGameOver('laser');
  }

  // JIKA JATUH KE LAVA
  if (godMode && character.position.y < -3) { character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z); physics.velocityY = 0; }
  if (!godMode && !flyMode && character.position.y < -3) {
    gameState = 'GAMEOVER'; 
    shatterLocal(); setTimeout(() => { if (gameState === 'GAMEOVER') showGameOver('fall'); }, 900);
  }

  // KONDISI MENANG DI PUNCAK
  if (character.position.y > FIN_Y - 0.5 && Math.abs(character.position.x - WIN.x) < 4.5 && Math.abs(character.position.z - WIN.z) < 4.5) {
    gameState = 'WIN'; 
    playerData.coins = (playerData.coins || 0) + 1000;
    if (currentMap === 'snow') playerData.savedCheckpointSnow = null; else playerData.savedCheckpoint = null; // selesai: progres checkpoint map ini direset
    updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins;
    onFinish();
    showOverlay('YOU WIN!', (currentMap === 'snow' ? 'Kamu lolos dari dunia salju dan tembakan NPC! +1000 🪙' : currentMap === 'angkasa' ? 'Kamu berhasil menaklukkan lintasan luar angkasa! +1000 🪙' : 'Putzzdev mengakui kamu jago melewati tower, jebakan, dan labirin! +1000 🪙') + finishSummary(), '#00ff00');
  }

  // ===== Animasi karakter: damping + squash & stretch + condong badan =====
  const k = 1 - Math.exp(-delta * 14);
  const damp = (o, key, v) => { o[key] += (v - o[key]) * k; };
  const runK = THREE.MathUtils.clamp((hSpeed - 5) / 4, 0, 1);
  sq.v += (-sq.x * 220 - sq.v * 14) * delta; sq.x += sq.v * delta;
  let bob = 0, lean = 0, twist = 0, sway = 0;
  let lH = 0, rH = 0, lK = 0, rK = 0, lA = 0, rA = 0, lE = -0.15, rE = -0.15, armZ = 0.1, headY = 0;

  if (!physics.isGrounded) {
    const up = physics.velocityY > 0;
    lH = up ? -0.9 : -0.4; rH = up ? 0.3 : 0.5; lK = up ? 1.0 : 0.4; rK = up ? 0.3 : 0.7;
    lA = rA = up ? -1.7 : -1.0; lE = rE = -0.5; armZ = up ? 0.5 : 0.8;
    lean = 0.1 + THREE.MathUtils.clamp(-physics.velocityY * 0.004, -0.1, 0.12);
  } else if (isMoving) {
    walkTime += delta * hSpeed * 1.7;
    const s = Math.sin(walkTime), c = Math.cos(walkTime), amp = 0.55 + runK * 0.4;
    lH = s * amp; rH = -s * amp;
    lK = Math.max(0, -c) * (0.7 + runK * 0.8) + 0.08; rK = Math.max(0, c) * (0.7 + runK * 0.8) + 0.08;
    lA = -s * amp * 0.9; rA = s * amp * 0.9;
    lE = -(0.25 + runK * 0.9) - Math.max(0, s) * 0.3; rE = -(0.25 + runK * 0.9) - Math.max(0, -s) * 0.3;
    bob = Math.abs(s) * (0.05 + runK * 0.05); lean = 0.06 + runK * 0.2; twist = -s * (0.12 + runK * 0.1); sway = s * 0.04; armZ = 0.12;
    headY = -twist * 0.8;
  } else {
    const br = Math.sin(t * 2.2); // idle: napas, goyang pelan, kepala melirik
    bob = br * 0.008; lA = Math.sin(t * 1.3) * 0.04; rA = -lA; armZ = 0.1 + br * 0.015;
    lE = rE = -0.12; sway = Math.sin(t * 0.8) * 0.015; headY = Math.sin(t * 0.5) * 0.35;
  }
  damp(leftLegPivot.rotation, 'x', lH); damp(rightLegPivot.rotation, 'x', rH);
  damp(leftKnee.rotation, 'x', lK); damp(rightKnee.rotation, 'x', rK);
  damp(leftArmPivot.rotation, 'x', lA); damp(rightArmPivot.rotation, 'x', rA);
  damp(leftElbow.rotation, 'x', lE); damp(rightElbow.rotation, 'x', rE);
  damp(leftArmPivot.rotation, 'z', -armZ); damp(rightArmPivot.rotation, 'z', armZ);
  damp(headGroup.rotation, 'y', headY);
  damp(rig.position, 'y', bob); damp(rig.rotation, 'x', lean); damp(rig.rotation, 'y', twist); damp(rig.rotation, 'z', sway);
  for (const cp of [capePivot, capeB, capeT]) if (cp && cp.visible) damp(cp.rotation, 'x', 0.08 + hSpeed * 0.05 + (physics.isGrounded ? 0 : 0.4) + Math.sin(t * 7) * (isMoving ? 0.05 : 0.01));
  const air = physics.isGrounded ? 0 : THREE.MathUtils.clamp(physics.velocityY / 13, -1, 1) * 0.1;
  const st = THREE.MathUtils.clamp(sq.x + air, -0.35, 0.35);
  rig.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
  camera.fov += ((60 + runK * 8) - camera.fov) * k * 0.5; camera.updateProjectionMatrix();
  updateLavaMap(lavaMapVisuals, delta, t, currentMap === 'lava');

  const targetPos = character.position.clone(); targetPos.y += 1.5;
  const prevT = controls.target.clone();
  controls.target.lerp(targetPos, 1 - Math.exp(-delta * 8));
  camera.position.add(controls.target.clone().sub(prevT)); // kamera ikut bergerak bersama pemain

  // Kamera tetap bebas dikontrol dan di-zoom, termasuk ketika berada di labirin.
  // Tidak ada kamera paksa yang menimpa jarak zoom pemain.
  if (zoomDir) {
    const off = camera.position.clone().sub(controls.target);
    const nextDistance = THREE.MathUtils.clamp(
      off.length() * (1 + zoomDir * 1.2 * delta),
      controls.minDistance,
      controls.maxDistance
    );
    off.setLength(nextDistance);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
}

window.addEventListener('resize', () => {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});