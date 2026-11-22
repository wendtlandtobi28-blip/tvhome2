// Welten: Raumstation (Hub) und Archivsektoren. Aufbau, Kollision, Interaktionsobjekte.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createCharacter, createStatue } from './character.js';
import { createSky } from './sky.js';
import { rng, clamp } from './util.js';

export const HUB = {
  radius: 45,
  start: { x: 0, z: -22, yaw: 0 },
  gate: { x: 31.5, z: 4 },
  landmarks: { aussicht: { x: 0, z: 41 }, denkmal: { x: -12, z: 14 }, archivtor: { x: 30, z: 4 } },
  crystals: [[-30, -24], [22, -26], [24, 32], [-28, 26], [14, 29], [-20, 34], [6, -8], [-27, 6], [24, -6], [-6, 22]]
};
export const SECTOR = { HL: 45, HW: 11, WH: 8, PORTAL_X: 42, start: { x: -42, z: 0, yaw: Math.PI / 2 }, quiz: { x: 37.5, z: -4.2 }, echo: { x: 0, z: 4.0 }, partitions: [-15, 15], door: 3.2 };

// --------------------------------------------------------------------- Bausteine

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function labelSprite(text, width, color) {
  const W = 1024, H = 160;
  const tex = canvasTex(W, H, (g) => {
    g.font = '600 72px "Rajdhani", "Exo 2", "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 72;
    while (g.measureText(text).width > W * 0.94 && size > 20) { size -= 4; g.font = `600 ${size}px "Rajdhani", "Exo 2", "Segoe UI", Arial, sans-serif`; }
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 12;
    g.fillStyle = color || '#e9f4ff';
    g.fillText(text, W / 2, H / 2);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  spr.scale.set(width, width * H / W, 1);
  return spr;
}

function bannerTexture(emblemImg) {
  return canvasTex(256, 768, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#8d1417');
    grad.addColorStop(1, '#3d0709');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b8893f';
    g.fillRect(0, 0, w, 18);
    g.fillRect(14, 30, 6, h - 120);
    g.fillRect(w - 20, 30, 6, h - 120);
    // Schwalbenschwanz unten
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 90); g.lineTo(w, h); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    if (emblemImg) g.drawImage(emblemImg, 38, 170, 180, 180);
  });
}

class Builder {
  constructor() {
    this.group = new THREE.Group();
    this.colliders = [];
    this.blockers = [];
    this.interactables = [];
    this.updaters = [];
    this.mats = {};
  }
  mat(key, params) {
    if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial(params);
    return this.mats[key];
  }
  add(mesh, opts = {}) {
    mesh.castShadow = opts.shadow !== false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (opts.block) this.blockers.push(mesh);
    return mesh;
  }
  box(x, y, z, sx, sy, sz, material, opts = {}) {
    const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material), opts);
    m.position.set(x, y, z);
    if (opts.collide) this.colliders.push({ t: 'b', x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2 });
    return m;
  }
  cyl(x, y, z, rTop, rBottom, h, material, opts = {}) {
    const m = this.add(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, opts.seg || 24), material), opts);
    m.position.set(x, y, z);
    if (opts.collide) this.colliders.push({ t: 'c', x, z, r: Math.max(rTop, rBottom) });
    return m;
  }
  light(x, y, z, color, intensity, distance) {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    this.group.add(l);
    return l;
  }
}

/** Datenkristall (Sammelobjekt) */
function makeCrystal(b, id, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, emissive: 0x3fb6ff, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.9 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
  gem.position.y = 1.0;
  gem.scale.y = 1.6;
  g.add(gem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.12, 6), b.mat('crystalBase', { color: 0x1c2230, metalness: 0.8, roughness: 0.3 }));
  base.position.y = 0.06;
  g.add(base);
  b.group.add(g);
  const item = { kind: 'crystal', id, pos: new THREE.Vector3(x, 1.0, z), obj: g, collected: false, label: 'Datenkristall' };
  b.updaters.push((dt, t) => {
    if (item.collected) return;
    gem.rotation.y += dt * 1.4;
    gem.position.y = 1.0 + Math.sin(t * 2 + x) * 0.08;
  });
  item.setCollected = (c) => { item.collected = c; g.visible = !c; };
  b.interactables.push(item);
  return item;
}

// --------------------------------------------------------------------- Raumstation

