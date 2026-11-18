// Port Aurelia — procedural delta port city: painted ground, instanced buildings,
// palms, container port, cranes, ferris wheel, and the rising Aurelia Drawbridge.
import * as THREE from 'three';
import { MAP, DISTRICTS } from './config.js';
import { RNG } from './random.js';

function groundTexture(rng) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  const px = (x) => ((x + MAP.half) / (MAP.half * 2)) * S;
  const pz = (z) => ((z + MAP.half) / (MAP.half * 2)) * S;
  // base land
  c.fillStyle = '#6f7d5a'; c.fillRect(0, 0, S, S);
  // district tints
  for (const d of DISTRICTS) {
    c.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
    c.globalAlpha = 0.28;
    c.fillRect(px(d.cx - d.w / 2), pz(d.cz - d.d / 2), px(d.w) - px(0), pz(d.d) - pz(0));
  }
  c.globalAlpha = 1;
  // beach (east strip + south shore)
  c.fillStyle = '#d8c07a';
  c.fillRect(px(200), pz(-280), px(80), S);
  c.fillRect(0, pz(150), S, pz(10) - pz(0));
  // canal + delta water painted under the water planes
  c.fillStyle = '#123a4d';
  c.fillRect(0, pz(MAP.canalZ0), S, pz(MAP.canalZ1) - pz(MAP.canalZ0));
  c.fillRect(0, pz(MAP.waterZ), S, S - pz(MAP.waterZ));
  // roads
  const road = (x0, z0, x1, z1) => {
    c.fillStyle = '#2e2e33';
    c.fillRect(px(Math.min(x0, x1)), pz(Math.min(z0, z1)), Math.abs(px(x1) - px(x0)) || 18, Math.abs(pz(z1) - pz(z0)) || 18);
  };
  for (const x of MAP.roadsX) road(x - 5, -280, x + 5, 150);
  for (const z of MAP.roadsZ) road(-280, z - 5, 280, z + 5);
  road(-14, 140, 14, 240); // bridge road
  // sidewalks: light border along roads
  c.strokeStyle = '#8a8a80'; c.lineWidth = 3;
  for (const x of MAP.roadsX) { c.beginPath(); c.moveTo(px(x - 7), pz(-280)); c.lineTo(px(x - 7), pz(150)); c.moveTo(px(x + 7), pz(-280)); c.lineTo(px(x + 7), pz(150)); c.stroke(); }
  for (const z of MAP.roadsZ) { c.beginPath(); c.moveTo(px(-280), pz(z - 7)); c.lineTo(px(280), pz(z - 7)); c.moveTo(px(-280), pz(z + 7)); c.lineTo(px(280), pz(z + 7)); c.stroke(); }
  // center dashes
  c.strokeStyle = '#d8c860'; c.lineWidth = 2; c.setLineDash([14, 18]);
  for (const x of MAP.roadsX) { c.beginPath(); c.moveTo(px(x), pz(-280)); c.lineTo(px(x), pz(150)); c.stroke(); }
  for (const z of MAP.roadsZ) { c.beginPath(); c.moveTo(px(-280), pz(z)); c.lineTo(px(280), pz(z)); c.stroke(); }
  c.setLineDash([]);
  // plaza tiles in Fishmarket
  c.fillStyle = '#a8845a';
  for (let i = 0; i < 40; i++) c.fillRect(px(-100 + rng.range(0, 120)), pz(-60 + rng.range(0, 120)), 6, 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#3a3f4a'; c.fillRect(0, 0, 128, 256);
  const rng = new RNG(7);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      c.fillStyle = rng.chance(0.55) ? '#ffd98a' : '#20242e';
      c.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (Math.abs(x - d.cx) <= d.w / 2 && Math.abs(z - d.cz) <= d.d / 2) return d.name;
  }
  let best = DISTRICTS[0], bd = 1e9;
  for (const d of DISTRICTS) {
    const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best.name;
}

