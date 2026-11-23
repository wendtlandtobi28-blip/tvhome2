// THE LAST HUMANITY - Browser-Version 2 (Science-Fiction, dritte Person)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import CONTENT from '../../TheLastHumanity/Content/Data/content_de.json';
import STORY from '../../TheLastHumanity/Content/Data/story_de.json';
import { loadAssets, emblemDataUrl } from './assets.js';
import { createCharacter } from './character.js';
import { buildHub, buildSector, disposeWorld, HUB, SECTOR } from './world.js';
import { clamp, damp, esc, paragraphs, fmt, angleDiff } from './util.js';
import { Audio } from './audio.js';

const T = (key, ...args) => fmt((CONTENT.ui && CONTENT.ui[key]) || key, ...args);
const S = STORY;
const $ = (id) => document.getElementById(id);
const bootEl = $('boot');

function fail(msg) {
  bootEl.hidden = false;
  bootEl.className = 'error';
  bootEl.innerHTML = '<p>' + esc(msg) + '</p>';
}

// ===================================================================== Speicher

const SAVE_KEY = 'tlh.spielstand.v4';
const OLD_SAVE_KEY = 'tlh.spielstand.v3';
const SETTINGS_KEY = 'tlh.einstellungen.v2';
const Store = {
  ok: (() => { try { localStorage.setItem('tlh.t', '1'); localStorage.removeItem('tlh.t'); return true; } catch (e) { return false; } })(),
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  has(k) { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } }
};

const LIMITS = { sensMin: 0.5, sensMax: 6, fovMin: 55, fovMax: 100 };
const DEFAULT_SETTINGS = { sensitivity: 2.5, invertY: false, fov: 70, showHint: true, unlockAll: false, quality: 'hoch', volume: 0.5 };
function sanitizeSettings(s) {
  const out = {};
  for (const k in DEFAULT_SETTINGS) out[k] = (s && typeof s[k] === typeof DEFAULT_SETTINGS[k]) ? s[k] : DEFAULT_SETTINGS[k];
  out.sensitivity = clamp(out.sensitivity, LIMITS.sensMin, LIMITS.sensMax);
  out.fov = clamp(Math.round(out.fov), LIMITS.fovMin, LIMITS.fovMax);
  out.volume = clamp(out.volume, 0, 1);
  if (!['hoch', 'mittel', 'niedrig'].includes(out.quality)) out.quality = 'hoch';
  return out;
}
// Touch-Geraet (Tablet/Handy) erkennen; ?touch=an / ?touch=aus erzwingt es
const touchParam = (location.search.match(/[?&]touch=(an|aus)/) || [])[1];
let touchMode = touchParam ? touchParam === 'an'
  : ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches));
const storedSettings = Store.get(SETTINGS_KEY);
const settings = sanitizeSettings(storedSettings);
// Tablets: beim ersten Start mittlere Grafik (spart Akku, fluessiger)
if (!storedSettings && touchMode) settings.quality = 'mittel';
const urlQuality = (location.search.match(/[?&]grafik=(hoch|mittel|niedrig)/) || [])[1];
if (urlQuality) settings.quality = urlQuality;

// ===================================================================== Fortschritt

const chapters = CONTENT.chapters;
const XP = { memory: 100, crystal: 50, landmark: 50, chapter: 300, artifact: 75, echo: 75, quiz: 200, noise: 50, perLevel: 800 };

function newProgress(name) {
  return {
    name: (name || 'Hüter').slice(0, 24), xp: 0, area: 'hub', chapter: chapters[0].id,
    discovered: new Set(), crystals: new Set(), landmarks: new Set(), completed: new Set(),
    quizPassed: new Set(), cleared: new Set(), artifacts: new Set(), echoes: new Set(), sideDone: new Set(), side: null,
    stage: 'talk', endingSeen: false, day: 1, minutes: 19 * 60 + 40
  };
}
let P = newProgress();

const Prog = {
  chapter: (id) => chapters.find((c) => c.id === id) || null,
  index: (ch) => chapters.indexOf(ch),
  info(id) { for (const c of chapters) for (const p of c.infoPoints) if (p.id === id) return { chapter: c, point: p }; return null; },
  count: (ch) => ch.infoPoints.filter((p) => P.discovered.has(p.id)).length,
  complete: (ch) => ch.infoPoints.length > 0 && Prog.count(ch) === ch.infoPoints.length,
  /** Sektor abgeschlossen: alle Erinnerungen + Wissenspruefung bestanden */
  done: (ch) => Prog.complete(ch) && (P.quizPassed.has(ch.id) || !(ch.quiz && ch.quiz.length)),
  unlocked(ch) {
    if (!ch.available) return false;
    if (settings.unlockAll) return true;
    const i = chapters.indexOf(ch);
    return i === 0 || Prog.done(chapters[i - 1]) || P.completed.has(chapters[i - 1].id) || P.completed.has(ch.id);
  },
  sideAvailable(npcId) {
    if (P.side) return null;
    return S.sidequests.find((q) => q.giver === npcId && !P.sideDone.has(q.id) && q.unlockAfter <= P.completed.size) || null;
  },
  sideQuest: () => (P.side ? S.sidequests.find((q) => q.id === P.side.id) : null),
  total: () => chapters.reduce((n, c) => n + c.infoPoints.length, 0),
  level: () => 1 + Math.floor(P.xp / XP.perLevel),
  nextChapter() { return chapters.find((c) => c.available && !P.completed.has(c.id)) || null; },
  allDone: () => chapters.every((c) => !c.available || P.completed.has(c.id))
};

function serialize() {
  return {
    version: 4, name: P.name, xp: P.xp, area: P.area, chapter: P.chapter,
    discovered: [...P.discovered], crystals: [...P.crystals], landmarks: [...P.landmarks], completed: [...P.completed],
    stage: P.stage, endingSeen: P.endingSeen, day: P.day, minutes: P.minutes,
    quizPassed: [...P.quizPassed], cleared: [...P.cleared], artifacts: [...P.artifacts], echoes: [...P.echoes],
    sideDone: [...P.sideDone], side: P.side,
    pos: [player.x, player.z], yaw: player.yaw, camYaw: cam.yaw, savedAt: new Date().toISOString()
  };
}
function deserialize(s) {
  if (!s || typeof s !== 'object' || !(s.version <= 4)) return null;
  const p = newProgress(s.name);
  p.xp = Number(s.xp) || 0;
  p.area = s.area === 'sector' ? 'sector' : 'hub';
  p.chapter = Prog.chapter(s.chapter) ? s.chapter : chapters[0].id;
  p.discovered = new Set((s.discovered || []).filter((id) => Prog.info(id)));
  p.crystals = new Set(s.crystals || []);
  p.landmarks = new Set(s.landmarks || []);
  p.completed = new Set((s.completed || []).filter((id) => Prog.chapter(id)));
  p.stage = typeof s.stage === 'string' ? s.stage : 'talk';
  p.endingSeen = !!s.endingSeen;
  p.quizPassed = new Set((s.quizPassed || []).filter((id) => Prog.chapter(id)));
  p.cleared = new Set(s.cleared || []);
  p.artifacts = new Set(s.artifacts || []);
  p.echoes = new Set(s.echoes || []);
  p.sideDone = new Set(s.sideDone || []);
  p.side = s.side && S.sidequests.some((q) => q.id === s.side.id) ? s.side : null;
  p.day = s.day || 1;
  p.minutes = s.minutes || p.minutes;
  return p;
}

// ===================================================================== Renderer

const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality !== 'niedrig', powerPreference: 'high-performance' });
} catch (e) {
  fail(T('web.webgl_error'));
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = settings.quality !== 'niedrig';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 4000);
let composer = null, bloomPass = null;

function setupPost() {
  const pr = settings.quality === 'hoch' ? Math.min(devicePixelRatio || 1, 2) : (settings.quality === 'mittel' ? Math.min(devicePixelRatio || 1, 1.5) : 1);
  renderer.setPixelRatio(pr);
  if (settings.quality === 'niedrig') { composer = null; return; }
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

function resize() {
  const w = innerWidth || 1, h = innerHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
  drawCompassBase();
}
addEventListener('resize', resize);

// ===================================================================== Spielzustand

let assets = null;
let world = null;
let hero = null;
const player = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, grounded: true, speed: 0, vx: 0, vz: 0, dash: 0, stamina: 100, energy: 100, health: 100, r: 0.4 };
const cam = { yaw: 0, pitch: 0.14, dist: 3.5, curDist: 3.5 };
let state = 'boot';
let gameStarted = false;
let showLong = false;
let openInfoId = null;
let dialog = null;
let quiz = null;
const returnFrom = {};
let focused = null;
let toastTime = 0;
let time = 0;
const effects = { scanUntil: 0, lightUntil: 0, echoUntil: 0, echoTarget: null };
const cooldowns = {};
let lightOrb = null, echoBeam = null;

// ===================================================================== Welt laden

function enterWorld(kind, chapterId) {
  if (world) {
    scene.remove(world.group);
    disposeWorld(world);
  }
  focused = null;
  if (kind === 'hub') {
    world = buildHub(assets, S, settings.quality);
    P.area = 'hub';
  } else {
    const ch = Prog.chapter(chapterId);
    P.chapter = ch.id;
    P.area = 'sector';
    world = buildSector(assets, ch, settings.quality);
  }
  scene.add(world.group);
  scene.environment = world.env;
  scene.environmentIntensity = world.envIntensity;
  scene.fog = world.fog;
  if (lightOrb) scene.add(lightOrb);
  refreshWorld();
}

function placePlayer(x, z, yaw) {
  player.x = x; player.z = z; player.y = 0; player.vy = 0; player.yaw = yaw; player.dash = 0;
  cam.yaw = yaw; cam.pitch = 0.14; cam.curDist = cam.dist;
  resolveCollisions();
}

function refreshWorld() {
  if (!world) return;
  if (world.kind === 'sector') {
    world.points.forEach((p) => world.setMemoryState(p, P.discovered.has(p.id), focused === p, p.noisy && !P.cleared.has(p.id)));
    world.artifacts.forEach((a) => a.setCollected(P.artifacts.has(a.id)));
    const ch = Prog.chapter(world.chapterId);
    world.quiz.setPassed(P.quizPassed.has(ch.id));
    world.portal.setOpen(Prog.done(ch));
  } else {
    world.crystals.forEach((c) => c.setCollected(P.crystals.has(c.id)));
    const markers = {};
    world.npcs.forEach((n) => { if (n.marker && Prog.sideAvailable(n.id)) markers[n.id] = 0x55d0ff; });
    const sq = Prog.sideQuest();
    if (sq) {
      if (sq.task.type === 'deliver') markers[sq.task.to] = 0x55d0ff;
      else if (P.side.stage === 'return') markers[sq.giver] = 0x55d0ff;
      if (sq.task.type === 'fetch' && P.side.stage === 'task') world.spawnQuestItem(sq.id, sq.task.label, sq.task.pos[0], sq.task.pos[1]);
    }
    if (['talk', 'report', 'final'].includes(P.stage)) markers.kommandantin = 0xffb640;
    world.setMarkers(markers);
  }
}

