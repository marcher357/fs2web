import * as THREE from 'three';
import { scene } from './scene.js';
import { player, game, enemies, wingmen, projectiles, missiles, particles, liveFreighters, nearestLiveEnemy } from './state.js';
import { forwardFromYawPitch, orientToForward, shieldQuadrantForDir, UP } from './utils.js';
import { sfx } from './audio.js';
import { comm, floatText } from './hud.js';
import { endMission } from './mission.js';

const laserGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6);
export function fireLaser(originPos, forward, faction, dmg, speed) {
  const mat = new THREE.MeshBasicMaterial({ color: (faction === 'player' || faction === 'friendly') ? 0x8ff0ff : 0xff8a8a });
  const mesh = new THREE.Mesh(laserGeo, mat);
  mesh.position.copy(originPos);
  orientToForward(mesh, forward);
  mesh.rotateX(Math.PI / 2);
  scene.add(mesh);
  projectiles.push({ pos: originPos.clone(), vel: forward.clone().multiplyScalar(speed), faction, dmg, life: 1.6, mesh });
}

export function tryFireMissile() {
  if (!game.running || !player.alive) return;
  if (game.lockTarget && game.lockProgress >= 1 && player.missiles > 0) {
    const t = game.lockTarget;
    if (!t.alive) return;
    player.missiles--;
    const forward = forwardFromYawPitch(player.yaw, player.pitch);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffce6b, emissive: 0xffb347, emissiveIntensity: 0.8 });
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 6), mat);
    mesh.position.copy(player.pos);
    scene.add(mesh);
    missiles.push({ pos: player.pos.clone(), vel: forward.clone().multiplyScalar(90), target: t, targetSub: game.targetSub, life: 7, faction: 'player', dmg: 60, mesh });
    sfx.missile();
  }
}

export function damagePlayer(dmg, fromPos) {
  if (!player.alive) return;
  const forward = forwardFromYawPitch(player.yaw, player.pitch);
  const hitDir = fromPos.clone().sub(player.pos).normalize();
  const quad = shieldQuadrantForDir(forward, UP, hitDir);
  player.shieldRegenDelay = 1.6;
  if (player.shields[quad] > 0) {
    const absorb = Math.min(player.shields[quad], dmg);
    player.shields[quad] -= absorb; dmg -= absorb;
    sfx.shieldHit();
    if (player.shields[quad] <= 0) comm(quad.toUpperCase() + ' SHIELD DOWN');
  }
  if (dmg > 0) {
    player.hull -= dmg; sfx.hit();
    game.shake = Math.min(1, game.shake + 0.35);
    if (player.hull <= 0) { player.hull = 0; player.alive = false; killPlayer(); }
  }
}
export function killPlayer() {
  spawnExplosion(player.pos, 1.6);
  sfx.explosion(true);
  player.group.visible = false;
  endMission(false);
}

export function subsystemWorldPos(cap, sub) {
  return sub.off.clone().applyQuaternion(cap.mesh.quaternion).add(cap.pos);
}

export function damageEnemy(e, dmg, subIndex) {
  if (!e.alive) return;
  if (e.kind === 'capital') {
    if (subIndex != null && e.subsystems[subIndex] && e.subsystems[subIndex].alive) {
      const s = e.subsystems[subIndex];
      s.hp -= dmg;
      floatText(subsystemWorldPos(e, s), '-' + Math.round(dmg), '#ffb347');
      if (s.hp <= 0 && s.alive) {
        s.alive = false; s.mesh.visible = false;
        spawnExplosion(subsystemWorldPos(e, s), 0.7);
        sfx.explosion(false);
        comm(s.name.toUpperCase() + ' DESTROYED');
      }
    } else {
      e.core.hp -= dmg;
      floatText(e.pos.clone().add(new THREE.Vector3(0, 10, 0)), '-' + Math.round(dmg), '#ff8080');
      if (e.core.hp <= 0) killEnemy(e);
    }
    return;
  }
  e.hull -= dmg;
  floatText(e.pos.clone().add(new THREE.Vector3(0, e.radius + 2, 0)), '-' + Math.round(dmg), '#ffb347');
  if (e.hull <= 0) killEnemy(e);
}
export function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false;
  scene.remove(e.mesh);
  spawnExplosion(e.pos, e.kind === 'capital' ? 2.4 : 1.0);
  sfx.explosion(e.kind === 'capital');
  game.kills++;
  comm((e.kind === 'capital' ? e.name : e.klass).toUpperCase() + ' DESTROYED');
  if (game.target === e) {
    game.target = nearestLiveEnemy(player.pos);
    game.targetSub = null;
    if (game.target) comm('TARGET: ' + (game.target.kind === 'capital' ? game.target.name : game.target.klass).toUpperCase());
  }
  if (game.lockTarget === e) { game.lockTarget = null; game.lockProgress = 0; }
}

export function damageWingman(wm, dmg, fromPos) {
  if (!wm.alive) return;
  wm.hull -= dmg;
  floatText(wm.pos.clone().add(new THREE.Vector3(0, 6, 0)), '-' + Math.round(dmg), '#ffb347');
  if (wm.hull <= 0) {
    wm.alive = false;
    scene.remove(wm.mesh);
    spawnExplosion(wm.pos, 0.9);
    sfx.explosion(false);
    comm(wm.name.toUpperCase() + ' IS DOWN');
  }
}

export function damageFreighter(l, dmg) {
  if (!l.alive) return;
  l.hull -= dmg;
  floatText(l.pos.clone().add(new THREE.Vector3(0, 10, 0)), '-' + Math.round(dmg), '#ff8080');
  if (l.hull <= 0) {
    l.alive = false;
    scene.remove(l.mesh);
    spawnExplosion(l.pos, 1.3);
    sfx.explosion(false);
    comm('CONVOY FREIGHTER LOST');
    if (liveFreighters().length === 0 && (game.stage === 'wave1' || game.stage === 'wave1-active' || game.stage === 'wave2' || game.stage === 'wave2-active')) {
      endMission(false, 'The convoy was destroyed before it could jump.');
    }
  }
}

export function spawnExplosion(pos, scale) {
  const n = Math.floor(14 * scale);
  for (let i = 0; i < n; i++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const sp = (20 + Math.random() * 70) * scale;
    const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xffb347 : 0xff5d5d });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random() * 1.2 * scale, 5, 4), mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    particles.push({ pos: pos.clone(), vel: dir.multiplyScalar(sp), life: 0.5 + Math.random() * 0.5 * scale, maxLife: 0.5 + 0.5 * scale, mesh });
  }
}
export function spawnSpark(pos, dir) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 4, 4), mat);
  mesh.position.copy(pos); scene.add(mesh);
  particles.push({ pos: pos.clone(), vel: dir.clone().multiplyScalar(0.2).add(new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10)), life: 0.2, maxLife: 0.2, mesh });
}
