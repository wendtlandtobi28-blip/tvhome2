// Himmel, Gasriese "Tethys", Ringstadt und Schiffsverkehr (Fernkulisse der Station).
import * as THREE from 'three';
import { rng } from './util.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
  col = mix(col, uZenith, smoothstep(0.15, 0.75, h));
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.2, h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 6.0) * 0.55 + pow(s, 64.0) * 1.6 + pow(s, 900.0) * 30.0);
  // Sterne im oberen Himmel
  vec3 g = floor(d * 420.0);
  float star = step(0.9965, hash(g)) * smoothstep(0.25, 0.7, h);
  col += vec3(star) * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PLANET_FRAG = `
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vPos;
varying vec3 vViewDir;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(vec3 x) {
  vec3 p = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
             mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; } return v; }
void main() {
  vec3 n = normalize(vNormalW);
  float lat = vPos.y;
  float warp = fbm(vec3(vPos.x * 2.0, lat * 9.0, vPos.z * 2.0 + uTime * 0.01)) * 0.35;
  float bands = sin((lat + warp) * 24.0) * 0.5 + 0.5;
  vec3 c1 = vec3(0.86, 0.62, 0.44);
  vec3 c2 = vec3(0.52, 0.36, 0.30);
  vec3 c3 = vec3(0.93, 0.83, 0.70);
  vec3 base = mix(c2, c1, bands);
  base = mix(base, c3, smoothstep(0.62, 0.9, fbm(vec3(vPos * 6.0))) * 0.5);
  float storm = smoothstep(0.08, 0.0, length(vec2(vPos.x - 0.35, (lat + 0.22) * 1.6)) - 0.02);
  base = mix(base, vec3(0.75, 0.4, 0.3), storm * 0.7);
  float light = clamp(dot(n, normalize(uSunDir)) * 1.15 + 0.08, 0.0, 1.0);
  vec3 col = base * light;
  float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 3.0);
  col += vec3(1.0, 0.62, 0.45) * rim * 0.65 * (0.35 + light);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PLANET_VERT = `
