// AURELIA DELTA — config: the city's data. All names, places and numbers are original.
// Map: land z in [-280, 160], canal z in [160, 200], delta water z in [200, 280].
// Roads on a grid every 80 m; the Aurelia Drawbridge crosses the canal at x = 0.

export const MAP = {
  half: 280,
  landZ: 160,
  canalZ0: 160,
  canalZ1: 200,
  waterZ: 200,
  roadsX: [-240, -160, -80, 0, 80, 160, 240],
  roadsZ: [-240, -160, -80, 0, 80, 140],
  bridgeX: 0,
  bridgeHalfWidth: 14,
};

export const DISTRICTS = [
  { name: 'The Docks', cx: -200, cz: 110, w: 160, d: 100, color: 0x8a6f4d, desc: 'Container port' },
  { name: 'Canal Row', cx: 0, cz: 120, w: 240, d: 80, color: 0x4d7a8a, desc: 'Canal-side shops' },
  { name: 'Fishmarket', cx: -40, cz: 0, w: 160, d: 160, color: 0xc47a4d, desc: 'Ibu Ratna\u2019s turf' },
  { name: 'Old Customs', cx: 120, cz: 0, w: 160, d: 160, color: 0x9a8a6a, desc: 'The old customs house' },
  { name: 'Drawbridge Quarter', cx: 0, cz: 180, w: 80, d: 120, color: 0x6a5a8a, desc: 'The Aurelia Drawbridge' },
  { name: 'The Spit', cx: 240, cz: 60, w: 80, d: 200, color: 0xd8c07a, desc: 'Beach strip' },
  { name: 'Crane Yard', cx: -200, cz: -100, w: 160, d: 120, color: 0x7a7a7a, desc: 'Truck park' },
  { name: 'Aurelia Heights', cx: 40, cz: -180, w: 320, d: 200, color: 0x5a6a9a, desc: 'Downtown towers' },
];

export const VEHICLES = [
  { name: 'MERAK GT', color: 0xd21f2b, top: 52, accel: 26, grip: 2.6, kind: 'sport' },
  { name: 'ELANG', color: 0xf2b705, top: 44, accel: 20, grip: 2.2, kind: 'sedan' },
  { name: 'KANCIL', color: 0x3fa7d6, top: 38, accel: 18, grip: 2.4, kind: 'hatch' },
  { name: 'KOMODO', color: 0x7a8a3a, top: 34, accel: 13, grip: 1.8, kind: 'truck' },
  { name: 'APD CRUISER', color: 0x1a2a4a, top: 48, accel: 24, grip: 2.5, kind: 'police' },
  { name: 'TAXI BAJAJ', color: 0xe8e8e8, top: 36, accel: 16, grip: 2.0, kind: 'taxi' },
];

export const WEAPONS = [
  { name: 'FISTS', damage: 12, mag: 0, reserve: 0, range: 2.2 },
  { name: 'PISTOL', damage: 22, mag: 12, reserve: 48, range: 40 },
  { name: 'SMG', damage: 14, mag: 32, reserve: 128, range: 34 },
  { name: 'SHOTGUN', damage: 55, mag: 6, reserve: 18, range: 16 },
];

export const POLICE_UNITS = ['HERON-2', 'MERAK-5', 'ELANG-7', 'GULL-3', 'TIDE-1', 'KUNTUL-4'];
export const POLICE_TACTICS = ['PURSUIT', 'RAMMING', 'ROADBLOCK', 'SEARCHLIGHT', 'BOXING IN'];

export const RADIO = [
  { name: 'DELTA 88.1', song: 'Tide Song', band: 'The Meraks', freq: '88.1' },
  { name: 'WAVE 104', song: 'Palm Static', band: 'Coral Ghosts', freq: '104.0' },
  { name: 'K-SUN 91.7', song: 'Golden Hour', band: 'The Meridians', freq: '91.7' },
  { name: 'CORAL FM', song: 'Coastal Nights', band: 'Neon Drive', freq: '96.3' },
];