export function buildHub(assets, story, quality) {
  const b = new Builder();
  const sky = createSky(assets, 'hub', quality);
  b.group.add(sky.group);
  b.updaters.push((dt, t) => sky.update(dt, t));
  const R = HUB.radius;

  // --- Boden: nasse Platten mit Spiegelung
  const tileMap = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#20222a'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 30 + r() * 14 | 0;
      g.fillStyle = `rgb(${v},${v + 1},${v + 5})`;
      g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    }
    g.fillStyle = 'rgba(255,190,120,0.06)';
    for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 2 + r() * 30, 1);
  });
  tileMap.repeat.set(18, 18);
  const floorMat = new THREE.MeshStandardMaterial({
    map: tileMap, color: 0xffffff, metalness: 0.35, roughness: 0.28,
    normalMap: assets.normals.tiles, normalScale: new THREE.Vector2(0.25, 0.25),
    transparent: quality === 'hoch', opacity: quality === 'hoch' ? 0.86 : 1
  });
  if (assets.normals.tiles) assets.normals.tiles.repeat.set(18, 18);
  if (quality === 'hoch') {
    const refl = new Reflector(new THREE.CircleGeometry(R + 30, 64), {
      textureWidth: Math.min(1024, window.innerWidth), textureHeight: Math.min(1024, window.innerHeight), color: 0x70757f
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.y = -0.02;
    b.group.add(refl);
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 30, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  b.group.add(floor);
  // Unterbau der Plattform (sichtbar ueber den Rand)
  b.cyl(0, -6.08, 0, R + 30, R + 18, 12, b.mat('platform', { color: 0x15171d, metalness: 0.7, roughness: 0.5 }), { shadow: false, seg: 64 });

  // --- Gelaender am Rand (Aussicht nach vorn, +Z)
  const railMat = b.mat('rail', { color: 0x2b2e37, metalness: 0.85, roughness: 0.3 });
  const railGlow = b.mat('railGlow', { color: 0xffb070, emissive: 0xff9a50, emissiveIntensity: 2.5 });
  for (let a = -1.25; a <= 1.25; a += 0.05) {
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const post = b.cyl(x, 0.55, z, 0.05, 0.05, 1.1, railMat, { seg: 8 });
    post.castShadow = false;
  }
  const railTop = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 128, 2.5), railMat);
  // Torusbogen (0..2.5 rad) so drehen, dass er von -1.25 bis +1.25 rad um die +Z-Richtung liegt
  railTop.rotation.set(-Math.PI / 2, 0, -1.25 - Math.PI / 2);
  railTop.position.y = 1.1;
  b.group.add(railTop);
  const railLight = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.025, 6, 128, 2.5), railGlow);
  railLight.rotation.copy(railTop.rotation);
  railLight.position.y = 1.0;
  b.group.add(railLight);

  // --- Gebaeude
  const winTex = canvasTex(256, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#0b0c10'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 24) for (let x = 8; x < w; x += 20) {
      if (r() < 0.45) { g.fillStyle = r() < 0.75 ? `rgba(255,${180 + r() * 50 | 0},110,${0.5 + r() * 0.5})` : 'rgba(120,200,255,0.8)'; g.fillRect(x, y, 12, 14); }
    }
  });
  const facade = (sx, sy, rep) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x262932, metalness: 0.75, roughness: 0.38, normalMap: assets.normals.panels,
      emissive: 0xffffff, emissiveMap: winTex.clone(), emissiveIntensity: 1.3
    });
    m.emissiveMap.repeat.set(sx / 12, sy / 22);
    m.emissiveMap.needsUpdate = true;
    return m;
  };
  const trimMat = b.mat('trim', { color: 0x8a6a3a, metalness: 0.95, roughness: 0.28 });
  const neonCyan = b.mat('neonC', { color: 0x80e0ff, emissive: 0x40c8ff, emissiveIntensity: 3 });
  const neonWarm = b.mat('neonW', { color: 0xffc080, emissive: 0xffa040, emissiveIntensity: 3 });

  function building(x, z, sx, sy, sz, opts = {}) {
    b.box(x, sy / 2, z, sx, sy, sz, facade(Math.max(sx, sz), sy), { collide: true, block: true });
    b.box(x, sy + 0.4, z, sx + 0.8, 0.8, sz + 0.8, trimMat);
    b.box(x, 3.2, z, sx + 0.6, 0.35, sz + 0.6, trimMat, { shadow: false });
    if (opts.neon) b.box(x + (opts.neonX || 0), opts.neonY || 5, z + (opts.neonZ || 0), opts.neonSX || 0.15, 0.2, opts.neonSZ || sz * 0.8, opts.neon === 'warm' ? neonWarm : neonCyan, { shadow: false });
    // Dachaufbauten
    const r = rng(Math.abs(x * 13 + z * 7) | 0);
    for (let i = 0; i < 3; i++) {
      b.box(x + (r() - 0.5) * sx * 0.6, sy + 1 + r() * 2, z + (r() - 0.5) * sz * 0.6, 2 + r() * 3, 2 + r() * 4, 2 + r() * 3, trimMat);
    }
  }
  // Kommandozentrum (links)
  building(-38, -6, 12, 20, 30, { neon: 'cyan', neonX: 6.1, neonY: 6, neonSZ: 20 });
  building(-36, 22, 10, 14, 14, { neon: 'warm', neonX: 5.1, neonY: 4.5, neonSZ: 10 });
  // Archivhalle (rechts) mit Tor
  building(40, 4, 14, 24, 26, {});
  building(36, -24, 12, 16, 14, { neon: 'warm', neonX: -6.1, neonY: 5, neonSZ: 10 });
  building(34, 26, 10, 12, 10, { neon: 'cyan', neonX: -5.1, neonY: 4, neonSZ: 7 });
  // Rueckseite
  building(0, -42, 46, 26, 10, { neon: 'cyan', neonZ: 5.1, neonY: 6, neonSX: 30, neonSZ: 0.15 });
  building(-24, -36, 10, 18, 10, {});
  building(24, -36, 10, 18, 10, {});

  // Stufen zum Kommandozentrum
  for (let i = 0; i < 4; i++) b.box(-31.2 + i * 0.6, 0.12 + i * 0.25, -6, 0.6, 0.25 + i * 0.5, 10, b.mat('steps', { color: 0x30333c, metalness: 0.5, roughness: 0.5 }), { collide: i === 3 });

  // Banner mit Emblem
  const bannerTex = bannerTexture(assets.emblem.gold);
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 });
  [[-31.9, 9, -14, Math.PI / 2], [-31.9, 9, 2, Math.PI / 2], [32.9, 11, -6, -Math.PI / 2], [32.9, 11, 14, -Math.PI / 2], [-12, 13, -36.9, 0], [12, 13, -36.9, 0]].forEach(([x, y, z, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7.8), bannerMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    b.group.add(m);
  });

  // --- Archivtor (an der Archivhalle)
  const gateGroup = new THREE.Group();
  gateGroup.position.set(33.05, 0, HUB.gate.z);
  gateGroup.rotation.y = -Math.PI / 2;
  const ringMat = b.mat('gateRing', { color: 0x3a3d48, metalness: 0.9, roughness: 0.25 });
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.45, 12, 64), ringMat);
  gateRing.position.y = 4.6;
  gateGroup.add(gateRing);
  const gateField = new THREE.Mesh(new THREE.CircleGeometry(3.9, 64), new THREE.MeshBasicMaterial({ color: 0x55c8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  gateField.position.y = 4.6;
  gateGroup.add(gateField);
  const gateLight = new THREE.PointLight(0x55c8ff, 60, 22, 2);
  gateLight.position.set(0, 4, 2.5);
  gateGroup.add(gateLight);
  const gateLabel = labelSprite('ARCHIV', 4, '#bfe9ff');
  gateLabel.position.y = 9.6;
  gateGroup.add(gateLabel);
  b.group.add(gateGroup);
  b.updaters.push((dt, t) => { gateField.material.opacity = 0.42 + Math.sin(t * 2) * 0.1; gateRing.rotation.z += dt * 0.1; });
  b.interactables.push({ kind: 'gate', id: 'archivtor', pos: new THREE.Vector3(32, 3, HUB.gate.z), label: 'Archivtor', range: 6 });

  // --- Denkmal der Gruender
  const dm = HUB.landmarks.denkmal;
  const stoneMat = b.mat('pedestal', { color: 0x4a4740, metalness: 0.2, roughness: 0.75 });
  b.cyl(dm.x, 0.8, dm.z, 2.0, 2.4, 1.6, stoneMat, { collide: true, seg: 8 });
  b.cyl(dm.x, 1.75, dm.z, 1.6, 1.8, 0.3, trimMat, { seg: 8 });
  const statue = createStatue(assets, 0x6a665e);
  statue.scale.setScalar(2.4);
  statue.position.set(dm.x, 1.9, dm.z);
  statue.rotation.y = Math.PI * 0.85;
  statue.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  b.group.add(statue);

  // --- Laternen und Baeume
  const lampPos = [[-20, -18], [20, -18], [-26, 10], [26, 14], [-14, 32], [14, 32], [0, -30], [-6, 6]];
  const lampMat = b.mat('lamp', { color: 0x22252c, metalness: 0.85, roughness: 0.35 });
  const glowMat = b.mat('lampGlow', { color: 0xffd9a0, emissive: 0xffb466, emissiveIntensity: 4 });
  lampPos.forEach(([x, z], i) => {
    b.cyl(x, 2.4, z, 0.08, 0.12, 4.8, lampMat, { collide: true, seg: 10 });
    b.box(x, 4.95, z, 0.45, 0.6, 0.45, lampMat);
    const glow = b.box(x, 4.95, z, 0.32, 0.45, 0.32, glowMat, { shadow: false });
    glow.castShadow = false;
    if (i < (quality === 'niedrig' ? 3 : 6)) b.light(x, 4.6, z, 0xffb070, 40, 18);
  });
  const leafMat = b.mat('leaf', { color: 0x2f4a2c, roughness: 0.9 });
  [[-22, 28], [20, 36]].forEach(([x, z]) => {
    b.cyl(x, 0.5, z, 1.4, 1.6, 1, b.mat('planter', { color: 0x2c2e35, metalness: 0.6, roughness: 0.4 }), { collide: true, seg: 8 });
    b.cyl(x, 2, z, 0.12, 0.18, 2.4, b.mat('trunk', { color: 0x3b2b20, roughness: 0.9 }));
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), leafMat);
    crown.position.set(x, 4, z);
    crown.castShadow = true;
    b.group.add(crown);
  });

  // --- Licht
  const hemi = new THREE.HemisphereLight(0x6a5a8a, 0x1a1414, 0.9);
  b.group.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa36a, 3.2);
  // Schattenlicht etwas hoeher als die sichtbare Abendsonne (vermeidet lange Schattenstreifen)
  sun.position.set(sky.sunDir.x, 0.62, sky.sunDir.z).normalize().multiplyScalar(80);
  sun.castShadow = quality !== 'niedrig';
  sun.shadow.mapSize.set(quality === 'hoch' ? 2048 : 1024, quality === 'hoch' ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  b.group.add(sun);
  b.group.add(sun.target);

  // --- Nebenfiguren
  const npcs = [];
  const palettes = [
    { Ruestung: 0x3a3f4a, Akzent: 0x1f5a8a, Anzug: 0x15171c, glow: 0x60d0ff },
    { Ruestung: 0x4a3a2e, Akzent: 0x8a6a2a, Anzug: 0x1c1712, glow: 0xffb060 },
    { Ruestung: 0x2a2e33, Akzent: 0x6a1a1a, Anzug: 0x101114, glow: 0xff6040 },
    { Ruestung: 0x38403a, Akzent: 0x3a6a3a, Anzug: 0x121512, glow: 0x80ff9a },
    { Ruestung: 0x44444c, Akzent: 0x5a2a6a, Anzug: 0x16141a, glow: 0xc080ff }
  ];
  function npc(id, x, z, yaw, palette, opts = {}) {
    const c = createCharacter(assets, { palette, cape: opts.cape || false, emblem: assets.emblem.gold, capeColors: opts.capeColors, scale: opts.scale });
    c.root.position.set(x, 0, z);
    c.root.rotation.y = yaw;
    b.group.add(c.root);
    const entry = { id, char: c, x, z, yaw, path: opts.path || null, pathIndex: 0, speed: opts.speed || 1.3, wait: 0 };
    npcs.push(entry);
    if (opts.talk) {
      const ch = story.characters[id];
      const tag = labelSprite(ch ? ch.name : id, 2.4, opts.quest ? '#ffd27a' : '#dbe8f5');
      tag.position.y = 2.35 * (opts.scale || 1);
      c.root.add(tag);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffb640, fog: false }));
      marker.position.y = 2.75 * (opts.scale || 1);
      marker.visible = false;
      c.root.add(marker);
      entry.marker = marker;
      b.interactables.push({ kind: 'npc', id, pos: new THREE.Vector3(x, 1.6, z), label: ch ? ch.name : id, npc: entry, range: 3.2 });
      b.colliders.push({ t: 'c', x, z, r: 0.45 });
    }
    return entry;
  }
  npc('kommandantin', -27, -8, Math.PI / 2, { Ruestung: 0x1c1f26, Akzent: 0x8a1416, Anzug: 0x0d0e11, Zierkante: 0xc9a050 },
    { talk: true, quest: true, cape: true, capeColors: ['#1a2a4a', '#070b14'] });
  npc('technikerin', 28, -14, -Math.PI / 2.4, palettes[1], { talk: true });
  npc('archivar', 26, 12, -Math.PI / 2, palettes[4], { talk: true });
  npc('pilot', 6, 40, Math.PI, palettes[0], { talk: true });
  npc('kind', -6, 28, Math.PI * 0.8, palettes[3], { talk: true, scale: 0.62 });
  npc('gaertnerin', -18, 23, Math.PI * 0.7, palettes[3], { talk: true });
  npc('aerztin', 16, -11, -Math.PI * 0.2, { Ruestung: 0xd8dde4, Akzent: 0x2a7a9a, Anzug: 0x9aa4b0, glow: 0x80e0ff }, { talk: true });
  npc('haendler', 9, 17, Math.PI * 1.1, palettes[1], { talk: true });
  npc('musikerin', -10, -26, Math.PI * 0.1, palettes[4], { talk: true, cape: true, capeColors: ['#3a2a5a', '#120a1e'] });
  npc('wache', 19, 28, Math.PI * 1.2, { Ruestung: 0x2a2e36, Akzent: 0x8a6a2a, Anzug: 0x101114 }, { talk: true, cape: true, capeColors: ['#5a1a1a', '#1a0505'] });
  const walkPaths = [
    [[-10, -12], [10, -12], [10, 8], [-10, 8]], [[-24, 18], [-6, 36], [12, 24]], [[18, -20], [24, 0], [16, 20], [4, 10]],
    [[-18, -26], [-30, 16], [-16, 0]], [[0, -34], [18, -30], [8, -16]], [[-4, 38], [10, 34], [20, 28], [4, 22]]
  ];
  walkPaths.forEach((p, i) => npc('passant' + i, p[0][0], p[0][1], 0, palettes[i % palettes.length], { path: p, speed: 1.1 + (i % 3) * 0.25, cape: i % 2 === 0, capeColors: ['#2a2a30', '#0d0d10'] }));

  b.updaters.push((dt) => {
    npcs.forEach((n) => {
      let speed = 0;
      if (n.path) {
        if (n.wait > 0) { n.wait -= dt; }
        else {
          const [tx, tz] = n.path[n.pathIndex];
          const dx = tx - n.x, dz = tz - n.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) { n.pathIndex = (n.pathIndex + 1) % n.path.length; n.wait = 1 + Math.random() * 3; }
          else {
            n.x += dx / d * n.speed * dt; n.z += dz / d * n.speed * dt;
            const target = Math.atan2(dx, dz);
            let diff = target - n.yaw;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            n.yaw += diff * Math.min(1, dt * 5);
            speed = n.speed;
          }
        }
        n.char.root.position.set(n.x, 0, n.z);
        n.char.root.rotation.y = n.yaw;
      }
      n.char.update(dt, speed, true);
      if (n.marker && n.marker.visible) n.marker.rotation.y += dt * 2;
    });
  });

  // --- Wahrzeichen (Erkunden) und Kristalle
  Object.entries(HUB.landmarks).forEach(([id, p]) => {
    const lm = story.landmarks.find((l) => l.id === id);
    b.interactables.push({ kind: 'landmark', id, pos: new THREE.Vector3(p.x, 1.5, p.z), label: lm ? lm.title : id, range: 7, auto: true });
  });
  const questItems = {};
  const crystals = HUB.crystals.map(([x, z], i) => makeCrystal(b, story.crystals[i] ? story.crystals[i].id : 'kr' + i, x, z));

  return {
    kind: 'hub', group: b.group, colliders: b.colliders, blockers: b.blockers, interactables: b.interactables,
    npcs, crystals, radius: R, start: HUB.start,
    env: assets.env.sunset, envIntensity: 0.55,
    fog: new THREE.FogExp2(0x3a2a3a, quality === 'niedrig' ? 0.0028 : 0.0022),
    update(dt, t) { b.updaters.forEach((u) => u(dt, t)); },
    setMarkers(map) {
      npcs.forEach((n) => {
        if (!n.marker) return;
        const c = map[n.id];
        n.marker.visible = !!c;
        if (c) n.marker.material.color.setHex(c);
      });
    },
    spawnQuestItem(id, label, x, z) {
      if (questItems[id]) return questItems[id];
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.7, roughness: 0.3, emissive: 0x3fa0ff, emissiveIntensity: 0.6 }));
      boxM.position.y = 0.2;
      g.add(boxM);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.y = 2.2;
      g.add(beam);
      const tag = labelSprite(label, 1.8, '#bfe6ff');
      tag.position.y = 1.0;
      g.add(tag);
      b.group.add(g);
      const item = { kind: 'questitem', id, label, pos: new THREE.Vector3(x, 0.6, z), obj: g, range: 2.2 };
      b.interactables.push(item);
      questItems[id] = item;
      return item;
    },
    removeQuestItem(id) {
      const it = questItems[id];
      if (!it) return;
      b.group.remove(it.obj);
      const i = b.interactables.indexOf(it);
      if (i >= 0) b.interactables.splice(i, 1);
      delete questItems[id];
    },
    mapShapes() {
      return {
        circle: R,
        boxes: b.colliders.filter((c) => c.t === 'b'),
        dots: b.colliders.filter((c) => c.t === 'c' && c.r > 1)
      };
    }
  };
}

