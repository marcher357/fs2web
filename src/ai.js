import * as THREE from 'three';
import { player, game, enemies, wingmen, nearestCombatant, liveFreighters } from './state.js';
import { orientToForward, UP } from './utils.js';
import { fireLaser, subsystemWorldPos } from './combat.js';
import { sfx } from './audio.js';

// Orbiting a target to line up a shot is fine briefly, but with no way to break
// off, two AI ships circling each other can lock into a stable mutual orbit
// forever. After ORBIT_STALEMATE_TIME spent circling the same target, force a
// short DISENGAGE_TIME extend-away pass before resuming pursuit -- this mirrors
// what FS2's own ai_profiles.tbl stalemate thresholds are for.
const ORBIT_STALEMATE_TIME = 4.5;
const DISENGAGE_TIME = 2.5;
const WINGMAN_ORBIT_STALEMATE_TIME = 4.0;
const WINGMAN_DISENGAGE_TIME = 2.0;

export function updateFighterAI(e, dt) {
  // Escort raiders: go after the convoy by default. They only turn on the player
  // (or a wingman) once one gets close or actually shoots them (aggro), then
  // disengage back to the convoy once that threat backs off.
  e.aggro = Math.max(0, e.aggro - dt);
  const nearest = nearestCombatant(e.pos);
  if (nearest && e.pos.distanceTo(nearest.pos) < 200) e.aggro = Math.max(e.aggro, 1.5);

  const freighters = liveFreighters();
  let targetIsCombatant = (e.aggro > 0 && nearest) || freighters.length === 0;
  let targetObj = targetIsCombatant ? (nearest || player) : null;
  if (!targetIsCombatant) {
    let best = null, bestD = Infinity;
    for (const l of freighters) { const dd = e.pos.distanceTo(l.pos); if (dd < bestD) { bestD = dd; best = l; } }
    targetObj = best;
  }
  if (e.aiTargetRef !== targetObj) { e.aiTargetRef = targetObj; e.orbitTime = 0; e.disengageTimer = 0; }
  const targetPos = targetObj.pos;

  const toTarget = targetPos.clone().sub(e.pos);
  const d = toTarget.length();
  toTarget.normalize();
  let desiredDir = toTarget;
  const desiredRange = 180;
  e.disengageTimer = e.disengageTimer || 0;
  if (e.disengageTimer > 0) {
    e.disengageTimer -= dt;
    e.orbitTime = 0;
    desiredDir = toTarget.clone().negate();
  } else if (d < desiredRange * 0.7) {
    e.orbitTime = (e.orbitTime || 0) + dt;
    if (e.orbitTime > ORBIT_STALEMATE_TIME) {
      e.disengageTimer = DISENGAGE_TIME;
      desiredDir = toTarget.clone().negate();
    } else {
      const rightV = new THREE.Vector3().crossVectors(toTarget, UP).normalize();
      desiredDir = toTarget.clone().addScaledVector(rightV, e.orbitDir).normalize();
    }
  } else {
    e.orbitTime = 0;
  }
  orientToForward(e.mesh, desiredDir);
  const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(e.mesh.quaternion);
  const spd = e.speed;
  e.vel.lerp(currentForward.multiplyScalar(spd), dt * 1.1);
  e.pos.addScaledVector(e.vel, dt);
  e.mesh.position.copy(e.pos);

  e.fireCooldown -= dt;
  const facingDot = currentForward.dot(toTarget);
  if (d < 420 && facingDot > 0.82 && e.fireCooldown <= 0) {
    if (targetIsCombatant && !targetObj.alive) return;
    e.fireCooldown = 1.35 + Math.random() * 0.8;
    const nose = e.pos.clone().addScaledVector(toTarget, e.radius + 2);
    fireLaser(nose, toTarget, 'hostile', 6, 240);
    sfx.laser();
  }
}

