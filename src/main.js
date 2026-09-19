import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';
import { clamp, lerp, forwardFromYawPitch, orientToForward, dist3, UP, screenToWorldDir } from './utils.js';
import { player, game, enemies, wingmen, projectiles, missiles, particles, landmarks, liveFreighters } from './state.js';
import { keys, mouse, requestPointerLock } from './input.js';
import { updateFighterAI, updateCapitalAI, updateWingmanAI } from './ai.js';
import { updateMissionFlow, resetGame } from './mission.js';
import { fireLaser, damageEnemy, damagePlayer, damageWingman, damageFreighter, spawnSpark, spawnExplosion, subsystemWorldPos } from './combat.js';
import { audioInit, sfx } from './audio.js';
import {
  updateHUD, drawCrosshair, drawTargetRing, drawLockBracket, drawFloaters,
  drawNavMarker, drawRadar, drawHoverTooltip, tickFloaters, nearestEnemyToCrosshair, comm,
} from './hud.js';

const MISSILE_REGEN_INTERVAL = 12; // seconds per missile, only while below max

function update(dt) {
  game.time += dt;
  const w = renderer.domElement.clientWidth || 800, h = renderer.domElement.clientHeight || 600;

  // ---- cursor steering (virtual joystick: offset from screen center sets turn RATE) ----
  const halfW = w / 2, halfH = h / 2;
  const rawNx = mouse.hasMoved ? clamp((mouse.x - halfW) / halfW, -1, 1) : 0;
  const rawNy = mouse.hasMoved ? clamp((mouse.y - halfH) / halfH, -1, 1) : 0;
  const smoothing = clamp(dt * 10, 0, 1);
  mouse.smx = lerp(mouse.smx, rawNx, smoothing);
  mouse.smy = lerp(mouse.smy, rawNy, smoothing);
  function shapeAxis(v) {
    const dz = 0.08; // dead zone near center: small jitter shouldn't cause drift
    const s = Math.sign(v);
    const mag = Math.max(0, (Math.abs(v) - dz) / (1 - dz));
    return s * mag * mag; // squared past the dead zone: fine control near center, fast turns at the edge
  }
  const maxTurnRate = 1.7; // rad/s at full cursor deflection
  player.yaw -= shapeAxis(mouse.smx) * maxTurnRate * dt;
  player.pitch -= shapeAxis(mouse.smy) * maxTurnRate * dt;
  player.pitch = clamp(player.pitch, -1.35, 1.35);

  const forward = forwardFromYawPitch(player.yaw, player.pitch);
  const right = new THREE.Vector3().crossVectors(forward, UP).normalize();

  // ---- thrust ----
  const thrustAccel = 130, strafeAccel = 95;
  const boosting = (keys['ShiftLeft'] || keys['ShiftRight']);
  const canBoost = boosting && player.boost > 1;
  const boostMul = canBoost ? 2.0 : 1.0;
  const accel = new THREE.Vector3();
  if (keys['KeyW']) { accel.addScaledVector(forward, thrustAccel * boostMul); player.thrustVisual = 1; }
  else player.thrustVisual = Math.max(0, player.thrustVisual - dt * 3);
  if (keys['KeyS']) accel.addScaledVector(forward, -thrustAccel * 0.6);
  if (keys['KeyA']) accel.addScaledVector(right, -strafeAccel);
  if (keys['KeyD']) accel.addScaledVector(right, strafeAccel);

  if (canBoost) player.boost = Math.max(0, player.boost - dt * 45);
  else player.boost = Math.min(player.boostMax, player.boost + dt * 12);

  // Newtonian: no drag. Whatever velocity you have, you keep -- thrust only adds to it.
  player.vel.addScaledVector(accel, dt);
  const maxSpeed = 150 * (canBoost ? 1.6 : 1);
  if (player.vel.length() > maxSpeed) player.vel.setLength(maxSpeed);
  player.pos.addScaledVector(player.vel, dt);

  player.group.position.copy(player.pos);
  orientToForward(player.group, forward);
  if (player.group.userData.engineGlow) {
    player.group.userData.engineGlow.material.emissiveIntensity = 1.0 + player.thrustVisual * 2.2;
  }

  // weapon energy
  player.weaponEnergy = Math.min(player.weaponEnergyMax, player.weaponEnergy + dt * 22);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (mouse.down && player.fireCooldown <= 0 && player.weaponEnergy >= 6 && player.alive) {
    player.fireCooldown = 0.11;
    player.weaponEnergy -= 6;
    const aimDir = screenToWorldDir(camera, mouse.x, mouse.y, w, h);
    const nosePos = player.pos.clone().addScaledVector(forward, 5);
    fireLaser(nosePos, aimDir, 'player', 10, 340);
    sfx.laser();
    game.shotsFired++;
  }

  // missiles regenerate slowly on their own, one at a time
  if (player.missiles < player.missilesMax) {
    player.missileRegenTimer += dt;
    if (player.missileRegenTimer >= MISSILE_REGEN_INTERVAL) {
      player.missileRegenTimer -= MISSILE_REGEN_INTERVAL;
      player.missiles++;
    }
  } else {
    player.missileRegenTimer = 0;
  }

  // shield regen
  if (player.shieldRegenDelay > 0) player.shieldRegenDelay -= dt;
  else for (const k in player.shields) player.shields[k] = Math.min(player.shieldMax, player.shields[k] + dt * 4.5);

  // ---- targeting / lock ----
  if (game.target && !game.target.alive) { game.target = null; game.targetSub = null; }
  // game.target can be a wingman too (F cycles friendlies) -- only hostiles
  // (enemies carry a .kind) are ever valid missile-lock candidates.
  let lockCandidate = (game.target && game.target.alive && game.target.kind) ? game.target : nearestEnemyToCrosshair(w, h, 90);
  if (mouse.rdown && lockCandidate && dist3(player.pos, lockCandidate.pos) < 1400) {
    if (game.lockTarget !== lockCandidate) { game.lockTarget = lockCandidate; game.lockProgress = 0; }
    const wasLocked = game.lockProgress >= 1;
    game.lockProgress = Math.min(1, game.lockProgress + dt / 0.9);
    if (!wasLocked && game.lockProgress >= 1) sfx.lockOn();
    else if (Math.random() < 0.15) sfx.lock();
  } else if (!mouse.rdown) { game.lockTarget = null; game.lockProgress = 0; }

  // ---- enemies ----
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.kind === 'fighter') updateFighterAI(e, dt);
    else updateCapitalAI(e, dt);
  }

  // ---- wingmen ----
  for (const wm of wingmen) {
    if (!wm.alive) continue;
    updateWingmanAI(wm, dt);
  }

  // ---- convoy (reference landmark) ----
  for (const l of landmarks) {
    l.pos.addScaledVector(l.vel, dt);
    l.mesh.position.copy(l.pos);
  }

  // ---- projectiles ----
  for (const p of projectiles) {
    p.life -= dt;
    p.pos.addScaledVector(p.vel, dt);
    p.mesh.position.copy(p.pos);
  }
  for (const p of projectiles) {
    if (p.life <= 0) continue;
    if (p.faction === 'player' || p.faction === 'friendly') {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (e.kind === 'capital') {
          let hit = false;
          for (let i = 0; i < e.subsystems.length; i++) {
            const s = e.subsystems[i]; if (!s.alive) continue;
            const sp = subsystemWorldPos(e, s);
            if (p.pos.distanceTo(sp) < 5) { damageEnemy(e, p.dmg, i); p.life = 0; hit = true; if (p.faction === 'player') game.shotsHit++; spawnSpark(p.pos, p.vel); break; }
          }
          if (!hit && p.pos.distanceTo(e.pos) < e.radius) { damageEnemy(e, p.dmg, null); p.life = 0; if (p.faction === 'player') game.shotsHit++; spawnSpark(p.pos, p.vel); }
        } else if (p.pos.distanceTo(e.pos) < e.radius + 1) {
          damageEnemy(e, p.dmg, null); e.aggro = Math.max(e.aggro, 5); p.life = 0; if (p.faction === 'player') game.shotsHit++; spawnSpark(p.pos, p.vel);
        }
      }
    } else {
      if (player.alive && p.pos.distanceTo(player.pos) < 3.2) {
        damagePlayer(p.dmg, p.pos); p.life = 0; spawnSpark(p.pos, p.vel);
      } else {
        for (const wm of wingmen) {
          if (!wm.alive) continue;
          if (p.pos.distanceTo(wm.pos) < wm.radius + 1) { damageWingman(wm, p.dmg, p.pos); p.life = 0; spawnSpark(p.pos, p.vel); break; }
        }
        if (p.life > 0) {
          for (const l of liveFreighters()) {
            if (p.pos.distanceTo(l.pos) < l.radius) { damageFreighter(l, p.dmg); p.life = 0; spawnSpark(p.pos, p.vel); break; }
          }
        }
      }
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (projectiles[i].life <= 0) { scene.remove(projectiles[i].mesh); projectiles.splice(i, 1); }
  }

  // ---- missiles ----
  for (const m of missiles) {
    m.life -= dt;
    if (m.target && m.target.alive) {
      const desired = m.target.pos.clone().sub(m.pos).normalize();
      m.vel.lerp(desired.multiplyScalar(110), dt * 2.4);
    }
    m.pos.addScaledVector(m.vel, dt);
    m.mesh.position.copy(m.pos);
    if (m.vel.lengthSq() > 0.01) orientToForward(m.mesh, m.vel.clone().normalize());
    if (m.target && m.target.alive && m.pos.distanceTo(m.target.pos) < (m.target.radius || 6) + 4) {
      damageEnemy(m.target, m.dmg, m.targetSub);
      spawnExplosion(m.pos, 0.5); sfx.hit(); m.life = 0;
    }
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    if (missiles[i].life <= 0) { scene.remove(missiles[i].mesh); missiles.splice(i, 1); }
  }

  // ---- particles ----
  for (const pt of particles) {
    pt.life -= dt;
    pt.pos.addScaledVector(pt.vel, dt);
    pt.vel.multiplyScalar(0.94);
    pt.mesh.position.copy(pt.pos);
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    pt.mesh.material.opacity = a;
    pt.mesh.material.transparent = true;
    pt.mesh.scale.setScalar(0.6 + (1 - a) * 1.8);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].life <= 0) { scene.remove(particles[i].mesh); particles.splice(i, 1); }
  }
  tickFloaters(dt);

  game.shake = Math.max(0, game.shake - dt * 1.8);

  updateMissionFlow(dt);
  updateHUD();
}

