// The 8 jobs as ONE mission system: a chain with stages, objectives, dialog,
// timers and win/fail. The HUD reads the current stage; the autopilot drives it.
import { MISSIONS } from './config.js';
import { setWanted } from './police.js';

export function initMissions(G) {
  G.missions = {
    index: 0, stage: 0, timer: 0, state: 'idle', // idle | active | done
    completed: 0, guards: [], ledger: false,
  };
}

export function currentJob(G) {
  return MISSIONS[G.missions.index];
}

export function currentStage(G) {
  const job = currentJob(G);
  return job ? job.stages[G.missions.stage] : null;
}

export function startMission(G, n) {
  const m = G.missions;
  m.index = n; m.stage = 0; m.timer = 0; m.state = 'active';
  const job = MISSIONS[n];
  setWanted(G, job.wanted);
  G.time.day = n + 1 > 3 ? 3 : n + 1;
  const st = job.stages[0];
  if (st && st.dialog) G.hud.say(st.dialog[0], st.dialog[1], st.dialog[2]);
  if (G.hud) G.hud.location('JOB ' + job.id + ' — ' + job.title);
}

export function nextStage(G) {
  const m = G.missions;
  const job = currentJob(G);
  m.stage++;
  if (m.stage >= job.stages.length) {
    // job complete
    m.completed++;
    G.player.money += 2500 + job.id * 1500;
    G.player.rep += 120;
    if (G.hud) {
      G.hud.floatText('JOB COMPLETE  +$' + (2500 + job.id * 1500));
      G.hud.say('SINTA', 'Getaway Planner', 'Job ' + job.id + ' done, Mara. ' + (job.id < 8 ? 'Next one is waiting.' : 'That was the last one. Vanish!'));
    }
    if (m.index + 1 < MISSIONS.length) {
      startMission(G, m.index + 1);
    } else {
      m.state = 'done';
      G.mode = 'complete';
    }
    return;
  }
  const st = job.stages[m.stage];
  if (st.dialog && G.hud) G.hud.say(st.dialog[0], st.dialog[1], st.dialog[2]);
}

// Called every frame while a mission is active: checks whether the current
// stage's objective is met. Returns true when a stage was completed.
export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.state !== 'active' || G.mode !== 'play') return false;
  m.timer += dt;
  const st = currentStage(G);
  if (!st) return false;
  const p = G.player;
  const dx = p.pos.x - st.x, dz = p.pos.z - st.z;
  const d2 = dx * dx + dz * dz;
  const reach = st.type === 'boat' ? 16 : (st.type === 'walk' || st.type === 'combat') ? 4 : 14;
  if (st.type === 'combat') {
    // stage completes when all guards are down
    if (m.guards.length > 0 && m.guards.every((g) => g.dead)) nextStage(G);
    return true;
  }
  if (d2 < reach * reach) {
    // steal / boat stages need the right vehicle state
    if (st.type === 'steal' && p.mode !== 'car') return false;
    if (st.type === 'boat' && p.mode !== 'boat') return false;
    nextStage(G);
    return true;
  }
  return false;
}

// Spawn the two armed guards for mission 5 (Night Market).
export function spawnGuards(G) {
  const m = G.missions;
  m.guards = [];
  for (const [x, z] of [[-28, 12], [-32, 6]]) {
    m.guards.push({ x, z, health: 50, dead: false, mesh: null });
  }
}