varying vec3 vNormalW;
varying vec3 vPos;
varying vec3 vViewDir;
void main() {
  vPos = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vViewDir = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

function windowTexture(seed, lit, warm) {
  const r = rng(seed);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#07080c';
  g.fillRect(0, 0, 128, 512);
  for (let y = 4; y < 512; y += 10) {
    for (let x = 4; x < 128; x += 8) {
      if (r() < lit) {
        const w = warm && r() < 0.7;
        const b = 0.5 + r() * 0.5;
        g.fillStyle = w ? `rgba(255,${170 + r() * 50 | 0},${90 + r() * 50 | 0},${b})` : `rgba(${120 + r() * 60 | 0},${190 + r() * 40 | 0},255,${b})`;
        g.fillRect(x, y, 5, 5);
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Baut die Fernkulisse. mode: 'hub' (Sonnenuntergang ueber der Ringstadt) oder 'sector' (Archiv bei Nacht).
 * Liefert { group, sunDir, update(dt, time) }.
 */
export function createSky(assets, mode, quality) {
  const group = new THREE.Group();
  const sunDir = mode === 'hub' ? new THREE.Vector3(0.62, 0.11, 0.78).normalize() : new THREE.Vector3(-0.3, 0.5, 0.8).normalize();
  const colors = mode === 'hub'
    ? { zenith: new THREE.Color(0.07, 0.07, 0.18), mid: new THREE.Color(0.32, 0.22, 0.38), horizon: new THREE.Color(1.0, 0.56, 0.36), sun: new THREE.Color(1.0, 0.62, 0.35) }
    : { zenith: new THREE.Color(0.01, 0.015, 0.04), mid: new THREE.Color(0.03, 0.05, 0.1), horizon: new THREE.Color(0.08, 0.12, 0.2), sun: new THREE.Color(0.4, 0.6, 1.0) };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
      uniforms: { uSunDir: { value: sunDir }, uZenith: { value: colors.zenith }, uMid: { value: colors.mid }, uHorizon: { value: colors.horizon }, uSunColor: { value: colors.sun } }
    })
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  const updaters = [];

  // --- Gasriese Tethys mit Ring
  const planetMat = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG,
    // eigene Lichtrichtung: beleuchtete Seite zeigt zur Station, Schattengrenze rechts
    uniforms: { uSunDir: { value: new THREE.Vector3(-0.55, 0.3, -0.78).normalize() }, uTime: { value: 0 } }
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), planetMat);
  const pr = mode === 'hub' ? 470 : 300;
  planet.scale.setScalar(pr);
  planet.position.set(mode === 'hub' ? 120 : -300, mode === 'hub' ? 560 : 420, 980);
  planet.rotation.z = 0.32;
  group.add(planet);
  const ringCv = document.createElement('canvas');
  ringCv.width = 512; ringCv.height = 4;
  const rg = ringCv.getContext('2d');
  const grad = rg.createLinearGradient(0, 0, 512, 0);
  [[0, 0], [0.08, 0.35], [0.2, 0.15], [0.32, 0.5], [0.46, 0.25], [0.6, 0.55], [0.75, 0.1], [0.86, 0.35], [1, 0]].forEach(([p, a]) => grad.addColorStop(p, `rgba(240,205,170,${a})`));
  rg.fillStyle = grad;
  rg.fillRect(0, 0, 512, 4);
  const ringTex = new THREE.CanvasTexture(ringCv);
  ringTex.colorSpace = THREE.SRGBColorSpace;
  const ringGeo = new THREE.RingGeometry(1.35, 2.35, 128, 1);
  const pos = ringGeo.attributes.position;
  const uv = ringGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const l = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (l - 1.35) / 1.0, 0.5);
  }
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  ring.position.copy(planet.position);
  ring.scale.setScalar(pr);
  ring.rotation.set(Math.PI / 2 - 0.28, 0.12, 0.32);
  group.add(ring);
  updaters.push((dt, t) => { planetMat.uniforms.uTime.value = t; });

  // --- Ringstadt mit Tuermen (nur Station)
  if (mode === 'hub') {
    const r = rng(42);
    const towerTexA = windowTexture(1, 0.35, true);
    const towerTexB = windowTexture(2, 0.22, false);
    const matA = new THREE.MeshStandardMaterial({ color: 0x1a1c24, metalness: 0.7, roughness: 0.45, emissive: 0xffffff, emissiveMap: towerTexA, emissiveIntensity: 1.4 });
    const matB = new THREE.MeshStandardMaterial({ color: 0x14161d, metalness: 0.7, roughness: 0.45, emissive: 0xffffff, emissiveMap: towerTexB, emissiveIntensity: 1.2 });
    const count = quality === 'niedrig' ? 90 : 170;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0);
    const instA = new THREE.InstancedMesh(boxGeo, matA, count);
    const instB = new THREE.InstancedMesh(boxGeo, matB, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count * 2; i++) {
      const ang = r() * Math.PI * 1.3 - Math.PI * 0.15; // vor allem in Blickrichtung (+Z)
      const dist = 230 + r() * 560;
      const x = Math.sin(ang) * dist * 1.3;
      const z = Math.cos(ang) * dist + 60;
      let h = 20 + Math.pow(r(), 2.4) * (dist > 450 ? 230 : 120);
      if (Math.abs(ang) < 0.5) h *= 0.55; // Blick auf Tethys frei halten
      const w = 8 + r() * 18;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      m4.compose(new THREE.Vector3(x, -60, z), q, new THREE.Vector3(w, h + 60, w * (0.6 + r() * 0.8)));
      (i % 2 ? instB : instA).setMatrixAt(i >> 1, m4);
    }
    group.add(instA, instB);

    // Zentrale Megastruktur mit Spitzen und Ringen (wie eine Kathedrale der Station)
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x20222b, metalness: 0.8, roughness: 0.35, emissive: 0xffffff, emissiveMap: windowTexture(3, 0.4, true), emissiveIntensity: 1.6 });
    const core = new THREE.Group();
    core.position.set(-160, -60, 520);
    const spires = [[0, 380, 30], [-38, 260, 18], [40, 290, 20], [-70, 190, 14], [75, 210, 15], [-110, 140, 12], [115, 150, 12], [0, 230, 40]];
    spires.forEach(([sx, h, w]) => {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w, h, 8), spireMat);
      body.position.set(sx, h / 2, 0);
      core.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.35, h * 0.35, 8), spireMat);
      tip.position.set(sx, h + h * 0.175, 0);
      core.add(tip);
    });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x2b2d36, metalness: 0.85, roughness: 0.3, emissive: 0xff9a55, emissiveIntensity: 0.25 });
    const rings = [];
    [[150, 120, 3.5], [200, 180, 3], [120, 250, 2.5]].forEach(([rad, y, tube], i) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 96), ringMat);
      t.position.set(0, y, 0);
      t.rotation.x = Math.PI / 2 + (i - 1) * 0.12;
      t.rotation.y = (i - 1) * 0.2;
      core.add(t);
      rings.push(t);
    });
    group.add(core);
    updaters.push((dt) => { rings.forEach((t, i) => { t.rotation.z += dt * 0.02 * (i % 2 ? -1 : 1); }); });

    // Kreuzer und Shuttles
    const cruiser = assets.cruiser.scene.clone(true);
    cruiser.scale.setScalar(2.2);
    group.add(cruiser);
    const cruiser2 = assets.cruiser.scene.clone(true);
    cruiser2.scale.setScalar(1.4);
    group.add(cruiser2);
    updaters.push((dt, t) => {
      const a = t * 0.012;
      cruiser.position.set(Math.sin(a) * 300 + 120, 150 + Math.sin(t * 0.1) * 4, Math.cos(a) * 140 + 360);
      cruiser.rotation.y = a + Math.PI / 2;
      const b = -t * 0.018 + 2;
      cruiser2.position.set(Math.sin(b) * 420 - 80, 95, Math.cos(b) * 200 + 520);
      cruiser2.rotation.y = b - Math.PI / 2;
    });
    const shuttles = [];
    for (let i = 0; i < 7; i++) {
      const s = assets.shuttle.scene.clone(true);
      s.scale.setScalar(1.6);
      group.add(s);
      shuttles.push({ obj: s, radius: 90 + i * 35, height: 35 + (i % 3) * 22, speed: 0.05 + (i % 4) * 0.018, phase: i * 1.7, cx: (i % 2 ? -40 : 60), cz: 160 + i * 25 });
    }
    updaters.push((dt, t) => {
      shuttles.forEach((s) => {
        const a = t * s.speed + s.phase;
        s.obj.position.set(s.cx + Math.sin(a) * s.radius, s.height + Math.sin(a * 2) * 3, s.cz + Math.cos(a) * s.radius * 0.6);
        s.obj.rotation.y = a + Math.PI;
        s.obj.rotation.z = -0.25;
      });
    });
  }

  return {
    group,
    sunDir,
    update(dt, t) { updaters.forEach((u) => u(dt, t)); }
  };
}