// ===================================================================== Quests

function questInfo() {
  const lines = [];
  let target = null;
  const ch = Prog.chapter(P.chapter);
  const npcPos = (id) => { const n = world && world.npcs ? world.npcs.find((x) => x.id === id) : null; return n ? { x: n.x, z: n.z } : null; };
  switch (P.stage) {
    case 'talk':
      lines.push({ text: S.quests.step_talk, done: false });
      if (P.area === 'hub') target = npcPos('kommandantin');
      break;
    case 'explore': {
      lines.push({ text: S.quests.step_talk, done: true });
      lines.push({ text: fmt(S.quests.step_explore, P.landmarks.size, 3), done: false });
      if (P.area === 'hub') {
        const open = Object.entries(HUB.landmarks).filter(([id]) => !P.landmarks.has(id));
        let best = null, bd = Infinity;
        open.forEach(([, p]) => { const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < bd) { bd = d; best = p; } });
        target = best;
      }
      break;
    }
    case 'gate': {
      const next = Prog.nextChapter();
      lines.push({ text: S.quests.step_gate + (next ? ' · ' + T('chapters.heading', next.number, next.title) : ''), done: false });
      if (P.area === 'hub') target = { x: HUB.gate.x - 1, z: HUB.gate.z };
      break;
    }
    case 'sector':
    case 'return':
      if (ch) target = sectorLines(ch, lines);
      break;
    case 'report':
      lines.push({ text: S.quests.step_report, done: false });
      if (P.area === 'hub') target = npcPos('kommandantin');
      break;
    case 'final':
      lines.push({ text: S.quests.step_final, done: false });
      if (P.area === 'hub') target = npcPos('kommandantin');
      break;
    default:
      lines.push({ text: S.quests.done, done: true });
  }
  if (P.area === 'sector' && P.stage !== 'sector' && P.stage !== 'return' && world && world.kind === 'sector') {
    // Freies Erkunden eines Sektors (z. B. erneut besucht)
    lines.length = 0;
    target = sectorLines(Prog.chapter(world.chapterId), lines);
  }
  // Nebenquest
  let side = null, sideTarget = null;
  const sq = Prog.sideQuest();
  if (sq) {
    const giverName = (S.characters[sq.giver] || {}).name || sq.giver;
    let step;
    if (sq.task.type === 'deliver') {
      const toName = (S.characters[sq.task.to] || {}).name || sq.task.to;
      step = fmt(S.quests.side_deliver, sq.task.label, toName);
      if (P.area === 'hub') sideTarget = npcPos(sq.task.to);
    } else if (P.side.stage === 'return') {
      step = fmt(S.quests.side_return, giverName);
      if (P.area === 'hub') sideTarget = npcPos(sq.giver);
    } else {
      step = fmt(sq.task.type === 'visit' ? S.quests.side_visit : S.quests.side_fetch, sq.task.label);
      if (P.area === 'hub') sideTarget = { x: sq.task.pos[0], z: sq.task.pos[1] };
    }
    side = { title: sq.title, step };
  }
  return { title: S.quests.main_title, lines, target: target || sideTarget, side, sideTarget };
}

function sectorLines(ch, lines) {
  let target = null;
  const memDone = Prog.complete(ch);
  lines.push({ text: fmt(S.quests.step_sector, ch.number, Prog.count(ch), ch.infoPoints.length), done: memDone });
  const quizOk = P.quizPassed.has(ch.id);
  if (memDone) lines.push({ text: 'Bestehe die Wissensprüfung am Wissensterminal', done: quizOk });
  if (memDone && quizOk) lines.push({ text: S.quests.step_return, done: false });
  if (P.area === 'sector' && world && world.kind === 'sector' && world.chapterId === ch.id) {
    if (memDone && quizOk) target = { x: SECTOR.PORTAL_X - 1, z: 0 };
    else if (memDone) target = { x: SECTOR.quiz.x - 1.5, z: SECTOR.quiz.z };
    else {
      let bd = Infinity;
      world.points.forEach((p) => { if (!P.discovered.has(p.id)) { const d = Math.hypot(p.pos.x - player.x, p.pos.z - player.z); if (d < bd) { bd = d; target = { x: p.pos.x, z: p.pos.z }; } } });
    }
  }
  return target;
}

function addXp(amount, reason) {
  const before = Prog.level();
  P.xp += amount;
  const after = Prog.level();
  log(fmt('Du erhältst {0} Erfahrung ({1}).', amount, reason));
  if (after > before) {
    toast(fmt('Stufe {0} erreicht!', after), 4);
    log(fmt('Stufe {0} erreicht.', after));
    Audio.chime(1.5);
  }
}

// ===================================================================== Kollision & Bewegung

function resolveCollisions() {
  if (!world) return;
  const r = player.r;
  for (let pass = 0; pass < 2; pass++) {
    if (world.kind === 'hub') {
      const d = Math.hypot(player.x, player.z), max = world.radius - 0.6;
      if (d > max) { player.x *= max / d; player.z *= max / d; }
    } else {
      player.x = clamp(player.x, -world.bounds.x + r, world.bounds.x - r);
      player.z = clamp(player.z, -world.bounds.z + r, world.bounds.z - r);
    }
    for (const c of world.colliders) {
      if (c.t === 'c') {
        const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m) { if (d < 1e-6) player.x = c.x - m; else { player.x = c.x + dx / d * m; player.z = c.z + dz / d * m; } }
      } else {
        const cx = clamp(player.x, c.x0, c.x1), cz = clamp(player.z, c.z0, c.z1);
        const ex = player.x - cx, ez = player.z - cz, dd = Math.hypot(ex, ez);
        if (dd > 0 && dd < r) { player.x = cx + ex / dd * r; player.z = cz + ez / dd * r; }
        else if (dd === 0) {
          const l = player.x - c.x0, rr = c.x1 - player.x, f = player.z - c.z0, bk = c.z1 - player.z, mn = Math.min(l, rr, f, bk);
          if (mn === l) player.x = c.x0 - r; else if (mn === rr) player.x = c.x1 + r; else if (mn === f) player.z = c.z0 - r; else player.z = c.z1 + r;
        }
      }
    }
  }
}

const keys = {};
/** Virtueller Joystick (Touch): x rechts, y vorwaerts, je -1..1; run = Sprint-Schalter */
const touchMove = { x: 0, y: 0, run: false };
function movePlayer(dt) {
  let fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let analog = 1;
  if (!fwd && !side && (touchMove.x || touchMove.y)) {
    fwd = touchMove.y; side = touchMove.x;
    analog = Math.min(1, Math.hypot(fwd, side));
  }
  const wantSprint = (keys.ShiftLeft || keys.ShiftRight || touchMove.run) && player.stamina > 1;
  const len = Math.hypot(fwd, side);
  let target = 0;
  let mx = 0, mz = 0;
  if (len > 0) {
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const rx = -fz, rz = fx; // rechts = vorwaerts x oben
    mx = (fx * fwd + rx * side) / len;
    mz = (fz * fwd + rz * side) / len;
    target = (wantSprint ? 7.6 : 4.2) * (analog < 0.35 ? 0.45 : analog < 0.7 ? 0.75 : 1);
    const desired = Math.atan2(mx, mz);
    player.yaw += angleDiff(desired, player.yaw) * Math.min(1, dt * 12);
  }
  player.speed = damp(player.speed, target, 10, dt);
  if (wantSprint && len > 0) player.stamina = Math.max(0, player.stamina - 16 * dt);
  else player.stamina = Math.min(100, player.stamina + 11 * dt);
  player.energy = Math.min(100, player.energy + 5 * dt);
  const vx = len > 0 ? mx * player.speed : Math.sin(player.yaw) * player.speed;
  const vz = len > 0 ? mz * player.speed : Math.cos(player.yaw) * player.speed;
  player.x += vx * dt;
  player.z += vz * dt;
  if (player.dash > 0) {
    player.x += Math.sin(player.yaw) * player.dash * dt;
    player.z += Math.cos(player.yaw) * player.dash * dt;
    player.dash = Math.max(0, player.dash - 40 * dt);
  }
  if (keys.Space && player.grounded) { player.vy = 5.0; player.grounded = false; Audio.blip(220, 0.05); }
  player.vy -= 14 * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; }
  resolveCollisions();
}

// ===================================================================== Kamera

const raycaster = new THREE.Raycaster();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function updateCamera(dt) {
  const target = tmpA.set(player.x, player.y + 1.6, player.z);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  const rx = -fz, rz = fx;
  const shoulder = 0.7;
  const dir = tmpB.set(-fx * cp + rx * shoulder / cam.dist, sp, -fz * cp + rz * shoulder / cam.dist).normalize();
  let dist = cam.dist;
  if (world && world.blockers.length) {
    raycaster.set(target, dir);
    raycaster.far = cam.dist + 0.3;
    const hits = raycaster.intersectObjects(world.blockers, false);
    if (hits.length) dist = Math.max(0.8, hits[0].distance - 0.35);
  }
  cam.curDist = dist < cam.curDist ? dist : damp(cam.curDist, dist, 6, dt);
  camera.position.copy(target).addScaledVector(dir, cam.curDist);
  camera.lookAt(target.x + fx * 2, target.y + 0.1 - sp * 0.5, target.z + fz * 2);
}

function look(dx, dy) {
  const s = settings.sensitivity * 0.0011;
  cam.yaw -= dx * s;
  cam.pitch += dy * s * (settings.invertY ? -1 : 1);
  cam.pitch = clamp(cam.pitch, -0.45, 1.0);
}

// ===================================================================== Interaktion