// ---------------------------------------------------------------------------
// Render (camera + HUD lock brackets + radar)
// ---------------------------------------------------------------------------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function render() {
  const forward = forwardFromYawPitch(player.yaw, player.pitch);
  const localOffset = new THREE.Vector3(0, 3.4, 10.5);
  const worldOffset = localOffset.clone().applyQuaternion(player.group.quaternion);
  const desiredCamPos = player.pos.clone().add(worldOffset);
  camPos.lerp(desiredCamPos, game.running ? 0.18 : 1);
  camera.position.copy(camPos);
  const desiredLook = player.pos.clone().addScaledVector(forward, 30).add(new THREE.Vector3(0, 1.2, 0));
  camLook.lerp(desiredLook, game.running ? 0.25 : 1);

  let shakeOffset = new THREE.Vector3();
  if (game.shake > 0) {
    shakeOffset.set((Math.random() - 0.5) * 3 * game.shake, (Math.random() - 0.5) * 3 * game.shake, 0);
  }
  camera.position.add(shakeOffset);
  camera.up.set(0, 1, 0);
  camera.lookAt(camLook);

  renderer.render(scene, camera);

  const w = renderer.domElement.clientWidth || 800, h = renderer.domElement.clientHeight || 600;
  drawCrosshair();
  drawTargetRing(w, h);
  drawLockBracket(w, h);
  drawFloaters(w, h);
  drawNavMarker(w, h);
  drawHoverTooltip(w, h);
  drawRadar();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.running && !game.paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
document.getElementById('launchBtn').addEventListener('click', () => {
  audioInit();
  document.getElementById('startOverlay').hidden = true;
  resetGame();
  requestPointerLock();
  comm('MISSION START: PATROL CORRIDOR');
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('endOverlay').hidden = true;
  resetGame();
  requestPointerLock();
  comm('MISSION START: PATROL CORRIDOR');
});

requestAnimationFrame(loop);
