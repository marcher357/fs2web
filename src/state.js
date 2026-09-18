import * as THREE from 'three';
import { scene } from './scene.js';
import { makeFighterMesh } from './ships.js';

export const player = {
  group: makeFighterMesh(0xcfefff, 1.0),
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: 0, pitch: 0,
  hull: 100, hullMax: 100,
  shields: { front: 55, back: 55, left: 55, right: 55 }, shieldMax: 55,
  shieldRegenDelay: 0,
  weaponEnergy: 100, weaponEnergyMax: 100,
  missiles: 6, missilesMax: 6,
  boost: 100, boostMax: 100,
  fireCooldown: 0,
  alive: true,
  thrustVisual: 0,
};
scene.add(player.group);
player.group.visible = false;

export let idCounter = 1;
export function nextId() { return idCounter++; }

export let enemies = [];
export let projectiles = [];
export let missiles = [];
export let particles = [];
export let floaters = [];
export let landmarks = [];
export let wingmen = [];
export let currentObjectiveLabel = 'NAV';
export function setObjectiveLabel(label) { currentObjectiveLabel = label; }

export function setFloaters(next) { floaters = next; }

export const game = {
  running: false, time: 0, stage: 'idle', waveTimer: 0,
  kills: 0, shotsFired: 0, shotsHit: 0,
  target: null, targetSub: null, lockTarget: null, lockProgress: 0,
  shake: 0,
};

export function clearScene() {
  for (const e of enemies) scene.remove(e.mesh);
  for (const p of projectiles) if (p.mesh) scene.remove(p.mesh);
  for (const m of missiles) if (m.mesh) scene.remove(m.mesh);
  for (const pt of particles) if (pt.mesh) scene.remove(pt.mesh);
  for (const l of landmarks) scene.remove(l.mesh);
  for (const wm of wingmen) scene.remove(wm.mesh);
  enemies = []; projectiles = []; missiles = []; particles = []; floaters = []; landmarks = []; wingmen = [];
}

export function liveFreighters() { return landmarks.filter(l => l.alive); }
export function liveWingmen() { return wingmen.filter(w => w.alive); }
export function nearestCombatant(fromPos) {
  let best = null, bestD = Infinity;
  if (player.alive) { best = player; bestD = fromPos.distanceTo(player.pos); }
  for (const wm of liveWingmen()) {
    const dd = fromPos.distanceTo(wm.pos);
    if (dd < bestD) { bestD = dd; best = wm; }
  }
  return best;
}