export function buildCity(G) {
  const rng = new RNG(G.seed);
  const group = new THREE.Group();
  const city = { group, bridgeAngle: 0, bridgeTarget: 0, tide: 0.5, tideDir: 1, wheel: null, water: [] };

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.half * 2, MAP.half * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // water: canal strip + open delta
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x1e6a8a, transparent: true, opacity: 0.88, shininess: 120, specular: 0x99ccff });
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(MAP.half * 2, MAP.canalZ1 - MAP.canalZ0), waterMat);
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(0, -0.35, (MAP.canalZ0 + MAP.canalZ1) / 2);
  group.add(canal);
  const delta = new THREE.Mesh(new THREE.PlaneGeometry(MAP.half * 2, MAP.half - MAP.waterZ), waterMat);
  delta.rotation.x = -Math.PI / 2;
  delta.position.set(0, -0.35, (MAP.waterZ + MAP.half) / 2);
  group.add(delta);
  city.water = [canal, delta];

  // buildings: instanced boxes on blocks between roads
  const winTex = windowTexture();
  const bmat = new THREE.MeshLambertMaterial({ map: winTex });
  const bgeo = new THREE.BoxGeometry(1, 1, 1);
  bgeo.translate(0, 0.5, 0);
  const spots = [];
  for (let ix = 0; ix < MAP.roadsX.length - 1; ix++) {
    for (let iz = 0; iz < MAP.roadsZ.length - 1; iz++) {
      const cx = (MAP.roadsX[ix] + MAP.roadsX[ix + 1]) / 2;
      const cz = (MAP.roadsZ[iz] + MAP.roadsZ[iz + 1]) / 2;
      if (cz > 120) continue; // canal row blocks are docks, not towers
      if (Math.abs(cx) < 24 && cz > 80) continue; // bridge corridor
      const d = districtAt(cx, cz);
      const tall = d === 'Aurelia Heights';
      const n = tall ? 2 : 1 + (rng.chance(0.5) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const w = rng.range(14, 26), dep = rng.range(14, 26);
        const h = tall ? rng.range(28, 70) : rng.range(8, 26);
        spots.push({ x: cx + rng.range(-14, 14), z: cz + rng.range(-14, 14), w, d: dep, h, hue: rng.range(0, 1) });
      }
    }
  }
  const inst = new THREE.InstancedMesh(bgeo, bmat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    pos.set(s.x, 0, s.z); sc.set(s.w, s.h, s.d);
    m4.compose(pos, q, sc);
    inst.setMatrixAt(i, m4);
    col.setHSL(s.hue, 0.25, 0.55);
    inst.setColorAt(i, col);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  group.add(inst);
  city.buildings = inst;

  // palms: instanced trunks + crowns along roads and beach
  const palmSpots = [];
  for (const x of MAP.roadsX) for (let z = -260; z < 150; z += 40) if (rng.chance(0.6)) palmSpots.push({ x: x + 9, z });
  for (let z = -60; z < 150; z += 30) palmSpots.push({ x: 210 + rng.range(0, 50), z });
  for (let x = -260; x < 260; x += 50) if (rng.chance(0.4)) palmSpots.push({ x, z: 148 });
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 5), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), palmSpots.length);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }), palmSpots.length);
  palmSpots.forEach((p, i) => {
    pos.set(p.x, 3.5, p.z); sc.set(1, 1, 1); m4.compose(pos, q, sc); trunk.setMatrixAt(i, m4);
    pos.set(p.x, 8.2, p.z); m4.compose(pos, q, sc); crown.setMatrixAt(i, m4);
  });
  group.add(trunk); group.add(crown);

  // container port: stacked containers + gantry cranes at The Docks
  const contGeo = new THREE.BoxGeometry(12, 3, 3);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const contSpots = [];
  for (let i = 0; i < 26; i++) {
    contSpots.push({ x: -260 + rng.range(0, 120), z: 70 + rng.range(0, 70), y: rng.chance(0.5) ? 1.5 : 4.5, hue: rng.range(0, 1) });
  }
  const conts = new THREE.InstancedMesh(contGeo, contMat, contSpots.length);
  contSpots.forEach((s, i) => {
    pos.set(s.x, s.y, s.z); sc.set(1, 1, 1); m4.compose(pos, q, sc); conts.setMatrixAt(i, m4);
    col.setHSL(s.hue, 0.6, 0.5); conts.setColorAt(i, col);
  });
  conts.castShadow = true;
  group.add(conts);
  // cranes: yellow gantry frames
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xf2b705 });
  for (const cx of [-240, -190, -140]) {
    const crane = new THREE.Group();
    const leg = new THREE.BoxGeometry(2, 34, 2);
    for (const [lx, lz] of [[-8, 0], [8, 0]]) {
      const m = new THREE.Mesh(leg, craneMat); m.position.set(lx, 17, lz); m.castShadow = true; crane.add(m);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 3), craneMat);
    beam.position.set(0, 34, 0); crane.add(beam);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    cab.position.set(6, 31, 0); crane.add(cab);
    crane.position.set(cx, 0, 100);
    group.add(crane);
  }

  // ferris wheel at The Spit
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.7, 8, 24), new THREE.MeshLambertMaterial({ color: 0xd21f6e }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cab.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0);
    wheel.add(cab);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 0.4), craneMat);
    spoke.rotation.z = a; wheel.add(spoke);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 16, 1.5), craneMat);
  legL.position.set(-5, -8, 0); legL.rotation.z = 0.35; wheel.add(legL);
  const legR = legL.clone(); legR.position.x = 5; legR.rotation.z = -0.35; wheel.add(legR);
  wheel.position.set(250, 16, 120);
  group.add(wheel);
  city.wheel = wheel;

  // ---- the Aurelia Drawbridge ----
  const bridge = new THREE.Group();
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
  // fixed approaches
  for (const z of [145, 215]) {
    const ap = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 20), deckMat);
    ap.position.set(0, 0.5, z); ap.receiveShadow = true; bridge.add(ap);
  }
  // towers at both hinges
  for (const z of [160, 200]) {
    for (const x of [-15, 15]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(3, 22, 3), towerMat);
      t.position.set(x, 11, z); t.castShadow = true; bridge.add(t);
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(33, 2, 3), towerMat);
    cap.position.set(0, 22, z); bridge.add(cap);
  }
  // two leaves, hinged at z=160 (south) and z=200 (north), each 20 long
  const leafGeo = new THREE.BoxGeometry(26, 1, 20);
  leafGeo.translate(0, 0.5, 10); // pivot at hinge edge
  const leafS = new THREE.Mesh(leafGeo, deckMat);
  leafS.position.set(0, 0, 160); leafS.castShadow = true; leafS.receiveShadow = true;
  const leafNGeo = new THREE.BoxGeometry(26, 1, 20);
  leafNGeo.translate(0, 0.5, -10);
  const leafN = new THREE.Mesh(leafNGeo, deckMat);
  leafN.position.set(0, 0, 200); leafN.castShadow = true; leafN.receiveShadow = true;
  bridge.add(leafS); bridge.add(leafN);
  // warning stripes on leaf tips
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd21f });
  for (const [z, dir] of [[178, 1], [182, -1]]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 1.2), stripeMat);
    st.position.set(0, 1.1, z + dir * 0.4);
    bridge.add(st);
  }
  group.add(bridge);
  city.bridge = { group: bridge, leafS, leafN, angle: 0, target: 0 };

  // dock + boat pier
  const pier = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 30), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  pier.position.set(24, 0.2, 225); pier.receiveShadow = true;
  group.add(pier);

  G.scene.add(group);
  G.city = city;
  return city;
}

export function setBridgeAngle(G, angle) {
  const b = G.city.bridge;
  b.angle = angle;
  b.leafS.rotation.x = -angle;
  b.leafN.rotation.x = angle;
}

export function updateCity(G, dt) {
  const c = G.city;
  // tide: slow sine over TIDE_PERIOD
  G.time.t += dt;
  const ph = (G.time.t % 240) / 240 * Math.PI * 2;
  c.tide = 0.5 + 0.5 * Math.sin(ph);
  const wl = -0.9 + c.tide * 1.1;
  for (const w of c.water) w.position.y = wl;
  // bridge eases toward its target
  const b = c.bridge;
  const diff = b.target - b.angle;
  if (Math.abs(diff) > 0.0005) setBridgeAngle(G, b.angle + diff * Math.min(1, dt * 0.8));
  if (c.wheel) c.wheel.rotation.z += dt * 0.05;
}

export function tideLabel(G) {
  const ph = (G.time.t % 240) / 240 * Math.PI * 2;
  const rising = Math.cos(ph) > 0;
  const t = G.city.tide;
  if (t > 0.92) return 'HIGH TIDE';
  if (t < 0.08) return 'LOW TIDE';
  return rising ? 'TIDE: RISING' : 'TIDE: FALLING';
}