// --------------------------------------------------------------------- Archivsektor

/** Verteilt n Erinnerungen auf drei Kammern, abwechselnd an beiden Seitenwaenden. */
export function sectorLayout(n) {
  const { HL, HW, partitions } = SECTOR;
  const rooms = [[-HL + 7, partitions[0] - 4], [partitions[0] + 4, partitions[1] - 4], [partitions[1] + 4, HL - 9]];
  const per = [Math.ceil(n / 3), Math.ceil((n - Math.ceil(n / 3)) / 2)];
  per.push(n - per[0] - per[1]);
  const out = [];
  rooms.forEach(([x0, x1], r) => {
    const k = per[r];
    for (let i = 0; i < k; i++) {
      const t = k > 1 ? i / (k - 1) : 0.5;
      out.push({ x: x0 + (x1 - x0) * t, z: (out.length % 2 === 0 ? -1 : 1) * (HW - 2.6) });
    }
  });
  return out;
}

export function artifactLayout(n) {
  const { HL, HW, partitions } = SECTOR;
  const spots = [
    { x: partitions[0] - 1.6, z: HW - 1.4 }, { x: partitions[0] + 1.6, z: -(HW - 1.4) },
    { x: partitions[1] - 1.6, z: -(HW - 1.4) }, { x: partitions[1] + 1.6, z: HW - 1.4 },
    { x: -HL + 2, z: HW - 1.6 }, { x: HL - 3, z: HW - 1.6 }
  ];
  return spots.slice(0, n);
}