function updateFocus() {
  let best = null, bestD = Infinity;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  for (const it of world.interactables) {
    if (it.kind === 'crystal') {
      if (!it.collected && Math.hypot(it.pos.x - player.x, it.pos.z - player.z) < 1.5) collectCrystal(it);
      continue;
    }
    if (it.kind === 'landmark') {
      if (P.stage === 'explore' && !P.landmarks.has(it.id) && Math.hypot(it.pos.x - player.x, it.pos.z - player.z) < it.range) visitLandmark(it);
      continue;
    }
    if (it.kind === 'artifact' && it.collected) continue;
    if (it.kind === 'npc') { it.pos.set(it.npc.x, 1.6, it.npc.z); }
    const dx = it.pos.x - player.x, dz = it.pos.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > (it.range || 3.0)) continue;
    const facing = d < 1.2 ? 1 : (dx * fx + dz * fz) / d;
    if (facing < 0.2) continue;
    if (d < bestD) { bestD = d; best = it; }
  }
  if (focused !== best) {
    focused = best;
    noise.active = false; noise.progress = 0;
    refreshWorld();
  }
  // Nebenquest "Gehe zu"
  const sq = Prog.sideQuest();
  if (sq && sq.task.type === 'visit' && P.side.stage === 'task' && world.kind === 'hub' && Math.hypot(sq.task.pos[0] - player.x, sq.task.pos[1] - player.z) < 4) {
    P.side.stage = 'return';
    toast(fmt('Ziel erreicht: {0} · kehre zurück zu {1}', sq.task.label, (S.characters[sq.giver] || {}).name), 4);
    Audio.chime(1.4);
    refreshWorld();
    saveGame(false);
  }
}

const noise = { active: false, progress: 0 };
function isNoisy(it) { return it && it.kind === 'memory' && it.noisy && !P.cleared.has(it.id); }
function clearNoise(it) {
  P.cleared.add(it.id);
  addXp(XP.noise, 'Datenrauschen beseitigt');
  toast('Datenrauschen beseitigt – die Erinnerung ist wieder lesbar', 3.5);
  Audio.sweep(0.5);
  noise.active = false; noise.progress = 0;
  refreshWorld();
  saveGame(false);
}

function promptText() {
  if (state !== 'playing' || !focused) return '';
  const f = focused;
  if (f.kind === 'npc') return fmt('[E]  Sprechen: {0}', f.label);
  if (f.kind === 'memory') {
    if (isNoisy(f)) return noise.active ? fmt('Datenrauschen wird beseitigt … {0} %', Math.round(noise.progress * 100)) : '[E gedrückt halten]  Datenrauschen beseitigen';
    return T(P.discovered.has(f.id) ? 'hud.interact_again' : 'hud.interact', f.label);
  }
  if (f.kind === 'artifact') return fmt('[E]  Artefakt aufheben: {0}', f.label);
  if (f.kind === 'echo') return fmt('[E]  Mit dem Echo sprechen: {0}', f.label);
  if (f.kind === 'questitem') return fmt('[E]  Aufheben: {0}', f.label);
  if (f.kind === 'quiz') {
    const ch = Prog.chapter(world.chapterId);
    if (P.quizPassed.has(ch.id)) return 'Wissensprüfung bestanden';
    if (!Prog.complete(ch)) return fmt('Wissensterminal: erst alle Erinnerungen erwecken ({0}/{1})', Prog.count(ch), ch.infoPoints.length);
    return '[E]  Wissensprüfung starten';
  }
  if (f.kind === 'gate') {
    if (P.stage === 'talk') return 'Das Archivtor ist versiegelt. Sprich zuerst mit der Kommandantin.';
    if (P.stage === 'explore') return 'Erkunde zuerst die Station, dann öffnet sich das Archivtor.';
    if (P.stage === 'report' || P.stage === 'final') return 'Erstatte zuerst der Kommandantin Bericht.';
    const next = Prog.nextChapter();
    if (P.stage === 'gate' && next) return fmt('[E]  Archivtor betreten: Sektor {0} · {1}', next.number, next.title);
    return '[E]  Archivtor: Sektor wählen (Journal)';
  }
  if (f.kind === 'portal') {
    const ch = Prog.chapter(world.chapterId);
    if (!f.open) return Prog.complete(ch) ? 'Das Sektortor öffnet sich nach der Wissensprüfung.' : T('hud.portal_locked', Prog.count(ch), ch.infoPoints.length);
    return '[E]  Zurück zur Station';
  }
  return '';
}

function interact() {
  if (!focused) return;
  const f = focused;
  Audio.blip(660, 0.06);
  if (f.kind === 'npc') talkTo(f.id);
  else if (f.kind === 'memory' && isNoisy(f)) { noise.active = true; noise.start = performance.now(); }
  else if (f.kind === 'artifact') {
    if (!P.artifacts.has(f.id)) {
      P.artifacts.add(f.id);
      f.setCollected(true);
      const ch = Prog.chapter(world.chapterId);
      const a = (ch.artifacts || []).find((x) => x.id === f.id);
      addXp(XP.artifact, 'Artefakt');
      toast(fmt('Artefakt gefunden: {0} · im Kodex (I)', f.label), 4);
      if (a) log('Artefakt: ' + a.title + ' – ' + a.text.slice(0, 70) + '…');
      Audio.chime(1.6);
      focused = null;
      saveGame(false);
    }
  }
  else if (f.kind === 'echo') {
    const ch = Prog.chapter(world.chapterId);
    const first = !P.echoes.has(ch.id);
    const lines = ch.echo.lines.map((t) => ({ name: ch.echo.name, role: ch.echo.role, text: t }));
    dialog = { lines, index: 0, npc: null, after: () => { if (first) { P.echoes.add(ch.id); addXp(XP.echo, 'Zeitzeugen-Echo'); saveGame(false); } } };
    setState('dialog');
  }
  else if (f.kind === 'quiz') {
    const ch = Prog.chapter(world.chapterId);
    if (P.quizPassed.has(ch.id)) { toast('Diese Wissensprüfung hast du bereits bestanden.', 2.5); return; }
    if (!Prog.complete(ch)) { toast(promptText(), 3); return; }
    quiz = { ch, index: 0, feedback: null };
    setState('quiz');
  }
  else if (f.kind === 'questitem') {
    const sq = Prog.sideQuest();
    if (sq && sq.id === f.id) {
      P.side.stage = 'return';
      world.removeQuestItem(f.id);
      toast(fmt('{0} aufgehoben · bring es zu {1}', f.label, (S.characters[sq.giver] || {}).name), 4);
      Audio.chime(1.3);
      focused = null;
      refreshWorld();
      saveGame(false);
    }
  }
  else if (f.kind === 'memory') {
    if (!P.discovered.has(f.id)) {
      P.discovered.add(f.id);
      addXp(XP.memory, 'Erinnerung');
      const ch = Prog.chapter(world.chapterId);
      if (Prog.complete(ch)) {
        toast('Alle Erinnerungen erweckt – jetzt die Wissensprüfung am Terminal vor dem Sektortor!', 5);
        log('Sektor ' + ch.number + ': alle Erinnerungen erweckt.');
        Audio.chime(1.2);
      } else {
        toast(T('toast.discovered'), 3.5);
      }
      log('Erinnerung archiviert: ' + f.label);
      refreshWorld();
      saveGame(false);
    }
    openInfo(f.id);
  } else if (f.kind === 'gate') {
    if (['talk', 'explore', 'report', 'final'].includes(P.stage)) { toast(promptText(), 3); return; }
    const next = P.stage === 'gate' ? Prog.nextChapter() : null;
    if (next) { P.stage = 'sector'; travelToSector(next.id); }
    else openSub('journal');
  } else if (f.kind === 'portal') {
    if (!f.open) { toast(promptText(), 3); return; }
    returnToHub();
  }
}

function collectCrystal(it) {
  it.setCollected(true);
  P.crystals.add(it.id);
  const c = S.crystals.find((x) => x.id === it.id);
  addXp(XP.crystal, 'Datenkristall');
  toast(fmt('Datenkristall gefunden ({0}/{1}) · im Kodex lesbar (I)', P.crystals.size, S.crystals.length), 4);
  if (c) log('Datenkristall: „' + c.text.slice(0, 60) + '…“');
  Audio.chime(1.8);
  saveGame(false);
}

function visitLandmark(it) {
  P.landmarks.add(it.id);
  const lm = S.landmarks.find((l) => l.id === it.id);
  addXp(XP.landmark, 'Erkundung');
  toast((lm ? lm.title + ' – ' + lm.text : it.label), 6);
  log('Erkundet: ' + (lm ? lm.title : it.id));
  if (P.landmarks.size >= 3 && P.stage === 'explore') {
    P.stage = 'gate';
    log('Quest aktualisiert: ' + S.quests.step_gate);
  }
  saveGame(false);
}

function talkTo(id) {
  let key = id;
  let after = null;
  let lines = null;
  const sq = Prog.sideQuest();
  // Nebenquest abschliessen (Rueckgabe oder Zustellung)
  if (sq && ((sq.task.type === 'deliver' && sq.task.to === id) || (sq.task.type !== 'deliver' && P.side.stage === 'return' && sq.giver === id))) {
    lines = sq.done;
    after = () => { P.sideDone.add(sq.id); P.side = null; addXp(sq.xp || 150, 'Nebenquest'); log('Nebenquest abgeschlossen: ' + sq.title); Audio.chime(1.2); refreshWorld(); saveGame(false); };
  } else if (id !== 'kommandantin' || !['talk', 'report', 'final'].includes(P.stage)) {
    const avail = Prog.sideAvailable(id);
    if (avail) {
      lines = avail.intro;
      after = () => { P.side = { id: avail.id, stage: 'task' }; log('Nebenquest angenommen: ' + avail.title); toast('Nebenquest: ' + avail.title, 3.5); refreshWorld(); saveGame(false); };
    }
  }
  if (lines) { startDialog(lines, id, after); return; }
  if (id === 'kommandantin') {
    if (P.stage === 'talk') { key = 'kommandantin_start'; after = () => { P.stage = 'explore'; log('Quest aktualisiert: Erkunde die Raumstation'); refreshWorld(); saveGame(false); }; }
    else if (P.stage === 'report') {
      key = 'kommandantin_report';
      const next = Prog.nextChapter();
      if (next && !Prog.allDone()) {
        const extra = S.dialogues.kommandantin_next.map((l) => ({ who: l.who, text: fmt(l.text, next.number + '. ' + next.title + ' (' + next.era + ')') }));
        startDialog(S.dialogues.kommandantin_report.concat(extra), id, () => { P.stage = 'gate'; refreshWorld(); saveGame(false); });
        return;
      }
      after = () => { P.stage = Prog.allDone() ? 'final' : 'gate'; refreshWorld(); saveGame(false); };
    }
    else if (P.stage === 'final') { key = 'kommandantin_final'; after = () => { P.stage = 'done'; P.endingSeen = true; refreshWorld(); saveGame(false); setState('ending'); }; }
    else key = 'kommandantin_wait';
  }
  startDialog(S.dialogues[key], id, after);
}

function startDialog(lines, id, after) {
  if (!lines) return;
  const npc = world.npcs && world.npcs.find((n) => n.id === id);
  if (npc) {
    npc.char.state.talking = true;
    npc.yaw = Math.atan2(player.x - npc.x, player.z - npc.z);
    npc.char.root.rotation.y = npc.yaw;
  }
  dialog = { lines, index: 0, npc, after };
  setState('dialog');
}

