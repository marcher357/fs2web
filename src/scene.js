import * as THREE from 'three';

export const stage = document.getElementById('stage');
const mount = document.getElementById('three-mount');

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
mount.appendChild(renderer.domElement);
export const canvas = renderer.domElement;

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070c, 0.00048);

export const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 20000);

export function resize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(320, r.width), h = Math.max(320, r.height);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// lighting
scene.add(new THREE.AmbientLight(0x35506a, 1.1));
const sun = new THREE.DirectionalLight(0xdfefff, 1.3);
sun.position.set(400, 600, -200);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x2b6cff, 0.4);
rim.position.set(-500, -200, 400);
scene.add(rim);

// starfield
(function buildStars() {
  const N = 2600;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 3000 + Math.random() * 6000;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbfe0ff, size: 3.2, sizeAttenuation: false });
  scene.add(new THREE.Points(geo, mat));
})();