export function buildSector(assets, chapter, quality) {
  const b = new Builder();
  const { HL, HW, WH, PORTAL_X, partitions, door } = SECTOR;
  const theme = chapter.theme || {};
  const tc = theme.torch || [0.4, 0.8, 1.0];
  const accent = new THREE.Color().setRGB(tc[0], tc[1], tc[2]);
  const accentHex = '#' + accent.getHexString();
  const sky = createSky(assets, 'sector', quality);
  b.group.add(sky.group);
  b.updaters.push((dt, t) => sky.update(dt, t));

  // Boden mit leuchtendem Raster
  const gridTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.globalAlpha = 0.9;
    g.strokeRect(0, 0, w, h);
    g.globalAlpha = 0.25; g.lineWidth = 1;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  }, false);
  gridTex.repeat.set(HL, HW);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.8, roughness: 0.25, emissive: accent, emissiveMap: gridTex, emissiveIntensity: 0.35, normalMap: assets.normals.metal });
  b.box(0, -0.3, 0, HL * 2, 0.6, HW * 2, floorMat, { shadow: false });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1d25, metalness: 0.75, roughness: 0.4, normalMap: assets.normals.panels });
  const stripMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.5 });
  [-1, 1].forEach((s) => {
    b.box(0, WH / 2, s * (HW + 0.3), HL * 2, WH, 0.6, wallMat, { collide: true, block: true });
    b.box(s * (HL + 0.3), WH / 2, 0, 0.6, WH, HW * 2 + 1.2, wallMat, { collide: true, block: true });
    b.box(0, 0.25, s * (HW - 0.05), HL * 2, 0.06, 0.08, stripMat, { shadow: false });
    b.box(0, WH - 0.4, s * (HW - 0.05), HL * 2, 0.06, 0.08, stripMat, { shadow: false });
  });
  // Trennwaende zwischen den Kammern mit Durchgang in der Mitte
  partitions.forEach((px) => {
    const seg = HW - door;
    [-1, 1].forEach((s) => {
      b.box(px, WH / 2, s * (door + seg / 2), 0.8, WH, seg, wallMat, { collide: true, block: true });
      b.box(px - 0.42, WH / 2, s * (door + 0.1), 0.06, WH * 0.85, 0.12, stripMat, { shadow: false });
      b.box(px + 0.42, WH / 2, s * (door + 0.1), 0.06, WH * 0.85, 0.12, stripMat, { shadow: false });
    });
    b.box(px, WH - 1, 0, 0.8, 2, door * 2, wallMat, { block: true });
  });
  // Saeulen mit Lichtband (zwischen Mittelweg und Terminals)
  const colMat = new THREE.MeshStandardMaterial({ color: 0x23262f, metalness: 0.85, roughness: 0.3 });
  const round = theme.columnShape !== 'eckig';
  for (let cx = -HL + 5; cx <= HL - 5; cx += 7.5) {
    if (partitions.some((p) => Math.abs(cx - p) < 2.5)) continue;
    [-1, 1].forEach((s) => {
      const cz = s * 5.4;
      if (round) b.cyl(cx, WH / 2, cz, 0.4, 0.4, WH, colMat, { collide: true });
      else b.box(cx, WH / 2, cz, 0.7, WH, 0.7, colMat, { collide: true });
      b.box(cx, WH / 2, cz - s * (round ? 0.39 : 0.36), 0.08, WH * 0.8, 0.04, stripMat, { shadow: false });
    });
  }
  // Lichter (zwei je Kammer)
  [-34, -22, -6, 6, 22, 34].forEach((x) => b.light(x, 5.5, 0, accent, 25, 18));
  b.group.add(new THREE.HemisphereLight(0x8090c0, 0x101015, 0.6));
  const moon = new THREE.DirectionalLight(0xb0c8ff, 1.2);
  moon.position.set(-30, 50, 30);
  moon.castShadow = quality !== 'niedrig';
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 160 });
  b.group.add(moon, moon.target);

  // Holografisches Monument in der mittleren Kammer
  const holoMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
  const holo = new THREE.Group();
  function holoBox(x, y, z, sx, sy, sz, geo) {
    const g = geo || new THREE.BoxGeometry(sx, sy, sz);
    const m = new THREE.Mesh(g, holoMat);
    m.position.set(x, y, z);
    holo.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), edgeMat);
    e.position.set(x, y, z);
    holo.add(e);
  }
  const M = theme.monument || 'keiner';
  if (M === 'feuer') { for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; holoBox(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4, 0.5, 0.4, 0.5); } holoBox(0, 0.9, 0, 0, 0, 0, new THREE.ConeGeometry(0.6, 1.6, 6)); b.colliders.push({ t: 'c', x: 0, z: 0, r: 1.7 }); }
  else if (M === 'obelisk') { holoBox(0, 0.3, 0, 2.2, 0.6, 2.2); holoBox(0, 3.3, 0, 0.9, 5.4, 0.9); holoBox(0, 6.3, 0, 0, 0, 0, new THREE.ConeGeometry(0.5, 0.8, 4)); b.colliders.push({ t: 'b', x0: -1.1, x1: 1.1, z0: -1.1, z1: 1.1 }); }
  else if (M === 'zikkurat') { holoBox(0, 0.5, 0, 3.2, 1, 3.2); holoBox(0, 1.5, 0, 2.3, 1, 2.3); holoBox(0, 2.5, 0, 1.4, 1, 1.4); b.colliders.push({ t: 'b', x0: -1.6, x1: 1.6, z0: -1.6, z1: 1.6 }); }
  else if (M === 'kugel') { holoBox(0, 0.6, 0, 0, 0, 0, new THREE.CylinderGeometry(0.8, 0.8, 1.2, 12)); holoBox(0, 2.3, 0, 0, 0, 0, new THREE.IcosahedronGeometry(1.1, 2)); b.colliders.push({ t: 'c', x: 0, z: 0, r: 1.1 }); }
  else if (M === 'bogen') { holoBox(0, 2, -1.5, 0.6, 4, 0.6); holoBox(0, 2, 1.5, 0.6, 4, 0.6); holoBox(0, 4.3, 0, 0.8, 0.6, 3.8); b.colliders.push({ t: 'b', x0: -0.3, x1: 0.3, z0: -1.8, z1: -1.2 }, { t: 'b', x0: -0.3, x1: 0.3, z0: 1.2, z1: 1.8 }); }
  else if (M === 'turm') { [-1.1, 1.1].forEach((px) => [-1.1, 1.1].forEach((pz) => { holoBox(px, 3, pz, 0.24, 6, 0.24); b.colliders.push({ t: 'b', x0: px - 0.12, x1: px + 0.12, z0: pz - 0.12, z1: pz + 0.12 }); })); [1.5, 3.3, 5.1].forEach((py) => holoBox(0, py, 0, 2.44, 0.14, 2.44)); }
  b.group.add(holo);
  b.updaters.push((dt, t) => { holo.rotation.y += dt * 0.15; holoMat.opacity = 0.14 + Math.sin(t * 3) * 0.04; });

  // Inschrift an der Stirnwand
  const insTex = canvasTex(2048, 400, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = accentHex; g.shadowBlur = 24;
    g.fillStyle = '#eaf6ff';
    let size = 120;
    const title = (chapter.number + '. ' + chapter.title).toUpperCase();
    do { g.font = `700 ${size}px "Rajdhani", "Exo 2", Arial, sans-serif`; size -= 6; } while (g.measureText(title).width > w * 0.94 && size > 40);
    g.fillText(title, w / 2, h * 0.38);
    g.font = '500 64px "Rajdhani", "Exo 2", Arial, sans-serif';
    g.fillStyle = accentHex;
    g.fillText(chapter.era, w / 2, h * 0.75);
  });
  insTex.wrapS = insTex.wrapT = THREE.ClampToEdgeWrapping;
  const ins = new THREE.Mesh(new THREE.PlaneGeometry(16, 16 * 400 / 2048), new THREE.MeshBasicMaterial({ map: insTex, transparent: true, depthWrite: false }));
  ins.position.set(HL - 0.05, 6.2, 0);
  ins.rotation.y = -Math.PI / 2;
  b.group.add(ins);

  // Datenterminals (Erinnerungen); zwei davon sind verrauscht
  const points = [];
  const n = chapter.infoPoints.length;
  const layout = sectorLayout(n);
  const noisyIdx = n >= 6 ? [Math.floor(n * 0.3), Math.floor(n * 0.7)] : [];
  chapter.infoPoints.forEach((entry, idx) => {
    const loc = layout[idx];
    const g = new THREE.Group();
    g.position.set(loc.x, 0, loc.z);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x1b1e26, metalness: 0.85, roughness: 0.3 }));
    ped.position.y = 0.5; ped.castShadow = true;
    g.add(ped);
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const ringObj = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 48), ringM);
    ringObj.rotation.x = Math.PI / 2; ringObj.position.y = 1.02;
    g.add(ringObj);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.92 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), coreMat);
    core.position.y = 1.45; core.scale.y = 1.5;
    g.add(core);
    const noise = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshBasicMaterial({ color: 0xff3355, wireframe: true, transparent: true, opacity: 0.55 }));
    noise.position.y = 1.45;
    noise.visible = false;
    g.add(noise);
    const pl = new THREE.PointLight(0xffffff, 8, 6, 2);
    pl.position.y = 1.8;
    g.add(pl);
    const label = labelSprite(entry.title, 2.2);
    label.position.y = 2.35;
    g.add(label);
    b.group.add(g);
    b.colliders.push({ t: 'c', x: loc.x, z: loc.z, r: 0.48 });
    const item = { kind: 'memory', id: entry.id, label: entry.title, pos: new THREE.Vector3(loc.x, 1.45, loc.z), core, coreMat, ringM, light: pl, noiseObj: noise,
      noisy: noisyIdx.includes(idx), discovered: false, focused: false, phase: idx * 1.3 };
    b.interactables.push(item);
    points.push(item);
  });
  b.updaters.push((dt, t) => {
    points.forEach((p) => {
      p.core.rotation.y += dt * 1.2;
      p.core.position.y = 1.45 + Math.sin(t * 1.8 + p.phase) * 0.06;
      p.core.scale.setScalar((p.focused ? 1.3 : 1));
      p.core.scale.y *= 1.5;
      if (p.noiseObj.visible) { p.noiseObj.rotation.y += dt * 3; p.noiseObj.rotation.x += dt * 2.1; p.noiseObj.scale.setScalar(1 + Math.sin(t * 17 + p.phase) * 0.08); }
    });
  });

  // Artefakte (versteckte Fundstuecke in den Ecken)
  const artifacts = [];
  artifactLayout((chapter.artifacts || []).length).forEach((loc, i) => {
    const a = chapter.artifacts[i];
    const g = new THREE.Group();
    g.position.set(loc.x, 0, loc.z);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8c070, emissive: 0xc08020, emissiveIntensity: 1.6, metalness: 0.8, roughness: 0.25 });
    const gem = new THREE.Mesh(new THREE.TorusKnotGeometry(0.16, 0.05, 64, 8), mat);
    gem.position.y = 0.9;
    g.add(gem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x1c2230, metalness: 0.8, roughness: 0.3 }));
    base.position.y = 0.05;
    g.add(base);
    b.group.add(g);
    const item = { kind: 'artifact', id: a.id, label: a.title, pos: new THREE.Vector3(loc.x, 0.9, loc.z), obj: g, range: 2.4, collected: false };
    item.setCollected = (c) => { item.collected = c; g.visible = !c; };
    b.updaters.push((dt, t) => { gem.rotation.y += dt * 1.5; gem.position.y = 0.9 + Math.sin(t * 2 + i) * 0.06; });
    b.interactables.push(item);
    artifacts.push(item);
  });

  // Zeitzeugen-Echo (Hologramm einer Person)
  let echo = null;
  if (chapter.echo) {
    const c = createCharacter(assets, { cape: false });
    const hmat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    c.model.traverse((o) => { if (o.isMesh) { o.material = hmat; o.castShadow = false; } });
    c.root.position.set(SECTOR.echo.x, 0, SECTOR.echo.z);
    c.root.rotation.y = -Math.PI / 2;
    b.group.add(c.root);
    const tag = labelSprite(chapter.echo.name, 2.6, accentHex);
    tag.position.y = 2.3;
    c.root.add(tag);
    b.updaters.push((dt, t) => { c.update(dt, 0, true); hmat.opacity = 0.35 + Math.sin(t * 6) * 0.08 + (Math.random() < 0.02 ? -0.2 : 0); });
    b.colliders.push({ t: 'c', x: SECTOR.echo.x, z: SECTOR.echo.z, r: 0.45 });
    echo = { kind: 'echo', id: 'echo_' + chapter.id, label: chapter.echo.name, pos: new THREE.Vector3(SECTOR.echo.x, 1.6, SECTOR.echo.z), range: 3.2, char: c };
    b.interactables.push(echo);
  }

  // Wissensterminal vor dem Sektortor
  const qt = new THREE.Group();
  qt.position.set(SECTOR.quiz.x, 0, SECTOR.quiz.z);
  const qBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x1d2230, metalness: 0.85, roughness: 0.3 }));
  qBase.position.y = 0.55;
  qt.add(qBase);
  const qScreenMat = new THREE.MeshBasicMaterial({ color: 0xffb640, transparent: true, opacity: 0.8 });
  const qScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), qScreenMat);
  qScreen.position.set(0, 1.55, 0.2);
  qScreen.rotation.x = -0.35;
  qt.add(qScreen);
  const qTag = labelSprite('Wissensterminal', 2.2, '#ffd27a');
  qTag.position.y = 2.4;
  qt.add(qTag);
  b.group.add(qt);
  b.colliders.push({ t: 'b', x0: SECTOR.quiz.x - 0.6, x1: SECTOR.quiz.x + 0.6, z0: SECTOR.quiz.z - 0.35, z1: SECTOR.quiz.z + 0.35 });
  const quizItem = { kind: 'quiz', id: 'quiz_' + chapter.id, label: 'Wissensterminal', pos: new THREE.Vector3(SECTOR.quiz.x, 1.4, SECTOR.quiz.z), range: 3.0, passed: false };
  quizItem.setPassed = (p) => { quizItem.passed = p; qScreenMat.color.setHex(p ? 0x55d0ff : 0xffb640); };
  b.interactables.push(quizItem);

  // Sektortor (Rueckweg)
  const portal = new THREE.Group();
  portal.position.set(PORTAL_X, 0, 0);
  portal.rotation.y = Math.PI / 2;
  const pRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.28, 12, 64), new THREE.MeshStandardMaterial({ color: 0x30333d, metalness: 0.9, roughness: 0.25 }));
  pRing.position.y = 2.5;
  portal.add(pRing);
  const fieldMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const field = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), fieldMat);
  field.position.y = 2.5;
  portal.add(field);
  const portalLight = new THREE.PointLight(0xff3a2a, 30, 10, 2);
  portalLight.position.set(0, 2.5, 1.2);
  portal.add(portalLight);
  b.group.add(portal);
  b.colliders.push({ t: 'b', x0: PORTAL_X - 0.4, x1: HL, z0: -2.6, z1: 2.6 });
  const portalItem = { kind: 'portal', id: 'sektortor', pos: new THREE.Vector3(PORTAL_X, 2, 0), label: 'Sektortor', open: false, range: 4 };
  portalItem.setOpen = (open) => {
    portalItem.open = open;
    const c = open ? 0x55d0ff : 0xff3a2a;
    fieldMat.color.setHex(c);
    portalLight.color.setHex(c);
    fieldMat.opacity = open ? 0.6 : 0.4;
  };
  b.interactables.push(portalItem);
  b.updaters.push((dt, t) => { pRing.rotation.z += dt * (portalItem.open ? 0.8 : 0.15); });

  return {
    kind: 'sector', chapterId: chapter.id, group: b.group, colliders: b.colliders, blockers: b.blockers, interactables: b.interactables,
    points, artifacts, echo, quiz: quizItem, portal: portalItem, start: SECTOR.start,
    bounds: { x: HL, z: HW },
    env: assets.env.night, envIntensity: 0.6,
    fog: new THREE.FogExp2(0x060810, 0.008),
    update(dt, t) { b.updaters.forEach((u) => u(dt, t)); },
    setMemoryState(item, discovered, focused, noisy) {
      item.discovered = discovered;
      item.focused = focused;
      item.noiseObj.visible = !!noisy;
      const c = noisy ? 0xff3355 : (discovered ? 0x55d0ff : 0xffb640);
      item.coreMat.color.setHex(c);
      item.coreMat.emissive.setHex(c);
      item.ringM.color.setHex(c);
      item.light.color.setHex(c);
      item.light.intensity = focused ? 18 : 8;
    },
    mapShapes() {
      return { rect: { x: HL, z: HW }, boxes: b.colliders.filter((c) => c.t === 'b'), dots: b.colliders.filter((c) => c.t === 'c' && c.r > 1) };
    }
  };
}

export function disposeWorld(world) {
  world.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        ['map', 'emissiveMap'].forEach((k) => { if (m[k] && m[k].isCanvasTexture) m[k].dispose(); });
        m.dispose();
      });
    }
    if (o.isReflector && o.getRenderTarget) o.getRenderTarget().dispose();
  });
}

export { clamp };