function advanceDialog() {
  if (!dialog) return;
  dialog.index++;
  Audio.blip(520, 0.04);
  if (dialog.index >= dialog.lines.length) {
    const d = dialog;
    dialog = null;
    if (d.npc) d.npc.char.state.talking = false;
    setState('playing');
    if (d.after) d.after();
  } else renderDialog();
}

function travelToSector(chapterId) {
  const ch = Prog.chapter(chapterId);
  if (!ch) return;
  enterWorld('sector', ch.id);
  placePlayer(SECTOR.start.x, SECTOR.start.z, SECTOR.start.yaw);
  gameStarted = true;
  toast(fmt('Archivsektor {0} · {1}', ch.number, ch.title), 5);
  log('Betreten: Archivsektor ' + ch.number + ' – ' + ch.title);
  Audio.whoosh();
  setState('playing');
  saveGame(false);
}

function returnToHub() {
  const ch = world && world.kind === 'sector' ? Prog.chapter(world.chapterId) : null;
  let newlyCompleted = false;
  if (ch && Prog.done(ch) && !P.completed.has(ch.id)) {
    P.completed.add(ch.id);
    addXp(XP.chapter, 'Sektor abgeschlossen');
    newlyCompleted = true;
  }
  if (newlyCompleted && (P.stage === 'return' || P.stage === 'sector')) P.stage = Prog.allDone() ? 'final' : 'report';
  enterWorld('hub');
  placePlayer(HUB.gate.x - 4, HUB.gate.z, -Math.PI / 2);
  toast(S.station.hubLocation, 3);
  Audio.whoosh();
  setState('playing');
  saveGame(false);
}

// ===================================================================== Faehigkeiten

function useAbility(slot) {
  const ab = S.abilities[slot - 1];
  if (!ab || state !== 'playing') return;
  if (ab.id === 'locked') { toast(ab.desc, 3); return; }
  if ((cooldowns[ab.id] || 0) > time) { toast(ab.name + ': noch nicht bereit', 1.5); return; }
  if (player.energy < ab.energy) { toast('Zu wenig Energie für ' + ab.name, 2); return; }
  player.energy -= ab.energy;
  cooldowns[ab.id] = time + ab.cooldown;
  if (ab.id === 'scan') {
    effects.scanUntil = time + 20;
    let n = 0;
    if (world.kind === 'sector') world.points.forEach((p) => { if (isNoisy(p) && Math.hypot(p.pos.x - player.x, p.pos.z - player.z) < 12) { P.cleared.add(p.id); n++; } });
    if (n) { addXp(XP.noise * n, 'Datenrauschen beseitigt'); refreshWorld(); saveGame(false); }
    toast(n ? fmt('Scan-Puls: {0}× Datenrauschen beseitigt, Ziele markiert', n) : 'Scan-Puls: verborgene Ziele markiert', 3);
    Audio.sweep();
  }
  if (ab.id === 'dash') { player.dash = 16; Audio.whoosh(0.4); }
  if (ab.id === 'light') {
    effects.lightUntil = time + 40;
    if (!lightOrb) {
      lightOrb = new THREE.Group();
      const l = new THREE.PointLight(0x9fdcff, 30, 16, 2);
      lightOrb.add(l);
      lightOrb.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xcff0ff })));
    }
    scene.add(lightOrb);
    Audio.chime(2);
  }
  if (ab.id === 'echo') {
    const t = nearestUndiscovered();
    if (!t) { toast('Keine unentdeckten Ziele in der Nähe', 2.5); return; }
    effects.echoUntil = time + 15;
    effects.echoTarget = t;
    if (!echoBeam) {
      echoBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 60, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    }
    echoBeam.position.set(t.x, 30, t.z);
    scene.add(echoBeam);
    toast('Zeitecho: Wegpunkt gesetzt', 2.5);
    Audio.sweep(0.6);
  }
  if (ab.id === 'regen') {
    const s = world.start;
    placePlayer(s.x, s.z, s.yaw);
    toast('Rückruf zum Startpunkt', 2);
    Audio.whoosh();
  }
}

function nearestUndiscovered() {
  let best = null, bd = Infinity;
  world.interactables.forEach((it) => {
    const open = (it.kind === 'memory' && !P.discovered.has(it.id)) || ((it.kind === 'crystal' || it.kind === 'artifact') && !it.collected);
    if (!open) return;
    const d = Math.hypot(it.pos.x - player.x, it.pos.z - player.z);
    if (d < bd) { bd = d; best = { x: it.pos.x, z: it.pos.z }; }
  });
  return best;
}

// ===================================================================== Speichern

function saveGame(showMessage) {
  if (!gameStarted) return;
  const ok = Store.set(SAVE_KEY, serialize());
  if (showMessage || !ok) toast(ok ? T('toast.saved') : (Store.ok ? T('toast.save_failed') : T('web.storage_off')));
  if (showMessage && ok) log('Speichervorgang abgeschlossen.');
  if (state === 'pause') renderMenu(true);
}

function startNewGame(name) {
  P = newProgress(name);
  enterWorld('hub');
  placePlayer(HUB.start.x, HUB.start.z, HUB.start.yaw);
  gameStarted = true;
  logEl.innerHTML = '';
  log('Willkommen auf der ' + S.station.name + '.');
  log('Quest erhalten: ' + S.quests.main_title);
  Audio.start(settings.volume);
  setState('intro');
}

function continueGame() {
  const s = Store.get(SAVE_KEY) || Store.get(OLD_SAVE_KEY);
  const p = deserialize(s);
  if (!p) { toast(T('toast.nosave')); return; }
  P = p;
  if (P.area === 'sector') enterWorld('sector', P.chapter); else enterWorld('hub');
  const start = world.start;
  placePlayer(start.x, start.z, start.yaw);
  if (Array.isArray(s.pos) && isFinite(s.pos[0]) && isFinite(s.pos[1])) { player.x = s.pos[0]; player.z = s.pos[1]; }
  if (isFinite(s.yaw)) player.yaw = s.yaw;
  if (isFinite(s.camYaw)) cam.yaw = s.camYaw;
  resolveCollisions();
  gameStarted = true;
  Audio.start(settings.volume);
  toast(T('toast.loaded'));
  log('Spielstand geladen.');
  setState('playing');
}

// ===================================================================== HUD

const hud = $('hud');
const logEl = $('log');
const promptEl = $('prompt');
const toastEl = $('toast');
const minimap = $('minimap');
const mm = minimap.getContext('2d');
const compassEl = $('compass');
const compassStrip = $('compass-strip');
const compassMarker = $('compass-marker');

function toast(text, seconds) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  toastTime = seconds || 3;
}

function log(text) {
  const h = Math.floor(P.minutes / 60) % 24, m = Math.floor(P.minutes % 60);
  const li = document.createElement('li');
  li.innerHTML = '<time>' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + '</time> <b>System:</b> ' + esc(text);
  logEl.appendChild(li);
  while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
}

const COMPASS_SPAN = Math.PI * 0.9;
function drawCompassBase() {
  const marks = [['N', 0], ['NW', Math.PI / 4], ['W', Math.PI / 2], ['SW', Math.PI * 0.75], ['S', Math.PI], ['SO', -Math.PI * 0.75], ['O', -Math.PI / 2], ['NO', -Math.PI / 4]];
  compassStrip.innerHTML = marks.map(([l, a]) => `<span data-a="${a}" class="${l.length === 1 ? 'major' : ''}">${l}</span>`).join('') +
    Array.from({ length: 24 }, (_, i) => `<i data-a="${(i / 24) * Math.PI * 2}"></i>`).join('');
}

function updateCompass() {
  const w = compassEl.clientWidth;
  // Winkel: 0 = +Z (Norden), positiv = +X (Westen)
  compassStrip.querySelectorAll('[data-a]').forEach((el) => {
    const a = parseFloat(el.dataset.a);
    const rel = angleDiff(a, cam.yaw);
    const x = w / 2 - (rel / COMPASS_SPAN) * w;
    el.style.transform = `translateX(${x}px)`;
    el.style.opacity = Math.abs(rel) < COMPASS_SPAN / 2 ? String(1 - Math.abs(rel) / (COMPASS_SPAN / 2) * 0.6) : '0';
  });
  const q = questInfo();
  if (q.target) {
    const a = Math.atan2(q.target.x - player.x, q.target.z - player.z);
    const rel = angleDiff(a, cam.yaw);
    const x = clamp(w / 2 - (rel / COMPASS_SPAN) * w, 12, w - 12);
    compassMarker.hidden = false;
    compassMarker.style.transform = `translateX(${x}px)`;
    $('compass-dist').textContent = Math.round(Math.hypot(q.target.x - player.x, q.target.z - player.z)) + ' m';
  } else compassMarker.hidden = true;
}

