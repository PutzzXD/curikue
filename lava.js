import * as THREE from 'three';

// Modul visual Map Lava. Dipanggil oleh main.js agar seluruh dekorasi/efek Lava
// terpusat di file ini; gameplay, platform, checkpoint, dan collision tetap di main.js.
export function buildLavaMap(scene) {
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -8;
  scene.add(lava);

  const emberPos = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) {
    emberPos[i * 3] = (Math.random() - 0.5) * 90;
    emberPos[i * 3 + 1] = -8 + Math.random() * 30;
    emberPos[i * 3 + 2] = -35 + (Math.random() - 0.5) * 100;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7722, size: 0.25, transparent: true, opacity: 0.8 }));
  scene.add(embers);

  // Gunung berapi bercahaya dan partikel magma, dekorasi tanpa collider.
  const volcanoLights = [];
  const volcanoSpots = [
    [-38, -8, -32, 1.0], [38, -8, -55, 0.9],
    [-42, -8, -105, 1.15], [42, -8, -132, 1.0],
    [0, -8, -158, 0.85]
  ];
  volcanoSpots.forEach(([vx, baseY, vz, scale]) => {
    const volcano = new THREE.Group();
    volcano.position.set(vx, baseY, vz);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x28202a, roughness: 1 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(11 * scale, 24 * scale, 9), rockMat);
    cone.position.y = 12 * scale;
    cone.castShadow = true; cone.receiveShadow = true; volcano.add(cone);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.6 * scale, 0.48 * scale, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xff4a12, emissive: 0xff2600, emissiveIntensity: 2.4 })
    );
    rim.rotation.x = Math.PI / 2; rim.position.y = 23.1 * scale; volcano.add(rim);
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(2.15 * scale, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6a00, side: THREE.DoubleSide })
    );
    crater.rotation.x = -Math.PI / 2; crater.position.y = 23.12 * scale; volcano.add(crater);
    scene.add(volcano);
    const glow = new THREE.PointLight(0xff3b08, 3.2 * scale, 34 * scale, 2);
    glow.position.set(vx, baseY + 20 * scale, vz); scene.add(glow);
    volcanoLights.push({ light: glow, base: 2.4 * scale, phase: vx * 0.13 + vz * 0.07 });
  });

  const sparkPositions = new Float32Array(240 * 3);
  const sparkSpeeds = new Float32Array(240);
  for (let i = 0; i < 240; i++) {
    sparkPositions[i * 3] = (Math.random() - 0.5) * 100;
    sparkPositions[i * 3 + 1] = -7 + Math.random() * 26;
    sparkPositions[i * 3 + 2] = -85 + (Math.random() - 0.5) * 150;
    sparkSpeeds[i] = 1.2 + Math.random() * 3.2;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xff9a24, size: 0.34, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sparks.userData.speeds = sparkSpeeds;
  scene.add(sparks);

  return { lavaMat, embers, sparks, volcanoLights };
}

export function updateLavaMap(map, delta, time, active) {
  if (!map) return;
  if (map.embers) {
    const ep = map.embers.geometry.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      let y = ep.getY(i) + delta * 1.5;
      if (y > 22) y = -8;
      ep.setY(i, y);
    }
    ep.needsUpdate = true;
  }
  if (active && map.sparks) {
    const sp = map.sparks.geometry.attributes.position;
    const speeds = map.sparks.userData.speeds;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) + speeds[i] * delta;
      if (y > 20) {
        y = -7;
        sp.setX(i, (Math.random() - 0.5) * 100);
        sp.setZ(i, -85 + (Math.random() - 0.5) * 150);
      }
      sp.setY(i, y);
    }
    sp.needsUpdate = true;
    map.volcanoLights.forEach(v => { v.light.intensity = v.base * (0.82 + 0.18 * Math.sin(time * 3 + v.phase)); });
  }
  if (map.lavaMat) map.lavaMat.color.setHSL(0.03 + Math.sin(time * 2) * 0.02, 1, 0.5);
}
