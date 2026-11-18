// Renderer, golden-hour sky, sun + shadows, fog, chase camera, quality tiers.
// ACES filmic tone mapping, exposure ~0.85, one shadow-casting sun at 7 degrees.
import * as THREE from 'three';
import { CFG, clamp, lerp } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createSky(scene) {
  // Gradient sky dome with a low sun glow, written as one small shader.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(CFG.colors.skyTop) },
      mid: { value: new THREE.Color(0xc96a4a) },
      horizon: { value: new THREE.Color(CFG.colors.skyHorizon) },
      sunDir: { value: new THREE.Vector3(-0.55, 0.12, 0.82).normalize() },
      sunCol: { value: new THREE.Color(CFG.colors.sun) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top, mid, horizon, sunDir, sunCol;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.2, 0.65, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunCol * (pow(s, 220.0) * 1.4 + pow(s, 18.0) * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog(CFG.colors.fog, 180, 700);
  return sky;
}

export function createLights(scene) {
  const sun = new THREE.DirectionalLight(0xffd9a0, 3.4);
  // Low sun, 7 degrees above the horizon, from the west-southwest.
  sun.position.set(-260, 55, 380);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x8aa0c0, 0x5a4a3a, 1.5);
  scene.add(hemi);
  return { sun, hemi };
}

// Chase camera: follows behind the target, eases, never clips the ground.
export class ChaseCam {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 8, -20);
    this.look = new THREE.Vector3();
    this.yaw = 0; this.pitch = -0.12;
  }
  update(dt, target, heading, mode) {
    const cam = this.camera;
    if (mode === 'car') {
      const back = 13.5, up = 5.2;
      const tx = target.x - Math.sin(heading) * back, tz = target.z - Math.cos(heading) * back;
      const want = new THREE.Vector3(tx, target.y + up, tz);
      this.pos.lerp(want, 1 - Math.pow(0.0001, dt));
      this.pos.y = Math.max(this.pos.y, target.y + 2.2);
      this.look.lerp(new THREE.Vector3(target.x + Math.sin(heading) * 10, target.y + 2, target.z + Math.cos(heading) * 10), 1 - Math.pow(0.0001, dt));
    } else if (mode === 'boat') {
      const back = 16, up = 7;
      const tx = target.x - Math.sin(heading) * back, tz = target.z - Math.cos(heading) * back;
      const want = new THREE.Vector3(tx, target.y + up, tz);
      this.pos.lerp(want, 1 - Math.pow(0.0001, dt));
      this.look.lerp(new THREE.Vector3(target.x + Math.sin(heading) * 12, target.y + 1.5, target.z + Math.cos(heading) * 12), 1 - Math.pow(0.0001, dt));
    } else { // on foot: orbit with the mouse yaw/pitch
      const d = 7.5;
      const want = new THREE.Vector3(
        target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * d,
        target.y + 2.2 - Math.sin(this.pitch) * d,
        target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * d);
      this.pos.lerp(want, 1 - Math.pow(0.00001, dt));
      this.pos.y = Math.max(this.pos.y, target.y + 0.6);
      this.look.lerp(new THREE.Vector3(target.x, target.y + 1.6, target.z), 1 - Math.pow(0.00001, dt));
    }
    cam.position.copy(this.pos);
    cam.lookAt(this.look);
  }
  snap(target, heading, mode) {
    const back = mode === 'car' ? 13.5 : mode === 'boat' ? 16 : 7.5;
    const up = mode === 'car' ? 5.2 : mode === 'boat' ? 7 : 2.2;
    this.pos.set(target.x - Math.sin(heading) * back, target.y + up, target.z - Math.cos(heading) * back);
    this.look.set(target.x + Math.sin(heading) * 10, target.y + 2, target.z + Math.cos(heading) * 10);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}

// Quality tiers: drop a tier on their own after 3 s of slow frames, never mid-shot.
export class Quality {
  constructor(renderer) { this.renderer = renderer; this.tier = 0; this.slowSecs = 0; }
  noteFrame(ms) {
    if (ms > 20) this.slowSecs += ms / 1000; else this.slowSecs = 0;
    if (this.slowSecs > 3 && this.tier < 2) {
      this.tier++; this.slowSecs = 0;
      this.apply();
    }
  }
  apply() {
    const r = this.renderer;
    if (this.tier === 0) { r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; }
    if (this.tier === 1) { r.setPixelRatio(1.5); r.shadowMap.enabled = true; }
    if (this.tier === 2) { r.setPixelRatio(1); r.shadowMap.enabled = false; }
  }
}
export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = h > w ? 52 : 38;
  camera.updateProjectionMatrix();
}