function drawMinimap() {
  const W = minimap.width, H = minimap.height, cx = W / 2, cy = H / 2;
  mm.clearRect(0, 0, W, H);
  mm.save();
  mm.beginPath(); mm.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = 'rgba(8,12,20,0.82)'; mm.fillRect(0, 0, W, H);
  const scale = world.kind === 'hub' ? 1.5 : 3.2;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  const rx = -fz, rz = fx;
  const tr = (x, z) => { const dx = x - player.x, dz = z - player.z; return [cx + (dx * rx + dz * rz) * scale, cy - (dx * fx + dz * fz) * scale]; };
  const shapes = world.mapShapes();
  mm.strokeStyle = 'rgba(140,190,255,0.35)'; mm.lineWidth = 1.5;
  if (shapes.circle) {
    const [px, py] = tr(0, 0);
    mm.beginPath(); mm.arc(px, py, shapes.circle * scale, 0, Math.PI * 2); mm.stroke();
  }
  mm.fillStyle = 'rgba(90,110,140,0.55)';
  shapes.boxes.forEach((b) => {
    const pts = [tr(b.x0, b.z0), tr(b.x1, b.z0), tr(b.x1, b.z1), tr(b.x0, b.z1)];
    mm.beginPath(); mm.moveTo(...pts[0]); pts.slice(1).forEach((p) => mm.lineTo(...p)); mm.closePath(); mm.fill();
  });
  const scanning = effects.scanUntil > time;
  world.interactables.forEach((it) => {
    let color = null, r = 3;
    if (it.kind === 'npc') { color = it.id === 'kommandantin' ? '#ffb640' : '#9fb3c8'; }
    if (it.kind === 'gate' || it.kind === 'portal') { color = '#55d0ff'; r = 5; }
    if (it.kind === 'memory') { color = P.discovered.has(it.id) ? '#55d0ff' : '#ffb640'; r = 4; }
    if (it.kind === 'crystal' && !it.collected && scanning) { color = '#9fe3ff'; r = 3; }
    if (it.kind === 'artifact' && !it.collected && scanning) { color = '#e8c070'; r = 3; }
    if (it.kind === 'echo') { color = '#c080ff'; r = 4; }
    if (it.kind === 'quiz') { color = '#ffd27a'; r = 4; }
    if (it.kind === 'questitem') { color = '#7fd0ff'; r = 4; }
    if (!color) return;
    const [x, y] = tr(it.pos.x, it.pos.z);
    mm.fillStyle = color; mm.beginPath(); mm.arc(x, y, r, 0, Math.PI * 2); mm.fill();
  });
  const q = questInfo();
  if (q.target) {
    const [x, y] = tr(q.target.x, q.target.z);
    const ax = clamp(x, 14, W - 14), ay = clamp(y, 14, H - 14);
    mm.save(); mm.translate(ax, ay); mm.rotate(Math.PI / 4);
    mm.fillStyle = '#ffb640'; mm.fillRect(-5, -5, 10, 10); mm.restore();
  }
  mm.restore();
  // Spielerpfeil (Kamera-Blick nach oben, Figur-Ausrichtung relativ)
  mm.save(); mm.translate(cx, cy); mm.rotate(-angleDiff(player.yaw, cam.yaw));
  mm.fillStyle = '#e8f4ff'; mm.beginPath(); mm.moveTo(0, -8); mm.lineTo(6, 6); mm.lineTo(0, 3); mm.lineTo(-6, 6); mm.closePath(); mm.fill();
  mm.restore();
  mm.strokeStyle = 'rgba(160,200,255,0.5)'; mm.lineWidth = 2; mm.beginPath(); mm.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2); mm.stroke();
  mm.fillStyle = '#e8f4ff'; mm.font = '600 12px Rajdhani, sans-serif'; mm.textAlign = 'center';
  const [nx, ny] = [cx + Math.sin(-cam.yaw) * 0 , 0];
  const north = tr(player.x, player.z + 1000);
  const ang = Math.atan2(north[1] - cy, north[0] - cx);
  mm.fillText('N', cx + Math.cos(ang) * (W / 2 - 12), cy + Math.sin(ang) * (W / 2 - 12) + 4);
  void nx; void ny;
}

let hudTick = 0;
function updateHud(dt) {
  if (state !== 'playing') return;
  $('bar-hp').style.width = player.stamina + '%';
  $('bar-en').style.width = player.energy + '%';
  $('pname').textContent = P.name;
  $('plevel').textContent = 'Lv. ' + Prog.level();
  const pt = promptText();
  promptEl.hidden = !pt;
  if (pt && promptEl.textContent !== pt) promptEl.textContent = pt;
  hudTick -= dt;
  if (hudTick <= 0) {
    hudTick = 0.1;
    const q = questInfo();
    $('quest-title').textContent = q.title;
    $('quest-steps').innerHTML = q.lines.map((l) => `<li class="${l.done ? 'done' : ''}">${esc(l.text)}</li>`).join('')
      + (q.side ? `<li class="side"><b>${esc(q.side.title)}:</b> ${esc(q.side.step)}</li>` : '');
    const h = Math.floor(P.minutes / 60) % 24, m = Math.floor(P.minutes % 60);
    $('loc-name').textContent = P.area === 'hub' ? S.station.hubLocation : fmt(S.station.sectorLocation, (Prog.chapter(P.chapter) || {}).number || '');
    $('loc-time').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' | Tag ' + P.day;
    $('cnt-mem').textContent = P.discovered.size + ' | ' + Prog.total();
    $('cnt-cry').textContent = P.crystals.size + ' | ' + S.crystals.length;
    S.abilities.forEach((ab, i) => {
      const el = $('ab' + (i + 1));
      const cd = Math.max(0, (cooldowns[ab.id] || 0) - time);
      el.classList.toggle('cooldown', cd > 0);
      el.classList.toggle('locked', ab.id === 'locked' && Prog.level() < (ab.unlockLevel || 99));
      el.classList.toggle('noenergy', player.energy < ab.energy);
      el.querySelector('.cd').textContent = cd > 0 ? Math.ceil(cd) : '';
    });
    $('hint').hidden = !settings.showHint;
    $('lockHint').hidden = pointerLocked || !lockSupported;
  }
  updateCompass();
  drawMinimap();
}

// ===================================================================== Oberflaeche (Menues)

const screens = ['menu', 'info', 'dialog', 'quiz', 'journal', 'codex', 'skills', 'map', 'options', 'ending', 'intro'].reduce((o, k) => { o[k] = $(k); return o; }, {});

function button(action, label, opts = {}) {
  return `<button type="button" data-action="${action}"${opts.id ? ` data-id="${esc(opts.id)}"` : ''}${opts.cls ? ` class="${opts.cls}"` : ''}${opts.disabled ? ' disabled' : ''}>${esc(label)}</button>`;
}

let confirmNew = false, askName = false;
function renderMenu(pause) {
  const hasSave = Store.has(SAVE_KEY) || Store.has(OLD_SAVE_KEY);
  let h = `<div class="panel menu-panel${pause ? ' pause' : ''}" role="dialog"><img class="emblem" alt="" src="${emblemDataUrl('#d9a95a')}"><h1>THE LAST HUMANITY</h1>`;
  h += `<div class="subtitle">${esc(pause ? 'Pause' : T('menu.subtitle'))}</div><div class="buttons${pause ? ' two' : ''}">`;
  if (pause) {
    h += button('resume', 'Weiterspielen', { cls: 'primary' }) + button('save', 'Spiel speichern') + button('load', 'Letzten Spielstand laden', { disabled: !hasSave });
    h += button('journal', 'Journal (J)') + button('codex', 'Kodex (I)') + button('skills', 'Fähigkeiten (K)') + button('map', 'Karte (M)') + button('options', 'Optionen') + button('mainmenu', 'Zum Hauptmenü');
  } else if (askName) {
    h += `<label class="namefield" for="heroname">Name deines Hüters</label><input id="heroname" maxlength="24" value="${esc(P.name || 'Hüter')}" autocomplete="off">`;
    h += `<div class="row">${button('name-ok', 'Erwachen', { cls: 'primary' })}${button('name-cancel', 'Zurück')}</div>`;
  } else if (confirmNew) {
    h += `<div class="confirm"><div>${esc(T('web.confirm_new'))}</div><div class="row">${button('new-confirm', T('web.confirm_yes'), { cls: 'primary' })}${button('new-cancel', T('web.confirm_no'))}</div></div>`;
  } else {
    h += button('new', 'Neues Spiel', { cls: hasSave ? '' : 'primary' }) + button('continue', 'Fortsetzen', { disabled: !hasSave, cls: hasSave ? 'primary' : '' });
    h += button('options', 'Optionen');
  }
  h += '</div>';
  if (!pause) h += `<div class="controls">WASD gehen · Maus Kamera · Shift sprinten · Leertaste springen · E interagieren<br>1–6 Fähigkeiten · J Journal · I Kodex · K Fähigkeiten · M Karte · Esc Menü · F5 speichern</div>`;
  if (!Store.ok) h += `<div class="note warn">${esc(T('web.storage_off'))}</div>`;
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) h += `<div class="note warn">${esc(T('web.touch_hint'))}</div>`;
  h += '</div>';
  screens.menu.innerHTML = h;
  if (askName) setTimeout(() => { const i = $('heroname'); if (i) { i.focus(); i.select(); } }, 0);
}

function renderIntro() {
  screens.intro.innerHTML = `<div class="panel intro-panel"><div class="eyebrow">${esc(S.station.name)}</div><h2>${esc(S.quests.main_title)}</h2><div class="reading">${paragraphs(S.station.intro)}</div><div class="row">${button('intro-ok', 'Weiter  [E]', { cls: 'primary' })}</div></div>`;
}

function renderInfo() {
  const f = Prog.info(openInfoId);
  if (!f) return;
  const fiction = f.point.kind === 'fiktion';
  screens.info.innerHTML = `<div class="panel" role="dialog"><div class="eyebrow"><span>${esc(T('info.chapter', f.chapter.number, f.chapter.title))}</span><span class="kind${fiction ? ' fiction' : ''}">${esc(T(fiction ? 'info.kind_fiction' : 'info.kind_fact'))}</span></div>
    <h2>${esc(f.point.title)}</h2><div class="mode">${esc(T(showLong ? 'info.label_long' : 'info.label_short'))}</div>
    <div class="scroll reading">${paragraphs(showLong ? f.point.long : f.point.short)}</div>
    <div class="row">${button('toggle-long', T(showLong ? 'info.toggle_short' : 'info.toggle_long'))}${button('close', T('info.close'), { cls: 'primary' })}</div></div>`;
}

function renderDialog() {
  const line = dialog.lines[dialog.index];
  const ch = line.name ? { name: line.name, role: line.role || '' } : (S.characters[line.who] || { name: line.who, role: '' });
  screens.dialog.innerHTML = `<div class="dialog-box"><div class="speaker">${esc(ch.name)}<span>${esc(ch.role)}</span></div><p>${esc(line.text)}</p>
    <div class="row">${button('dialog-next', dialog.index + 1 < dialog.lines.length ? 'Weiter  [E]' : 'Ende  [E]', { cls: 'primary' })}</div></div>`;
}

