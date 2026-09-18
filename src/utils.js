import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function forwardFromYawPitch(yaw, pitch) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}

export const UP = new THREE.Vector3(0, 1, 0);
const tmpObj = new THREE.Object3D();
export function orientToForward(obj, forward) {
  tmpObj.position.copy(obj.position);
  tmpObj.up.set(0, 1, 0);
  tmpObj.lookAt(obj.position.clone().add(forward));
  obj.quaternion.copy(tmpObj.quaternion);
}

export function dist3(a, b) { return a.distanceTo(b); }

export function shieldQuadrantForDir(shipForward, shipUp, hitDirWorld) {
  const right = new THREE.Vector3().crossVectors(shipForward, shipUp).normalize();
  const localZ = -hitDirWorld.dot(shipForward); // >0 means hit came from front
  const localX = hitDirWorld.dot(right);
  if (Math.abs(localZ) > Math.abs(localX)) return localZ > 0 ? 'front' : 'back';
  return localX > 0 ? 'right' : 'left';
}

const _screenPos = new THREE.Vector3();
export function projectToScreen(camera, worldPos, w, h) {
  _screenPos.copy(worldPos).project(camera);
  return { x: (_screenPos.x * 0.5 + 0.5) * w, y: (-_screenPos.y * 0.5 + 0.5) * h, behind: _screenPos.z > 1 };
}
