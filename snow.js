// Map ice/salju PARKOUR 3D. Dipisahkan dari main.js.
export function buildSnowWorld(THREE, scene, api) {
  const { runElapsedMs, insidePlat, showToast } = api;
  const SNOW_TIMER_SEC = 20;
  const SNOW_FIRE_WINDOW_SEC = 10;
  const SNOW_CYCLE_SEC = SNOW_TIMER_SEC + SNOW_FIRE_WINDOW_SEC;
  // NPC lebih responsif: cepat mengunci sasaran, lalu memberi jeda singkat antar-tembakan.
  const SNOW_AIM_TIME = 0.45, SNOW_LOCK_TIME = 0.12, SNOW_COOL_TIME = 0.95;
  // Jarak tembak NPC TIDAK dibatasi: selama ada garis pandang, pemain di jarak berapa pun tetap bisa kena.
  // (angka sangat besar dipakai, bukan Infinity, supaya aman untuk semua perhitungan di main.js)
  const SNOW_NPC_UNLIMITED_RANGE = true;
  const SNOW_NPC_RANGE = 1e9;
  // Sektor jaga tiap NPC (kotak zona) tetap dipertahankan agar tidak semua NPC menembak sekaligus dari
  // seluruh map. Ubah ke true bila ingin semua NPC menembak ke mana pun tanpa batas sektor.
  const SNOW_NPC_IGNORE_ZONE = false;
  const snowTimeLeft = () => {
    const phase = (runElapsedMs() / 1000) % SNOW_CYCLE_SEC;
    return phase < SNOW_TIMER_SEC ? SNOW_TIMER_SEC - phase : 0;
  };
  const grp = new THREE.Group(); grp.name = 'SNOW_WORLD'; grp.visible = false; scene.add(grp);
  const P = [], C = [], cracks = [], npcs = [], route = [], cpList = [];
  const vanish = [], rotators = [], snowballs = [], windZones = [], swingPlanks = [], glowCrystals = [];

  // Pseudo-random dengan seed tetap -> dekorasi selalu sama setiap game dimuat.
  function mulberry32(a) { return function () { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rand = mulberry32(20261109);

  grp.add(new THREE.HemisphereLight(0xe4f4ff, 0x6d88aa, 1.15));
  const sunS = new THREE.DirectionalLight(0xffffff, 1.25); sunS.position.set(-25, 70, 35); grp.add(sunS);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: 0x6fa8d6 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -8, -270); grp.add(water);

  const iceMat = new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.12, metalness: 0.15, emissive: 0x16405e, emissiveIntensity: 0.35 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.95 });
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x7fcfff, roughness: 0.1, metalness: 0.2, emissive: 0x1b5a86, emissiveIntensity: 0.4 });
  const crackMat = new THREE.MeshStandardMaterial({ color: 0xd8f1ff, roughness: 0.25, emissive: 0x4a7a9c, emissiveIntensity: 0.3 });
  const cpMat = new THREE.MeshStandardMaterial({ color: 0x22ddaa, emissive: 0x22ddaa, emissiveIntensity: 0.45 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9, emissive: 0x2a5878, emissiveIntensity: 0.25 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xe9f1f8, roughness: 0.9 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xaed9f2, roughness: 0.3, emissive: 0x1d4663, emissiveIntensity: 0.3 });
  const iceRockMat = new THREE.MeshStandardMaterial({ color: 0xa9dcf5, roughness: 0.35, metalness: 0.1, flatShading: true, emissive: 0x1d5273, emissiveIntensity: 0.3 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2c6b58, roughness: 0.9, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.95 });
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x7f97b0, roughness: 1, flatShading: true });
  const bergMat = new THREE.MeshStandardMaterial({ color: 0xcfeeff, roughness: 0.25, flatShading: true, emissive: 0x2a6a90, emissiveIntensity: 0.25 });
  const crystalMats = [0, 1, 2].map(() => cubeMat.clone()); // material sendiri agar kilau kristal tidak mengubah platform kubus
  const ICE_GRIP = [0.22, 0.1], SNOW_GRIP = [0.6, 0.55]; // [saat ada input, saat lepas input] -> licin

  const pushColl = (p) => { P.push(p); return p; };
  // y = nilai "nominal" seperti map Lava: permukaan atas selalu y + 0.25
  function plat(x, y, z, w, d, o = {}) {
    const kind = o.kind || 'ice', shape = o.shape || 'box', type = o.type || 'static', h = o.h || 0.5, cy = y + 0.25 - h / 2;
    const geo = shape === 'round' ? new THREE.CylinderGeometry(w / 2, w / 2, h, 28) : new THREE.BoxGeometry(w, h, d);
    let mat = o.cp ? cpMat : (type === 'crack' ? crackMat : (kind === 'snow' ? snowMat : (kind === 'cube' ? cubeMat : iceMat)));
    if (type === 'snow_vanish') mat = mat.clone(); // kedip peringatan hanya pada platform itu sendiri
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, cy, z); grp.add(mesh);
    const p = { mesh, width: w, depth: d, type, hh: h / 2, startX: x, startY: cy, startZ: z, range: o.range != null ? o.range : 2.5, speed: o.speed != null ? o.speed : 1.5,
      phase: (P.length * 2.39996) % (Math.PI * 2), isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: shape === 'round' ? w / 2 : 0,
      grip: kind === 'snow' ? SNOW_GRIP : ICE_GRIP, crackState: 0, crackT: 0 };
    if (o.cp) {
      p.checkpoint = true; p.checkpointActivated = false; p.checkpointReadyMaterial = cpMat; cpList.push(p);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      pole.position.set(x + w / 2 - 0.7, y + 0.25 + 1.5, z + d / 2 - 0.7); grp.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), new THREE.MeshBasicMaterial({ color: 0x22ddaa }));
      flag.position.set(x + w / 2 - 0.7 + 0.65, y + 0.25 + 2.6, z + d / 2 - 0.7); grp.add(flag);
    }
    if (type === 'crack') cracks.push(p);
    if (type === 'snow_vanish') { p.vanishState = 0; p.vanishT = 0; vanish.push(p); }
    if (o.route) route.push(p);
    return pushColl(p);
  }
  function coverEntry(mesh, w, d, hh, r) {
    const p = { mesh, width: w, depth: d, type: 'wall', hh, startX: mesh.position.x, startY: mesh.position.y, startZ: mesh.position.z, range: 0, speed: 0, phase: 0, isFallen: false, tell: 0, revealTimer: 0, dx: 0, r: r || 0, cover: true };
    P.push(p); C.push(p); return p;
  }
  function wall(cx, floorTop, cz, w, h, d) { // dinding es / penghalang es besar (collision kotak)
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(cx, floorTop + h / 2, cz); grp.add(m);
    return coverEntry(m, w, d, h / 2, 0);
  }
  function rock(cx, floorTop, cz, rad, h) { // bongkahan batu salju (collision lingkaran)
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockMat); m.scale.set(rad * 1.06, h / 2, rad * 1.06); m.position.set(cx, floorTop + h / 2, cz); grp.add(m);
    return coverEntry(m, rad * 2, rad * 2, h / 2, rad);
  }
  function column(cx, cz, rad, y0, y1) { // pilar es raksasa
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.15, y1 - y0, 20), towerMat); m.position.set(cx, (y0 + y1) / 2, cz); grp.add(m);
    return coverEntry(m, rad * 2, rad * 2, (y1 - y0) / 2, rad);
  }
  const octaGeo = new THREE.OctahedronGeometry(1, 0);
  function crystal(x, y, z, s) {
    const m = new THREE.Mesh(octaGeo, crystalMats[glowCrystals.length % 3]); m.scale.set(s * 0.5, s, s * 0.5); m.position.set(x, y + s, z);
    m.rotation.y = (glowCrystals.length * 1.7) % 6.28; grp.add(m); glowCrystals.push(m);
  }
  function rotatingBar(x, y, z, length, speed, color = 0x65d9ff) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); grp.add(pivot);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(length, 0.28, 0.48), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.22 }));
    bar.position.y = 0.25; pivot.add(bar);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.6, 16), cubeMat); hub.position.y = 0.3; pivot.add(hub);
    // half = setengah panjang batang; dipakai untuk tabrakan sepanjang batang (bukan satu lingkaran penuh).
    rotators.push({ mesh: pivot, speed, radius: length * 0.48, half: length / 2 });
  }
  function rollingSnowball(x, y, z, axis, range, speed, phase = 0) {
    const radius = 1.35;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), new THREE.MeshStandardMaterial({ color: 0xf7fcff, roughness: 0.92 }));
    mesh.position.set(x, y + radius * 0.72, z); grp.add(mesh);
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.09, 8, 24), new THREE.MeshStandardMaterial({ color: 0x8edcff, emissive: 0x2c8eb8, emissiveIntensity: 0.4 }));
    band.rotation.x = Math.PI / 2; mesh.add(band);
    snowballs.push({ mesh, axis, center: axis === 'x' ? x : z, range, speed, phase, radius });
  }
  const top = (p) => p.mesh.position.y + p.hh;

  // Raycast garis pandang NPC -> pemain. Dihitung analitik (slab kotak / lingkaran) sehingga biaya
  // tidak bergantung pada panjang tembakan: jarak sejauh apa pun tetap murah dan akurat.
  function snowRayBlocked(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    let bestT = 2;
    for (const c of C) {
      const m = c.mesh.position;
      let lo = 0.002, hi = 0.998;
      // irisan sumbu Y
      const y0 = m.y - c.hh, y1 = m.y + c.hh;
      if (Math.abs(dy) < 1e-9) { if (ay < y0 || ay > y1) continue; }
      else { let ta = (y0 - ay) / dy, tb = (y1 - ay) / dy; if (ta > tb) { const s = ta; ta = tb; tb = s; } lo = Math.max(lo, ta); hi = Math.min(hi, tb); }
      if (lo > hi) continue;
      if (c.r > 0) { // pilar / batu bulat (lingkaran di bidang XZ)
        const ox = ax - m.x, oz = az - m.z, a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), cc = ox * ox + oz * oz - c.r * c.r;
        if (a < 1e-9) { if (cc > 0) continue; }
        else {
          const disc = b * b - 4 * a * cc; if (disc < 0) continue;
          const sq = Math.sqrt(disc); lo = Math.max(lo, (-b - sq) / (2 * a)); hi = Math.min(hi, (-b + sq) / (2 * a));
        }
      } else { // dinding kotak
        const hw = c.width / 2, hd = c.depth / 2;
        if (Math.abs(dx) < 1e-9) { if (Math.abs(ax - m.x) > hw) continue; }
        else { let ta = (m.x - hw - ax) / dx, tb = (m.x + hw - ax) / dx; if (ta > tb) { const s = ta; ta = tb; tb = s; } lo = Math.max(lo, ta); hi = Math.min(hi, tb); }
        if (lo > hi) continue;
        if (Math.abs(dz) < 1e-9) { if (Math.abs(az - m.z) > hd) continue; }
        else { let ta = (m.z - hd - az) / dz, tb = (m.z + hd - az) / dz; if (ta > tb) { const s = ta; ta = tb; tb = s; } lo = Math.max(lo, ta); hi = Math.min(hi, tb); }
      }
      if (lo <= hi && lo < bestT) bestT = lo;
    }
    return bestT <= 1 ? { x: ax + dx * bestT, y: ay + dy * bestT, z: az + dz * bestT } : null;
  }
  function distPointSeg(px, py, pz, ax, ay, az, bx, by, bz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const l2 = abx * abx + aby * aby + abz * abz || 1e-6;
    let t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t), pz - (az + abz * t));
  }

  // ================= DEKORASI & OBJEK LINGKUNGAN (pohon salju, batu es, gundukan, gerbang) =================
  // Instancing dipakai untuk objek dekoratif yang jumlahnya banyak supaya ringan di Web maupun APK.
  const INS = { green: [], white: [], trunk: [], mound: [], mtn: [], mtnCap: [], berg: [] };
  function pine(x, floorTop, z, s, solid) { // pohon pinus bersalju; solid = batang jadi collider + tempat berlindung
    if (solid) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 3.2, 8), trunkMat); m.scale.set(s, s, s); m.position.set(x, floorTop + 1.6 * s, z); grp.add(m);
      coverEntry(m, 1.0 * s, 1.0 * s, 1.6 * s, 0.5 * s);
    } else INS.trunk.push([x, floorTop + 1.6 * s, z, s]);
    for (let k = 0; k < 3; k++) {
      const yb = floorTop + (2.8 + 1.25 * k) * s, hk = (2.7 - 0.25 * k) * s, rk = (2.1 - 0.55 * k) * s;
      INS.green.push([x, yb + hk / 2, z, rk, hk, k * 0.6]);
      const a = 0.42 * hk, rw = rk * (1 - a / hk) + 0.1 * s, hw = rw * hk / rk; // tudung salju di bagian atas tiap lapis
      INS.white.push([x, yb + a + hw / 2, z, rw, hw, k * 0.6]);
    }
  }
  function iceRock(cx, floorTop, cz, rad, h) { // batu es berfaset dengan kristal kecil (collision lingkaran)
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), iceRockMat);
    m.scale.set(rad * 1.05, h / 2, rad * 1.05); m.position.set(cx, floorTop + h / 2, cz); m.rotation.y = Math.abs(cx * 12.9 + cz * 7.3) % 6.28; grp.add(m);
    crystal(cx + rad * 0.6, floorTop + h * 0.25, cz - rad * 0.3, rad * 0.4);
    return coverEntry(m, rad * 2.1, rad * 2.1, h / 2, rad);
  }
  function mound(x, floorTop, z, r) { INS.mound.push([x, floorTop - 0.04, z, r]); } // tumpukan salju dekoratif
  function shelter(p, sx) { // dinding berbentuk L di sudut checkpoint sebagai tempat berlindung
    const x = p.startX, z = p.startZ, ft = top(p), hw = p.width / 2, hd = p.depth / 2;
    wall(x + sx * (hw - 2.7), ft, z - hd + 1.1, 4.8, 3.4, 0.9);
    wall(x + sx * (hw - 1.1), ft, z - hd + 3.35, 0.9, 3.4, 3.6);
  }
  function labelTexture(text) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const cx = cv.getContext('2d');
    cx.fillStyle = '#0d2238'; cx.fillRect(0, 0, 512, 128); cx.strokeStyle = '#7fd6ff'; cx.lineWidth = 8; cx.strokeRect(5, 5, 502, 118);
    cx.font = 'bold 44px sans-serif'; cx.fillStyle = '#e8f8ff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 256, 66, 470);
    return new THREE.CanvasTexture(cv);
  }
  function gateway(x, floorTop, z, R, rotY, label) { // gerbang lengkung es + papan nama zona (dekoratif, tanpa collision)
    const g = new THREE.Group(); g.position.set(x, floorTop, z); g.rotation.y = rotY || 0; grp.add(g);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.42, 8, 30, Math.PI), cubeMat));
    for (const sd of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.78, 1.4, 8), towerMat); leg.position.set(sd * R, 0.7, 0); g.add(leg); }
    if (R >= 4) for (const a of [1.15, 1.45, 1.7, 2.0]) {
      const ice = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 6), cubeMat); ice.rotation.x = Math.PI;
      ice.position.set((R - 1.0) * Math.cos(a), (R - 1.0) * Math.sin(a), 0); g.add(ice);
    }
    const W = Math.min(R * 1.7, 8.5), board = new THREE.Mesh(new THREE.PlaneGeometry(W, W / 4), new THREE.MeshBasicMaterial({ map: labelTexture(label), side: THREE.DoubleSide }));
    board.position.set(0, R + 0.5 + W / 8, 0); g.add(board);
  }
  function gustRings(cx, cy, cz, n, step, axis) { // cincin angin dekoratif searah dorongan badai
    for (let i = 0; i < n; i++) {
      const gust = new THREE.Mesh(new THREE.TorusGeometry(1.15 + (i % 3) * 0.12, 0.04, 6, 20), gustMat);
      if (axis === 'x') { gust.position.set(cx + i * step, cy + (i % 2) * 0.25, cz); gust.rotation.y = Math.PI / 2; }
      else gust.position.set(cx + (i % 2) * 0.3, cy + (i % 2) * 0.25, cz + i * step);
      grp.add(gust);
    }
  }
  const gustMat = new THREE.MeshBasicMaterial({ color: 0xc9f2ff, transparent: true, opacity: 0.28 });

  // ================= ZONA 1: Camp awal + Lapangan Es (licin, zig-zag dinding) =================
  plat(0, 0, 0, 10, 10, { kind: 'snow', route: 1 });
  plat(0, 0, -16, 16, 20, { route: 1 });
  wall(-3, 0.25, -3.2, 4, 3.2, 1);
  wall(-4.5, 0.25, -12, 7, 3.2, 1);
  wall(4.5, 0.25, -18, 7, 3.2, 1);
  rock(-5.5, 0.25, -22.5, 1.7, 3.2);
  rock(5.8, 0.25, -8.2, 1.5, 3.0);
  crystal(-7, 0.25, -7, 1.6); crystal(7.2, 0.25, -24, 1.3);

  // ================= ZONA 2: Jembatan es batu melayang (bergerak, retak) =================
  plat(11.5, 0.5, -22, 3.6, 3.6, { kind: 'cube', h: 1.4, route: 1 });
  plat(16.5, 1.0, -22, 3.6, 3.6, { kind: 'cube', h: 1.4, type: 'moving_y', range: 0.9, speed: 1.4, route: 1 });
  plat(21.5, 1.5, -25, 3.6, 3.6, { kind: 'cube', h: 1.4, type: 'moving_x', range: 1.5, speed: 1.2, route: 1 });
  plat(26.5, 2.0, -28.5, 3.6, 3.6, { kind: 'cube', h: 1.4, type: 'crack', route: 1 });
  plat(31.5, 2.0, -31.5, 3.6, 3.6, { kind: 'cube', h: 1.4, route: 1 });

  // ================= ZONA 3: Teras Timur (CHECKPOINT 1) + tangga zig-zag bertingkat =================
  plat(40, 2.5, -33, 10, 10, { kind: 'snow', cp: true, route: 1 });
  wall(38.75, 2.75, -35.5, 6.5, 4, 1);
  wall(44.2, 2.75, -30.5, 1, 4, 5);
  plat(38, 4, -43, 7, 7, { route: 1 });
  plat(31.5, 5.5, -48, 7, 7, { type: 'snow_vanish', route: 1 });
  plat(25, 7, -43, 7, 7, { route: 1 });
  plat(18.5, 8.5, -48, 7, 7, { type: 'snow_vanish', route: 1 });
  plat(12, 10, -43, 7, 7, { route: 1 });
  rock(33.8, 5.75, -48.3, 1.4, 3.4);
  rock(14.4, 10.25, -44.6, 1.3, 3.4);
  plat(4.5, 11.5, -45, 8, 8, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 2

  // ================= ZONA 4: Jembatan es sempit licin + pad perlindungan =================
  plat(-6, 11.5, -45, 10, 2.8, { route: 1 });
  plat(-17, 12, -45, 9, 9, { route: 1 });
  rock(-14.2, 12.25, -47.2, 1.6, 3.8);
  plat(-17, 12.5, -56.5, 2.8, 14, { route: 1 });
  plat(-17, 13, -69, 10, 10, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 3
  wall(-13.2, 13.25, -69, 1, 3.8, 7);
  wall(-14.6, 13.25, -72.8, 4, 3.8, 1);

  // ================= ZONA 5: Menara spiral es (naik melingkar) =================
  const SC = { x: -17, z: -83 }, SR = 9, SN = 14, SDA = 0.62;
  column(SC.x, SC.z, 3.2, 12, 34);
  for (let i = 1; i <= SN; i++) {
    const a = Math.PI / 2 + i * SDA, o = { shape: 'round', route: 1 };
    if (i % 4 === 0) o.type = 'crack'; else if (i % 5 === 2) { o.type = 'moving_y'; o.range = 0.5; o.speed = 1.3; }
    plat(SC.x + SR * Math.cos(a), 13 + i, SC.z + SR * Math.sin(a), 3.8, 3.8, o);
  }

  // ================= FITUR TAMBAHAN: rintangan unik Map Salju =================
  // Bola salju raksasa melintasi lapangan awal; ada dinding batu sebagai tempat menghindar.
  rollingSnowball(0, 0.25, -15.5, 'x', 6.2, 1.05, 0.4);
  rollingSnowball(39.5, 2.75, -39.5, 'z', 2.8, 0.8, 2.1);

  // Tangga es bergerak tambahan untuk variasi timing sebelum checkpoint kedua.
  plat(8.5, 12.5, -49.5, 3.2, 3.2, { kind: 'cube', h: 1.0, type: 'moving_y', range: 0.65, speed: 1.25, route: 1 });
  plat(1.5, 13.5, -54.5, 3.2, 3.2, { kind: 'cube', h: 1.0, type: 'moving_y', range: 0.8, speed: 1.05, route: 1 });

  // Jembatan gantung: papan pijakan berayun ringan, tetapi collider utama tetap aman.
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 2.2), new THREE.MeshStandardMaterial({ color: 0x8bc9e8, roughness: 0.32, metalness: 0.18 }));
    plank.position.set(-6 - i * 2.1, 12.05 + (i % 2) * 0.08, -45); grp.add(plank);
    swingPlanks.push({ mesh: plank, speed: 1.4 + i * 0.08, phase: i * 0.8 });
  }
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x567f9b, roughness: 0.8 });
  for (const side of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 10.5, 8), ropeMat);
    rope.position.set(-10.2, 13.1, -45 + side * 1.65); rope.rotation.z = Math.PI / 2; grp.add(rope);
  }

  // Badai salju di jembatan sempit. Arah dorongan konsisten; pagar es memberi batas visual.
  windZones.push({ x: -17, z: -56.5, hx: 2.2, hz: 6.4, dx: 8.5, dz: 0, maxY: 18 });
  wall(-19.15, 12.75, -56.5, 0.35, 1.6, 13.5);
  wall(-14.85, 12.75, -56.5, 0.35, 1.6, 13.5);
  for (let i = 0; i < 7; i++) {
    const gust = new THREE.Mesh(new THREE.TorusGeometry(1.0 + i * 0.12, 0.035, 6, 20), gustMat);
    gust.position.set(-17 + (i % 2) * 0.35, 14 + i * 0.12, -52 - i * 1.35); gust.rotation.x = Math.PI / 2; grp.add(gust);
  }

  // Gua es gelap dengan gerbang kristal dan stalaktit dekoratif di sekitar checkpoint 3.
  const caveMat = new THREE.MeshStandardMaterial({ color: 0x173a59, roughness: 0.28, metalness: 0.18, emissive: 0x0a2845, emissiveIntensity: 0.65 });
  const caveArch = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.65, 8, 24, Math.PI), caveMat);
  caveArch.position.set(-17, 15.7, -69.2); caveArch.rotation.z = Math.PI; grp.add(caveArch);
  for (let i = 0; i < 7; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.38 + (i % 3) * 0.12, 1.8 + (i % 2) * 0.8, 6), cubeMat);
    spike.position.set(-21.5 + i * 1.5, 17.2, -72.5 - (i % 2) * 0.6); spike.rotation.x = Math.PI; grp.add(spike);
  }
  crystal(-21.5, 13.25, -68.5, 2.0); crystal(-12.5, 13.25, -68.5, 1.7);

  // Lompatan kristal es di sisi jalur spiral: platform kecil berurutan dengan jarak terukur.
  for (let i = 0; i < 4; i++) {
    const px = -7.5 - i * 1.9, pz = -76.5 - i * 2.0, py = 14 + i * 1.15;
    const pad = plat(px, py, pz, 2.35, 2.35, { kind: 'cube', h: 0.75, route: 1 });
    crystal(px, py + 0.25, pz, 0.95);
  }

  // ================= ZONA 6: Puncak (CHECKPOINT 4) + medan terakhir (versi lama) =================
  plat(-27, 27.5, -97, 9, 9, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 4
  const PF2 = plat(-27, 28, -113.5, 14, 19, { route: 1 });
  // Ekstensi jalur puncak: lompatan zig-zag, platform bergerak.
  plat(-21.5, 29.5, -128, 3.4, 3.4, { kind: 'cube', h: 0.8, route: 1 });
  plat(-27.5, 31, -133.5, 3.1, 3.1, { kind: 'cube', h: 0.8, type: 'moving_x', range: 1.0, speed: 1.0, route: 1 });
  plat(-33, 32.5, -139, 3.0, 3.0, { kind: 'crack', h: 0.75, type: 'crack', route: 1 });
  plat(-27.5, 34, -144.5, 3.2, 3.2, { kind: 'cube', h: 0.8, route: 1 });
  wall(-31, 28.25, -106.5, 7, 3.6, 1);
  wall(-23, 28.25, -110, 7, 3.6, 1);
  rock(-32, 28.25, -116, 1.5, 3.2);
  crystal(-21.5, 28.25, -120, 1.4);

  // ================= ZONA 7: Hutan Pinus Beku (slalom dinding + pohon) =================
  const PF3 = plat(-27, 34, -153, 10, 10, { kind: 'snow', cp: true, route: 1 });   // CHECKPOINT 5 (dulu finish)
  shelter(PF3, -1);
  const A1 = plat(-27, 34.5, -167, 12, 14, { route: 1 });
  const A2 = plat(-27, 35, -184, 10, 16, { kind: 'snow', route: 1 });
  gateway(-27, top(A1), -160.6, 6, 0, 'HUTAN PINUS BEKU');
  wall(-30, top(A1), -163.5, 6, 3.4, 0.9);
  wall(-24, top(A1), -169.5, 6, 3.4, 0.9);
  pine(-32.2, top(A1), -172.6, 1.2, true); pine(-21.8, top(A1), -161.8, 1.1, true);
  iceRock(-27.5, top(A2), -180, 1.5, 3.2); iceRock(-25, top(A2), -187.5, 1.4, 3.0);
  pine(-31.2, top(A2), -177.5, 1.3, true); pine(-22.8, top(A2), -190.5, 1.2, true);

  // ================= ZONA 8: Jembatan Angin (balok es sempit + angin samping) =================
  plat(-27, 35.5, -196.5, 3.6, 3.6, { kind: 'cube', h: 1.2, route: 1 });
  plat(-20.5, 36, -200, 3.6, 3.6, { kind: 'cube', h: 1.2, type: 'moving_x', range: 1.0, speed: 1.1, route: 1 });
  plat(-14, 36.5, -203, 3.6, 3.6, { kind: 'cube', h: 1.2, type: 'crack', route: 1 });
  const BM = plat(3, 37, -203, 24, 2.6, { route: 1 });
  gateway(-8.6, top(BM), -203, 3.4, -Math.PI / 2, 'JEMBATAN ANGIN');
  wall(3, top(BM), -201.5, 24, 1.3, 0.3);                 // pagar di sisi yang didorong angin
  windZones.push({ x: 3, z: -203, hx: 12.5, hz: 1.9, dx: 0, dz: 7.5, maxY: 44 });
  gustRings(-6, top(BM) + 1.2, -203, 7, 3.2, 'x');
  const CP6 = plat(23, 38, -203, 10, 10, { kind: 'snow', cp: true, route: 1 });    // CHECKPOINT 6
  shelter(CP6, 1);
  pine(19.2, top(CP6), -207.2, 1.2, true);

  // ================= ZONA 9: Lembah Bola Salju + batu pijakan menghilang =================
  const D1 = plat(23, 38.5, -221, 14, 20, { route: 1 });
  gateway(23, top(D1), -212.2, 7, 0, 'LEMBAH BOLA SALJU');
  rollingSnowball(23, top(D1), -216.5, 'x', 3.4, 1.0, 0.4);
  rollingSnowball(23, top(D1), -225.5, 'x', 3.4, 1.35, 2.3);
  iceRock(17.2, top(D1), -221, 1.2, 3.0); iceRock(28.8, top(D1), -221, 1.2, 3.0);   // tempat berlindung di antara dua bola
  const D2 = plat(23, 39, -237, 6, 8, { kind: 'snow', route: 1 });
  pine(20.8, top(D2), -234.3, 1.0, true);
  plat(17.5, 39.5, -246, 4, 4, { type: 'snow_vanish', route: 1 });
  plat(24.5, 40, -250, 4, 4, { type: 'snow_vanish', route: 1 });
  plat(17.5, 40.5, -255, 4, 4, { route: 1 });
  plat(24.5, 41, -260, 4, 4, { type: 'crack', route: 1 });
  const CP7 = plat(21, 41.5, -271, 12, 12, { kind: 'snow', cp: true, route: 1 });  // CHECKPOINT 7
  shelter(CP7, -1);
  pine(15.9, top(CP7), -266, 1.3, true); iceRock(26, top(CP7), -274, 1.2, 2.8);

  // ================= ZONA 10: Pendakian Gunung Es + Lorong Penyapu Es =================
  plat(9, 42.5, -271, 6, 6, { kind: 'cube', h: 1.2, route: 1 });
  plat(1.5, 43.5, -271, 6, 6, { kind: 'cube', h: 1.2, type: 'snow_vanish', route: 1 });
  plat(-6, 44.5, -271, 6, 6, { kind: 'cube', h: 1.2, type: 'crack', route: 1 });
  plat(-14, 45, -274, 5, 5, { kind: 'cube', h: 1.0, type: 'moving_y', range: 0.8, speed: 1.1, route: 1 });
  plat(-22.5, 45.75, -277, 6, 6, { route: 1 });
  const H1 = plat(-22.5, 46.5, -295, 14, 24, { route: 1 });
  gateway(-22.5, top(H1), -284.2, 7, 0, 'LORONG PENYAPU ES');
  rotatingBar(-22.5, top(H1), -290, 13, 1.4);                    // batang penyapu: lompati atau tunggu celah
  rotatingBar(-22.5, top(H1), -301, 9, -1.8, 0xff9a5c);
  crystal(-28.5, top(H1), -306, 1.1); crystal(-16.5, top(H1), -306, 1.1); crystal(-28.7, top(H1), -284.5, 0.9);
  const CP8 = plat(-22.5, 47.5, -314, 10, 10, { kind: 'snow', cp: true, route: 1 }); // CHECKPOINT 8
  shelter(CP8, 1);
  pine(-26.3, top(CP8), -311, 1.2, true);

  // ================= ZONA 11: Titi Badai Salju (balok panjang + angin kencang) + platform bergerak =================
  const I1 = plat(-22.5, 48, -332, 3, 20, { route: 1 });
  gateway(-22.5, top(I1), -323, 3.2, 0, 'TITI BADAI SALJU');
  wall(-24.25, top(I1), -332, 0.3, 1.4, 20);
  windZones.push({ x: -22.5, z: -332, hx: 2.4, hz: 11, dx: -9, dz: 0, maxY: 56 });
  gustRings(-22.5, top(I1) + 1.2, -326, 6, 3.4, 'z');
  const I2 = plat(-22.5, 48.5, -350, 9, 9, { route: 1 });
  pine(-26, top(I2), -347.5, 1.2, true); iceRock(-20, top(I2), -352.2, 1.2, 2.6);
  plat(-14, 49, -357, 3.6, 3.6, { kind: 'cube', h: 1.2, type: 'moving_x', range: 1.0, speed: 1.2, route: 1 });
  plat(-7, 49.5, -360, 3.6, 3.6, { kind: 'cube', h: 1.2, type: 'moving_y', range: 0.9, speed: 1.3, route: 1 });
  plat(0, 50, -363, 3.6, 3.6, { kind: 'cube', h: 1.2, type: 'crack', route: 1 });
  plat(7, 50.5, -363, 3.6, 3.6, { kind: 'cube', h: 1.2, type: 'snow_vanish', route: 1 });
  const CP9 = plat(18, 51, -363, 12, 12, { kind: 'snow', cp: true, route: 1 });    // CHECKPOINT 9
  shelter(CP9, 1);
  pine(12.9, top(CP9), -359, 1.3, true); iceRock(13.6, top(CP9), -367, 1.2, 2.8);

  // ================= ZONA 12: Rimba Pilar Es (hutan pilar + bola salju) lalu Menara Spiral II =================
  const L1 = plat(18, 51.5, -383, 16, 24, { route: 1 });
  gateway(18, top(L1), -372.2, 8, 0, 'RIMBA PILAR ES');
  for (const [px, pz] of [[13.5, -376.5], [22.5, -376.5], [18, -382.5], [13.5, -388.5], [22.5, -388.5], [18, -392.5]]) column(px, pz, 1.3, top(L1) - 0.2, top(L1) + 8);
  rollingSnowball(18, top(L1), -385.5, 'x', 4.6, 1.1, 1.0);
  plat(18, 52, -400, 5, 5, { kind: 'snow', type: 'snow_vanish', route: 1 });
  plat(11, 52.5, -405.5, 3.4, 3.4, { kind: 'cube', h: 1.0, type: 'crack', route: 1 });
  plat(4.5, 53, -410, 3.4, 3.4, { kind: 'cube', h: 1.0, route: 1 });
  const HC = { x: 2, z: -423 }, HR = 8, HN = 16, HDA = 0.62, HA0 = Math.atan2(13, 2);
  column(HC.x, HC.z, 2.6, 52, 70);
  for (let i = 0; i < HN; i++) {
    const a = HA0 + i * HDA, o = { shape: 'round', route: 1 };
    if (i % 4 === 3) o.type = 'crack'; else if (i % 6 === 1) o.type = 'snow_vanish'; else if (i % 5 === 2) { o.type = 'moving_y'; o.range = 0.4; o.speed = 1.3; }
    plat(HC.x + HR * Math.cos(a), 53.5 + 0.9 * i, HC.z + HR * Math.sin(a), 3.2, 3.2, o);
  }
  const CP10 = plat(2, 67.5, -439.5, 10, 10, { kind: 'snow', cp: true, route: 1 }); // CHECKPOINT 10
  shelter(CP10, 1);
  pine(-1.6, top(CP10), -436, 1.3, true);

  // ================= ZONA 13: Puncak Badai (jalur terakhir, tersulit) =================
  const O1 = plat(2, 68, -455, 12, 16, { route: 1 });
  gateway(2, top(O1), -447.8, 6, 0, 'PUNCAK BADAI');
  windZones.push({ x: 2, z: -455, hx: 6, hz: 8, dx: -5.5, dz: 0, maxY: 76 });
  wall(-1.5, top(O1), -451.5, 5, 3.4, 0.9); wall(5.5, top(O1), -458, 5, 3.4, 0.9);
  iceRock(-1.6, top(O1), -461.5, 1.3, 3.0);
  const P1 = plat(2, 68.5, -472, 2.6, 14, { route: 1 });
  windZones.push({ x: 2, z: -472, hx: 2, hz: 7.4, dx: 7.5, dz: 0, maxY: 80 });
  gustRings(2, top(P1) + 1.2, -466, 5, 3, 'z');
  plat(2, 69, -483.5, 3.2, 3.2, { kind: 'cube', h: 1.0, route: 1 });
  plat(7.5, 69.5, -489, 3.0, 3.0, { kind: 'cube', h: 0.9, type: 'moving_x', range: 0.9, speed: 1.4, route: 1 });
  plat(1.5, 70, -494, 2.8, 2.8, { kind: 'cube', h: 0.9, type: 'snow_vanish', route: 1 });
  plat(8, 70.5, -499, 2.8, 2.8, { kind: 'cube', h: 0.9, type: 'crack', route: 1 });
  plat(2, 71, -504, 2.6, 2.6, { kind: 'cube', h: 0.9, route: 1 });
  plat(8, 71.5, -509, 2.6, 2.6, { kind: 'cube', h: 0.9, type: 'snow_vanish', route: 1 });
  const CP11 = plat(5, 72, -518, 10, 10, { kind: 'snow', cp: true, route: 1 });    // CHECKPOINT 11
  shelter(CP11, -1);
  pine(9.2, top(CP11), -514.5, 1.3, true);
  const S1 = plat(5, 72.5, -538, 14, 22, { route: 1 });
  rotatingBar(5, top(S1), -532.5, 12, 1.7, 0xff7a4d);
  rotatingBar(5, top(S1), -543.5, 10, -2.0);
  crystal(-1, top(S1), -548, 1.2); crystal(11, top(S1), -548, 1.2); crystal(-1, top(S1), -527.5, 1.0); crystal(11, top(S1), -527.5, 1.0);

  // ================= FINISH BARU (di puncak tertinggi) =================
  const FINP = plat(5, 73, -559.5, 14, 14, { kind: 'snow', route: 1 });
  gateway(5, top(FINP), -553.3, 7, 0, 'GERBANG PUNCAK');
  const FY = 73, WINP = { x: 5, y: FY, z: -559.5 };
  const finishLine = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 7), new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1 }));
  finishLine.position.set(WINP.x, FY + 0.3, WINP.z); grp.add(finishLine);
  for (const sd of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc })); pl.position.set(WINP.x + sd * 4, FY + 3, WINP.z); grp.add(pl); }
  { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const cx = cv.getContext('2d');
    cx.fillStyle = '#0d2238'; cx.fillRect(0, 0, 1024, 256); cx.strokeStyle = '#7fd6ff'; cx.lineWidth = 15; cx.strokeRect(10, 10, 1004, 236);
    cx.font = 'bold 80px sans-serif'; cx.fillStyle = '#7fd6ff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('DUNIA SALJU', 512, 100);
    cx.font = 'bold 90px sans-serif'; cx.fillStyle = '#ffffff'; cx.fillText('KAMU LOLOS!', 512, 188);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
    board.position.set(WINP.x, FY + 4, WINP.z); grp.add(board); }

  // ================= EFEK PEMAIN KENA TEMBAK =================
  // Percikan es + kilatan + cincin di titik kena, plus vignette merah layar saat tembakan benar-benar melukai.
  const hitFx = (() => {
    const NP = 42, pos = new Float32Array(NP * 3), vel = new Float32Array(NP * 3), DUR = 0.9;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pmat = new THREE.PointsMaterial({ color: 0xcff6ff, size: 0.34, transparent: true, opacity: 0, depthWrite: false });
    const pts = new THREE.Points(geo, pmat); pts.frustumCulled = false; pts.visible = false; grp.add(pts);
    const fmat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0, depthWrite: false });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), fmat); flash.visible = false; grp.add(flash);
    const rmat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 28), rmat); ring.rotation.x = -Math.PI / 2; ring.visible = false; grp.add(ring);
    let age = 99, dmg = false, last = 0, dom = null;
    const getDom = () => {
      if (!dom) {
        dom = document.createElement('div'); dom.id = 'snow-hit-flash';
        dom.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:31;pointer-events:none;display:none;background:rgba(255,40,20,.16);box-shadow:inset 0 0 140px 40px rgba(255,50,30,.7)';
        document.body.appendChild(dom);
      }
      return dom;
    };
    function hide() { age = 99; pts.visible = false; flash.visible = false; ring.visible = false; if (dom) dom.style.display = 'none'; }
    function trigger(x, y, z, damaging) {
      age = 0; dmg = !!damaging; last = performance.now();
      for (let i = 0; i < NP; i++) {
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
        vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = 1.5 + Math.random() * 5; vel[i * 3 + 2] = Math.sin(a) * sp;
      }
      geo.attributes.position.needsUpdate = true;
      fmat.color.setHex(dmg ? 0xff5a3a : 0x9fe8ff);
      flash.position.set(x, y, z); ring.position.set(x, y - 0.7, z);
      pts.visible = true; flash.visible = true; ring.visible = true;
      if (dmg) { const d = getDom(); d.style.opacity = '1'; d.style.display = 'block'; }
    }
    function tick(now) {
      if (age >= DUR) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; age += dt;
      if (age >= DUR) { hide(); return; }
      for (let i = 0; i < NP; i++) {
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 14 * dt;
      }
      geo.attributes.position.needsUpdate = true;
      pmat.opacity = 1 - age / DUR;
      flash.scale.setScalar(0.3 + age * 5); fmat.opacity = 0.75 * Math.max(0, 1 - age / 0.25);
      ring.scale.setScalar(0.6 + age * 7); rmat.opacity = 0.9 * Math.max(0, 1 - age / 0.5);
      if (dom && dmg) dom.style.opacity = String(Math.max(0, 1 - age / 0.7));
    }
    return { trigger, tick, hide };
  })();

  // ================= SATU NPC RAKSASA: YETI (MERAH = DIAM, HIJAU = BOLEH GERAK) =================
  // Yeti ditempatkan di area awal. Saat fase merah dimulai, pemain wajib berhenti.
  // Perpindahan yang jelas selama fase merah akan mengembalikan true ke main.js
  // melalui kontrak guards.update(), sehingga sistem GAMEOVER yang sudah ada tetap dipakai.
  const yeti = (() => {
    const root = new THREE.Group();
    root.name = 'SNOW_GIANT_YETI';
    root.position.set(0, 0.25, -5.2);
    grp.add(root);
    const fur = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, roughness: 0.98 });
    const shade = new THREE.MeshStandardMaterial({ color: 0x9fc8df, roughness: 0.92 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x263d50, roughness: 0.7 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x55eeff });
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff160d });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x26313b, roughness: 1 });
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); root.add(m); return m;
    };
    // Tubuh besar, kepala, lengan panjang, kaki, telinga, dan wajah Yeti.
    add(new THREE.SphereGeometry(1.72, 20, 16), fur, 0, 2.15, 0);
    add(new THREE.SphereGeometry(1.22, 20, 16), fur, 0, 4.15, 0.08);
    add(new THREE.SphereGeometry(0.42, 12, 10), shade, -1.02, 4.55, 0.02);
    add(new THREE.SphereGeometry(0.42, 12, 10), shade, 1.02, 4.55, 0.02);
    const armL = add(new THREE.CapsuleGeometry(0.48, 1.75, 6, 12), fur, -1.78, 2.55, 0.02);
    const armR = add(new THREE.CapsuleGeometry(0.48, 1.75, 6, 12), fur, 1.78, 2.55, 0.02);
    armL.rotation.z = -0.22; armR.rotation.z = 0.22;
    add(new THREE.CapsuleGeometry(0.55, 0.85, 5, 10), shade, -0.72, 0.7, 0);
    add(new THREE.CapsuleGeometry(0.55, 0.85, 5, 10), shade, 0.72, 0.7, 0);
    add(new THREE.SphereGeometry(0.2, 12, 10), noseMat, 0, 3.95, 1.15);
    const eyeL = add(new THREE.SphereGeometry(0.13, 12, 10), eyeMat, -0.43, 4.3, 1.03);
    const eyeR = add(new THREE.SphereGeometry(0.13, 12, 10), eyeMat, 0.43, 4.3, 1.03);
    add(new THREE.BoxGeometry(0.58, 0.12, 0.12), mouthMat, 0, 3.55, 1.02);
    // Taring es kecil di atas kepala.
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xeffcff, roughness: 0.45 });
    const hornL = add(new THREE.ConeGeometry(0.2, 0.8, 7), hornMat, -0.72, 5.2, 0.0); hornL.rotation.z = 0.35;
    const hornR = add(new THREE.ConeGeometry(0.2, 0.8, 7), hornMat, 0.72, 5.2, 0.0); hornR.rotation.z = -0.35;
    // Lingkaran indikator di atas Yeti: biru saat aman, merah saat wajib diam.
    const signal = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.13, 8, 24), new THREE.MeshBasicMaterial({ color: 0x35e6a1 }));
    signal.position.set(0, 6.25, 0); root.add(signal);
    const eyeRed = () => { eyeL.material = redEyeMat; eyeR.material = redEyeMat; };
    const eyeBlue = () => { eyeL.material = eyeMat; eyeR.material = eyeMat; };
    let red = false, anchor = null, caught = false, redElapsed = 0;
    const guard = {
      mesh: root,
      reset() { red = false; anchor = null; caught = false; redElapsed = 0; signal.material.color.setHex(0x35e6a1); eyeBlue(); root.rotation.y = Math.PI; },
      update(delta, pp, t, canKill) {
        const left = snowTimeLeft();
        const nowRed = left <= 0;
        if (nowRed && !red) {
          red = true; anchor = { x: pp.x, y: pp.y, z: pp.z }; caught = false; redElapsed = 0;
          showToast('🧊 YETI MELIHAT! BERHENTI, JANGAN BERGERAK!');
        } else if (!nowRed && red) {
          red = false; anchor = null; caught = false; signal.material.color.setHex(0x35e6a1); eyeBlue();
          showToast('✅ Yeti tidak melihat. Kamu boleh bergerak!');
        }
        if (red) {
          redElapsed += delta;
          signal.material.color.setHex(0xff2418); eyeRed();
          // Yeti menoleh ke arah pemain selama fase merah.
          const targetYaw = Math.atan2(pp.x - root.position.x, pp.z - root.position.z);
          let turn = targetYaw - root.rotation.y; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          root.rotation.y += turn * (1 - Math.exp(-delta * 5));
          // Gerak kecil akibat floating point diabaikan; gerak nyata (jalan/lari/lompat) tertangkap.
          if (!caught && anchor && canKill) {
            const moved = Math.hypot(pp.x - anchor.x, pp.z - anchor.z) > 0.24 || Math.abs(pp.y - anchor.y) > 0.38;
            if (moved) {
              caught = true;
              showToast('☃️ YETI MENANGKAPMU KARENA BERGERAK!');
              return true;
            }
          }
        } else {
          signal.material.color.setHex(0x35e6a1); eyeBlue();
          // Saat aman, Yeti membelakangi pemain dan bergerak santai.
          root.rotation.y = Math.PI + Math.sin(t * 0.55) * 0.18;
          root.position.y = 0.25 + Math.sin(t * 1.2) * 0.06;
          armL.rotation.z = -0.22 + Math.sin(t * 1.5) * 0.08;
          armR.rotation.z = 0.22 - Math.sin(t * 1.5) * 0.08;
        }
        return false;
      }
    };
    guard.reset();
    return guard;
  })();
  // Hanya satu NPC penjaga di seluruh map Salju.
  const guardsArr = [yeti];

  // Salju turun
  const N = 260, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - 0.5) * 50; sp[i * 3 + 1] = Math.random() * 30; sp[i * 3 + 2] = (Math.random() - 0.5) * 50; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowfall = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.9 })); snowfall.frustumCulled = false; grp.add(snowfall);

  // ================= PEMANDANGAN: gunung salju, pulau pinus melayang, gunung es di laut, gundukan salju =================
  function clearOf(x, z, margin, y, yMargin) { // true bila titik (x,z) cukup jauh dari jalur & menara NPC
    for (const p of P) {
      if (p.cover) continue;
      const dx = Math.max(Math.abs(x - p.startX) - p.width / 2, 0), dz = Math.max(Math.abs(z - p.startZ) - p.depth / 2, 0);
      if (Math.hypot(dx, dz) < margin && (y == null || Math.abs(y - p.startY) < yMargin)) return false;
    }
    for (const n of npcs) if (Math.hypot(x - n.x, z - n.z) < margin + 3) return false;
    return true;
  }
  function buildScenery() {
    // Tumpukan salju di tepi platform besar
    for (const p of P) {
      if (p.cover || p.type !== 'static' || p.r || Math.min(p.width, p.depth) < 8) continue;
      const hw = p.width / 2, hd = p.depth / 2;
      for (let k = 0; k < 2; k++) {
        const side = Math.floor(rand() * 4), t = (rand() - 0.5) * 0.8;
        const x = p.startX + (side < 2 ? t * p.width : (side === 2 ? -1 : 1) * (hw - 0.8));
        const z = p.startZ + (side < 2 ? (side === 0 ? -1 : 1) * (hd - 0.8) : t * p.depth);
        if (p.checkpoint && x > p.startX + hw - 2.5 && z > p.startZ + hd - 2.5) continue; // jangan menimpa tiang bendera
        mound(x, top(p), z, 0.7 + rand() * 0.6);
      }
    }
    // Gunung salju di kejauhan (kiri-kanan jalur)
    let made = 0;
    for (let k = 0; k < 90 && made < 38; k++) {
      const side = rand() < 0.5 ? -1 : 1, z = 80 - rand() * 740, x = side * (75 + rand() * 230) + (rand() - 0.5) * 20;
      const r = 26 + rand() * 52, h = r * (1.5 + rand() * 1.2);
      if (!clearOf(x, z, r + 14)) continue;
      const rot = rand() * 6.28, hc = h * 0.42;
      INS.mtn.push([x, -8 + h / 2, z, r, h, rot]);
      INS.mtnCap.push([x, -8 + h - hc / 2, z, r * 0.43, hc, rot]);
      const r2 = r * 0.6, h2 = h * 0.7, x2 = x + side * r * 0.55, z2 = z + (rand() - 0.5) * r * 0.8;
      if (clearOf(x2, z2, r2 + 14)) { INS.mtn.push([x2, -8 + h2 / 2, z2, r2, h2, rot + 1]); INS.mtnCap.push([x2, -8 + h2 - h2 * 0.21, z2, r2 * 0.43, h2 * 0.42, rot + 1]); }
      made++;
    }
    // Gunung es kecil mengambang di laut
    made = 0;
    for (let k = 0; k < 120 && made < 40; k++) {
      const x = (rand() - 0.5) * 320, z = 60 - rand() * 690, r = 3 + rand() * 7, h = r * (0.8 + rand() * 1.4);
      if (!clearOf(x, z, r + 10, -8 + h, 16)) continue;
      INS.berg.push([x, -8 + h * 0.35, z, r, h, rand() * 6.28]); made++;
    }
    // Pulau salju melayang dengan pinus dekoratif di sekitar jalur
    made = 0;
    for (let k = 0; k < 90 && made < 24; k++) {
      const p = route[Math.floor(rand() * route.length)], ang = rand() * 6.283, d = 24 + rand() * 34;
      const x = p.startX + Math.cos(ang) * d, z = p.startZ + Math.sin(ang) * d, y = p.startY + (rand() - 0.65) * 34, r = 4 + rand() * 5;
      if (!clearOf(x, z, r + 8, y, 18)) continue;
      const topM = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 1.6, 12), snowMat); topM.position.set(x, y - 0.8, z); grp.add(topM);
      const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 1.3, 9), towerMat); under.rotation.x = Math.PI; under.position.set(x, y - 1.6 - r * 0.65, z); grp.add(under);
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) { const a = rand() * 6.283, dd = rand() * r * 0.65; pine(x + Math.cos(a) * dd, y, z + Math.sin(a) * dd, 0.8 + rand() * 0.9, false); }
      if (rand() < 0.5) crystal(x + r * 0.3, y, z - r * 0.2, 1.0 + rand());
      made++;
    }
  }
  function flushInstances() {
    const dummy = new THREE.Object3D();
    const make = (geo, mat, list, setter) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((a, i) => { setter(dummy, a); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; grp.add(im);
    };
    const cone = (d, a) => { d.position.set(a[0], a[1], a[2]); d.scale.set(a[3], a[4], a[3]); d.rotation.set(0, a[5] || 0, 0); };
    make(new THREE.ConeGeometry(1, 1, 9), pineMat, INS.green, cone);
    make(new THREE.ConeGeometry(1, 1, 9), snowMat, INS.white, cone);
    make(new THREE.CylinderGeometry(0.34, 0.5, 3.2, 6), trunkMat, INS.trunk, (d, a) => { d.position.set(a[0], a[1], a[2]); d.scale.set(a[3], a[3], a[3]); d.rotation.set(0, 0, 0); });
    make(new THREE.SphereGeometry(1, 10, 6), snowMat, INS.mound, (d, a) => { d.position.set(a[0], a[1], a[2]); d.scale.set(a[3], a[3] * 0.38, a[3]); d.rotation.set(0, 0, 0); });
    make(new THREE.ConeGeometry(1, 1, 7), mtnMat, INS.mtn, cone);
    make(new THREE.ConeGeometry(1, 1, 7), snowMat, INS.mtnCap, cone);
    make(new THREE.DodecahedronGeometry(1, 0), bergMat, INS.berg, (d, a) => { d.position.set(a[0], a[1], a[2]); d.scale.set(a[3], a[4], a[3]); d.rotation.set(0, a[5], 0); });
  }
  buildScenery(); flushInstances();

  // Posisi aman (di belakang cover) untuk pengujian & titik teleport admin
  const tpOf = (p) => [p.mesh.position.x, top(p) + 0.05, p.mesh.position.z];
  const cp = cpList;
  const world = { platforms: P, hazards: [], guards: guardsArr, laserBeam: null, FIN_Y: top(FINP), WIN: WINP, MAZE_H: 0, MAZE_Z: 0,
    cover: C, cracks, snowfall, route, npcs, cps: cp, vanish, rotators, snowballs, windZones, swingPlanks, glowCrystals,
    tp: { start: [0, 0.25, 0], hub: tpOf(cp[1]), top: tpOf(cp[2]), maze: tpOf(cp[3]), finish: [WINP.x, top(FINP), WINP.z] } };
  for (let i = 4; i < cp.length; i++) world.tp['cp' + (i + 1)] = tpOf(cp[i]); // titik teleport checkpoint 5..11

  const snowSys = { alarmed: false, hudText: '', hudMode: '' };
  function reset() {
    cracks.forEach(p => { p.crackState = 0; p.crackT = 0; p.isFallen = false; p.mesh.visible = true; p.mesh.position.x = p.startX; });
    vanish.forEach(p => { p.vanishState = 0; p.vanishT = 0; p.isFallen = false; p.mesh.visible = true; p.mesh.material.emissiveIntensity = 0.35; });
    snowSys.alarmed = false;
    guardsArr.forEach(g => g.reset && g.reset());
    hitFx.hide();
  }
  function updateHud({ currentMap, gameState }) {
    let el = document.getElementById('snow-hud');
    const on = currentMap === 'snow' && ['PLAYING', 'GAMEOVER', 'WIN', 'COUNTDOWN'].includes(gameState);
    if (!on) { if (el && el.style.display !== 'none') el.style.display = 'none'; hitFx.hide(); return; }
    hitFx.tick(performance.now()); // efek tetap beranimasi saat layar GAMEOVER
    if (!el) {
      el = document.createElement('div'); el.id = 'snow-hud';
      el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:12px;font:700 15px sans-serif;color:#fff;background:rgba(10,30,55,.72);border:2px solid #7fd6ff;pointer-events:none;white-space:nowrap';
      document.body.appendChild(el);
    }
    const left = gameState === 'COUNTDOWN' ? SNOW_TIMER_SEC : snowTimeLeft();
    let txt, mode;
    if (gameState === 'WIN') { txt = '❄️ Map Salju selesai!'; mode = 'win'; }
    else if (left > 0) { const sec = Math.ceil(left); txt = '❄️ YETI TIDUR — BOLEH GERAK ' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); mode = left <= 10 ? 'warn' : 'ok'; }
    else { txt = '🔴 YETI MELIHAT — JANGAN BERGERAK!'; mode = 'fire'; }
    if (snowSys.hudText !== txt) { el.textContent = txt; snowSys.hudText = txt; }
    if (snowSys.hudMode !== mode) {
      snowSys.hudMode = mode;
      el.style.borderColor = mode === 'fire' ? '#ff3a2a' : (mode === 'warn' ? '#ffb02a' : '#7fd6ff');
      el.style.background = mode === 'fire' ? 'rgba(120,10,10,.8)' : 'rgba(10,30,55,.72)';
    }
    el.style.display = 'block';
    if (gameState === 'PLAYING') {
      if (left <= 0 && !snowSys.alarmed) { snowSys.alarmed = true; showToast('🔴 Waktu habis! Yeti melihat — berhenti bergerak!'); }
      if (left > 0) snowSys.alarmed = false;
    }
  }
  function update(delta, state) {
    const { curGroundPlat, physics, character, godMode, flyMode, hitCD, knock } = state;
    hitFx.tick(performance.now());
    for (const p of cracks) {
      if (p.crackState === 0) { if (curGroundPlat === p && physics.isGrounded) { p.crackState = 1; p.crackT = 0; } }
      else if (p.crackState === 1) {
        p.crackT += delta; p.mesh.position.x = p.startX + Math.sin(p.crackT * 70) * 0.06;
        if (p.crackT > 0.75) { p.crackState = 2; p.crackT = 0; p.isFallen = true; p.mesh.visible = false; p.mesh.position.x = p.startX; }
      } else { p.crackT += delta; if (p.crackT > 3) { p.isFallen = false; p.mesh.visible = true; p.crackState = 0; } }
    }
    for (const p of vanish) {
      if (p.vanishState === 0 && curGroundPlat === p && physics.isGrounded) { p.vanishState = 1; p.vanishT = 0; }
      else if (p.vanishState === 1) {
        p.vanishT += delta; p.mesh.material.emissiveIntensity = 0.35 + Math.sin(p.vanishT * 24) * 0.3;
        if (p.vanishT > 0.65) { p.vanishState = 2; p.vanishT = 0; p.isFallen = true; p.mesh.visible = false; }
      } else if (p.vanishState === 2) {
        p.vanishT += delta;
        if (p.vanishT > 2.1) { p.vanishState = 3; p.vanishT = 0; p.mesh.visible = true; p.mesh.material.emissiveIntensity = 0.35; }
      } else if (p.vanishState === 3) {
        p.vanishT += delta; if (p.vanishT > 0.25) { p.vanishState = 0; p.vanishT = 0; p.isFallen = false; }
      }
    }
    for (const r of rotators) {
      r.mesh.rotation.y += r.speed * delta;
      if (character && physics && !godMode && !flyMode) {
        // Tabrakan sepanjang batang yang berputar (bisa dilompati / dihindari di celah), bukan satu lingkaran penuh.
        const dx = character.position.x - r.mesh.position.x, dz = character.position.z - r.mesh.position.z;
        const ang = r.mesh.rotation.y, ux = Math.cos(ang), uz = -Math.sin(ang);
        const along = dx * ux + dz * uz, side = dx * uz - dz * ux, feet = character.position.y - r.mesh.position.y;
        if (Math.abs(along) < (r.half || r.radius) + 0.3 && Math.abs(side) < 0.85 && feet > -0.9 && feet < 0.8 && hitCD <= 0) {
          const sg = side >= 0 ? 1 : -1;
          knock.set(uz * sg * 15, -ux * sg * 15);
          physics.velocityY = Math.max(physics.velocityY, 7); physics.isGrounded = false;
        }
      }
    }
    for (const b of snowballs) {
      b.mesh.position[b.axis] = b.center + Math.sin(performance.now() * 0.001 * b.speed + b.phase) * b.range;
      b.mesh.rotation.x += delta * 2.8; b.mesh.rotation.z += delta * 1.7;
      if (character && !godMode && !flyMode) {
        const dx = character.position.x - b.mesh.position.x, dz = character.position.z - b.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < b.radius + 0.55 && Math.abs((character.position.y + 0.8) - b.mesh.position.y) < 1.8 && hitCD <= 0) {
          knock.set((dx / (d || 1)) * 19, (dz / (d || 1)) * 19);
          physics.velocityY = Math.max(physics.velocityY, 9); physics.isGrounded = false;
          showToast('☃️ Tertabrak bola salju!');
        }
      }
    }
    if (character && !godMode && !flyMode) for (const z of windZones) {
      if (Math.abs(character.position.x - z.x) < z.hx && Math.abs(character.position.z - z.z) < z.hz && character.position.y < z.maxY) {
        knock.x += z.dx * delta; knock.y += z.dz * delta;
      }
    }
    for (const plank of swingPlanks) plank.mesh.rotation.z = Math.sin(performance.now() * 0.001 * plank.speed + plank.phase) * 0.09;
    for (let i = 0; i < crystalMats.length; i++) crystalMats[i].emissiveIntensity = 0.45 + (Math.sin(performance.now() * 0.002 + i * 2.1) + 1) * 0.28;
    if (snowfall && character) {
      const pos = snowfall.geometry.attributes.position;
      snowfall.position.set(character.position.x, character.position.y - 6, character.position.z);
      for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) - (2 + (i % 5) * 0.5) * delta; if (y < 0) y += 30; pos.setY(i, y); }
      pos.needsUpdate = true;
    }
  }
  return { world, group: grp, controller: { reset, update, updateHud, timeLeft: snowTimeLeft, rayBlocked: snowRayBlocked } };
}
