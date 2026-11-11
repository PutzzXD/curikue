import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ 1. KONFIGURASI FIREBASE ============
const FIREBASE_URL = "https://game3d-66134-default-rtdb.asia-southeast1.firebasedatabase.app/";
const DEV_USERNAME = "putzzdev"; 

let playerData = { 
  username: "", 
  isDev: false, 
  coins: 0, 
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
    { id: 'baju_spiderman', name: 'Kostum Spiderman', price: 500, color: 0xd91e2b, web: true },
    { id: 'baju_batman', name: 'Kostum Batman', price: 550, color: 0x2b2f3a, bat: true },
    { id: 'baju_ironman', name: 'Kostum Ironman', price: 2000, color: 0xb01020, iron: true }
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
function showToast(message) {
  const toast = document.getElementById('custom-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 2000); 
}

// ============ 3. SETUP DOM & EVENT LISTENER ============
window.addEventListener('DOMContentLoaded', () => {
  const loginMsg = document.getElementById('login-msg');
  const regMsg = document.getElementById('reg-msg');
  const profileModal = document.getElementById('profile-modal');
  const shopModal = document.getElementById('shop-modal');
  
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
    renderShopTab('baju'); 
  });
  document.getElementById('close-shop').addEventListener('click', () => { shopModal.style.display = 'none'; });

  document.querySelectorAll('.shop-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderShopTab(e.target.dataset.cat);
    });
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    requestFullscreenAndLock();
    document.getElementById('btn-start-game').style.display = 'none';
    document.getElementById('btn-shop').style.display = 'none';
    document.getElementById('in-game-controls').style.display = 'block'; { const zc = document.getElementById('zoom-ctrl'); if (zc) zc.style.display = 'flex'; }
    chatBox.style.display = 'none'; 
    chatToggle.textContent = '💬 Chat Global';
    isGameStarted = true;
    gameState = 'PLAYING';
    profileModal.style.display = 'none';
    shopModal.style.display = 'none';
    camera.position.set(0, 4, 8);
    controls.target.set(0, 1.5, 0);
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
      const newPlayerData = { username, pin, isDev: (userKey === DEV_USERNAME), coins: 0, inventory: playerData.inventory, equipped: playerData.equipped };
      await fetch(firebaseUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlayerData) });

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

    const userKey = username.toLowerCase();
    const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;

    try {
      const res = await fetch(firebaseUrl);
      const data = await res.json();
      if (!data) {
        loginMsg.textContent = "Akun tidak ditemukan. Silakan Daftar."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      if (data.pin !== pin) {
        loginMsg.textContent = "PIN salah! Coba lagi."; loginMsg.className = "msg error";
        document.getElementById('btn-login').disabled = false; return;
      }
      
      playerData = { ...playerData, ...data, inventory: data.inventory || playerData.inventory, equipped: data.equipped || playerData.equipped };
      localStorage.setItem('parkour_user', JSON.stringify({ username, isDev: data.isDev }));
      startLobby();
    } catch(e) {
      loginMsg.textContent = "Gagal konek ke server."; loginMsg.className = "msg error";
      document.getElementById('btn-login').disabled = false;
    }
  });

  // AUTO LOGIN
  const savedSession = localStorage.getItem('parkour_user');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      fetch(`${FIREBASE_URL}players/${session.username.toLowerCase()}.json`)
        .then(res => res.json())
        .then(data => {
          if (data) {
            playerData = { ...playerData, ...data, inventory: data.inventory || playerData.inventory, equipped: data.equipped || playerData.equipped };
            startLobby();
          } else { localStorage.removeItem('parkour_user'); }
        });
    } catch(e) { localStorage.removeItem('parkour_user'); }
  }
});

