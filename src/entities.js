import * as THREE from 'three';
import { scene } from './scene.js';
import { makeFreighterMesh, makeFighterMesh, makeCapitalMesh, makeTurretMesh } from './ships.js';
import { player, enemies, landmarks, wingmen, nextId } from './state.js';
import { comm } from './hud.js';
import { sfx } from './audio.js';

export function spawnConvoy() {
  const anchors = [new THREE.Vector3(-90, -10, -160), new THREE.Vector3(70, 15, -210)];
  for (const a of anchors) {
    const mesh = makeFreighterMesh();
    mesh.position.copy(a);
    scene.add(mesh);
    landmarks.push({ pos: a.clone(), vel: new THREE.Vector3(0, 0, -4), mesh, name: 'Convoy Freighter', radius: 16, hull: 70, hullMax: 70, alive: true });
  }
}

export function spawnWingmen() {
  const defs = [{ name: 'Alpha 2', off: new THREE.Vector3(-14, -2, 10) }, { name: 'Alpha 3', off: new THREE.Vector3(14, -2, 10) }];
  for (const d of defs) {
    const mesh = makeFighterMesh(0xbfe0ff, 1.0);
    const pos = player.pos.clone().add(d.off);
    mesh.position.copy(pos);
    scene.add(mesh);
    wingmen.push({
      id: nextId(), mesh, pos, vel: new THREE.Vector3(0, 0, 0), name: d.name, klass: 'GTF Loki',
      hull: 55, hullMax: 55, radius: 6, speed: 120, alive: true, fireCooldown: Math.random(), formationOffset: d.off,
      targetEnemy: null, orbitTime: 0,
    });
  }
}

export function spawnFighter(px, py, pz, tough) {
  const mesh = makeFighterMesh(tough ? 0xc9705f : 0xd9605f, tough ? 1.35 : 1.0);
  scene.add(mesh);
  const e = {
    id: nextId(), mesh, pos: new THREE.Vector3(px, py, pz), vel: new THREE.Vector3(0, 0, 0),
    hull: tough ? 70 : 40, hullMax: tough ? 70 : 40,
    name: tough ? 'NTF Bomber' : 'NTF Interceptor', klass: tough ? 'Mara-B' : 'Mara',
    kind: 'fighter', score: tough ? 40 : 20, radius: tough ? 7 : 5,
    speed: tough ? 55 : 95, alive: true, fireCooldown: 1 + Math.random(), orbitDir: Math.random() < 0.5 ? 1 : -1,
    aggro: 0, orbitTime: 0,
  };
  enemies.push(e);
  return e;
}

export function spawnCapital() {
  const mesh = makeCapitalMesh();
  scene.add(mesh);
  const cap = {
    id: nextId(), mesh, pos: new THREE.Vector3(0, 0, -2600), vel: new THREE.Vector3(0, 0, 6),
    kind: 'capital', name: 'NTF Ravana', klass: 'Cain-class Cruiser', score: 400,
    radius: 60, alive: true,
  };
  cap.core = { hp: 280, hpMax: 280 };
  const subDefs = [
    { name: 'Fwd Turret', off: new THREE.Vector3(-10, 9, -30), hp: 80, hpMax: 80 },
    { name: 'Aft Turret', off: new THREE.Vector3(10, 9, 20), hp: 80, hpMax: 80 },
    { name: 'Flak Battery', off: new THREE.Vector3(0, 9, 0), hp: 60, hpMax: 60 },
  ];
  cap.subsystems = subDefs.map(d => {
    const tmesh = makeTurretMesh();
    tmesh.position.copy(d.off);
    mesh.add(tmesh);
    return { name: d.name, hp: d.hp, hpMax: d.hpMax, off: d.off, mesh: tmesh, cooldown: Math.random() * 1.5, alive: true };
  });
  enemies.push(cap);
  comm('WARNING: CRUISER-CLASS CONTACT');
  sfx.alert();
  return cap;
}
