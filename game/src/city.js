// Port Aurelia, built procedurally from a seed: ground texture with the whole
// road grid drawn in, instanced buildings / palms / containers / stalls, three
// harbour cranes, a ferris wheel, and the rising drawbridge. One sun, one sky.
import * as THREE from 'three';
import { CFG, clamp } from './config.js';
import { mulberry32, range, pick, int } from './random.js';

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function px(v) { return ((v + CFG.world.half) / CFG.world.size) * 1024; }

// Geography (pure, no bridge state): the river is a north-south channel at
// x 220-280, the bay is z > 240, and the Docks are two concrete banks
// flanking the channel (west 200-220, east 280-320, z -160 to 160).
// Everything west of x=200 is city land. The ground mesh is displaced to
// this height so the riverbed is really lower and the water really shows.
function isWaterAt(x, z) {
  if (z > CFG.world.beachZ) return true; // bay
  if (x <= 200) return false; // city
  const inDocksZ = z >= -160 && z <= 160;
  if (inDocksZ && ((x >= 200 && x <= 220) || (x >= 280 && x <= 320))) return false;
  return true; // river channel + east strip outside the banks
}
function baseGroundHeight(x, z) { return isWaterAt(x, z) ? -1.6 : 0; }

function groundTexture() {
  return canvasTexture(1024, (g, S) => {
    g.fillStyle = '#8a8f80'; g.fillRect(0, 0, S, S);
    // block variation
    const rng = mulberry32(77);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${120 + rng() * 40 | 0},${118 + rng() * 30 | 0},${100 + rng() * 30 | 0},0.25)`;
      g.fillRect(rng() * S, rng() * S, 20 + rng() * 60, 20 + rng() * 60);
    }
    // riverbed (east) + bay (south) under the water plane
    g.fillStyle = '#1d3a4a'; g.fillRect(px(190), 0, S - px(190), S);
    g.fillStyle = '#1d3a4a'; g.fillRect(0, px(238), S, S - px(238));
    // beach sand
    g.fillStyle = '#d9b380'; g.fillRect(0, px(240), px(200), S - px(240));
    // docks apron: two banks flanking the river channel (west 200-220,
    // east 280-320). The channel between them (220-280) stays riverbed.
    g.fillStyle = '#8b8f94';
    g.fillRect(px(200), px(-160), px(220) - px(200), px(160) - px(-160));
    g.fillRect(px(280), px(-160), S - px(280), px(160) - px(-160));
    // sidewalks then roads
    const road = (x0, z0, x1, z1) => {
      g.fillStyle = '#9a9da0';
      g.fillRect(px(x0) - 9, px(z0) - 9, px(x1) - px(x0) + 18, px(z1) - px(z0) + 18);
      g.fillStyle = '#33363c';
      g.fillRect(px(x0), px(z0), px(x1) - px(x0), px(z1) - px(z0));
    };
    for (const x of CFG.streetsNS) road(x - 6, -320, x + 6, 200);
    for (const z of CFG.streetsEW) road(-320, z - 6, 190, z + 6);
    road(-320, -12, 320, 12); // Bridge Road, the main east-west boulevard
    // centre dashes
    g.fillStyle = '#d8c25a';
    for (const x of CFG.streetsNS) for (let z = -300; z < 200; z += 24) g.fillRect(px(x) - 1, px(z), 2, 10);
    for (const z of CFG.streetsEW) for (let x = -300; x < 190; x += 24) g.fillRect(px(x), px(z) - 1, 10, 2);
    for (let x = -300; x < 320; x += 24) g.fillRect(px(x), px(-1) - 1, 10, 2);
    // crosswalks at the main intersections
    g.fillStyle = 'rgba(240,240,235,0.85)';
    for (const x of [-180, -20, 140]) for (const z of [-180, -20, 140]) {
      for (let i = -4; i <= 4; i++) g.fillRect(px(x + i * 2.4) - 1, px(z - 8), 2, 16);
    }
    // bridge deck markings
    g.fillStyle = '#c9a13a';
    g.fillRect(px(180), px(-7), px(300) - px(180), 2); g.fillRect(px(180), px(7) - 2, px(300) - px(180), 2);
  });
}
function windowTexture(base, lit) {
  return canvasTexture(128, (g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    const rng = mulberry32(31);
    for (let y = 8; y < S - 8; y += 16) for (let x = 8; x < S - 8; x += 14) {
      g.fillStyle = rng() < 0.45 ? lit : '#232830';
      g.fillRect(x, y, 8, 10);
    }
  });
}
function box(w, h, d, color, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildCity(scene) {
  const rng = mulberry32(20261118);
  const group = new THREE.Group();
  scene.add(group);
  const C = CFG.colors;

  // --- ground (one plane, roads drawn in the texture). Displaced to the
  // real heightfield so the riverbed is lower and the water plane shows.
  const groundGeo = new THREE.PlaneGeometry(CFG.world.size, CFG.world.size, 96, 96);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, baseGroundHeight(pos.getX(i), pos.getZ(i)));
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.receiveShadow = true;
  group.add(ground);

  // --- water: river (east) + bay (south). Tide moves it in boats.js. ---
  const waterMat = new THREE.MeshLambertMaterial({ color: C.water, transparent: true, opacity: 0.88 });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(140, CFG.world.size), waterMat);
  river.rotation.x = -Math.PI / 2; river.position.set(255, C.waterY, 0); river.receiveShadow = true;
  group.add(river);
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(520, 90), waterMat.clone());
  bay.rotation.x = -Math.PI / 2; bay.position.set(-60, C.waterY, 280); bay.receiveShadow = true;
  group.add(bay);
  const water = { river, bay, level: C.waterY };

  // --- buildings (3 instanced tiers, window texture) ---
  const winTex = windowTexture('#d8cfc0', '#ffd98a');
  const tiers = [
    { h: [7, 14], mat: new THREE.MeshLambertMaterial({ map: winTex, color: 0xd8c8a8 }) },
    { h: [14, 28], mat: new THREE.MeshLambertMaterial({ map: winTex, color: 0xc8b898 }) },
    { h: [28, 58], mat: new THREE.MeshLambertMaterial({ map: winTex, color: 0x9ab0c8 }) },
  ];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const lists = [[], [], []];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = [0xd8c8a8, 0xc8b898, 0xb8a888, 0x9ab0c8, 0xc8a898, 0x8aa0b8];
  for (let bi = 0; bi < CFG.streetsNS.length - 1; bi++) {
    for (let bj = 0; bj < CFG.streetsEW.length - 1; bj++) {
      const x0 = CFG.streetsNS[bi] + 10, x1 = CFG.streetsNS[bi + 1] - 10;
      const z0 = CFG.streetsEW[bj] + 10, z1 = CFG.streetsEW[bj + 1] - 10;
      if (x0 > 185 || z0 > 230) continue; // river / beach
      if (z0 > -14 && z1 < 14) continue; // Bridge Road corridor
      if (x0 > -280 && x1 < -120 && z0 > -40 && z1 < 160) continue; // Fishmarket stalls
      if (x0 > 200) continue;
      const n = int(rng, 2, 4);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 12, Math.max(13, (x1 - x0) / 2));
        const d = range(rng, 12, Math.max(13, (z1 - z0) / 2));
        const x = range(rng, x0 + w / 2, x1 - w / 2), z = range(rng, z0 + d / 2, z1 - d / 2);
        const tall = x > -120 && x < 40 && z < -120; // Aurelia Heights
        const tier = tall ? (rng() < 0.6 ? 2 : 1) : (rng() < 0.75 ? 0 : 1);
        const h = range(rng, tiers[tier].h[0], tiers[tier].h[1]);
        lists[tier].push({ x, z, w, d, h, c: pick(rng, palette) });
      }
    }
  }
  const buildingMeshes = [];
  lists.forEach((list, ti) => {
    const inst = new THREE.InstancedMesh(geo, tiers[ti].mat, list.length);
    list.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z); dummy.scale.set(b.w, b.h, b.d); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, col.setHex(b.c));
    });
    inst.castShadow = true; inst.receiveShadow = true;
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst); buildingMeshes.push(inst);
  });

  // --- palms (instanced trunks + crowns) along the boulevard, beach, riverfront ---
  const palmSpots = [];
  for (let x = -300; x < 180; x += 26) { palmSpots.push([x, -14]); palmSpots.push([x, 14]); }
  for (let x = -260; x < 180; x += 34) palmSpots.push([x, 246]);
  for (let z = -140; z < 160; z += 30) palmSpots.push([186, z]);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 7, 6); trunkGeo.translate(0, 3.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4a2a }), palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(3.2, 2.6, 7); crownGeo.translate(0, 8, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x2f7a3a }), palmSpots.length);
  palmSpots.forEach((p, i) => {
    dummy.position.set(p[0] + range(rng, -1.5, 1.5), 0, p[1] + range(rng, -1.5, 1.5));
    dummy.scale.set(1, range(rng, 0.85, 1.3), 1); dummy.rotation.set(0, rng() * 6.28, 0);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = true; crowns.castShadow = true;
  group.add(trunks); group.add(crowns);

  // --- containers at The Docks (instanced, bright) ---
  const contSpots = [];
  for (let x = 220; x < 305; x += 14) for (let z = -140; z < 140; z += 34) {
    if (Math.abs(z) < 16) continue;
    const stack = int(rng, 1, 3);
    for (let s = 0; s < stack; s++) contSpots.push([x + range(rng, -2, 2), z + range(rng, -3, 3), s]);
  }
  const contGeo = new THREE.BoxGeometry(12, 2.6, 2.6);
  const conts = new THREE.InstancedMesh(contGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), contSpots.length);
  const contCols = [0xc23b2a, 0x2a5fc2, 0xe08a1e, 0x3a8a4a, 0x8a2a6b];
  contSpots.forEach((p, i) => {
    dummy.position.set(p[0], 1.3 + p[2] * 2.6, p[1]);
    dummy.scale.set(1, 1, 1); dummy.rotation.set(0, (rng() < 0.5 ? 0 : Math.PI / 2), 0);
    dummy.updateMatrix(); conts.setMatrixAt(i, dummy.matrix);
    conts.setColorAt(i, col.setHex(pick(rng, contCols)));
  });
  conts.castShadow = true; conts.receiveShadow = true;
  group.add(conts);

  // --- harbour cranes (3, at The Docks) ---
  const cranes = [];
  for (const [cx, cz, ry] of [[225, -90, 0.2], [250, 20, -0.15], [228, 110, 0.1]]) {
    const crane = new THREE.Group();
    crane.add(box(3, 34, 3, 0xd8a020, 0, 17, 0));
    crane.add(box(26, 2.2, 2.2, 0xd8a020, 8, 32, 0));
    crane.add(box(9, 2, 2, 0xd8a020, -12, 32, 0));
    crane.add(box(4, 3, 3.4, 0x33363c, 0, 30, 0));
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    cable.position.set(16, 24, 0); crane.add(cable);
    crane.add(box(3, 2.4, 2.4, 0xc23b2a, 16, 16, 0));
    crane.position.set(cx, 0, cz); crane.rotation.y = ry;
    crane.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    group.add(crane); cranes.push(crane);
  }

  // --- ferris wheel at The Spit (rotates slowly) ---
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 28), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  rim.castShadow = true; wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 32, 5), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    spoke.rotation.z = a; wheel.add(spoke);
    const cab = box(3, 2.4, 2.4, [0xd21f2b, 0x2b5fd9, 0xe8b820, 0x3f7a3a][i % 4], Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cab);
  }
  wheel.add(box(2.4, 22, 2.4, 0x8a8f94, -8, -11, 0, 0.3));
  wheel.add(box(2.4, 22, 2.4, 0x8a8f94, 8, -11, 0, -0.3));
  wheel.position.set(-40, 20, 285);
  group.add(wheel);

  // --- Fishmarket stalls (instanced box + striped awning) ---
  const stallSpots = [];
  for (let x = -260; x < -130; x += 22) for (let z = -20; z < 150; z += 24) stallSpots.push([x, z]);
  const stallGeo = new THREE.BoxGeometry(7, 2.2, 5);
  const stalls = new THREE.InstancedMesh(stallGeo, new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), stallSpots.length);
  const awnTex = canvasTexture(64, (g, S) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#d21f2b' : '#f2ead8'; g.fillRect(i * 8, 0, 8, S); }
  });
  const awnGeo = new THREE.BoxGeometry(7.6, 0.3, 5.6);
  const awns = new THREE.InstancedMesh(awnGeo, new THREE.MeshLambertMaterial({ map: awnTex }), stallSpots.length);
  stallSpots.forEach((p, i) => {
    dummy.position.set(p[0], 1.1, p[1]); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); stalls.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p[0], 2.6, p[1]); dummy.updateMatrix(); awns.setMatrixAt(i, dummy.matrix);
  });
  stalls.castShadow = true;
  group.add(stalls); group.add(awns);

  // --- street lamps (instanced) along the main streets ---
  const lampSpots = [];
  for (let x = -300; x < 180; x += 52) { lampSpots.push([x, -10]); lampSpots.push([x, 10]); }
  for (const z of [-180, -20, 140]) for (let x = -280; x < 180; x += 52) lampSpots.push([x, z - 8]);
  const lampGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.5, 5); lampGeo.translate(0, 3.25, 0);
  const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0x2c2f33 }), lampSpots.length);
  const lampHeadGeo = new THREE.SphereGeometry(0.42, 8, 6);
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 0.9 }), lampSpots.length);
  lampSpots.forEach((p, i) => {
    dummy.position.set(p[0], 0, p[1]); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); lamps.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p[0], 6.6, p[1]); dummy.updateMatrix(); lampHeads.setMatrixAt(i, dummy.matrix);
  });
  group.add(lamps); group.add(lampHeads);

  // --- boat dock pier (east bank) ---
  const pier = new THREE.Group();
  for (let i = 0; i < 6; i++) pier.add(box(2, 1, 2, 0x6b4a2a, 205 + i * 4, 0.4, 120));
  pier.add(box(26, 0.5, 4, 0x8a6a42, 216, 1, 120));
  group.add(pier);

  // --- drawbridge: two leaves + fixed approaches + towers ---
  const B = CFG.bridge;
  const deckTex = canvasTexture(128, (g, S) => {
    g.fillStyle = '#33363c'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#d8c25a'; for (let y = 0; y < S; y += 16) g.fillRect(S / 2 - 1, y, 2, 8);
    g.fillStyle = '#c9a13a'; g.fillRect(0, 4, S, 3); g.fillRect(0, S - 7, S, 3);
  });
  const deckMat = new THREE.MeshLambertMaterial({ map: deckTex });
  function leaf(hx, dir) { // hinge x, direction the deck extends (+1 east, -1 west)
    const gLeaf = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 24), deckMat);
    deck.position.set(dir * 20, 0, 0); deck.castShadow = true; deck.receiveShadow = true;
    gLeaf.add(deck);
    const railMat = new THREE.MeshLambertMaterial({ color: 0xc23b2a });
    for (const s of [-11.6, 11.6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(40, 1.1, 0.5), railMat);
      rail.position.set(dir * 20, 0.9, s); rail.castShadow = true; gLeaf.add(rail);
    }
    const weight = box(6, 4, 12, 0x4a4f55, -dir * 3, -1, 0);
    gLeaf.add(weight);
    gLeaf.position.set(hx, 0.4, 0);
    return gLeaf;
  }
  const westLeaf = leaf(B.leaf0, +1), eastLeaf = leaf(B.leaf2, -1);
  group.add(westLeaf); group.add(eastLeaf);
  // fixed approaches + towers
  group.add(box(20, 0.8, 24, 0x33363c, 190, 0.2, 0));
  group.add(box(20, 0.8, 24, 0x33363c, 290, 0.2, 0));
  for (const tx of [196, 284]) {
    group.add(box(3, 18, 3, 0x8a7f70, tx, 9, -14));
    group.add(box(3, 18, 3, 0x8a7f70, tx, 9, 14));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1 }));
    lamp.position.set(tx, 18.6, -14); group.add(lamp);
    const lamp2 = lamp.clone(); lamp2.position.set(tx, 18.6, 14); group.add(lamp2);
  }
  let bridgeAngle = 0;
  function setBridgeAngle(a) {
    bridgeAngle = a;
    westLeaf.rotation.z = a;
    eastLeaf.rotation.z = -a;
  }
  // Height of the bridge deck at (x,z) when the leaves are at `bridgeAngle`.
  // A raised leaf's tip moves toward its hinge, so a real gap opens between the
  // two tips: west leaf ends at leaf0+40*cos(a), east leaf starts at leaf2-40*cos(a).
  function bridgeHeight(x, z) {
    if (Math.abs(z) > B.halfW || x < B.x0 || x > B.x1) return null;
    const t = Math.tan(bridgeAngle), c = Math.cos(bridgeAngle);
    const westTip = B.leaf0 + 40 * c, eastTip = B.leaf2 - 40 * c;
    if (x >= B.leaf0 && x <= westTip) return 0.4 + (x - B.leaf0) * t;
    if (x >= eastTip && x <= B.leaf2) return 0.4 + (B.leaf2 - x) * t;
    if (x > westTip && x < eastTip) return null; // the gap: nothing under the car
    return 0.4;
  }
  function groundHeight(x, z) {
    const bh = bridgeHeight(x, z);
    if (bh !== null) return bh;
    return baseGroundHeight(x, z);
  }
  function isWater(x, z) { return isWaterAt(x, z); }

  return {
    group, water, wheel, bridge: { setAngle: setBridgeAngle, get angle() { return bridgeAngle; } },
    groundHeight, isWater,
    update(dt, t) { wheel.rotation.z += dt * 0.12; },
  };
}
