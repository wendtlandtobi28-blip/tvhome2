// Spielfigur und Nebenfiguren: Blender-Modell mit Gelenken, prozedurale Animation, Umhang mit Emblem.
import * as THREE from 'three';
import { clamp } from './util.js';

const JOINTS = ['Root', 'Pelvis', 'Torso', 'Neck', 'Head', 'Shoulder.L', 'Shoulder.R', 'Elbow.L', 'Elbow.R', 'Hip.L', 'Hip.R', 'Knee.L', 'Knee.R'];

function findNode(root, name) {
  return root.getObjectByName(name) || root.getObjectByName(name.replace(/\./g, '')) || root.getObjectByName(name.replace(/\./g, '_'));
}

function capeTexture(emblemImg, cloth, trim) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 512;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, cloth[0]);
  grad.addColorStop(1, cloth[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  // Webstruktur
  g.globalAlpha = 0.08;
  for (let y = 0; y < 512; y += 3) { g.fillStyle = y % 6 ? '#000' : '#fff'; g.fillRect(0, y, 256, 1); }
  g.globalAlpha = 1;
  g.fillStyle = trim;
  g.fillRect(0, 498, 256, 14);
  g.fillRect(0, 0, 10, 512);
  g.fillRect(246, 0, 10, 512);
  if (emblemImg) { g.globalAlpha = 0.9; g.drawImage(emblemImg, 58, 120, 140, 140); g.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * opts: { palette: {armor, accent, suit, trim}, cape: true/false, capeColors: [top, bottom], emblem: Image, scale }
 */
export function createCharacter(assets, opts = {}) {
  const model = assets.hero.scene.clone(true);
  const palette = opts.palette || {};
  const cloned = new Map();
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const src = o.material;
      if (!cloned.has(src)) {
        const m = src.clone();
        if (palette[src.name] !== undefined) {
          m.color.set(palette[src.name]);
        }
        if (src.name === 'Leuchte' && palette.glow !== undefined) {
          m.emissive.set(palette.glow);
          m.color.set(palette.glow);
        }
        cloned.set(src, m);
      }
      o.material = cloned.get(src);
    }
  });
  const nodes = {};
  JOINTS.forEach((n) => { nodes[n] = findNode(model, n); });
  const rest = {};
  Object.keys(nodes).forEach((k) => { if (nodes[k]) rest[k] = nodes[k].rotation.clone(); });

  const root = new THREE.Group();
  root.add(model);
  if (opts.scale) model.scale.setScalar(opts.scale);

  // Umhang
  let cape = null;
  if (opts.cape !== false && nodes.Torso) {
    const W = 0.62, H = 1.25;
    const geo = new THREE.PlaneGeometry(W, H, 8, 16);
    geo.translate(0, -H / 2, 0);
    const mat = new THREE.MeshStandardMaterial({
      map: capeTexture(opts.emblem, opts.capeColors || ['#7a0f12', '#2a0507'], opts.capeTrim || '#b8893f'),
      side: THREE.DoubleSide, roughness: 0.8, metalness: 0.05
    });
    cape = new THREE.Mesh(geo, mat);
    cape.castShadow = true;
    // Befestigung zwischen den Schultern, hinten (Blickrichtung der Figur ist +Z)
    const holder = new THREE.Group();
    holder.position.set(0, 1.56 - 1.06, -0.27);
    nodes.Torso.add(holder);
    holder.add(cape);
    cape.rotation.y = Math.PI; // Vorderseite (Emblem) nach hinten
    cape.userData.base = Float32Array.from(geo.attributes.position.array);
  }

  let phase = Math.random() * 6;
  let time = Math.random() * 10;
  const state = { speed: 0, grounded: true, talking: false, aim: false };

  function setRot(name, x, y, z) {
    const n = nodes[name];
    if (!n) return;
    const r = rest[name];
    n.rotation.set(r.x + (x || 0), r.y + (y || 0), r.z + (z || 0));
  }

  function update(dt, speed, grounded) {
    time += dt;
    state.speed = speed;
    const move = clamp(speed / 4, 0, 1);
    const run = clamp((speed - 4) / 3.5, 0, 1);
    phase += dt * (2 + speed * 1.55);
    const s = Math.sin(phase);
    const amp = move * (0.55 + run * 0.35);

    if (!grounded) {
      setRot('Hip.L', -0.6, 0, 0); setRot('Hip.R', 0.2, 0, 0);
      setRot('Knee.L', 0.9, 0, 0); setRot('Knee.R', 0.4, 0, 0);
      setRot('Shoulder.L', 0.4, 0, -0.3); setRot('Shoulder.R', 0.4, 0, 0.3);
    } else {
      setRot('Hip.L', -s * amp, 0, 0);
      setRot('Hip.R', s * amp, 0, 0);
      setRot('Knee.L', Math.max(0, Math.sin(phase + 1.3)) * amp * 1.3, 0, 0);
      setRot('Knee.R', Math.max(0, Math.sin(phase + 1.3 + Math.PI)) * amp * 1.3, 0, 0);
      const breathe = Math.sin(time * 1.6) * 0.03 * (1 - move);
      setRot('Shoulder.L', s * amp * 0.8, 0, -0.08 - breathe);
      setRot('Shoulder.R', -s * amp * 0.8, 0, 0.08 + breathe);
    }
    setRot('Elbow.L', -0.25 - move * 0.35 - run * 0.4, 0, 0);
    setRot('Elbow.R', -0.25 - move * 0.35 - run * 0.4, 0, 0);
    // Zielhaltung mit gezogener Waffe: rechter Arm nach vorn
    if (state.aim) {
      setRot('Shoulder.R', -1.45, 0, 0.12);
      setRot('Elbow.R', -0.08, 0, 0);
    }
    setRot('Torso', 0.04 * move + run * 0.12, s * 0.06 * move, 0);
    setRot('Head', -0.04 * move, state.talking ? Math.sin(time * 1.3) * 0.1 : 0, 0);
    if (nodes.Pelvis) {
      nodes.Pelvis.position.y = (rest.pelvisY ?? (rest.pelvisY = nodes.Pelvis.position.y)) + Math.abs(Math.cos(phase)) * 0.045 * move - 0.02 * move
        + Math.sin(time * 1.6) * 0.004;
    }

    // Umhang: haengt nach unten, weht bei Bewegung nach hinten
    if (cape) {
      const p = cape.geometry.attributes.position;
      const base = cape.userData.base;
      const flow = 0.12 + move * 0.35 + run * 0.35 + (grounded ? 0 : 0.3);
      for (let i = 0; i < p.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const v = clamp(-by / 1.25, 0, 1);
        const wave = Math.sin(time * (3 + move * 4) + v * 5 + bx * 3) * 0.035 * v * (0.4 + move);
        const back = Math.pow(v, 1.4) * flow;
        p.setXYZ(i, bx * (1 + v * 0.18), by * (1 - back * 0.25), back + wave + v * 0.05);
      }
      p.needsUpdate = true;
      cape.geometry.computeVertexNormals();
    }
  }

  update(0, 0, true);
  return { root, model, nodes, cape, state, update };
}

/** Steinerne Statue (Denkmal der Gruender) aus dem Figurmodell */
export function createStatue(assets, stoneColor) {
  const c = createCharacter(assets, { cape: false });
  const stone = new THREE.MeshStandardMaterial({ color: stoneColor || 0x5c5953, roughness: 0.85, metalness: 0.1 });
  c.model.traverse((o) => { if (o.isMesh) o.material = stone; });
  // Pose: Speer in der rechten Hand
  if (c.nodes['Shoulder.R']) c.nodes['Shoulder.R'].rotation.x -= 0.5;
  if (c.nodes['Elbow.R']) c.nodes['Elbow.R'].rotation.x -= 0.9;
  if (c.nodes['Head']) c.nodes['Head'].rotation.x -= 0.1;
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.6, 8), stone);
  spear.position.set(-0.31, 1.25, 0.32);
  c.model.add(spear);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 8), stone);
  tip.position.set(-0.31, 2.65, 0.32);
  c.model.add(tip);
  return c.root;
}
