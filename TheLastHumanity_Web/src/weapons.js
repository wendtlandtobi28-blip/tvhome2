// Waffen, Waffenkreuz-Daten, Geschosse, Effekte und Stoersonden (Ziel-Drohnen).
// Leistung: alle Effekte kommen aus festen Vorraeten (keine neuen Lichter/Materialien zur Laufzeit,
// damit keine Shader neu uebersetzt werden muessen -> kein Ruckeln beim Schiessen).
import * as THREE from 'three';

/** Richtung im Waffenkreuz: oben, rechts, unten, links */
export const WEAPONS = [
  { id: 'blaster', dir: 'oben', name: 'Puls-Blaster', desc: 'Zuverlässige Energiepistole mit schnellen Einzelschüssen.',
    dmg: 34, rate: 0.2, mag: 14, reload: 1.3, speed: 70, spread: 0.008, pellets: 1, range: 70, color: 0x5fd8ff },
  { id: 'streuer', dir: 'rechts', name: 'Streukanone', desc: 'Feuert eine breite Ladung. Stark auf kurze Entfernung.',
    dmg: 15, rate: 0.7, mag: 6, reload: 1.9, speed: 55, spread: 0.075, pellets: 8, range: 26, color: 0xffa040 },
  { id: 'lanze', dir: 'unten', name: 'Lichtlanze', desc: 'Durchschlagender Präzisionsstrahl. Trifft alles auf einer Linie.',
    dmg: 120, rate: 1.0, mag: 4, reload: 2.2, beam: true, range: 95, color: 0xc080ff },
  { id: 'klinge', dir: 'links', name: 'Energieklinge', desc: 'Nahkampfklinge. Braucht keine Ladung.',
    dmg: 70, rate: 0.42, melee: true, range: 3.0, arc: 1.3, color: 0x7dffb0 }
];
export const weaponById = (id) => WEAPONS.find((w) => w.id === id) || null;

const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

/** Kleines Waffenmodell fuer die Hand der Spielfigur (Blickrichtung +Z) */
export function weaponModel(w) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.85, roughness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: w.color, emissive: w.color, emissiveIntensity: 1.6, roughness: 0.4 });
  const box = (sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  if (w.id === 'blaster') {
    box(0.07, 0.09, 0.3, 0, 0, 0.1, body); box(0.05, 0.12, 0.06, 0, -0.08, 0, body); box(0.075, 0.025, 0.2, 0, 0.05, 0.1, accent);
  } else if (w.id === 'streuer') {
    box(0.11, 0.11, 0.42, 0, 0, 0.15, body); box(0.06, 0.13, 0.07, 0, -0.09, 0, body);
    box(0.13, 0.04, 0.06, 0, 0.0, 0.37, accent); box(0.115, 0.03, 0.25, 0, 0.065, 0.12, accent);
  } else if (w.id === 'lanze') {
    box(0.08, 0.1, 0.6, 0, 0, 0.22, body); box(0.05, 0.12, 0.06, 0, -0.09, 0, body);
    box(0.03, 0.03, 0.62, 0, 0.07, 0.24, accent); box(0.1, 0.1, 0.05, 0, 0, 0.53, accent);
  } else {
    box(0.04, 0.06, 0.16, 0, 0, 0, body);
    const blade = box(0.02, 0.07, 0.75, 0, 0, 0.45, accent);
    blade.material = glow(w.color, 0.85); blade.castShadow = false;
  }
  return g;
}

/** Stoersonde: schwebende, beschaedigte Ueberwachungsdrohne */
function droneMesh(shared) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x252a35, metalness: 0.8, roughness: 0.35, emissive: 0xff3020, emissiveIntensity: 0 });
  const core = new THREE.Mesh(shared.coreGeo, shell);
  core.castShadow = true;
  g.add(core);
  const ring = new THREE.Mesh(shared.ringGeo, shared.ringMat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const eye = new THREE.Mesh(shared.eyeGeo, shared.eyeMat);
  eye.position.z = 0.36;
  g.add(eye);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(shared.finGeo, shell);
    fin.position.x = s * 0.5;
    g.add(fin);
  }
  return { group: g, shell, ring };
}

