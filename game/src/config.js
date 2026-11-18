// AURELIA DELTA — all world data in one place. Port Aurelia is a river-delta
// port city, not a resort island. Coordinates: x east, z south, metres, y up.
// The river/delta is the east strip (x >= 200). The drawbridge crosses it on
// Bridge Road (z = 0). The beach (The Spit) is the south strip (z >= 240).
export const CFG = {
  world: { size: 640, half: 320, riverX: 200, beachZ: 240, waterY: -0.6 },
  // Drawbridge: west approach 180..200, west leaf 200..240 (hinge x=200),
  // east leaf 240..280 (hinge x=280), east approach 280..300. Road z -12..12.
  bridge: { x0: 180, x1: 300, leaf0: 200, leaf1: 240, leaf2: 280, halfW: 12, maxAngle: 0.52, raiseSecs: 25, lowerSecs: 65 },
  // 8 named districts (rects). The minimap + location card read these.
  districts: [
    { name: 'Old Customs', x0: -280, z0: -280, x1: -120, z1: -40, color: '#8a6f4d' },
    { name: 'Aurelia Heights', x0: -120, z0: -280, x1: 40, z1: -120, color: '#5d7fa3' },
    { name: 'Crane Yard', x0: 40, z0: -280, x1: 200, z1: -120, color: '#7a7d84' },
    { name: 'Fishmarket', x0: -280, z0: -40, x1: -120, z1: 160, color: '#c98a4b' },
    { name: 'Canal Row', x0: -120, z0: -120, x1: 120, z1: 120, color: '#4d8a7a' },
    { name: 'Drawbridge Quarter', x0: 120, z0: -60, x1: 320, z1: 60, color: '#a35d5d' },
    { name: 'The Docks', x0: 200, z0: -160, x1: 320, z1: 160, color: '#6b6f8a' },
    { name: 'The Spit', x0: -280, z0: 200, x1: 200, z1: 320, color: '#d9b380' },
  ],
  // Road grid: north-south streets and east-west streets (centre lines).
  streetsNS: [-260, -180, -100, -20, 60, 140],
  streetsEW: [-260, -180, -100, -20, 60, 140, 220],
  streetW: 12,
  // Named vehicles. `top` is top speed m/s, `acc` accel, `grip` steering.
  vehicles: {
    merak:  { name: 'MERAK GT', color: 0xd21f2b, top: 46, acc: 22, grip: 2.4, body: 'sport' },
    elang:  { name: 'ELANG',    color: 0x2b5fd9, top: 38, acc: 18, grip: 2.2, body: 'sedan' },
    kancil: { name: 'KANCIL',   color: 0xe8b820, top: 32, acc: 16, grip: 2.6, body: 'hatch' },
    komodo: { name: 'KOMODO',   color: 0x3f7a3a, top: 28, acc: 12, grip: 1.6, body: 'truck' },
    police: { name: 'APD CRUISER', color: 0x11151c, top: 42, acc: 20, grip: 2.5, body: 'police' },
    taxi:   { name: 'TAXI',     color: 0xe8c832, top: 30, acc: 14, grip: 2.0, body: 'sedan' },
  },
  trafficColors: [0x8a8f96, 0x5a6b7a, 0x7a5a4a, 0x4a6b5a, 0x9a9a9a, 0x3a4a6b, 0x6b3a4a],
  weapons: [
    { id: 'fists',  name: 'FISTS',  damage: 25, rate: 2.2, range: 2.2, ammo: -1, mag: -1, auto: false },
    { id: 'pistol', name: 'PISTOL', damage: 34, rate: 3.5, range: 55, ammo: 48, mag: 12, auto: false },
    { id: 'smg',    name: 'SMG',    damage: 20, rate: 9.0, range: 45, ammo: 128, mag: 32, auto: true },
    { id: 'shotgun',name: 'SHOTGUN',damage: 18, rate: 1.1, range: 26, ammo: 18, mag: 6, auto: false, pellets: 6 },
  ],
  policeUnits: ['HERON-2', 'MERAK-5', 'ELANG-7', 'GULL-3', 'TIDE-1', 'KUNTUL-4'],
  policeTactics: ['Pursuit', 'Ramming', 'Roadblock', 'Searchlight', 'Boxing in'],
  radio: [
    { name: 'DELTA 88.1', show: 'Golden Hour', song: 'Tide Song', band: 'The Meraks', scale: [0, 3, 5, 7, 10], bpm: 96 },
    { name: 'WAVE 104.2', show: 'Neon Drive', song: 'Pink Horizon', band: 'Lumen Kids', scale: [0, 2, 4, 7, 9], bpm: 118 },
    { name: 'K-SUN 91.7', show: 'Harbour Lights', song: 'Cranes at Dusk', band: 'The Meridians', scale: [0, 3, 5, 8, 10], bpm: 84 },
    { name: 'CORAL 89.5', show: 'Night Market', song: 'Fishmarket Blues', band: 'Ibu Ratna Trio', scale: [0, 2, 3, 7, 8], bpm: 104 },
  ],
  crew: {
    mara: 'MARA VELA — getaway driver, ex-harbour pilot',
    ratna: 'RATNA "IBU" KUSUMA — fixer, Fishmarket',
    sinta: 'SINTA — getaway planner',
    doni: 'DONI PRASETYO — mechanic, garage',
    harun: 'KAPTEN HARUN — chief of the APD',
  },
  // One mission system: 8 jobs in a chain. A stage is goto / steal / pickup /
  // fight / jump / boat / escape. `at` is [x, z]. `wanted` is the level the job runs at.
  jobs: [
    { title: 'FIRST LIGHT', wanted: 1, reward: 500, brief: 'Steal a car, lose the APD, reach the garage.',
      stages: [
        { type: 'steal', text: 'Steal a car', at: [-160, 60], car: 'merak' },
        { type: 'goto', text: 'Lose the APD — reach the garage', at: [-20, 140], r: 10 },
        { type: 'goto', text: 'Park in the garage', at: [-20, 140], r: 5 },
      ] },
    { title: 'FISHMARKET RUN', wanted: 2, reward: 800, brief: 'Pick up the package on foot, deliver it to Canal Row.',
      stages: [
        { type: 'pickup', text: 'Pick up the package (E)', at: [-170, 80] },
        { type: 'goto', text: 'Deliver to Canal Row', at: [140, 40], r: 10 },
        { type: 'goto', text: 'Drop the package', at: [140, 40], r: 5 },
      ] },
    { title: 'THE CRANE JOB', wanted: 2, reward: 1200, brief: 'Steal the KOMODO truck from The Docks.',
      stages: [
        { type: 'steal', text: 'Steal the KOMODO truck', at: [300, -60], car: 'komodo' },
        { type: 'goto', text: 'Drive it to Crane Yard', at: [100, -220], r: 10 },
        { type: 'goto', text: 'Park the truck', at: [100, -220], r: 5 },
      ] },
    { title: 'BRIDGE TOLL', wanted: 3, reward: 1500, brief: 'Break the roadblock and cross the bridge.',
      stages: [
        { type: 'goto', text: 'Reach the bridge', at: [150, 0], r: 12 },
        { type: 'goto', text: 'Break the roadblock', at: [200, 0], r: 10 },
        { type: 'goto', text: 'Cross to The Docks', at: [250, 0], r: 10 },
      ] },
    { title: 'NIGHT MARKET', wanted: 3, reward: 2000, brief: 'Meet the buyer on foot. The deal goes bad.',
      stages: [
        { type: 'goto', text: 'Meet the buyer on foot', at: [-150, 100], r: 6, onFoot: true },
        { type: 'fight', text: 'Deal gone bad — drop them', at: [-150, 100], foes: 3 },
        { type: 'goto', text: 'Escape to the safehouse', at: [-20, 140], r: 10 },
      ] },
    { title: 'THE CUSTOMS LEDGER', wanted: 4, reward: 3000, brief: 'Take the ledger from Old Customs.',
      stages: [
        { type: 'goto', text: 'Reach Old Customs', at: [-240, -200], r: 12 },
        { type: 'pickup', text: 'Take the ledger (E)', at: [-240, -190] },
        { type: 'goto', text: 'Get back to the car', at: [-220, -180], r: 8 },
      ] },
    { title: 'HIGH TIDE', wanted: 5, reward: 4000, brief: 'Wanted 5. Get the ledger to the boat.',
      stages: [
        { type: 'goto', text: 'Reach the boat dock', at: [210, 120], r: 10 },
        { type: 'boat', text: 'Take the boat (F)', at: [215, 120] },
        { type: 'boatgoto', text: 'Outrun the APD down the river', at: [260, 260], r: 14 },
        { type: 'boatgoto', text: 'Double back to the Docks', at: [250, 120], r: 14 },
      ] },
    { title: 'VANISHING POINT', wanted: 5, reward: 6000, brief: 'Jump the rising bridge, take the boat, vanish into the delta.',
      stages: [
        { type: 'steal', text: 'Take the MERAK GT', at: [150, 0], car: 'merak' },
        { type: 'jump', text: 'Jump the rising bridge', at: [260, 0], r: 12 },
        { type: 'boat', text: 'Take the boat (F)', at: [285, 100] },
        { type: 'boatgoto', text: 'Vanish into the delta', at: [280, 280], r: 14 },
      ] },
  ],
  tuning: {
    walkSpeed: 6, runSpeed: 9, carEnterR: 4.5, interactR: 3,
    wantedDecaySecs: 22, bustedSecs: 2.0, policeDespawnR: 260,
    trafficCount: 10, pedCount: 26, maxPolice: 6,
    moneyStart: 250, repPerJob: 240, driftBonus: 150, nearMissBonus: 250,
  },
  colors: {
    skyTop: 0x2e4a7a, skyHorizon: 0xff9a5c, sun: 0xffd9a0, fog: 0xe8a06a,
    ground: 0x6b6f66, road: 0x33363c, sidewalk: 0x8a8d90, sand: 0xd9b380,
    water: 0x2a6f8a, waterDeep: 0x14425e, building: 0x9a8f80,
  },
};
export function districtAt(x, z) {
  for (const d of CFG.districts) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
  return CFG.districts[4];
}
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
