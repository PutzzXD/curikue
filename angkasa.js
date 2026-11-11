// Map Angkasa v2 - module mandiri untuk PARKOUR 3D.
// API tetap sama dengan versi sebelumnya (mengikuti pola buildSnowWorld):
//   const { world, group, controller } = buildAngkasaWorld(THREE, scene, deps);
//   world      -> { platforms, hazards, guards, laserBeam, FIN_Y, WIN, MAZE_H, MAZE_Z }
//   controller -> { reset(physics), update(delta, { physics, character, flyMode }), updateHud(), enter(scene), exit(scene) }
//
// Isi map:
//  - Ruang angkasa pekat: langit hitam penuh bintang (juga di BAWAH), nebula, planet batu berkawah,
//    planet bercincin, sabuk asteroid. Tidak ada lantai/air/kabut di bawah jalur -> jurang hitam total.
//  - Gravitasi rendah saat melompat (default -15, zona Nol-G -7) -> lompatan melayang ala astronot.
//  - Jalur parkour antariksa: pijakan hexagon, platform orbit bergerak, trampolin, checkpoint, finish.
//  - Semua rintangan lintasan adalah pijakan solid yang bisa diinjak; tanpa lava dan tanpa laser/bandul.
//  - 5 checkpoint + finish.
export function buildAngkasaWorld(THREE, scene, deps = {}) {
  const NORMAL_GRAVITY = -32;                       // gravitasi default game (dipulihkan saat keluar map)
  const BASE_GRAVITY = deps.baseGravity ?? -15;     // gravitasi map Angkasa (lompatan melayang)
  const ZERO_G = deps.zeroGravity ?? -7;            // zona Nol-G
  const ZERO_G_RANGE = { zNear: -250, zFar: -300 }; // zona Nol-G: z antara zFar dan zNear
  const BOUNCE_VELOCITY = 19;                       // kecepatan lontar trampolin

  const group = new THREE.Group();
  group.name = 'ANGKASA_WORLD';
  group.visible = false;
  scene.add(group);

  const platforms = [];
  const hazards = [];
  const guards = [];
  const bouncePads = [];
  const route = [];

  // ---------- util ----------
  let seed = 9173;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const M = {
    deck: new THREE.MeshStandardMaterial({ color: 0x1c2550, metalness: 0.75, roughness: 0.32 }),
    deckAlt: new THREE.MeshStandardMaterial({ color: 0x2b2160, metalness: 0.7, roughness: 0.34 }),
    deckDark: new THREE.MeshStandardMaterial({ color: 0x0e1230, metalness: 0.8, roughness: 0.4 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0c2a55, emissive: 0x19b4ff, emissiveIntensity: 0.95, metalness: 0.5, roughness: 0.3 }),
    magenta: new THREE.MeshStandardMaterial({ color: 0x3a0f45, emissive: 0xd23cff, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 }),
    lime: new THREE.MeshStandardMaterial({ color: 0x103a2a, emissive: 0x2dffa0, emissiveIntensity: 0.85, metalness: 0.5, roughness: 0.3 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0x284c91, emissive: 0x174dff, emissiveIntensity: 0.75, metalness: 0.55, roughness: 0.28 }),
    hazardAlt: new THREE.MeshStandardMaterial({ color: 0x50317e, emissive: 0x8d45ff, emissiveIntensity: 0.75, metalness: 0.55, roughness: 0.28 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0x6a86c8, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.4 }),
    bounce: new THREE.MeshStandardMaterial({ color: 0x063a4a, emissive: 0x00e5ff, emissiveIntensity: 1.3, metalness: 0.4, roughness: 0.25 }),
    checkpoint: new THREE.MeshStandardMaterial({ color: 0x23d69a, emissive: 0x087d62, emissiveIntensity: 0.9 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.02 }),
    rockFar: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, emissive: 0x120c0a, emissiveIntensity: 0.5, fog: false }),
    neon: (c) => new THREE.MeshBasicMaterial({ color: c, fog: false })
  };

  const add = (geo, mat, x, y, z, parent = group, shadow = false) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    parent.add(mesh);
    return mesh;
  };

  // ---------- pencahayaan (ruang angkasa: gelap, cahaya matahari tegas) ----------
  group.add(new THREE.HemisphereLight(0x8fa8ff, 0x0b0620, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
  sun.position.set(60, 90, 40);
  group.add(sun);
  const rim = new THREE.DirectionalLight(0x6a4dff, 0.8);   // cahaya ungu dari bawah agar sisi bawah platform terlihat
  rim.position.set(-40, -60, -30);
  group.add(rim);

  // ---------- langit hitam + bintang (mengikuti pemain, ada di semua arah termasuk bawah) ----------
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  skyDome.renderOrder = -10;
  skyDome.frustumCulled = false;
  group.add(skyDome);

  const starGroup = new THREE.Group();
  const makeStars = (count, rMin, rMax, size, palette) => {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = rMin + rand() * (rMax - rMin);
      pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sin(a) * s * r;
      const c = palette[Math.floor(rand() * palette.length)], k = 0.55 + rand() * 0.45;
      col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
    pts.frustumCulled = false;
    starGroup.add(pts);
    return pts;
  };
  const WHITE = [1, 1, 1], BLUE = [0.7, 0.82, 1], WARM = [1, 0.88, 0.7];
  makeStars(1700, 120, 280, 1.6, [WHITE, WHITE, BLUE, WARM]);
  const brightStars = makeStars(260, 110, 270, 3.0, [WHITE, BLUE, [1, 0.8, 0.9]]);
  group.add(starGroup);

  // nebula (sprite gradien lembut) di kejauhan
  const nebulaTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  const nebula = (x, y, z, size, color, opacity) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set(x, y, z); sp.scale.set(size, size * 0.7, 1); group.add(sp); return sp;
  };
  nebula(-70, 40, -90, 190, 0x5a2cff, 0.32);
  nebula(90, 20, -170, 210, 0xff2a8a, 0.22);
  nebula(-60, -20, -260, 230, 0x1a7bff, 0.28);
  nebula(70, 50, -340, 200, 0x7b2cff, 0.26);

  // ---------- planet & batuan ----------
  // Geometri batu berkawah: noise + kawah dengan warna lebih gelap di dasar kawah.
  function rockGeometry(radius, detail, craterCount, palette) {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const pos = geo.attributes.position, n = pos.count, colors = new Float32Array(n * 3);
    const craters = [];
    for (let i = 0; i < craterCount; i++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      craters.push({ x: Math.cos(a) * s, y: u, z: Math.sin(a) * s, ang: 0.16 + rand() * 0.3, depth: 0.07 + rand() * 0.1 });
    }
    const ph = rand() * 6;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), l = Math.hypot(x, y, z) || 1;
      const nx = x / l, ny = y / l, nz = z / l;
      let h = 1 + Math.sin(nx * 4.3 + ph) * Math.sin(ny * 3.7 + ph * 0.7) * Math.sin(nz * 5.1 + 1.3) * 0.09 + Math.sin(nx * 11 + ny * 8 + ph) * 0.02;
      let dark = 0;
      for (const c of craters) {
        const d = Math.acos(clamp(nx * c.x + ny * c.y + nz * c.z, -1, 1));
        if (d < c.ang) { const k = 1 - d / c.ang; h -= c.depth * k * k * (3 - 2 * k); dark = Math.max(dark, k); }
        else if (d < c.ang * 1.25) h += c.depth * 0.35 * (1 - (d - c.ang) / (c.ang * 0.25));
      }
      pos.setXYZ(i, nx * radius * h, ny * radius * h, nz * radius * h);
      const band = (Math.sin(ny * 6 + nx * 2 + ph) + 1) / 2, c0 = palette[0], c1 = palette[1], f = 1 - dark * 0.5;
      colors[i * 3] = (c0[0] + (c1[0] - c0[0]) * band) * f;
      colors[i * 3 + 1] = (c0[1] + (c1[1] - c0[1]) * band) * f;
      colors[i * 3 + 2] = (c0[2] + (c1[2] - c0[2]) * band) * f;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  const spinners = []; // objek dekorasi yang berputar pelan
  const planet = (x, y, z, radius, palette, craters, spin, mat = M.rockFar) => {
    const mesh = add(rockGeometry(radius, 3, craters, palette), mat, x, y, z);
    mesh.castShadow = false; spinners.push({ mesh, spin });
    return mesh;
  };
  // planet batu besar (merah-oranye), bulan abu-abu, planet batu biru-kehijauan
  planet(-70, 12, -110, 26, [[0.22, 0.25, 0.48], [0.42, 0.38, 0.68]], 14, 0.01);
  planet(52, 34, -70, 10, [[0.5, 0.5, 0.52], [0.72, 0.72, 0.74]], 12, 0.02);
  planet(60, -6, -210, 18, [[0.3, 0.38, 0.42], [0.45, 0.6, 0.58]], 12, -0.012);
  planet(-48, 40, -235, 8, [[0.55, 0.4, 0.3], [0.7, 0.58, 0.44]], 9, 0.03);
  planet(40, 22, -300, 7, [[0.45, 0.4, 0.5], [0.65, 0.6, 0.72]], 8, -0.025);
  // planet bercincin raksasa di belakang garis finish
  const giant = add(new THREE.SphereGeometry(34, 40, 28), new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x2a1470, emissiveIntensity: 0.55, roughness: 0.8, fog: false }), -22, 26, -440);
  const giantRing = add(new THREE.TorusGeometry(54, 2.4, 6, 90), new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.55, fog: false }), -22, 26, -440);
  giantRing.rotation.x = 1.15; giantRing.rotation.y = 0.2;
  spinners.push({ mesh: giant, spin: 0.01 });
  const sunDisc = add(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false }), 110, 120, 30);

  // sabuk asteroid (InstancedMesh: ringan untuk perangkat mobile)
  const belts = [];
  const asteroidBelt = (cx, cy, cz, count, spreadX, spreadY, spreadZ) => {
    const geo = rockGeometry(1, 1, 3, [[0.28, 0.32, 0.42], [0.48, 0.52, 0.66]]);
    const inst = new THREE.InstancedMesh(geo, M.rock, count), dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set((rand() - 0.5) * spreadX, (rand() - 0.5) * spreadY, (rand() - 0.5) * spreadZ);
      const s = 0.4 + rand() * 1.8; dummy.scale.set(s, s * (0.7 + rand() * 0.5), s);
      dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    const holder = new THREE.Group(); holder.position.set(cx, cy, cz); holder.add(inst); group.add(holder);
    belts.push({ holder, spin: (rand() - 0.5) * 0.02 });
  };
  asteroidBelt(-26, 6, -60, 40, 20, 24, 60);
  asteroidBelt(26, 12, -140, 40, 20, 30, 80);
  asteroidBelt(-24, 20, -250, 40, 22, 30, 90);
  asteroidBelt(26, 24, -330, 36, 20, 30, 70);

  // ---------- platform ----------
  const underGeos = [rockGeometry(1, 1, 3, [[0.34, 0.3, 0.38], [0.5, 0.42, 0.5]]), rockGeometry(1, 1, 4, [[0.32, 0.26, 0.3], [0.48, 0.4, 0.42]])];
  let platformCount = 0;
  const createPlatform = (x, y, z, width, depth, type = 'static', shape = 'box', options = {}) => {
    const h = options.height || 0.5;
    let geo;
    if (shape === 'round') geo = new THREE.CylinderGeometry(width / 2, width / 2, h, 28);
    else if (shape === 'hex') geo = new THREE.CylinderGeometry(width * 0.48, width * 0.48, h, 6);
    else geo = new THREE.BoxGeometry(width, h, depth);
    const mat = options.material || ((platformCount++ % 2) ? M.deck : M.deckAlt);
    const mesh = add(geo, mat, x, y, z, group, true);
    const glow = options.glow || M.cyan;
    if (options.glow !== false) {
      const rimGeo = shape === 'box'
        ? new THREE.BoxGeometry(width * 0.98, 0.07, depth * 0.98)
        : new THREE.CylinderGeometry(width * (shape === 'hex' ? 0.47 : 0.49), width * (shape === 'hex' ? 0.47 : 0.49), 0.07, shape === 'hex' ? 6 : 28);
      const r = add(rimGeo, glow, 0, h * 0.5 + 0.025, 0, mesh);
      r.userData.isDecoration = true;
    }
    if (options.under !== false && type !== 'fake') { // dasar batu melayang di bawah platform
      const w = shape === 'box' ? width * 0.42 : width * 0.46, d = shape === 'box' ? depth * 0.42 : width * 0.46;
      const rock = add(underGeos[platformCount % 2], M.rock, 0, -h / 2 - Math.min(width, depth) * 0.42, 0, mesh);
      rock.scale.set(w, Math.min(width, depth) * 0.5, d);
      rock.rotation.y = rand() * 6;
      rock.userData.isDecoration = true;
    }
    const p = {
      mesh, width, depth, type,
      startX: x, startY: y, startZ: z,
      range: options.range ?? 1.6,
      speed: options.speed ?? 1.25,
      phase: options.phase ?? rand() * Math.PI * 2,
      isFallen: false, tell: options.tell ?? 0, revealTimer: 0, dx: 0,
      r: shape === 'round' ? width / 2 : (shape === 'hex' ? width * 0.45 : 0),
      hh: h / 2
    };
    if (options.checkpoint) {
      p.checkpoint = true; p.checkpointActivated = false; p.checkpointReadyMaterial = M.checkpoint; mesh.material = M.checkpoint;
    }
    if (options.route) route.push(p);
    platforms.push(p);
    return p;
  };
  const gate = (z, y, color, radius = 7) => { // gerbang cincin neon penanda bagian
    const ring = add(new THREE.TorusGeometry(radius, 0.14, 8, 56), M.neon(color), 0, y + radius * 0.55, z);
    ring.userData.isDecoration = true; return ring;
  };

  // ===== 0. DECK LUNCUR (start) =====
  createPlatform(0, 0, 0, 13, 13, 'static', 'hex', { glow: M.cyan, route: true, under: true });
  gate(-4, 0, 0x30d5ff, 6);
  {
    const ring = add(new THREE.TorusGeometry(8.4, 0.1, 6, 64), M.neon(0x30d5ff), 0, 0.05, 0);
    ring.rotation.x = Math.PI / 2;
  }

  // ===== 1. PLANETOID HOP (lompatan melayang, pemanasan) =====
  const hops = [[0, 0.8, -11], [-4, 1.6, -22], [4, 2.4, -33], [-3, 3.2, -44], [0, 4.0, -55]];
  hops.forEach(([x, y, z], i) => createPlatform(x, y, z, 6, 6, 'static', 'round', { glow: i % 2 ? M.magenta : M.cyan, route: true }));
  createPlatform(0, 4.8, -65, 11, 10, 'static', 'box', { checkpoint: true, route: true });   // CP1
  gate(-58, 4.0, 0xd23cff);

  // ===== 2. ARENA ASTEROID MELAYANG =====
  // Arena lebar sebagai tempat mendarat, dilanjutkan platform bergerak yang semuanya bisa diinjak.
  const ARENA = { x: 0, y: 5.6, z: -84 };
  createPlatform(ARENA.x, ARENA.y, ARENA.z, 18, 18, 'static', 'round', { glow: M.magenta, route: true });
  {
    const ring = add(new THREE.TorusGeometry(8.8, 0.14, 8, 64), M.neon(0x9b7bff), ARENA.x, ARENA.y + 0.3, ARENA.z);
    ring.rotation.x = Math.PI / 2;
  }
  createPlatform(-4.5, 6.2, -94, 5.2, 5.2, 'moving_x', 'hex', { glow: M.cyan, range: 1.8, speed: 1.0, route: true });
  createPlatform(4.5, 6.8, -101, 5.2, 5.2, 'moving_y', 'round', { glow: M.magenta, range: 1.1, speed: 1.15, route: true });
  createPlatform(0, 6.4, -108, 9, 8, 'static', 'box', { checkpoint: true, route: true }); // CP2

  // ===== 3. JALUR BATU BINTANG =====
  // Tidak ada bandul atau tiang penghalang yang tidak bisa diinjak.
  const starSteps = [
    [-3.8, 6.9, -116, 5.4, 'static'], [2.8, 7.5, -124, 5.2, 'moving_x'],
    [-2.5, 8.0, -132, 5.2, 'moving_y'], [3.6, 8.5, -140, 5.4, 'static']
  ];
  starSteps.forEach(([x, y, z, w, type], i) => createPlatform(x, y, z, w, w, type, 'hex', {
    glow: i % 2 ? M.magenta : M.cyan, range: 1.5, speed: 1.0 + i * 0.12, route: true
  }));
  gate(-113, 6.8, 0x7ff6ff);

  // ===== 4. JEMBATAN HEXAGON =====
  // Semua ubin di bagian ini adalah platform asli dan dapat diinjak; tidak ada ubin palsu.
  const HC = { y: 8.8, z0: -148, dz: 5.2, dx: 4.6 };
  const hexPath = [0, -4.6, 0, 4.6, 0, -4.6];
  for (let row = 0; row < hexPath.length; row++) {
    const x = hexPath[row];
    createPlatform(x, HC.y + (row % 2) * 0.35, HC.z0 - row * HC.dz, 5.5, 5.5,
      row === 2 || row === 4 ? 'moving_x' : 'static', 'hex', {
        glow: row % 2 ? M.magenta : M.cyan, range: 1.15, speed: 1.0 + row * 0.08, route: true, under: true
      });
  }
  createPlatform(0, 9.0, -181, 10, 9, 'static', 'box', { checkpoint: true, route: true }); // CP3
  gate(-145, HC.y, 0x2dffa0);

  // ===== 5. KEPINGAN ORBIT =====
  // Rintangan berupa pijakan bergerak, bukan dinding padat yang tidak bisa diinjak.
  const orbitSteps = [
    [-4.5, 9.5, -190, 5.6, 'moving_x'], [4.5, 10.2, -198, 5.6, 'moving_y'],
    [-4.0, 10.8, -206, 5.6, 'moving_x'], [4.0, 11.4, -214, 5.6, 'moving_y']
  ];
  orbitSteps.forEach(([x, y, z, w, type], i) => createPlatform(x, y, z, w, w, type, 'round', {
    glow: i % 2 ? M.magenta : M.lime, range: 1.7, speed: 1.0 + i * 0.13, route: true, under: true
  }));
  createPlatform(0, 11.8, -222, 9, 8, 'static', 'box', { checkpoint: true, route: true }); // CP4
  gate(-188, 9.5, 0xffd23a);

  // ===== 6. TRAMPOLIN PANTUL =====
  const addBouncePad = (x, y, z, r) => {
    const base = add(new THREE.CylinderGeometry(r, r * 1.15, 0.55, 32), M.deckDark, x, y, z, group, true);
    const top = add(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.24, 32), M.bounce, 0, 0.39, 0, base);
    add(new THREE.TorusGeometry(r * 0.88, 0.13, 8, 36), M.neon(0x7ff6ff), 0, 0.53, 0, base).rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(r * 0.58, 0.07, 6, 32), M.neon(0xd23cff), 0, 0.54, 0, base).rotation.x = Math.PI / 2;
    const p = { mesh: base, width: r * 2, depth: r * 2, type: 'static', startX: x, startY: y, startZ: z, range: 0, speed: 0, phase: 0,
      isFallen: false, tell: 0, revealTimer: 0, dx: 0, r, hh: 0.25 };
    platforms.push(p); route.push(p);
    bouncePads.push({ x, z, r, top: y + 0.25, squash: 0, topMesh: top });
    return p;
  };
  addBouncePad(0, 12.2, -231, 2.8);                                   // lontar ke platform tinggi
  createPlatform(0, 18.0, -244, 9, 8, 'static', 'box', { glow: M.lime, route: true, under: true });
  gate(-229, 12.8, 0x7ff6ff, 5);

  // ===== 7. ZONA NOL-G (batu planetoid melayang) =====
  const rocks = [
    [0, 18.8, -256, 6.5, 'static'], [-5, 19.8, -266, 5.8, 'moving_y'], [4, 20.6, -276, 5.8, 'static'],
    [-4, 21.4, -286, 5.8, 'moving_x'], [3, 20.8, -296, 5.8, 'static']
  ];
  rocks.forEach(([x, y, z, w, type], i) => createPlatform(x, y, z, w, w, type, 'round', {
    glow: i % 2 ? M.magenta : M.lime, range: type === 'moving_x' ? 2.6 : 1.4, speed: 1.0 + i * 0.1, route: true
  }));
  createPlatform(0, 20.8, -306, 10, 9, 'static', 'box', { checkpoint: true, route: true });  // CP5
  gate(-252, 18.5, 0x2dffa0);

  // ===== 7B. JALUR ASTEROID RAKSASA =====
  // Asteroid di jalur ini berupa pijakan solid, bukan objek dekorasi yang menabrak pemain.
  createPlatform(-3.5, 21.2, -315, 6.8, 6.8, 'moving_x', 'round', { glow: M.cyan, range: 1.3, speed: 0.9, route: true, under: true });
  createPlatform(3.5, 21.8, -325, 6.8, 6.8, 'moving_y', 'hex', { glow: M.magenta, range: 1.0, speed: 1.0, route: true, under: true });
  createPlatform(0, 22.2, -335, 8.5, 8.5, 'static', 'round', { glow: M.lime, route: true, under: true });

  // ===== 8. LINTASAN FINAL DI ANTARABINTANG =====
  // Menghapus laser gate yang tidak bisa diinjak; tantangan akhir memakai pijakan melayang.
  const FIN = { y: 22.2, z: -383 };
  createPlatform(0, 22.2, -350, 8.5, 8.5, 'static', 'box', { glow: M.cyan, route: true, under: true });
  createPlatform(-3.8, 22.8, -360, 5.8, 5.8, 'moving_x', 'hex', { glow: M.magenta, range: 1.4, speed: 1.1, route: true, under: true });
  createPlatform(3.8, 23.4, -370, 5.8, 5.8, 'moving_y', 'round', { glow: M.cyan, range: 1.0, speed: 1.0, route: true, under: true });


  // Dek akhir: tiga jalur finish berjauhan, dihubungkan oleh jembatan bercabang.
  // Platform pendekatan tetap dipertahankan sebagai titik awal percabangan.
  createPlatform(0, FIN.y, FIN.z, 13, 12, 'static', 'box', {
    glow: M.lime, route: true, checkpoint: true, under: true
  });

  const finishLanes = [];
  const finishLaneXs = [-18, 0, 18];
  const finishZ = FIN.z - 27;
  const finishArchMat = new THREE.MeshStandardMaterial({
    color: 0x37f5c2, emissive: 0x0b9b7b, emissiveIntensity: 1.2
  });

  // Jembatan bercabang: setiap jalur dibuat cukup lebar dan terpisah jelas.
  // Jalur tengah lurus; kiri dan kanan memiliki pijakan diagonal menuju platform masing-masing.
  finishLaneXs.forEach((x) => {
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const f = i / (steps + 1);
      const bx = x * f;
      const bz = FIN.z - 5 - f * 17;
      createPlatform(bx, FIN.y + (i % 2 ? 0.15 : 0), bz, 5.2, 5.8, 'static', 'box', {
        glow: M.cyan, route: true, under: true
      });
    }
  });
  finishLaneXs.forEach((x) => {
    createPlatform(x, FIN.y, finishZ + 7, 6.2, 8, 'static', 'box', {
      glow: M.cyan, route: true, under: true
    });
  });

  // Semua gerbang memiliki bentuk, ukuran, tulisan, dan material identik.
  finishLaneXs.forEach((x, index) => {
    const lanePad = createPlatform(x, FIN.y, finishZ, 9, 11, 'static', 'box', {
      glow: M.lime, route: true, under: true
    });
    const archZ = finishZ - 1.0;
    add(new THREE.BoxGeometry(0.4, 5, 0.4), finishArchMat, x - 3.2, FIN.y + 2.5, archZ);
    add(new THREE.BoxGeometry(0.4, 5, 0.4), finishArchMat, x + 3.2, FIN.y + 2.5, archZ);
    add(new THREE.BoxGeometry(6.8, 0.4, 0.4), finishArchMat, x, FIN.y + 5, archZ);

    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#05081a'; cx.fillRect(0, 0, 512, 128);
    cx.strokeStyle = '#37f5c2'; cx.lineWidth = 8; cx.strokeRect(6, 6, 500, 116);
    cx.font = 'bold 64px sans-serif'; cx.fillStyle = '#ffffff';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('FINISH', 256, 66);
    const sign = add(
      new THREE.PlaneGeometry(5.6, 1.4),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }),
      x, FIN.y + 3.4, archZ
    );
    sign.userData.isDecoration = true;
    finishLanes.push({ index, x, y: FIN.y, z: finishZ - 3.5, platform: lanePad });
  });

  // Tiga NPC penjaga menghadap lurus ke depan (-Z). Dua jalur palsu memberi penalti
  // jika pemain mendekat dalam radius 3 meter; NPC di jalur asli tetap pasif.
  const finishGuards = finishLanes.map((lane) => {
    const npc = new THREE.Group();
    npc.position.set(lane.x + 2.35, FIN.y + 0.25, finishZ + 1.2);
    npc.rotation.y = 0; // fokus tetap ke depan, tidak mengikuti/membidik pemain
    group.add(npc);

    const armor = new THREE.MeshStandardMaterial({ color: 0x202b48, metalness: 0.65, roughness: 0.32 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x17213a, emissive: 0x163b75, emissiveIntensity: 0.65, metalness: 0.5 });
    const visor = new THREE.MeshBasicMaterial({ color: 0x62eaff });
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); npc.add(m); return m;
    };
    part(new THREE.CylinderGeometry(0.38, 0.48, 0.28, 8), trim, 0, 0.18, 0);
    part(new THREE.CapsuleGeometry(0.34, 0.78, 4, 8), armor, 0, 1.0, 0);
    part(new THREE.SphereGeometry(0.34, 16, 12), trim, 0, 1.82, 0);
    part(new THREE.BoxGeometry(0.42, 0.12, 0.08), visor, 0, 1.85, -0.29);
    for (const side of [-1, 1]) {
      part(new THREE.CapsuleGeometry(0.12, 0.48, 4, 8), armor, side * 0.43, 1.0, 0);
      part(new THREE.CylinderGeometry(0.12, 0.16, 0.58, 8), trim, side * 0.22, 0.28, 0);
    }
    const energy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.12, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0x69efff, transparent: true, opacity: 0.88 })
    );
    energy.visible = false;
    group.add(energy);
    const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
    let flash = 0;

    const guard = {
      reset() { flash = 0; energy.visible = false; },
      update(delta, playerPos, t, canKill) {
        // NPC tidak pernah memutar badan untuk mengejar pemain.
        npc.rotation.y = 0;
        flash = Math.max(0, flash - delta);
        if (flash <= 0) energy.visible = false;
        const dx = playerPos.x - npc.position.x;
        const dz = playerPos.z - npc.position.z;
        const dy = playerPos.y - (FIN.y + 0.8);
        const near = Math.hypot(dx, dz) <= 3 && Math.abs(dy) <= 3.2;
        const isRealFinish = activeFinishIndex === lane.index;
        if (!near || isRealFinish || !canKill) return false;

        // Efek sinar energi singkat sebagai tanda pemain terkena penjaga.
        from.set(npc.position.x, npc.position.y + 1.85, npc.position.z - 0.3);
        to.set(playerPos.x, playerPos.y + 0.8, playerPos.z);
        dir.subVectors(to, from);
        const len = Math.max(0.01, dir.length());
        energy.position.copy(from).addScaledVector(dir, 0.5);
        energy.scale.set(1, len, 1);
        energy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        energy.visible = true;
        flash = 0.18;
        if (typeof showToast === 'function') showToast('⚡ FINISH PALSU! Penjaga menangkapmu!');
        return true;
      }
    };
    guards.push(guard);
    return { npc, energy, guard };
  });

  // Nomor jalur benar diacak setiap map dimasuki/ditinggalkan.
  let activeFinishIndex = -1;
  const randomizeFinish = () => {
    let next = Math.floor(Math.random() * finishLanes.length);
    if (finishLanes.length > 1 && next === activeFinishIndex) {
      next = (next + 1 + Math.floor(Math.random() * (finishLanes.length - 1))) % finishLanes.length;
    }
    activeFinishIndex = next;
    const selected = finishLanes[activeFinishIndex];
    world.WIN.x = selected.x;
    world.WIN.y = selected.y;
    world.WIN.z = selected.z;
    world.activeFinishLane = activeFinishIndex;
    return activeFinishIndex;
  };

  // ---------- dekorasi hidup (planet berputar, sabuk asteroid, bintang terang berkedip) ----------
  hazards.push({
    update(t) {
      for (const s of spinners) s.mesh.rotation.y = t * s.spin;
      for (const b of belts) b.holder.rotation.z = t * b.spin;
      brightStars.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.2;
    },
    test() { return null; }
  });

  // ---------- controller: gravitasi, trampolin, langit mengikuti pemain ----------
  const controller = {
    lowGravity: true,
    zeroG: false,
    bounceCooldown: 0,
    hudText: '',
    reset(physics) {
      if (physics) physics.gravity = NORMAL_GRAVITY;   // pulihkan gravitasi default untuk map lain/lobby
      this.lowGravity = false; this.zeroG = false; this.bounceCooldown = 0;
    },
    enter(sc) {                                        // map aktif: pilih ulang jalur finish untuk ronde baru
      const s = sc || scene;
      s.background = new THREE.Color(0x02030b);
      s.fog = null;
      randomizeFinish();
    },
    exit() { randomizeFinish(); },                     // saat kembali ke lobby, siapkan pilihan acak berikutnya
    randomizeFinish,
    update(delta, state = {}) {
      const { physics, character, flyMode } = state;
      if (!physics || !character) return;
      const pos = character.position;
      starGroup.position.set(pos.x, pos.y, pos.z);     // bintang & langit selalu mengelilingi pemain
      skyDome.position.set(pos.x, pos.y, pos.z);
      this.zeroG = pos.z < ZERO_G_RANGE.zNear && pos.z > ZERO_G_RANGE.zFar;
      this.lowGravity = !flyMode;
      physics.gravity = flyMode ? NORMAL_GRAVITY : (this.zeroG ? ZERO_G : BASE_GRAVITY);
      this.hudText = flyMode ? '' : (this.zeroG ? '🌌 Zona Nol-G' : '🪐 Gravitasi Rendah');

      // trampolin
      this.bounceCooldown = Math.max(0, this.bounceCooldown - delta);
      for (const b of bouncePads) {
        b.squash = Math.max(0, b.squash - delta);
        b.topMesh.scale.y = 1 - Math.sin(Math.min(1, b.squash / 0.35) * Math.PI) * 0.45;
        if (!flyMode && this.bounceCooldown <= 0 && Math.hypot(pos.x - b.x, pos.z - b.z) < b.r &&
            Math.abs(pos.y - b.top) < 0.7 && physics.velocityY <= 0.5) {
          physics.velocityY = BOUNCE_VELOCITY; physics.isGrounded = false; physics.jumpCount = 1;
          this.bounceCooldown = 0.5; b.squash = 0.35;
        }
      }
    },
    updateHud() {}
  };

  const world = {
    platforms, hazards, guards, laserBeam: null,
    FIN_Y: FIN.y + 0.25,
    WIN: { x: 0, y: FIN.y, z: finishZ },
    activeFinishLane: 0,
    finishLanes,
    randomizeFinish,
    MAZE_H: 0,
    MAZE_Z: 0,
    route,
    gravity: { base: BASE_GRAVITY, zero: ZERO_G, zeroRange: ZERO_G_RANGE, bounce: BOUNCE_VELOCITY }
  };

  randomizeFinish(); // pilihan awal sudah acak sejak map pertama kali dibuat
  return { world, group, controller };
}