function renderJournal() {
  const q = questInfo();
  let h = `<div class="panel wide" role="dialog"><h2>Journal</h2><div class="cols"><section><h3>Hauptquest · ${esc(q.title)}</h3><ul class="steps">${q.lines.map((l) => `<li class="${l.done ? 'done' : ''}">${esc(l.text)}</li>`).join('')}</ul>
    <h3>Nebenquests (${P.sideDone.size}/${S.sidequests.length})</h3><ul class="steps">${q.side ? `<li><b>${esc(q.side.title)}</b> – ${esc(q.side.step)}</li>` : ''}${S.sidequests.filter((x) => P.sideDone.has(x.id)).slice(-4).map((x) => `<li class="done">${esc(x.title)}</li>`).join('')}${!q.side ? `<li>${esc(S.sidequests.some((x) => !P.sideDone.has(x.id) && x.unlockAfter <= P.completed.size) ? 'Bewohner mit blauer Markierung haben Aufträge für dich.' : 'Neue Aufträge gibt es nach weiteren Sektoren.')}</li>` : ''}</ul>
    <h3>${esc(S.quests.side_title)}</h3><ul class="steps"><li class="${P.crystals.size === S.crystals.length ? 'done' : ''}">${esc(fmt(S.quests.side_step, P.crystals.size, S.crystals.length))}</li></ul>
    <p class="total">${esc(T('chapters.total', P.discovered.size, Prog.total()))} · Stufe ${Prog.level()} · ${P.xp} Erfahrung</p></section><section class="scroll"><h3>Archivsektoren</h3><div class="cards">`;
  chapters.forEach((ch, idx) => {
    const unlocked = Prog.unlocked(ch) || P.completed.has(ch.id);
    const done = Prog.complete(ch);
    const here = P.area === 'sector' && P.chapter === ch.id;
    let status = !unlocked ? T('chapters.locked', idx > 0 ? chapters[idx - 1].number : 0) : T(done ? 'chapters.complete' : 'chapters.discovered', Prog.count(ch), ch.infoPoints.length);
    if (unlocked && ch.artifacts) status += ' · Artefakte ' + ch.artifacts.filter((a) => P.artifacts.has(a.id)).length + '/' + ch.artifacts.length;
    if (here) status = T('chapters.current') + ' · ' + status;
    h += `<div class="card${unlocked ? ' open' : ' locked'}${done ? ' done' : ''}${here ? ' here' : ''}"><div class="head"><h4>${esc(T('chapters.heading', ch.number, ch.title))}</h4><span class="status">${esc(status)}</span></div>
      <div class="era">${esc(ch.era)}</div><div>${esc(ch.summary)}</div>`;
    const entries = ch.infoPoints.filter((p) => P.discovered.has(p.id));
    if (entries.length) h += `<div class="entries">${entries.map((p) => button('read', p.title, { id: p.id, cls: 'small' })).join('')}</div>`;
    const canEnter = gameStarted && unlocked && !here && (settings.unlockAll || P.completed.has(ch.id) || P.stage === 'done');
    if (canEnter) h += `<div class="enter">${button('enter', 'Sektor betreten', { id: ch.id, cls: 'primary' })}</div>`;
    h += '</div>';
  });
  h += `</div></section></div><div class="row">${button('back', 'Zurück', { cls: 'primary' })}</div></div>`;
  screens.journal.innerHTML = h;
}

function renderCodex() {
  let h = `<div class="panel wide" role="dialog"><h2>Kodex</h2><div class="cols"><section class="scroll"><h3>Datenkristalle (${P.crystals.size}/${S.crystals.length})</h3><ul class="codex">`;
  S.crystals.forEach((c, i) => { h += P.crystals.has(c.id) ? `<li>${esc(c.text)}</li>` : `<li class="unknown">Kristall ${i + 1} – noch nicht gefunden</li>`; });
  const artTotal = chapters.reduce((n, c) => n + (c.artifacts || []).length, 0);
  h += `</ul><h3>Artefakte (${P.artifacts.size}/${artTotal})</h3><ul class="codex">`;
  chapters.forEach((c) => (c.artifacts || []).forEach((a) => { if (P.artifacts.has(a.id)) h += `<li><b>${esc(a.title)}</b> · Sektor ${c.number}<br>${esc(a.text)}</li>`; }));
  if (!P.artifacts.size) h += '<li class="unknown">Noch keine Artefakte gefunden – sie liegen versteckt in den Ecken der Archivsektoren.</li>';
  h += `</ul></section><section class="scroll"><h3>Orte der Station</h3><ul class="codex">`;
  S.landmarks.forEach((l) => { h += P.landmarks.has(l.id) ? `<li><b>${esc(l.title)}</b><br>${esc(l.text)}</li>` : `<li class="unknown">${esc(l.title)} – noch nicht erkundet</li>`; });
  h += `</ul><h3>Personen</h3><ul class="codex">${Object.values(S.characters).map((c) => `<li><b>${esc(c.name)}</b> · ${esc(c.role)}</li>`).join('')}</ul></section></div><div class="row">${button('back', 'Zurück', { cls: 'primary' })}</div></div>`;
  screens.codex.innerHTML = h;
}

function renderSkills() {
  let h = `<div class="panel" role="dialog"><h2>Fähigkeiten</h2><p class="total">Energie lädt sich von selbst auf. Stufe ${Prog.level()}.</p><ul class="skills">`;
  S.abilities.forEach((a) => {
    const locked = a.id === 'locked' && Prog.level() < (a.unlockLevel || 99);
    h += `<li class="${locked ? 'locked' : ''}"><kbd>${a.key}</kbd><div><b>${esc(a.name)}</b><br>${esc(a.desc)}${a.energy ? `<br><small>Energie ${a.energy} · Abklingzeit ${a.cooldown} s</small>` : ''}</div></li>`;
  });
  h += `</ul><div class="row">${button('back', 'Zurück', { cls: 'primary' })}</div></div>`;
  screens.skills.innerHTML = h;
}

