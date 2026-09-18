import * as THREE from 'three';

export function makeFighterMesh(hullColor, scale) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.55, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: 0.1, metalness: 0.6, emissive: 0x1a3a44, emissiveIntensity: 0.6 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.2, 8), bodyMat);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -3.2;
  g.add(nose);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 4.5), bodyMat);
  body.position.z = -0.4;
  g.add(body);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), glassMat);
  cockpit.position.set(0, 0.65, -1.6);
  g.add(cockpit);
  const wingGeo = new THREE.BoxGeometry(3.6, 0.15, 1.6);
  const wingL = new THREE.Mesh(wingGeo, bodyMat); wingL.position.set(-2.0, 0, 0.6); wingL.rotation.z = 0.05;
  const wingR = new THREE.Mesh(wingGeo, bodyMat); wingR.position.set(2.0, 0, 0.6); wingR.rotation.z = -0.05;
  g.add(wingL, wingR);
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0x4de8ff, emissiveIntensity: 1.6 });
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8), engineMat);
  eng.rotation.x = Math.PI / 2; eng.position.z = 2.4;
  g.add(eng);
  g.scale.setScalar(scale || 1);
  g.userData.engineGlow = eng;
  return g;
}

export function makeCapitalMesh() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x2c3a4d, roughness: 0.75, metalness: 0.4 });
  const detailMat = new THREE.MeshStandardMaterial({ color: 0x445770, roughness: 0.6, metalness: 0.4 });
  const core = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 90), hullMat);
  g.add(core);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 16), detailMat);
  bridge.position.set(0, 11, -24);
  g.add(bridge);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 40, 10), detailMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 16, -2, 20);
    g.add(pod);
  }
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0xff8f5a, emissiveIntensity: 1.3 });
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 3, 10), engineMat);
  eng.rotation.x = Math.PI / 2; eng.position.z = 46;
  g.add(eng);
  return g;
}

export function makeFreighterMesh() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x5a6472, roughness: 0.8, metalness: 0.3 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2f3742, roughness: 0.7, metalness: 0.3 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 54), hullMat);
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 10, 8), hullMat);
  bow.rotation.x = Math.PI / 2; bow.position.z = -30;
  g.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(14.6, 2.2, 54), stripeMat);
  g.add(stripe);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0x6dffb0, emissiveIntensity: 1.4 });
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), lightMat);
    light.position.set(side * 7.3, 0, 0);
    g.add(light);
  }
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0x4de8ff, emissiveIntensity: 1.2 });
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 2.5, 10), engineMat);
  eng.rotation.x = Math.PI / 2; eng.position.z = 28;
  g.add(eng);
  return g;
}

export function makeTurretMesh() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 2, 8), new THREE.MeshStandardMaterial({ color: 0x556a80, roughness: 0.6, metalness: 0.5 }));
  g.add(base);
  const barrel = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff8f5a, roughness: 0.4, metalness: 0.3, emissive: 0x5a2a10, emissiveIntensity: 0.5 }));
  barrel.position.y = 1.6;
  g.add(barrel);
  return g;
}