export function updateCapitalAI(e, dt) {
  e.pos.addScaledVector(e.vel, dt);
  e.mesh.position.copy(e.pos);
  for (const s of e.subsystems) {
    if (!s.alive) continue;
    s.cooldown -= dt;
    const sp = subsystemWorldPos(e, s);
    const toPlayer = player.pos.clone().sub(sp);
    const d = toPlayer.length(); toPlayer.normalize();
    if (d < 520 && s.cooldown <= 0 && player.alive) {
      s.cooldown = 1.7 + Math.random() * 0.9;
      fireLaser(sp, toPlayer, 'hostile', 9, 220);
      sfx.laser();
    }
  }
}

export function updateWingmanAI(wm, dt) {
  if (!game.formationOrder) {
    // pick or keep an enemy fighter target
    if (!wm.targetEnemy || !wm.targetEnemy.alive) {
      let best = null, bestD = 1100;
      for (const e of enemies) {
        if (!e.alive || e.kind !== 'fighter') continue;
        const dd = wm.pos.distanceTo(e.pos);
        if (dd < bestD) { bestD = dd; best = e; }
      }
      if (wm.targetEnemy !== best) { wm.orbitTime = 0; wm.disengageTimer = 0; }
      wm.targetEnemy = best;
    }
  } else {
    // ordered to form up (C) -- ignore hostiles entirely until released
    wm.targetEnemy = null;
  }

  let desiredDir, desiredSpeed;
  if (wm.targetEnemy) {
    const toTarget = wm.targetEnemy.pos.clone().sub(wm.pos);
    const d = toTarget.length();
    toTarget.normalize();
    desiredDir = toTarget;
    wm.disengageTimer = wm.disengageTimer || 0;
    if (wm.disengageTimer > 0) {
      wm.disengageTimer -= dt;
      wm.orbitTime = 0;
      desiredDir = toTarget.clone().negate();
    } else if (d < 130) {
      wm.orbitTime = (wm.orbitTime || 0) + dt;
      if (wm.orbitTime > WINGMAN_ORBIT_STALEMATE_TIME) {
        wm.disengageTimer = WINGMAN_DISENGAGE_TIME;
        desiredDir = toTarget.clone().negate();
      } else {
        const rightV = new THREE.Vector3().crossVectors(toTarget, UP).normalize();
        desiredDir = toTarget.clone().addScaledVector(rightV, 1).normalize();
      }
    } else {
      wm.orbitTime = 0;
    }
    desiredSpeed = wm.speed;
    orientToForward(wm.mesh, desiredDir);
    const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(wm.mesh.quaternion);
    wm.fireCooldown -= dt;
    const facingDot = currentForward.dot(toTarget);
    if (d < 380 && facingDot > 0.85 && wm.fireCooldown <= 0) {
      wm.fireCooldown = 0.5 + Math.random() * 0.4;
      const nose = wm.pos.clone().addScaledVector(toTarget, wm.radius + 2);
      fireLaser(nose, toTarget, 'friendly', 8, 320);
      sfx.laser();
    }
    wm.vel.lerp(currentForward.multiplyScalar(desiredSpeed), dt * 1.4);
  } else {
    // no target: hold loose formation on the player
    const worldOffset = wm.formationOffset.clone().applyQuaternion(player.group.quaternion);
    const desiredPos = player.pos.clone().add(worldOffset);
    const toFormation = desiredPos.clone().sub(wm.pos);
    const d = toFormation.length();
    if (d > 2) {
      desiredDir = toFormation.clone().normalize();
      orientToForward(wm.mesh, desiredDir);
      desiredSpeed = THREE.MathUtils.clamp(d * 1.4, 0, 170);
      const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(wm.mesh.quaternion);
      wm.vel.lerp(currentForward.multiplyScalar(desiredSpeed), dt * 1.6);
    } else {
      wm.vel.lerp(player.vel, dt * 1.6);
    }
  }
  wm.pos.addScaledVector(wm.vel, dt);
  wm.mesh.position.copy(wm.pos);
}