function renderMap() {
  screens.map.innerHTML = `<div class="panel" role="dialog"><h2>Karte · ${esc(P.area === 'hub' ? S.station.hubLocation : fmt(S.station.sectorLocation, Prog.chapter(P.chapter).number))}</h2><canvas id="bigmap" width="640" height="640"></canvas><div class="legend"><span class="lg-you">Du</span><span class="lg-quest">Questziel</span><span class="lg-npc">Personen</span><span class="lg-mem">Erinnerung</span><span class="lg-gate">Tor</span></div><div class="row">${button('back', 'Zurück', { cls: 'primary' })}</div></div>`;
  const c = $('bigmap').getContext('2d');
  const W = 640, cx = W / 2;
  const shapes = world.mapShapes();
  const scale = world.kind === 'hub' ? 6.4 : 14;
  const tr = (x, z) => [cx - x * scale, cx - z * scale];
  c.fillStyle = '#070b13'; c.fillRect(0, 0, W, W);
  c.strokeStyle = 'rgba(140,190,255,0.4)'; c.lineWidth = 2;
  if (shapes.circle) { c.beginPath(); c.arc(cx, cx, shapes.circle * scale, 0, Math.PI * 2); c.stroke(); }
  if (shapes.rect) { const [x0, y0] = tr(shapes.rect.x, shapes.rect.z); c.strokeRect(x0, y0, shapes.rect.x * 2 * scale, shapes.rect.z * 2 * scale); }
  c.fillStyle = 'rgba(90,110,140,0.6)';
  shapes.boxes.forEach((b) => { const [x0, y0] = tr(b.x1, b.z1); c.fillRect(x0, y0, (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale); });
  world.interactables.forEach((it) => {
    let color = null;
    if (it.kind === 'npc') color = '#9fb3c8';
    if (it.kind === 'gate' || it.kind === 'portal') color = '#55d0ff';
    if (it.kind === 'memory') color = P.discovered.has(it.id) ? '#55d0ff' : '#ffb640';
    if (!color) return;
    const [x, y] = tr(it.pos.x, it.pos.z);
    c.fillStyle = color; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
    if (it.label && it.kind !== 'memory') { c.fillStyle = '#cfe0f2'; c.font = '600 14px Rajdhani, sans-serif'; c.fillText(it.label, x + 9, y + 4); }
  });
  const q = questInfo();
  if (q.target) { const [x, y] = tr(q.target.x, q.target.z); c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#ffb640'; c.fillRect(-7, -7, 14, 14); c.restore(); }
  const [px, py] = tr(player.x, player.z);
  c.save(); c.translate(px, py); c.rotate(-player.yaw + Math.PI);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(0, 4); c.lineTo(-8, 8); c.closePath(); c.fill(); c.restore();
  c.fillStyle = '#e8f4ff'; c.font = '700 16px Rajdhani, sans-serif'; c.fillText('N ↑', 12, 22);
}

function renderOptions() {
  const s = settings;
  let h = `<div class="panel" role="dialog"><h2>Optionen</h2><div class="scroll">`;
  h += `<div class="opt"><label for="opt-sens">Mausempfindlichkeit</label><div class="ctl"><input id="opt-sens" type="range" min="${LIMITS.sensMin}" max="${LIMITS.sensMax}" step="0.1" value="${s.sensitivity}"><output id="out-sens">${s.sensitivity.toFixed(1)}</output></div></div>`;
  h += `<div class="opt"><label for="opt-fov">Sichtfeld (Grad)</label><div class="ctl"><input id="opt-fov" type="range" min="${LIMITS.fovMin}" max="${LIMITS.fovMax}" step="1" value="${s.fov}"><output id="out-fov">${s.fov}</output></div></div>`;
  h += `<div class="opt"><label for="opt-vol">Lautstärke</label><div class="ctl"><input id="opt-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"><output id="out-vol">${Math.round(s.volume * 100)}</output></div></div>`;
  h += `<div class="opt"><label for="opt-quality">Grafikqualität</label><div class="ctl"><select id="opt-quality">${['hoch', 'mittel', 'niedrig'].map((q) => `<option value="${q}"${q === s.quality ? ' selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}</select></div></div>`;
  [['opt-invert', 'invertY', 'Maus-Y-Achse umkehren'], ['opt-hint', 'showHint', 'Tastenhinweise anzeigen'], ['opt-unlock', 'unlockAll', 'Alle Sektoren freischalten']].forEach(([id, k, l]) => {
    h += `<div class="opt"><label for="${id}">${l}</label><div class="ctl"><input id="${id}" type="checkbox" data-key="${k}"${s[k] ? ' checked' : ''}></div></div>`;
  });
  h += `<p class="hint">Grafikqualität „Hoch“ nutzt Spiegelungen und Leuchteffekte. Bei ruckelndem Bild „Mittel“ oder „Niedrig“ wählen. Eine Änderung der Qualität wird nach dem Neuladen der Seite wirksam.</p>`;
  h += `<p class="hint">„Alle Sektoren freischalten“: jeden Archivsektor sofort über das Journal betreten (Unterricht, Test).</p>`;
  h += `</div><div class="row">${button('back', 'Speichern und zurück', { cls: 'primary' })}</div></div>`;
  screens.options.innerHTML = h;
}

function renderEnding() {
  screens.ending.innerHTML = `<div class="panel" role="dialog"><img class="emblem" alt="" src="${emblemDataUrl('#7fd0ff')}"><h2>${esc(CONTENT.ending.title)}</h2><div class="scroll reading">${paragraphs(CONTENT.ending.text)}</div>
    <div class="stats">${esc(T('ending.stats', P.discovered.size, Prog.total()))} · ${P.crystals.size}/${S.crystals.length} Datenkristalle · Stufe ${Prog.level()}</div>
    <div class="row">${button('close', 'Weiter auf der Station umsehen')}${button('mainmenu', 'Zum Hauptmenü', { cls: 'primary' })}</div></div>`;
}

function renderQuiz() {
  const ch = quiz.ch;
  const q = ch.quiz[quiz.index];
  let h = `<div class="panel quiz-panel" role="dialog"><div class="eyebrow"><span>Wissensterminal · Sektor ${ch.number}</span><span>Frage ${quiz.index + 1} von ${ch.quiz.length}</span></div>`;
  h += `<h2>${esc(q.q)}</h2>`;
  if (quiz.feedback) {
    h += `<div class="quiz-feedback ${quiz.feedback.ok ? 'ok' : 'bad'}">${esc(quiz.feedback.text)}</div>`;
    h += `<div class="row">${button(quiz.feedback.ok ? 'quiz-next' : 'quiz-retry', quiz.feedback.ok ? (quiz.index + 1 < ch.quiz.length ? 'Nächste Frage  [E]' : 'Abschließen  [E]') : 'Noch einmal  [E]', { cls: 'primary' })}</div>`;
  } else {
    h += `<div class="quiz-options">${q.options.map((o, i) => button('quiz-answer', (i + 1) + '  ' + o, { id: String(i), cls: 'quiz-option' })).join('')}</div>`;
    h += `<div class="row">${button('close', 'Später', {})}</div>`;
  }
  h += '</div>';
  screens.quiz.innerHTML = h;
}

function answerQuiz(i) {
  if (!quiz || quiz.feedback) return;
  const q = quiz.ch.quiz[quiz.index];
  const ok = i === q.correct;
  quiz.feedback = ok ? { ok: true, text: 'Richtig!' } : { ok: false, text: 'Leider falsch. Richtig wäre: „' + q.options[q.correct] + '“. Lies die Erinnerungen im Journal (J) noch einmal nach.' };
  Audio.blip(ok ? 880 : 180, ok ? 0.12 : 0.25);
  renderQuiz();
}

function quizContinue() {
  if (!quiz || !quiz.feedback) return;
  if (!quiz.feedback.ok) { quiz.feedback = null; renderQuiz(); return; }
  quiz.index++;
  quiz.feedback = null;
  if (quiz.index >= quiz.ch.quiz.length) {
    const ch = quiz.ch;
    P.quizPassed.add(ch.id);
    if (P.stage === 'sector' && P.chapter === ch.id) P.stage = 'return';
    addXp(XP.quiz, 'Wissensprüfung');
    quiz = null;
    setState('playing');
    toast('Wissensprüfung bestanden – das Sektortor ist offen!', 5);
    log('Sektor ' + ch.number + ': Wissensprüfung bestanden.');
    Audio.chime(1.2);
    refreshWorld();
    saveGame(false);
  } else renderQuiz();
}

const RENDER = { quiz: renderQuiz, info: renderInfo, dialog: renderDialog, journal: renderJournal, codex: renderCodex, skills: renderSkills, map: renderMap, options: renderOptions, ending: renderEnding, intro: renderIntro };

function setState(next) {
  const prev = state;
  state = next;
  if (next === 'mainmenu') { confirmNew = false; askName = false; renderMenu(false); }
  if (next === 'pause') renderMenu(true);
  if (RENDER[next]) RENDER[next]();
  Object.entries(screens).forEach(([k, el]) => { el.hidden = !((k === 'menu' && (next === 'mainmenu' || next === 'pause')) || k === next); });
  hud.hidden = !(next === 'playing' || next === 'dialog');
  if (next === 'playing') {
    requestLock();
    canvas.focus({ preventScroll: true });
  } else {
    if (next !== 'dialog') focused = null;
    for (const k in keys) keys[k] = false;
    try { stickReset(); lookId = null; } catch (e) { /* Touch noch nicht initialisiert */ }
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    const first = document.querySelector('.screen:not([hidden]) button:not(:disabled), .screen:not([hidden]) input');
    if (first && prev !== next && first.id !== 'heroname') first.focus({ preventScroll: true });
  }
  promptEl.hidden = true;
}

function openInfo(id) { if (state !== 'info') returnFrom.info = state; openInfoId = id; setState('info'); }
function openSub(name) { if (state !== name) returnFrom[name] = state; setState(name); }
function closeOverlay() {
  const back = (name, fallback) => setState(returnFrom[name] && returnFrom[name] !== name ? returnFrom[name] : fallback);
  switch (state) {
    case 'pause': case 'ending': setState(gameStarted ? 'playing' : 'mainmenu'); break;
    case 'intro': setState('playing'); break;
    case 'quiz': quiz = null; setState('playing'); break;
    case 'info': back('info', 'playing'); break;
    case 'journal': case 'codex': case 'skills': case 'map': back(state, 'playing'); break;
    case 'options': Store.set(SETTINGS_KEY, settings); back('options', 'mainmenu'); break;
    default: break;
  }
}

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest && ev.target.closest('button[data-action]');
  if (!btn || btn.disabled) return;
  const a = btn.dataset.action, id = btn.dataset.id;
  Audio.blip(440, 0.03);
  switch (a) {
    case 'new': if (Store.has(SAVE_KEY)) confirmNew = true; else askName = true; renderMenu(false); break;
    case 'new-confirm': confirmNew = false; askName = true; renderMenu(false); break;
    case 'new-cancel': case 'name-cancel': confirmNew = false; askName = false; renderMenu(false); break;
    case 'name-ok': { const v = ($('heroname').value || '').trim() || 'Hüter'; askName = false; startNewGame(v); break; }
    case 'continue': case 'load': continueGame(); break;
    case 'resume': closeOverlay(); break;
    case 'save': saveGame(true); break;
    case 'journal': case 'codex': case 'skills': case 'map': case 'options': openSub(a); break;
    case 'mainmenu': setState('mainmenu'); break;
    case 'toggle-long': showLong = !showLong; renderInfo(); break;
    case 'close': case 'back': closeOverlay(); break;
    case 'intro-ok': setState('playing'); break;
    case 'dialog-next': advanceDialog(); break;
    case 'quiz-answer': answerQuiz(parseInt(id, 10)); break;
    case 'quiz-next': case 'quiz-retry': quizContinue(); break;
    case 'read': openInfo(id); break;
    case 'enter': travelToSector(id); break;
    default: break;
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'opt-sens') { settings.sensitivity = clamp(parseFloat(el.value) || 2.5, LIMITS.sensMin, LIMITS.sensMax); $('out-sens').textContent = settings.sensitivity.toFixed(1); }
  if (el.id === 'opt-fov') { settings.fov = clamp(parseInt(el.value, 10) || 70, LIMITS.fovMin, LIMITS.fovMax); $('out-fov').textContent = String(settings.fov); camera.fov = settings.fov; camera.updateProjectionMatrix(); }
  if (el.id === 'opt-vol') { settings.volume = clamp(parseFloat(el.value) || 0, 0, 1); $('out-vol').textContent = String(Math.round(settings.volume * 100)); Audio.setVolume(settings.volume); }
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.type === 'checkbox' && el.dataset.key) { settings[el.dataset.key] = el.checked; Store.set(SETTINGS_KEY, settings); refreshWorld(); }
  if (el.id === 'opt-quality') { settings.quality = el.value; Store.set(SETTINGS_KEY, settings); toast('Grafikqualität wird nach dem Neuladen der Seite übernommen.', 4); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.target && ev.target.id === 'heroname' && ev.key === 'Enter') { ev.preventDefault(); document.querySelector('[data-action="name-ok"]').click(); }
});

// ===================================================================== Maus

const lockSupported = ('requestPointerLock' in canvas) && !/[?&]zeiger=aus/.test(location.search) && !touchMode;
let pointerLocked = false, lastUnlockPause = 0;
function requestLock() {
  if (!lockSupported || document.pointerLockElement === canvas) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* Rueckfall: Ziehen */ }
}
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && state === 'playing') { lastUnlockPause = performance.now(); setState('pause'); }
});
let dragging = false, lastMX = 0, lastMY = 0;
canvas.addEventListener('mousedown', (ev) => {
  if (state !== 'playing') return;
  if (!pointerLocked) { requestLock(); dragging = true; lastMX = ev.clientX; lastMY = ev.clientY; }
});
addEventListener('mouseup', () => { dragging = false; });
document.addEventListener('mousemove', (ev) => {
  if (state !== 'playing') return;
  if (pointerLocked) {
    const mx = ev.movementX || 0, my = ev.movementY || 0;
    if (Math.abs(mx) > 250 || Math.abs(my) > 250) return;
    look(mx, my);
  } else if (dragging) { look(ev.clientX - lastMX, ev.clientY - lastMY); lastMX = ev.clientX; lastMY = ev.clientY; }
});
canvas.addEventListener('wheel', (ev) => { if (state === 'playing') { cam.dist = clamp(cam.dist + Math.sign(ev.deltaY) * 0.4, 2.2, 7); ev.preventDefault(); } }, { passive: false });

// ===================================================================== Tastatur

const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'];
addEventListener('keydown', (ev) => {
  if (ev.target && ev.target.tagName === 'INPUT' && ev.target.type === 'text') return;
  const code = ev.code;
  if (['Tab', 'F5', 'Space'].includes(code) && state !== 'mainmenu') ev.preventDefault();
  if (state === 'playing' && GAME_KEYS.includes(code)) { ev.preventDefault(); keys[code] = true; }
  if (ev.repeat) return;
  if (state === 'dialog' && (code === 'KeyE' || code === 'Space' || code === 'Enter')) { advanceDialog(); return; }
  if (state === 'intro' && (code === 'KeyE' || code === 'Enter')) { setState('playing'); return; }
  if (state === 'quiz') {
    const d = code.match(/^Digit([1-3])$/);
    if (d) { answerQuiz(parseInt(d[1], 10) - 1); return; }
    if ((code === 'KeyE' || code === 'Enter') && quiz && quiz.feedback) { quizContinue(); return; }
  }
  if (code === 'KeyE' && state === 'playing') keys.KeyE = true;
  if (code === 'KeyE') { if (state === 'playing') interact(); else if (state === 'info') closeOverlay(); return; }
  if (code === 'Escape' || code === 'KeyP') {
    if (code === 'Escape' && performance.now() - lastUnlockPause < 400) return;
    if (state === 'playing') setState('pause');
    else if (!['mainmenu', 'boot', 'dialog'].includes(state)) closeOverlay();
    return;
  }
  const subs = { KeyJ: 'journal', Tab: 'journal', KeyI: 'codex', KeyK: 'skills', KeyM: 'map' };
  if (subs[code]) {
    if (state === subs[code]) closeOverlay();
    else if (state === 'playing' || state === 'pause') openSub(subs[code]);
    return;
  }
  if (code === 'F5' && state === 'playing') { saveGame(true); return; }
  const m = code.match(/^Digit([1-6])$/);
  if (m && state === 'playing') useAbility(parseInt(m[1], 10));
});
// ===================================================================== Touch (Tablet)