// ============ 4. FUNGSI LOBI & SHOP ============
function startLobby() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('game-ui').style.display = 'block';
  gameState = 'LOBBY'; 
  if (!playerData.inventory.includes('aks_none')) playerData.inventory.push('aks_none');
  if (!playerData.equipped.aksesoris) playerData.equipped.aksesoris = 'aks_none';
  document.getElementById('hud-username').textContent = playerData.username;
  document.getElementById('coin-amount').textContent = playerData.coins || 0;
  document.getElementById('modal-username').textContent = playerData.username;
  
  if (playerData.isDev) {
    document.getElementById('hud-verified').style.display = 'flex';
    document.getElementById('modal-status').textContent = "Developer ✔";
  } else {
    document.getElementById('modal-status').textContent = "Player Biasa";
    document.getElementById('modal-status').style.color = "#ccc";
  }
  document.getElementById('btn-start-game').style.display = 'flex';
  document.getElementById('btn-shop').style.display = 'flex';
  document.getElementById('in-game-controls').style.display = 'none'; { const zc = document.getElementById('zoom-ctrl'); if (zc) zc.style.display = 'none'; }
  document.getElementById('chat-container').style.display = 'flex';

  fetchGlobalChat();
  setInterval(fetchGlobalChat, 3000);

  init3DGame();
  camera.position.set(0, 3, -5);
  controls.target.set(0, 1.5, 0);
}

function renderShopTab(category) {
  const container = document.getElementById('shop-items-container');
  container.innerHTML = '';
  
  SHOP_ITEMS[category].forEach(item => {
    const isOwned = playerData.inventory.includes(item.id);
    const isEquipped = Object.values(playerData.equipped).includes(item.id);
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
}

window.buyItem = async function(category, itemId, price) {
  if (playerData.coins < price) { showToast("❌ Koin kamu tidak cukup!"); return; }
  playerData.coins -= price;
  playerData.inventory.push(itemId);
  await updatePlayerFirebase();
  document.getElementById('coin-amount').textContent = playerData.coins;
  renderShopTab(category);
  showToast("✅ Berhasil dibeli!");
};

window.equipItem = async function(category, itemId) {
  let equipKey = category;
  if (category === 'efek') equipKey = itemId.includes('lari') ? 'efek_lari' : 'efek_lompat';
  
  playerData.equipped[equipKey] = itemId;
  await updatePlayerFirebase();
  updateCharacterVisuals();
  renderShopTab(category);
  showToast("✅ Item berhasil dipakai!");
};

async function updatePlayerFirebase() {
  const userKey = playerData.username.toLowerCase();
  const firebaseUrl = `${FIREBASE_URL}players/${userKey}.json`;
  await fetch(firebaseUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coins: playerData.coins, inventory: playerData.inventory, equipped: playerData.equipped })
  });
}

