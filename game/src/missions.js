// One mission system: an 8-job chain. Each job is a short list of stages
// (goto / steal / pickup / fight / jump / boat / boatgoto). The HUD reads the
// current job + stage; the autopilot in shots.js drives the same stages.
import { CFG, dist2 } from './config.js';

export class Missions {
  constructor() {
    this.jobs = CFG.jobs;
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.timer = 0;
    this.done = false;
    this.allDone = false;
    this.message = '';
    this.messageT = 0;
    this.foesDown = 0;
  }
  get job() { return this.jobs[this.jobIndex]; }
  get stage() { return this.job ? this.job.stages[this.stageIndex] : null; }
  get stageCount() { return this.job ? this.job.stages.length : 0; }
  startJob(i) {
    this.jobIndex = i;
    this.stageIndex = 0;
    this.timer = 0;
    this.done = false;
    this.foesDown = 0;
    const j = this.jobs[i];
    this.say(`${j.title} — ${j.brief}`);
    return j;
  }
  say(text, secs = 5) { this.message = text; this.messageT = secs; }
  update(dt) {
    this.timer += dt;
    if (this.messageT > 0) this.messageT -= dt;
  }
  // Returns 'job-done' | 'all-done' | null. Called by main.js when a stage's
  // condition is met (reached marker, stole car, picked up, foes down, jumped).
  advance() {
    if (this.allDone) return null;
    this.stageIndex++;
    if (this.stageIndex >= this.job.stages.length) {
      const reward = this.job.reward;
      this.jobIndex++;
      this.stageIndex = 0;
      this.timer = 0;
      this.foesDown = 0;
      if (this.jobIndex >= this.jobs.length) {
        this.allDone = true;
        this.say('AURELIA DELTA COMPLETE — Mara vanished into the delta. The ledger is ours.', 8);
        return 'all-done';
      }
      const j = this.jobs[this.jobIndex];
      this.say(`JOB ${this.jobIndex + 1}/8 — ${j.title}: ${j.brief}`);
      return 'job-done';
    }
    return null;
  }
  // Is the player close enough to the current stage's marker?
  atStageTarget(x, z) {
    const s = this.stage;
    if (!s || !s.at) return false;
    const r = s.r || 10;
    return dist2(x, z, s.at[0], s.at[1]) < r * r;
  }
  // Autopilot helper: where should the car drive to for the current stage?
  driveTarget() {
    const s = this.stage;
    if (!s) return null;
    if (s.type === 'goto' || s.type === 'steal' || s.type === 'pickup' || s.type === 'jump') return s.at;
    if (s.type === 'boat') return s.at;
    if (s.type === 'boatgoto') return s.at;
    if (s.type === 'fight') return s.at;
    return null;
  }
  // Timer text mm:ss for the HUD.
  timerText() {
    const t = Math.floor(this.timer);
    return `${String(Math.floor(t / 60)).padStart(1, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
  // Short label for the HUD mission panel.
  label() {
    if (this.allDone) return 'ALL JOBS DONE';
    const j = this.job;
    return `JOB ${this.jobIndex + 1}/8 · ${j.title}`;
  }
  nextText() {
    if (this.allDone) return '—';
    const next = this.job.stages[this.stageIndex + 1];
    return next ? `NEXT: ${next.text}` : 'NEXT: Job complete';
  }
}
