// Renderer: three.js setup, golden-hour sky + sun, shadows, fog, chase camera.
import * as THREE from 'three';

export function initRenderer(G) {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const scene = new THREE.Scene();
  // golden-hour sky: gradient dome
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x2a3a6a) },
      mid: { value: new THREE.Color(0xff9a5a) },
      bot: { value: new THREE.Color(0xffc07a) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog(0xe8a06a, 220, 780);
  // low sun, long shadows
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-180, 90, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8a7a9a, 0.55));
  const hemi = new THREE.HemisphereLight(0xffc890, 0x3a4a5a, 0.5);
  scene.add(hemi);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  G.renderer = renderer;
  G.scene = scene;
  G.camera = camera;
  G.sun = sun;
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Chase camera: behind and above the player (car, boat or on foot), smoothed.
export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  const back = p.mode === 'foot' ? 7 : p.mode === 'boat' ? 13 : 11;
  const up = p.mode === 'foot' ? 3.2 : p.mode === 'boat' ? 5 : 4.2;
  const tx = p.pos.x - Math.sin(p.heading) * back;
  const tz = p.pos.z - Math.cos(p.heading) * back;
  const k = Math.min(1, dt * 4);
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (p.pos.y + up - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  cam.lookAt(p.pos.x + Math.sin(p.heading) * 6, p.pos.y + 1.5, p.pos.z + Math.cos(p.heading) * 6);
}

// A fixed cinematic camera for a staged shot (position + look target).
export function shotCamera(G, pos, look) {
  const cam = G.camera;
  cam.position.set(pos[0], pos[1], pos[2]);
  cam.lookAt(look[0], look[1], look[2]);
}
