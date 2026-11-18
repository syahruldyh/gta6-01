// Screenshot staging: each shot sets the real game into a real state (real
// objects, real HUD, real mission) and freezes it, then the page signals
// window.__shotReady. Triggered by ?shot=cover|onfoot|start|boat&seed=1.
// The cover is the jump: the red MERAK GT airborne over the gap of the raised
// drawbridge, police behind, helicopter above, police boat in the water below.
import * as THREE from 'three';
import { CFG } from './config.js';
import { Car } from './vehicles.js';
import { Boat } from './boats.js';

function placePoliceCar(G, x, z, heading) {
  const c = new Car({ ...CFG.vehicles.police }, x, z, heading);
  c.unit = G.police.unitName();
  c.speed = 0;
  G.scene.add(c.mesh);
  G.police.cars.push(c);
  return c;
}
function clearPolice(G) {
  for (const c of G.police.cars) G.scene.remove(c.mesh);
  G.police.cars = [];
  if (G.police.heli) { G.scene.remove(G.police.heli.mesh); G.police.heli = null; }
  if (G.police.boat) { G.scene.remove(G.police.boat.mesh); G.police.boat = null; }
}

export function stageShot(G, name) {
  // G: the game object from main.js (scene, city, tide, police, missions,
  // combat, hud, state, playerCar, playerBoat, playerMesh, setMode, ...).
  clearPolice(G);
  G.combat.clearFoes();
  G.missions.allDone = false;
  const st = G.state;
  if (name === 'cover') {
    G.city.bridge.setAngle(CFG.bridge.maxAngle);
    G.tide.t = 30; G.tide.update(0); // TIDE: RISING
    G.missions.startJob(7);
    G.missions.stageIndex = 2; // Jump the rising bridge
    G.missions.timer = 179; // 2:59
    st.money = 48250; st.day = 3; st.timeMin = 18 * 60 + 52;
    st.rep = 1960; st.repLevel = 5;
    // The jump: red MERAK GT airborne over the gap, nose up, 150 KM/H.
    const car = G.playerCar;
    car.pos.set(240, 23.6, 0);
    car.heading = Math.PI / 2; // east, across the bridge
    car.speed = 41.7; car.vy = 1.5; car.airborne = true;
    car.condition = 82; car.nitro = 64;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.set(0, 0, 0.22); // nose up over the gap
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    G.setMode('car');
    // Police behind on the west leaf + one on the far side, helicopter above.
    placePoliceCar(G, 208, -3, Math.PI / 2).speed = 34;
    placePoliceCar(G, 196, 3, Math.PI / 2).speed = 30;
    placePoliceCar(G, 268, 2, -Math.PI / 2).speed = 20;
    G.police.wanted = 5;
    G.police.spawnHeli(car);
    G.police.heli.pos.set(214, 46, -28);
    // Police boat in the water below the bridge (north side, in frame).
    G.police.boat = new Boat(G.scene, 258, -38, Math.PI, 0x11151c);
    // The getaway boat waiting past the cranes (south water, lower right).
    G.playerBoat.pos.set(266, G.tide.level, 58);
    G.playerBoat.heading = Math.PI;
    G.playerBoat.mesh.position.copy(G.playerBoat.pos);
    G.playerBoat.mesh.rotation.y = G.playerBoat.heading - Math.PI / 2;
    G.playerBoat.mesh.visible = true;
    G.combat.select(2); // SMG 32/128
    G.combat.weapons[2].inMag = 32; G.combat.weapons[2].reserve = 128;
    G.combat.weapons[1].inMag = 12; G.combat.weapons[1].reserve = 48;
    G.combat.weapons[3].inMag = 6; G.combat.weapons[3].reserve = 18;
    G.missions.say('<b>SINTA — GETAWAY PLANNER</b> — "The bridge is rising, Mara! Don\'t stop — the boat is waiting past the cranes!"', 60);
    G.hud.addFloater('DRIFT x3 +$150 · NEAR MISS +$250');
    G.shotCam = { pos: new THREE.Vector3(206, 10, 62), look: new THREE.Vector3(248, 21, 0) };
    G.shotLabel = '1-cover.jpg';
  } else if (name === 'onfoot') {
    G.city.bridge.setAngle(0);
    G.tide.t = 120; G.tide.update(0);
    G.missions.startJob(4);
    G.missions.stageIndex = 1; // fight
    G.missions.timer = 64;
    st.money = 12400; st.day = 2; st.timeMin = 21 * 60 + 30;
    st.rep = 1200; st.repLevel = 4;
    // Mara on foot in the Fishmarket, pistol out, foes ahead.
    G.setMode('foot');
    G.playerMesh.position.set(-150, 0, 100);
    G.playerHeading = Math.atan2(-6, -14);
    G.playerMesh.rotation.y = G.playerHeading;
    G.playerCar.mesh.visible = false;
    G.combat.select(1); // PISTOL 12/48
    G.combat.weapons[1].inMag = 12; G.combat.weapons[1].reserve = 48;
    G.combat.spawnFoes(-150, 100, 3, G.playerMesh.position);
    G.combat.foes[0].mesh.position.set(-144, 0, 88);
    G.combat.foes[1].mesh.position.set(-158, 0, 86);
    G.combat.foes[2].mesh.position.set(-140, 0, 104);
    G.police.wanted = 3;
    placePoliceCar(G, -120, 80, Math.PI);
    placePoliceCar(G, -182, 122, 0);
    G.police.spawnHeli(G.playerMesh.position);
    G.police.heli.pos.set(-168, 44, 76);
    G.missions.say('<b>RATNA "IBU" KUSUMA — FIXER</b> — "The buyer brought friends, Mara. End it, then get to the safehouse."', 60);
    G.shotCam = { pos: new THREE.Vector3(-160, 5, 130), look: new THREE.Vector3(-148, 1.6, 92) };
    G.shotLabel = '2-onfoot.jpg';
  } else if (name === 'start') {
    G.city.bridge.setAngle(0.1);
    G.tide.t = 200; G.tide.update(0);
    G.missions.startJob(0);
    st.money = 250; st.day = 1; st.timeMin = 18 * 60 + 12;
    G.setMode('title');
    // A parked MERAK GT + traffic on the boulevard for the title backdrop.
    const car = G.playerCar;
    car.pos.set(-40, 0, -4); car.heading = Math.PI / 2; car.speed = 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.set(0, 0, 0);
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    G.shotCam = { pos: new THREE.Vector3(96, 26, 298), look: new THREE.Vector3(-20, 12, -40) };
    G.shotLabel = '3-start.jpg';
  } else if (name === 'boat') {
    G.city.bridge.setAngle(0.35);
    G.tide.t = 60; G.tide.update(0); // TIDE: HIGH
    G.missions.startJob(6);
    G.missions.stageIndex = 2; // outrun the APD down the river
    G.missions.timer = 96;
    st.money = 32100; st.day = 3; st.timeMin = 19 * 60 + 5;
    st.rep = 1750; st.repLevel = 5;
    G.setMode('boat');
    const boat = G.playerBoat;
    boat.pos.set(255, G.tide.level, 150);
    boat.heading = 0; // south, down the river
    boat.speed = 21;
    boat.mesh.position.copy(boat.pos);
    boat.mesh.rotation.y = boat.heading - Math.PI / 2;
    boat.mesh.visible = true;
    G.playerCar.mesh.visible = false;
    G.police.wanted = 5;
    G.police.spawnHeli(boat);
    G.police.heli.pos.set(238, 46, 118);
    G.police.boat = new Boat(G.scene, 250, 96, 0, 0x11151c);
    G.missions.say('<b>SINTA — GETAWAY PLANNER</b> — "High tide, Mara — the channel is open. Don\'t let the boat cops box you in!"', 60);
    G.shotCam = { pos: new THREE.Vector3(258, 18, 185), look: new THREE.Vector3(252, 0, 120) };
    G.shotLabel = '4-boat.jpg';
  }
  G.frozen = true;
  G.shotName = name;
}