const touchEl = $('touch'), stickBase = $('stick-base'), stickKnob = $('stick-knob');
function setTouchMode(on) {
  touchMode = on;
  document.body.classList.toggle('touch', on);
  touchEl.hidden = !on;
}
setTouchMode(touchMode);
function sendKey(type, code) { dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true })); }
const STICK_R = 56;
let stickId = null, stickCX = 0, stickCY = 0, lookId = null, lookX = 0, lookY = 0;
function stickMove(x, y) {
  let dx = x - stickCX, dy = y - stickCY;
  const d = Math.hypot(dx, dy);
  if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  const m = Math.hypot(dx, dy) / STICK_R;
  touchMove.x = m < 0.12 ? 0 : dx / STICK_R;
  touchMove.y = m < 0.12 ? 0 : -dy / STICK_R;
}
function stickReset() {
  stickId = null; touchMove.x = 0; touchMove.y = 0;
  stickKnob.style.transform = '';
  stickBase.classList.remove('active'); stickBase.style.left = ''; stickBase.style.top = '';
}
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType !== 'touch') return;
  if (!touchMode) setTouchMode(true);
  ev.preventDefault();
  if (state !== 'playing') return;
  if (ev.clientX < innerWidth * 0.42 && stickId === null) {
    stickId = ev.pointerId; stickCX = ev.clientX; stickCY = ev.clientY;
    stickBase.classList.add('active'); stickBase.style.left = stickCX + 'px'; stickBase.style.top = stickCY + 'px';
    stickMove(ev.clientX, ev.clientY);
  } else if (lookId === null) { lookId = ev.pointerId; lookX = ev.clientX; lookY = ev.clientY; }
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
});
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'touch') return;
  if (ev.pointerId === stickId) stickMove(ev.clientX, ev.clientY);
  else if (ev.pointerId === lookId && state === 'playing') { look((ev.clientX - lookX) * 1.8, (ev.clientY - lookY) * 1.8); lookX = ev.clientX; lookY = ev.clientY; }
});
function touchEnd(ev) {
  if (ev.pointerId === stickId) stickReset();
  if (ev.pointerId === lookId) lookId = null;
}
canvas.addEventListener('pointerup', touchEnd);
canvas.addEventListener('pointercancel', touchEnd);
// Knoepfe mit data-key senden Tastendruck (gedrueckt halten = Taste halten, z. B. E bei Datenrauschen)
touchEl.querySelectorAll('button[data-key]').forEach((b) => {
  const code = b.dataset.key;
  let down = false;
  b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); down = true; b.classList.add('on'); sendKey('keydown', code); });
  const up = () => { if (!down) return; down = false; b.classList.remove('on'); sendKey('keyup', code); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  b.addEventListener('contextmenu', (ev) => ev.preventDefault());
});
$('t-run').addEventListener('pointerdown', (ev) => { ev.preventDefault(); touchMove.run = !touchMove.run; $('t-run').classList.toggle('on', touchMove.run); });
// Faehigkeiten antippen, Hinweis antippen = Benutzen
for (let i = 1; i <= 6; i++) $('ab' + i).addEventListener('pointerdown', (ev) => { if (state === 'playing') { ev.preventDefault(); useAbility(i); } });
promptEl.addEventListener('pointerdown', (ev) => { if (state === 'playing') { ev.preventDefault(); sendKey('keydown', 'KeyE'); } });
promptEl.addEventListener('pointerup', () => sendKey('keyup', 'KeyE'));
promptEl.addEventListener('pointercancel', () => sendKey('keyup', 'KeyE'));

addEventListener('keyup', (ev) => {
  // Datenrauschen: auch bei sehr niedriger Bildrate zaehlt die echte Haltedauer
  if (ev.code === 'KeyE' && noise.active && state === 'playing' && isNoisy(focused) && performance.now() - noise.start >= 1500) clearNoise(focused);
  keys[ev.code] = false;
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ===================================================================== Schleife

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.25);
  time += dt;
  if (state === 'playing') {
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    for (let i = 0; i < steps; i++) movePlayer(dt / steps);
    updateFocus();
    if (noise.active) {
      if (keys.KeyE && isNoisy(focused)) {
        // echte Zeit seit dem Druecken (unabhaengig von der Bildrate)
        noise.progress = Math.min(1, (performance.now() - noise.start) / 1500);
        if (noise.progress >= 1) clearNoise(focused);
      } else { noise.active = false; noise.progress = 0; }
    }
    P.minutes += dt * 0.5; // Stationszeit: 1 Minute = 2 Sekunden
    if (P.minutes >= 24 * 60) { P.minutes -= 24 * 60; P.day++; }
  } else if (!gameStarted) {
    cam.yaw = Math.sin(time * 0.05) * 0.35 + 0.15;
    cam.pitch = 0.05;
    player.x = 0; player.z = -14;
  }
  if (hero) {
    hero.root.visible = gameStarted;
    hero.root.position.set(player.x, player.y, player.z);
    hero.root.rotation.y = player.yaw;
    hero.update(dt, state === 'playing' ? player.speed + player.dash * 0.3 : 0, player.grounded);
  }
  if (lightOrb) {
    if (effects.lightUntil > time) lightOrb.position.set(player.x + Math.sin(time * 1.3) * 0.8, player.y + 2.4, player.z + Math.cos(time * 1.3) * 0.8);
    else if (lightOrb.parent) lightOrb.parent.remove(lightOrb);
  }
  if (echoBeam && effects.echoUntil < time && echoBeam.parent) echoBeam.parent.remove(echoBeam);
  if (world) world.update(dt, time);
  updateCamera(dt);
  if (toastTime > 0) { toastTime -= dt; if (toastTime <= 0) toastEl.hidden = true; }
  updateHud(dt);
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ===================================================================== Testschnittstelle

window.TLH = {
  state: () => state,
  area: () => P.area,
  stage: () => P.stage,
  chapter: () => P.chapter,
  level: () => Prog.level(),
  xp: () => P.xp,
  discoveredCount: () => P.discovered.size,
  crystalCount: () => P.crystals.size,
  total: () => Prog.total(),
  completed: () => [...P.completed],
  chapterIds: () => chapters.map((c) => c.id),
  player: () => ({ x: player.x, z: player.z, y: player.y, yaw: player.yaw, camYaw: cam.yaw, pitch: cam.pitch, stamina: player.stamina, energy: player.energy, speed: player.speed }),
  focused: () => (focused ? focused.kind + ':' + focused.id : null),
  prompt: () => (promptEl.hidden ? '' : promptEl.textContent),
  questTarget: () => questInfo().target,
  questLines: () => questInfo().lines.map((l) => l.text),
  points: () => (world && world.kind === 'sector' ? world.points.map((p) => ({ id: p.id, x: p.pos.x, z: p.pos.z, discovered: P.discovered.has(p.id) })) : []),
  crystals: () => (world && world.kind === 'hub' ? world.crystals.map((c) => ({ id: c.id, x: c.pos.x, z: c.pos.z, collected: c.collected })) : []),
  npc: (id) => { const n = world && world.npcs ? world.npcs.find((x) => x.id === id) : null; return n ? { x: n.x, z: n.z } : null; },
  landmarks: () => HUB.landmarks,
  gate: () => ({ x: HUB.gate.x, z: HUB.gate.z }),
  portal: () => ({ x: SECTOR.PORTAL_X, z: 0 }),
  portalOpen: () => !!(world && world.portal && world.portal.open),
  artifacts: () => (world && world.kind === 'sector' ? world.artifacts.map((a) => ({ id: a.id, x: a.pos.x, z: a.pos.z, collected: a.collected })) : []),
  artifactCount: () => P.artifacts.size,
  noisy: () => (world && world.kind === 'sector' ? world.points.filter((p) => isNoisy(p)).map((p) => p.id) : []),
  echo: () => (world && world.echo ? { x: world.echo.pos.x, z: world.echo.pos.z } : null),
  quizPos: () => ({ ...SECTOR.quiz }),
  quizCorrect: () => (quiz ? quiz.ch.quiz[quiz.index].correct : null),
  quizPassed: () => [...P.quizPassed],
  side: () => (P.side ? { ...P.side } : null),
  sideAvailable: () => S.sidequests.filter((q) => !P.sideDone.has(q.id) && q.unlockAfter <= P.completed.size).map((q) => ({ id: q.id, giver: q.giver, type: q.task.type, to: q.task.to, pos: q.task.pos })),
  sideDone: () => P.sideDone.size,
  sideTarget: () => questInfo().sideTarget,
  npcIds: () => (world && world.npcs ? world.npcs.filter((n) => n.marker).map((n) => n.id) : []),
  teleport: (x, z) => { player.x = x; player.z = z; resolveCollisions(); },
  /** Erreichbarkeit aller Ziele vom Startpunkt (Gitter-Breitensuche ueber die Kollision) */
  reachability: () => {
    const step = 0.5, r = player.r + 0.05;
    const blocked = (x, z) => {
      if (world.kind === 'hub') { if (Math.hypot(x, z) > world.radius - 0.6) return true; }
      else if (Math.abs(x) > world.bounds.x - r || Math.abs(z) > world.bounds.z - r) return true;
      return world.colliders.some((c) => c.t === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + r : (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r));
    };
    const key = (i, j) => i + ',' + j;
    const s0 = world.start;
    const seen = new Set([key(Math.round(s0.x / step), Math.round(s0.z / step))]);
    const queue = [[Math.round(s0.x / step), Math.round(s0.z / step)]];
    while (queue.length) {
      const [i, j] = queue.shift();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, k = key(ni, nj);
        if (seen.has(k) || blocked(ni * step, nj * step) || seen.size > 200000) continue;
        seen.add(k); queue.push([ni, nj]);
      }
    }
    const res = [];
    world.interactables.forEach((it) => {
      if (it.kind === 'landmark') return;
      const range = Math.min(it.range || 3, 2.6);
      let ok = false;
      for (const k of seen) { const [i, j] = k.split(',').map(Number); if (Math.hypot(i * step - it.pos.x, j * step - it.pos.z) < range) { ok = true; break; } }
      res.push({ kind: it.kind, id: it.id, ok });
    });
    return res;
  },
  face: (x, z) => { const a = Math.atan2(x - player.x, z - player.z); cam.yaw = a; player.yaw = a; },
  settings: () => JSON.parse(JSON.stringify(settings)),
  frames: () => renderer.info.render.frame
};

// ===================================================================== Start

async function boot() {
  try {
    assets = await loadAssets(renderer);
  } catch (e) {
    console.error(e);
    fail('Die Spieldaten konnten nicht geladen werden: ' + e.message);
    return;
  }
  $('portrait-img').src = emblemDataUrl('#9fe0ff');
  setupPost();
  resize();
  camera.fov = settings.fov;
  hero = createCharacter(assets, { emblem: assets.emblem.gold, cape: true });
  scene.add(hero.root);
  enterWorld('hub');
  placePlayer(0, -14, 0.15);
  bootEl.hidden = true;
  setState('mainmenu');
  clock.start();
  requestAnimationFrame(tick);
}

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(boot, boot);