// The 8 jobs. Each job is a chain of stages; a stage is { type, x, z, text, dialog }.
// Types: walk, drive, steal, boat, combat, wait, deliver.
export const MISSIONS = [
  {
    id: 1, title: 'FIRST LIGHT', wanted: 1,
    brief: 'Steal a car and lose the APD. Get to Doni\u2019s garage.',
    stages: [
      { type: 'steal', x: -40, z: 8, text: 'Steal a car (F)', dialog: ['SINTA', 'Getaway Planner', 'First job, Mara. Take any car — the red one is yours if you can grab it.'] },
      { type: 'drive', x: -200, z: -120, text: 'Reach Doni\u2019s garage', dialog: ['DONI', 'Mechanic', 'Bring it here in one piece and I\u2019ll make it fast.'] },
    ],
  },
  {
    id: 2, title: 'FISHMARKET RUN', wanted: 2,
    brief: 'Pick up the package on foot, then drive it across Canal Row.',
    stages: [
      { type: 'walk', x: -60, z: 20, text: 'Pick up the package', dialog: ['IBU RATNA', 'Fixer', 'The package is with the fishmonger. Don\u2019t keep the buyer waiting.'] },
      { type: 'drive', x: 60, z: 120, text: 'Deliver to Canal Row', dialog: ['SINTA', 'Getaway Planner', 'Buyer\u2019s at the canal. Two stars now — keep it smooth.'] },
    ],
  },
  {
    id: 3, title: 'THE CRANE JOB', wanted: 2,
    brief: 'Steal the container truck from The Docks.',
    stages: [
      { type: 'steal', x: -220, z: 100, text: 'Steal the KOMODO truck', dialog: ['IBU RATNA', 'Fixer', 'The truck at the docks holds the good crates. Take it.'] },
      { type: 'drive', x: -200, z: -120, text: 'Bring the truck to the garage', dialog: ['DONI', 'Mechanic', 'A truck? You steal the weirdest things, Mara.'] },
    ],
  },
  {
    id: 4, title: 'BRIDGE TOLL', wanted: 3,
    brief: 'Smash through the APD roadblock at the Drawbridge Quarter.',
    stages: [
      { type: 'drive', x: 0, z: 120, text: 'Reach the bridge approach', dialog: ['KAPTEN HARUN', 'APD Chief', 'All units: the Vela woman is crossing. Block the bridge!'] },
      { type: 'drive', x: 0, z: 220, text: 'Break through the roadblock', dialog: ['SINTA', 'Getaway Planner', 'Roadblock ahead — don\u2019t stop, don\u2019t slow down!'] },
      { type: 'drive', x: 240, z: 60, text: 'Lose them at The Spit', dialog: ['SINTA', 'Getaway Planner', 'The beach, Mara. Lose them in the crowd.'] },
    ],
  },
  {
    id: 5, title: 'NIGHT MARKET', wanted: 3,
    brief: 'On foot in the Fishmarket: meet the buyer, deal with his guards, get out.',
    stages: [
      { type: 'walk', x: -40, z: 0, text: 'Meet the buyer', dialog: ['IBU RATNA', 'Fixer', 'Night market. The buyer brought guards — be ready.'] },
      { type: 'combat', x: -30, z: 10, text: 'Deal with the guards', dialog: ['SINTA', 'Getaway Planner', 'They drew first. Finish it and run!'] },
      { type: 'drive', x: -200, z: -120, text: 'Escape to the garage', dialog: ['DONI', 'Mechanic', 'You smell like fish and gunpowder. Nice work.'] },
    ],
  },
  {
    id: 6, title: 'THE CUSTOMS LEDGER', wanted: 4,
    brief: 'Slip into Old Customs and steal Harun\u2019s ledger.',
    stages: [
      { type: 'walk', x: 120, z: 0, text: 'Infiltrate Old Customs', dialog: ['IBU RATNA', 'Fixer', 'The ledger is in the customs house. Harun\u2019s whole case lives in it.'] },
      { type: 'walk', x: 140, z: -20, text: 'Grab the ledger', dialog: ['SINTA', 'Getaway Planner', 'Got it? Then run — the whole department is coming.'] },
      { type: 'drive', x: 0, z: 120, text: 'Escape toward the bridge', dialog: ['KAPTEN HARUN', 'APD Chief', 'That ledger is mine! AIR-1, find her!'] },
    ],
  },
  {
    id: 7, title: 'HIGH TIDE', wanted: 5,
    brief: 'Five stars. Helicopter and roadblocks. Get the ledger to the boat.',
    stages: [
      { type: 'drive', x: 0, z: 150, text: 'Reach the dock road', dialog: ['SINTA', 'Getaway Planner', 'Five stars, Mara. The boat is at the dock — go!'] },
      { type: 'boat', x: 0, z: 230, text: 'Board the boat (F)', dialog: ['DONI', 'Mechanic', 'Boat\u2019s fueled. The tide is with you tonight.'] },
    ],
  },
  {
    id: 8, title: 'VANISHING POINT', wanted: 5,
    brief: 'Cross the rising drawbridge, take the boat, vanish into the delta.',
    stages: [
      { type: 'drive', x: 0, z: 120, text: 'Approach the bridge', dialog: ['SINTA', 'Getaway Planner', 'The bridge is rising, Mara! Don\u2019t stop — the boat is waiting past the cranes!'] },
      { type: 'drive', x: 0, z: 220, text: 'Jump the rising bridge', dialog: ['KAPTEN HARUN', 'APD Chief', 'Stop her! She does not cross that bridge!'] },
      { type: 'boat', x: 0, z: 250, text: 'Take the boat and vanish', dialog: ['SINTA', 'Getaway Planner', 'You did it, Mara. Vanish into the delta.'] },
    ],
  },
];

export const GAME_TITLE = 'AURELIA DELTA';
export const GAME_SUBTITLE = '8 JOBS · 5-STAR POLICE · BOATS & BRIDGES';
export const START_MONEY = 250;
export const TIDE_PERIOD = 240; // seconds for a full tide cycle