// ============ 5. UPDATE VISUAL KARAKTER ============
const webTexCache = {};
function getWebTex(hex) {
  if (webTexCache[hex]) return webTexCache[hex];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); }
  for (let j = 0; j < 256; j += 32) for (let i = 0; i < 256; i += 64) { x.beginPath(); x.moveTo(i, j); x.quadraticCurveTo(i + 32, j + 10, i + 64, j); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
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
  return new THREE.CanvasTexture(c);
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
  return new THREE.CanvasTexture(c);
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
  if (SHAPES[cat]) {
    const col = '#' + it.color.toString(16).padStart(6, '0'), d = SHAPES[cat];
    inner = `<defs><clipPath id="cp-${it.id}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${col}" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (it.web) inner += `<g clip-path="url(#cp-${it.id})" stroke="rgba(0,0,0,.5)" stroke-width=".8" fill="none"><path d="M32 4V60M20 4V60M44 4V60M8 4V60M56 4V60M4 16Q32 24 60 16M4 28Q32 36 60 28M4 40Q32 48 60 40M4 52Q32 60 60 52"/></g>`;
    if (it.iron && cat === 'baju') inner += '<path d="M20 8L8 16L13 27L19 24Z" fill="#d4a017"/><path d="M44 8L56 16L51 27L45 24Z" fill="#d4a017"/><circle cx="32" cy="30" r="5" fill="#9ff3ff" stroke="#d4a017" stroke-width="2"/><rect x="19" y="46" width="26" height="4" fill="#d4a017"/>';
    if (it.bat && cat === 'baju') inner += '<rect x="19" y="47" width="26" height="4" fill="#f5c400"/><ellipse cx="32" cy="30" rx="8" ry="5" fill="#f5c400" stroke="#111"/><path d="M32 26L33 25L33.5 26.5Q38 26 40 28Q38 28.5 37 31Q35 30 34 31L32 33L30 31Q29 30 27 31Q26 28.5 24 28Q26 26 30.5 26.5L31 25Z" fill="#111"/>';
    if (it.web && cat === 'baju') inner += '<g stroke="#111" stroke-width="1.6" fill="#111" stroke-linecap="round"><ellipse cx="32" cy="35" rx="2.6" ry="5"/><circle cx="32" cy="28.5" r="1.8"/><path fill="none" d="M32 33L24 28M32 35L23 35M32 37L24 42M32 38L25 46M32 33L40 28M32 35L41 35M32 37L40 42M32 38L39 46"/></g>';
  } else if (cat === 'aksesoris') inner = ACC_ICONS[it.id] || '';
  else inner = `<text x="32" y="44" font-size="34" text-anchor="middle">${it.id.includes('api') ? '🔥' : (it.id.includes('_es') ? '❄️' : '✨')}</text>`;
  return `<svg viewBox="0 0 64 64" style="width:80%;height:80%">${inner}</svg>`;
}

function updateCharacterVisuals() {
  if (!character) return;
  const pick = (cat, def) => SHOP_ITEMS[cat].find(i => i.id === playerData.equipped[cat]) || SHOP_ITEMS[cat].find(i => i.id === def);
  const ap = (child, item) => { const m = child.material; m.map = item.web ? getWebTex(item.color) : null; m.color.setHex(item.web ? 0xffffff : item.color); m.metalness = item.iron ? 0.75 : 0; m.roughness = item.iron ? 0.28 : 0.7; m.needsUpdate = true; };
  const baju = pick('baju', 'baju_default'), celana = pick('celana', 'celana_default'), sepatu = pick('sepatu', 'sepatu_default');
  const iron = !!baju.iron;
  const celanaV = iron ? { color: 0xb01020, iron: true } : celana, sepatuV = iron ? { color: 0xd4a017, iron: true } : sepatu;
  character.traverse((child) => {
    if (!child.isMesh) return;
    if (child.userData.type === 'baju') ap(child, baju);
    if (child.userData.type === 'celana') ap(child, celanaV);
    if (child.userData.type === 'sepatu') ap(child, sepatuV);
  });
  if (spiderLogoGrp) spiderLogoGrp.visible = baju.id === 'baju_spiderman';
  if (batGrp) batGrp.visible = baju.id === 'baju_batman';
  if (ironHelm) ironHelm.visible = iron;
  if (ironBody) ironBody.visible = iron;
  const a = playerData.equipped.aksesoris || 'aks_none';
  Object.keys(acc).forEach(id => { acc[id].visible = !iron && id === a; });
  if (nameSprite) updateCharacterNameSprite(playerData.username, playerData.isDev);
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
let platforms = [], physics, lavaMat;
let leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, headGroup;
let joystickVector = new THREE.Vector2(0, 0);
let isRunning = false;
let trailParticles = [], jumpParticles = [];
let laserBeam = null; // Objek Laser NPC
let rig, leftElbow, rightElbow, leftKnee, rightKnee, embers;
let sq = { x: 0, v: 0 }, moveVel = new THREE.Vector2(0, 0), wasGrounded = true, laserState = 'off';
const LASER_Z = -44, LASER_Y = 9.3;
let FIN_Y = 1e9, checkpoint = { p: null, set: false, x: 0, y: 0.25, z: 0 };
let hazards = [], hitCD = 0, capePivot, spiderLogoGrp, acc = {};
const knock = new THREE.Vector2();
let batGrp, capeB, ironHelm, ironBody;
let zoomDir = 0, guards = [], mazeHinted = false, WIN = { x: 0, y: 0, z: -77 };
const ROASTS = {
  hit: ['Wah, pemain PALING BERUNTUNG hari ini... beruntung kena bola berduri 🍀😹', 'Beruntung banget ya, dilempar sejauh itu. Gratis lho 🚀😹', 'Selamat! Kamu terpilih jadi korban palang berputar 🏆💀', 'Keberuntungan kamu emang nggak ada obat, ketabrak mulu 🍀🤣'],
  fall: ['Beruntung banget jatuh ke lava, hangat kan? 🔥😹', 'Pemain paling beruntung sedunia: jatuh dari tempat yang sama lagi 🍀💀', 'Mantap, rekor jatuh terbaru! Lava bangga sama kamu 🏅🔥'],
  fake: ['Beruntung banget ketipu kotak palsu, yang asli malah kamu lewatin 😹🍀', 'Kotak palsu aja kamu percaya, pantes paling beruntung 🤣👻', 'Insting kamu emang paling beruntung... beruntung salah terus 🍀👻'],
  laser: ['Lasernya nyala sebentar, kamu tetap kena. Bakat langka 🍀💥', 'Kena laser lagi? Rekor kesialan paling beruntung 🏅💥', 'Tinggal lompat doang lho, beruntung banget kamu 😹⚡'],
  shot: ['Ditembak NPC gara-gara salah belok. Beruntung banget kamu 🍀🔫', 'Peta nggak bisa dibaca, tapi pistolnya akurat. Beruntung kamu 😹🔫', 'NPC: "makasih udah nyasar ke sini" 🔫💀', 'Satu lorong benar, kamu pilih yang salah. Pecah rekor 🏅🔫']
};
const isAdminUser = () => !!(playerData && playerData.username && playerData.username.toLowerCase() === DEV_USERNAME);
// Pemain biasa di-roasting; admin/dev tidak (admin cuma dapat pesan biasa)
function roast(kind, plain) {
  if (isAdminUser()) { if (plain) showToast(plain); return; }
  const arr = ROASTS[kind];
  showToast(arr[Math.floor(Math.random() * arr.length)]);
}
let flyMode = false, godMode = false, flyUp = false, flyDown = false, flySpeed = 14;

function respawn() {
  character.position.set(checkpoint.x, checkpoint.y + 0.3, checkpoint.z);
  physics.velocityY = 0; moveVel.set(0, 0); knock.set(0, 0); guards.forEach(gd => gd.reset()); gameState = 'PLAYING';
  document.getElementById('overlay').style.display = 'none';
}

// ===== ADMIN PANEL (khusus Putzzdev) =====
function setupAdminPanel() {
  if (playerData.username.toLowerCase() !== DEV_USERNAME || document.getElementById('admin-btn')) return;
  const css = document.createElement('style');
  css.textContent = '#admin-wrap{position:fixed;top:10px;right:10px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:sans-serif}#admin-btn{padding:8px 12px;border:0;border-radius:10px;background:#ff3366;color:#fff;font-weight:700;cursor:grab;touch-action:none}#admin-panel{width:220px;padding:12px;border-radius:12px;background:rgba(15,15,25,.92);color:#fff;display:none;flex-direction:column;gap:8px;font-size:13px}#admin-title{cursor:grab;padding:4px 0;touch-action:none;user-select:none}#admin-panel button{padding:8px;border:0;border-radius:8px;background:#2d3550;color:#fff}#admin-panel button.on{background:#00b86b}#admin-roast{font-size:12px;color:#ffd166}#fly-ctrl{position:fixed;z-index:9999;right:14px;top:45%;display:none;flex-direction:column;gap:10px}#fly-ctrl button{width:56px;height:56px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;font-size:24px}';
  document.head.appendChild(css);
  const wrap = document.createElement('div'); wrap.id = 'admin-wrap';
  const btn = document.createElement('button'); btn.id = 'admin-btn'; btn.textContent = '🛠️ Admin';
  const panel = document.createElement('div'); panel.id = 'admin-panel';
  panel.innerHTML = '<b id="admin-title">☰ Admin Panel - Putzzdev (geser)</b><button id="ad-fly">✈️ Terbang: OFF (F)</button><label>Kecepatan: <span id="ad-spd">14</span><input id="ad-speed" type="range" min="5" max="40" value="14" style="width:100%"></label><button id="ad-god">🛡️ Anti-mati: OFF</button><button data-tp="start">📍 Ke Start</button><button data-tp="hub">📍 Ke Hub Tower</button><button data-tp="top">🏁 Ke Puncak Tower</button><button data-tp="maze">🧩 Ke Labirin</button><button data-tp="finish">🎉 Ke Finish</button><button id="ad-coin">🪙 +1000 Koin</button>';
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
    const d = { start: [0, 0.25, 0], hub: [0, 13.75, -68], top: [0, FIN_Y, -77], maze: [-2, FIN_Y, -85], finish: [WIN.x, FIN_Y, WIN.z] }[b.dataset.tp];
    character.position.set(...d); physics.velocityY = 0; moveVel.set(0, 0);
    if (gameState === 'GAMEOVER') { gameState = 'PLAYING'; document.getElementById('overlay').style.display = 'none'; }
  });
  document.getElementById('ad-coin').onclick = () => {
    playerData.coins = (playerData.coins || 0) + 1000; updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins; showToast('🪙 +1000 koin');
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

function requestFullscreenAndLock() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(e => console.log(e));
    }).catch(e => console.log(e));
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
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 50, 10);
  sun.castShadow = true;
  scene.add(sun);

  lavaMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -8;
  scene.add(lava);
  const emberPos = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) { emberPos[i*3] = (Math.random()-0.5)*90; emberPos[i*3+1] = -8 + Math.random()*30; emberPos[i*3+2] = -35 + (Math.random()-0.5)*100; }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7722, size: 0.25, transparent: true, opacity: 0.8 }));
  scene.add(embers);

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
    if (type === 'fake') { mat = base.clone(); mat.transparent = true; }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);

    platforms.push({ 
      mesh, width, depth, type, 
      startX: x, startY: y, startZ: z, 
      range: 2.5, speed: 1.5, phase: Math.random() * Math.PI * 2, 
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
  const markCheckpoint = () => { const c = platforms[platforms.length - 1]; c.checkpoint = true; c.mesh.material = checkMat; };
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
      if (hard && i % 3 === 1) { const d = platforms[platforms.length - 1]; d.decoy = true; d.mesh.material = d.mesh.material.clone(); d.mesh.material.transparent = true; }
    }
  }
  createPlatform(TC.x + Math.cos(ta) * 6.3, ty + 0.55, TC.z + Math.sin(ta) * 6.3, 3, 3, 'static'); // penghubung
  const FY = ty + 1.1; FIN_Y = FY + 0.25;
  createPlatform(TC.x, FY, TC.z, 8, 8, 'static'); // PUNCAK / FINISH
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, FY - 12.25, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a3a }));
  pillar.position.set(TC.x, (12 + FY - 0.25) / 2, TC.z); scene.add(pillar);
  { const tp = platforms.find(pl => Math.abs(pl.mesh.position.x - TC.x) < 0.01 && Math.abs(pl.mesh.position.z - TC.z) < 0.01 && Math.abs(pl.mesh.position.y - FY) < 0.01); if (tp) { tp.checkpoint = true; tp.mesh.material = checkMat; } }

  // ===== LABIRIN DI ATAS TOWER (salah lorong = ditembak NPC) =====
  const MN = 6, CS = 4, mcx = 0, mcz = -101, wallH = 7, floorTop = FY + 0.25;
  WIN = { x: mcx - 10 + 4 * 3, y: FY, z: mcz - 12 - 4 };
  createPlatform(mcx - 10 + 4 * 2, FY, -85, 4, 8, 'static'); markCheckpoint(); // jembatan = checkpoint
  createPlatform(mcx, FY, mcz, 24, 24, 'static');   // lantai labirin
  createPlatform(WIN.x, FY, WIN.z, 8, 8, 'static'); // area finish setelah labirin

  const cells = [];
  for (let r = 0; r < MN; r++) { cells[r] = []; for (let c = 0; c < MN; c++) cells[r][c] = { n: true, e: true, s: true, w: true, v: false }; }
  let seed = 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stack = [[0, 2]]; cells[0][2].v = true;
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
  cells[0][2].n = false; cells[MN - 1][3].s = false; // pintu masuk & keluar

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5b6180, roughness: 0.8 });
  const addWall = (x, z, w, d) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    mesh.position.set(x, floorTop + wallH / 2, z); scene.add(mesh);
    platforms.push({ mesh, width: w, depth: d, type: 'wall', hh: wallH / 2, startX: x, startY: mesh.position.y, startZ: z, range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: 0 });
  };
  const cxOf = (c) => mcx - 10 + CS * c, czOf = (r) => mcz + 10 - CS * r;
  for (let r = 0; r < MN; r++) for (let c = 0; c < MN; c++) {
    const k = cells[r][c], x = cxOf(c), z = czOf(r);
    if (r === 0 && k.n) addWall(x, z + 2, CS + 0.6, 0.6);
    if (c === 0 && k.w) addWall(x - 2, z, 0.6, CS + 0.6);
    if (k.s) addWall(x, z - 2, CS + 0.6, 0.6);
    if (k.e) addWall(x + 2, z, 0.6, CS + 0.6);
  }

  // jalur benar (BFS pintu masuk -> keluar); semua sel di luar jalur = lorong salah
  const key = (r, c) => r + ',' + c;
  const nbrs = (r, c) => { const o = [], k = cells[r][c]; if (!k.n && r > 0) o.push([r - 1, c]); if (!k.s && r < MN - 1) o.push([r + 1, c]); if (!k.w && c > 0) o.push([r, c - 1]); if (!k.e && c < MN - 1) o.push([r, c + 1]); return o; };
  const prev = { [key(0, 2)]: null }, bq = [[0, 2]];
  while (bq.length) { const [r, c] = bq.shift(); for (const [nr, nc] of nbrs(r, c)) if (!(key(nr, nc) in prev)) { prev[key(nr, nc)] = [r, c]; bq.push([nr, nc]); } }
  const onPath = new Set(); for (let cur = [MN - 1, 3]; cur; cur = prev[key(cur[0], cur[1])]) onPath.add(key(cur[0], cur[1]));

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
        const col = Math.floor((pp.x - (mcx - 12)) / CS), row = Math.floor(((mcz + 12) - pp.z) / CS);
        const inside = pp.y > FY - 1 && pp.y < FY + 4 && set.has(key(row, col));
        if (state === 'idle') {
          g.rotation.y = Math.sin(t * 0.8 + gx) * 0.5;
          if (inside) { state = 'aim'; timer = 0; showToast('🔫 Salah lorong!'); }
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

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 16), matShirt); torso.position.y = 1.4; torso.castShadow = true; torso.userData.type = 'baju'; character.add(torso);
  headGroup = new THREE.Group(); headGroup.position.y = 2.2; character.add(headGroup);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), matSkin); head.castShadow = true; headGroup.add(head);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); leftEye.position.set(-0.1, 0.05, 0.27); headGroup.add(leftEye);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); leftPupil.position.set(-0.1, 0.05, 0.31); headGroup.add(leftPupil);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), matEyeWhite); rightEye.position.set(0.1, 0.05, 0.27); headGroup.add(rightEye);
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), matPupil); rightPupil.position.set(0.1, 0.05, 0.31); headGroup.add(rightPupil);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 16), matSkin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.02, 0.3); headGroup.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), matPupil); mouth.position.set(0, -0.12, 0.28); headGroup.add(mouth);

  const hairGroup = new THREE.Group(); headGroup.add(hairGroup);
  const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.6), matHair); baseHair.position.y = 0.02; baseHair.castShadow = true; hairGroup.add(baseHair);
  const bangGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
  const bangLeft = new THREE.Mesh(bangGeo, matHair); bangLeft.position.set(-0.15, 0.15, 0.24); bangLeft.rotation.set(0.2, 0, -0.3); hairGroup.add(bangLeft);
  const bangCenter = new THREE.Mesh(bangGeo, matHair); bangCenter.position.set(0, 0.2, 0.27); bangCenter.rotation.set(0.1, 0, 0); bangCenter.scale.set(1.2, 1, 1.2); hairGroup.add(bangCenter);
  const bangRight = new THREE.Mesh(bangGeo, matHair); bangRight.position.set(0.15, 0.15, 0.24); bangRight.rotation.set(0.2, 0, 0.3); hairGroup.add(bangRight);

  const makeArm = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.8, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), matShirt); up.position.y = -0.22; up.castShadow = true; up.userData.type = 'baju'; pivot.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -0.42; pivot.add(elbow);
    const low = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.25, 4, 8), matShirt); low.position.y = -0.2; low.castShadow = true; low.userData.type = 'baju'; elbow.add(low);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), matSkin); hand.position.y = -0.43; elbow.add(hand);
    return { pivot, elbow };
  };
  const makeLeg = (x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.9, 0);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.21, 4, 8), matPants); th.position.y = -0.2; th.castShadow = true; th.userData.type = 'celana'; pivot.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 8), matPants); sh.position.y = -0.2; sh.castShadow = true; sh.userData.type = 'celana'; knee.add(sh);
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

  updateCharacterVisuals();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.minDistance = 2.5; controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.enableZoom = true; controls.zoomSpeed = 1.2; controls.rotateSpeed = 0.9;
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }; // 1 jari = putar kamera, 2 jari = cubit zoom

  // Tombol zoom +/- (zoom tanpa cubit saat satu jempol sedang memegang analog)
  const zcss = document.createElement('style');
  zcss.textContent = '#zoom-ctrl{position:fixed;left:14px;top:42%;z-index:40;display:none;flex-direction:column;gap:10px}#zoom-ctrl button{width:48px;height:48px;border-radius:50%;border:0;background:rgba(255,255,255,.28);color:#fff;font-size:24px;font-weight:700;touch-action:none;user-select:none}';
  document.head.appendChild(zcss);
  const zc = document.createElement('div'); zc.id = 'zoom-ctrl';
  zc.innerHTML = '<button id="zoom-in">＋</button><button id="zoom-out">－</button>';
  document.body.appendChild(zc);
  const holdZoom = (id, dir) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); zoomDir = dir; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => { zoomDir = 0; }));
  };
  holdZoom('zoom-in', -1); holdZoom('zoom-out', 1);

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

  document.getElementById('btn-jump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (physics.isGrounded) {
      physics.jumpCount = 1; physics.velocityY = physics.jumpForce; physics.isGrounded = false; sq.v = 6; spawnDust(5);
      createJumpEffect();
    } else if (physics.jumpCount < physics.maxJumps) {
      physics.jumpCount++; physics.velocityY = physics.jumpForce; sq.v = 6;
      createJumpEffect();
    }
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
  const label = bj ? (bj.web ? '🕸️ ' : bj.bat ? '🦇 ' : bj.iron ? '🤖 ' : '👕 ') + bj.name : '';
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

const clock = new THREE.Clock();
let walkTime = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;
  const delta = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsedTime();
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
      const m = p.mesh.material;
      p.revealTimer = Math.max(0, p.revealTimer - delta);
      const glitch = p.revealTimer > 0 || ((t * 0.7 + p.phase) % 4) < 0.18; // semua kotak palsu sesekali berkedip
      m.opacity = glitch ? 0.2 + Math.random() * 0.25 : 1 - 0.45 * p.tell * (0.6 + 0.4 * Math.sin(t * 5 + p.phase));
      m.emissive.setHex(p.revealTimer > 0 ? 0xff0044 : (glitch ? 0x66ccff : 0x000000));
      m.emissiveIntensity = 0.7;
    }
    else if (p.decoy) { // kotak ASLI yang ikut berkedip, pengecoh
      p.mesh.material.opacity = ((t * 0.6 + p.phase * 1.7) % 5) < 0.14 ? 0.3 + Math.random() * 0.25 : 1;
    }
  });

  hazards.forEach(h => h.update(t));
  if (!mazeHinted && character.position.y > FIN_Y - 1 && Math.abs(character.position.x) < 12 && character.position.z < -89 && character.position.z > -113) { mazeHinted = true; showToast('🧩 SALAH BEGO,MAMPUS'); }
  for (const gd of guards) { if (gd.update(delta, character.position, t, !godMode && !flyMode)) { gameState = 'GAMEOVER'; showGameOver('shot'); break; } }
  hitCD = Math.max(0, hitCD - delta); knock.multiplyScalar(Math.exp(-delta * 2.5));
  if (hitCD <= 0 && !godMode && !flyMode) for (const h of hazards) {
    const n = h.test(character.position);
    if (n) { knock.set(n.x * 26, n.z * 26); physics.velocityY = 13; physics.isGrounded = false; hitCD = 1.2; sq.v = -5; roast('hit', ' Kena rintangan!'); break; }
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
  const accel = 1 - Math.exp(-delta * ((desX || desZ) ? 11 : 14));
  moveVel.x += (desX - moveVel.x) * accel; moveVel.y += (desZ - moveVel.y) * accel;
  const hSpeed = moveVel.length();
  isMoving = hSpeed > 0.4;
  nextX += (moveVel.x + knock.x) * delta; nextZ += (moveVel.y + knock.y) * delta;

  if (flyMode || !checkWallCollision(nextX, character.position.z, character.position.y)) character.position.x = nextX;
  if (flyMode || !checkWallCollision(character.position.x, nextZ, character.position.y)) character.position.z = nextZ;

  const groundData = flyMode ? null : checkGroundCollision(character.position.x, character.position.z, character.position.y);
  if (groundData && physics.velocityY <= 0) {
    character.position.y = groundData.y;
    physics.velocityY = 0; physics.isGrounded = true; physics.jumpCount = 0;
    if (groundData.platform.type === 'moving_x') character.position.x += groundData.platform.dx;
    if (groundData.platform.checkpoint && checkpoint.p !== groundData.platform) {
      const m = groundData.platform.mesh.position;
      checkpoint = { p: groundData.platform, set: true, x: m.x, y: groundData.y, z: m.z };
      showToast('✅ Checkpoint tersimpan!');
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

  // Kotak palsu: tembus lalu glitch merah
  platforms.forEach(p => {
    if (p.type !== 'fake' || p.revealTimer > 0) return;
    const m = p.mesh.position, ty = m.y + 0.25;
    if (Math.abs(character.position.x - m.x) < p.width / 2 && Math.abs(character.position.z - m.z) < p.depth / 2 && character.position.y < ty + 0.2 && character.position.y > ty - 1.2) {
      p.revealTimer = 1.5; roast('fake', ' Kotak palsu! bego');
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
    showGameOver('fall');
  }

  // KONDISI MENANG DI PUNCAK
  if (character.position.y > FIN_Y - 0.5 && Math.abs(character.position.x - WIN.x) < 4.5 && Math.abs(character.position.z - WIN.z) < 4.5) {
    gameState = 'WIN'; 
    playerData.coins = (playerData.coins || 0) + 700;
    updatePlayerFirebase();
    document.getElementById('coin-amount').textContent = playerData.coins;
    showOverlay('YOU WIN!', 'Putzzdev mengakui kamu jago melewati tower, jebakan, dan labirin! +700 🪙', '#00ff00');
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
  for (const cp of [capePivot, capeB]) if (cp && cp.visible) damp(cp.rotation, 'x', 0.08 + hSpeed * 0.05 + (physics.isGrounded ? 0 : 0.4) + Math.sin(t * 7) * (isMoving ? 0.05 : 0.01));
  const air = physics.isGrounded ? 0 : THREE.MathUtils.clamp(physics.velocityY / 13, -1, 1) * 0.1;
  const st = THREE.MathUtils.clamp(sq.x + air, -0.35, 0.35);
  rig.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);
  camera.fov += ((60 + runK * 8) - camera.fov) * k * 0.5; camera.updateProjectionMatrix();
  if (embers) { const ep = embers.geometry.attributes.position; for (let i = 0; i < ep.count; i++) { let y = ep.getY(i) + delta * 1.5; if (y > 22) y = -8; ep.setY(i, y); } ep.needsUpdate = true; }

  const targetPos = character.position.clone(); targetPos.y += 1.5;
  const prevT = controls.target.clone();
  controls.target.lerp(targetPos, 1 - Math.exp(-delta * 8));
  camera.position.add(controls.target.clone().sub(prevT)); // kamera ikut bergerak bersama pemain
  if (zoomDir) {
    const off = camera.position.clone().sub(controls.target);
    off.setLength(THREE.MathUtils.clamp(off.length() * (1 + zoomDir * 1.2 * delta), controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(off);
  }
  controls.update();

  lavaMat.color.setHSL(0.03 + Math.sin(t * 2) * 0.02, 1, 0.5);
}

window.addEventListener('resize', () => {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});