export function createCombat(scene) {
  const shared = {
    coreGeo: new THREE.IcosahedronGeometry(0.38, 1),
    ringGeo: new THREE.TorusGeometry(0.52, 0.035, 6, 32),
    ringMat: glow(0xff5038, 0.9),
    eyeGeo: new THREE.SphereGeometry(0.1, 12, 8),
    eyeMat: new THREE.MeshBasicMaterial({ color: 0xff6040 }),
    finGeo: new THREE.BoxGeometry(0.32, 0.05, 0.22)
  };
  // ---- Vorraete
  const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6, 1, true).rotateX(Math.PI / 2);
  const bolts = [];
  const boltMats = {};
  WEAPONS.forEach((w) => { boltMats[w.id] = glow(w.color, 0.95); });
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(boltGeo, boltMats.blaster);
    m.visible = false; m.frustumCulled = false; scene.add(m);
    bolts.push({ mesh: m, live: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(), speed: 0, left: 0, dmg: 0 });
  }
  const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const sparkMat = glow(0xffd080, 1);
  const sparks = [];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false; m.frustumCulled = false; scene.add(m);
    sparks.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
  }
  const beamMat = glow(0xc080ff, 0.9);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), beamMat);
  beam.visible = false; beam.frustumCulled = false; scene.add(beam);
  let beamLife = 0;
  const slashMat = glow(0x7dffb0, 0.8);
  const slash = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 4, 24, 2.4), slashMat);
  slash.visible = false; slash.frustumCulled = false; scene.add(slash);
  let slashLife = 0;
  const flashMat = glow(0xffffff, 0.9);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flashMat);
  flash.visible = false; flash.frustumCulled = false; scene.add(flash);
  let flashLife = 0;

  const drones = [];
  let group = null;

  function burst(p, color, n = 14, power = 5) {
    let made = 0;
    for (const s of sparks) {
      if (s.life > 0) continue;
      s.life = 0.35 + Math.random() * 0.35;
      s.mesh.position.copy(p);
      s.vel.set(Math.random() - 0.5, Math.random() * 0.8 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(power * (0.4 + Math.random()));
      s.mesh.visible = true;
      if (++made >= n) break;
    }
    if (color !== undefined) sparkMat.color.setHex(color);
  }

  return {
    drones,
    /** Sonden fuer eine neue Welt anlegen (alte werden entfernt) */
    spawn(worldGroup, spots, opts = {}) {
      drones.forEach((d) => { if (d.mesh.group.parent) d.mesh.group.parent.remove(d.mesh.group); d.mesh.shell.dispose(); });
      drones.length = 0;
      group = worldGroup;
      spots.forEach((s, i) => {
        const mesh = droneMesh(shared);
        mesh.group.position.set(s.x, s.y, s.z);
        worldGroup.add(mesh.group);
        drones.push({ id: i, mesh, home: new THREE.Vector3(s.x, s.y, s.z), pos: mesh.group.position, hp: 100, alive: true, hitT: 0, respawn: opts.respawn || 0, deadT: 0, phase: Math.random() * 6, practice: !!opts.practice });
      });
    },
    aliveCount: () => drones.filter((d) => d.alive).length,
    /** Treffer an einer Sonde */
    damage(d, amount) {
      if (!d.alive) return false;
      d.hp -= amount; d.hitT = 0.12;
      burst(d.pos, 0xffc070, 5, 3);
      if (d.hp <= 0) {
        d.alive = false; d.deadT = 0; d.mesh.group.visible = false;
        burst(d.pos, 0xff7040, 26, 7);
        return true;
      }
      return false;
    },
    /** Erste Sonde auf einer Strecke (Kugeltest), Radius 0.6 */
    firstDroneOnSegment(a, dir, len, r = 0.6) {
      let best = null, bt = len;
      for (const d of drones) {
        if (!d.alive) continue;
        const ox = d.pos.x - a.x, oy = d.pos.y - a.y, oz = d.pos.z - a.z;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > bt) continue;
        const px = ox - dir.x * t, py = oy - dir.y * t, pz = oz - dir.z * t;
        if (px * px + py * py + pz * pz < r * r) { bt = t; best = d; }
      }
      return best ? { drone: best, t: bt } : null;
    },
    allDronesOnSegment(a, dir, len, r = 0.7) {
      const out = [];
      for (const d of drones) {
        if (!d.alive) continue;
        const ox = d.pos.x - a.x, oy = d.pos.y - a.y, oz = d.pos.z - a.z;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > len) continue;
        const px = ox - dir.x * t, py = oy - dir.y * t, pz = oz - dir.z * t;
        if (px * px + py * py + pz * pz < r * r) out.push(d);
      }
      return out;
    },
    bolt(w, from, dir, maxLen, dmg) {
      const b = bolts.find((x) => !x.live);
      if (!b) return;
      b.live = true; b.pos.copy(from); b.dir.copy(dir); b.speed = w.speed; b.left = maxLen; b.dmg = dmg; b.color = w.color;
      b.mesh.material = boltMats[w.id];
      b.mesh.position.copy(from);
      b.mesh.lookAt(from.x + dir.x, from.y + dir.y, from.z + dir.z);
      b.mesh.visible = true;
    },
    muzzle(p, color) { flash.position.copy(p); flashMat.color.setHex(color); flash.visible = true; flashLife = 0.06; },
    beam(from, to) {
      beam.position.copy(from);
      beam.lookAt(to);
      beam.scale.set(1, 1, from.distanceTo(to));
      beam.visible = true; beamLife = 0.22; beamMat.opacity = 0.9;
    },
    slash(p, yaw) {
      slash.position.copy(p);
      slash.rotation.set(Math.PI / 2, 0, -yaw - 1.2 + Math.PI / 2);
      slash.visible = true; slashLife = 0.16;
    },
    spark: burst,
    /** Rueckgabe: Liste zerstoerter Sonden in diesem Bild */
    update(dt, t, player, onKill) {
      for (const b of bolts) {
        if (!b.live) continue;
        const step = Math.min(b.left, b.speed * dt);
        const hit = this.firstDroneOnSegment(b.pos, b.dir, step + 0.2);
        if (hit) {
          b.pos.addScaledVector(b.dir, hit.t);
          if (this.damage(hit.drone, b.dmg)) onKill(hit.drone);
          b.live = false; b.mesh.visible = false; continue;
        }
        b.pos.addScaledVector(b.dir, step);
        b.left -= step;
        b.mesh.position.copy(b.pos);
        if (b.left <= 0.001) { burst(b.pos, b.color, 4, 2.5); b.live = false; b.mesh.visible = false; }
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vel.y -= 9 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.scale.setScalar(Math.max(0.05, s.life * 2.2));
        if (s.life <= 0) s.mesh.visible = false;
      }
      if (beamLife > 0) { beamLife -= dt; beamMat.opacity = Math.max(0, beamLife / 0.22) * 0.9; if (beamLife <= 0) beam.visible = false; }
      if (slashLife > 0) { slashLife -= dt; if (slashLife <= 0) slash.visible = false; }
      if (flashLife > 0) { flashLife -= dt; if (flashLife <= 0) flash.visible = false; }
      for (const d of drones) {
        if (!d.alive) {
          if (d.respawn) { d.deadT += dt; if (d.deadT > d.respawn) { d.alive = true; d.hp = 100; d.pos.copy(d.home); d.mesh.group.visible = true; } }
          continue;
        }
        d.phase += dt;
        d.pos.set(d.home.x + Math.sin(d.phase * 0.5) * 1.6, d.home.y + Math.sin(d.phase * 1.7) * 0.25, d.home.z + Math.cos(d.phase * 0.37) * 1.2);
        const near = Math.hypot(player.x - d.pos.x, player.z - d.pos.z) < 20;
        d.mesh.group.rotation.y = near ? Math.atan2(player.x - d.pos.x, player.z - d.pos.z) : d.phase * 0.4;
        d.mesh.ring.rotation.z = t * 2;
        if (d.hitT > 0) { d.hitT -= dt; d.mesh.shell.emissiveIntensity = 2.5; } else d.mesh.shell.emissiveIntensity = 0;
      }
    }
  };
}

/** Positionen der Stoersonden in einem Sektor (schwebend, ohne Kollision) */
export function sectorDroneSpots(chapterNumber) {
  const n = Math.min(9, 4 + Math.floor((chapterNumber || 1) / 3));
  const xs = [-30, -22, -6, 4, 9, 24, 30, 36, -36];
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: xs[i], y: 2.6 + (i % 3) * 0.7, z: ((i * 37) % 11) / 11 * 10 - 5 });
  return out;
}
/** Uebungsziele auf der Station (kommen nach kurzer Zeit wieder) */
export const HUB_DRONE_SPOTS = [{ x: -8, y: 3.2, z: -32 }, { x: 0, y: 3.8, z: -36 }, { x: 8, y: 3.2, z: -32 }];
