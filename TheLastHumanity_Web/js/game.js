/*
 * THE LAST HUMANITY - Browser-Version
 * Spiellogik, 3D-Welt (three.js), Steuerung, Oberflaeche, Speichern.
 * Inhalte kommen aus js/content_de.js (erzeugt aus TheLastHumanity/Content/Data/content_de.json).
 */
(function () {
  'use strict';

  var C = window.TLH_CONTENT;
  var bootEl = document.getElementById('boot');

  function fail(message) {
    bootEl.hidden = false;
    bootEl.className = 'error';
    bootEl.innerHTML = '<p>' + esc(message) + '</p>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  if (!C || !C.chapters) {
    fail('Inhaltsdatei js/content_de.js fehlt oder ist beschädigt.');
    return;
  }

  /** UI-Text mit Platzhaltern {0}, {1}, ... */
  function T(key) {
    var text = (C.ui && C.ui[key]) || key;
    for (var i = 1; i < arguments.length; i++) {
      text = text.split('{' + (i - 1) + '}').join(String(arguments[i]));
    }
    return text;
  }

  function paragraphs(text) {
    return String(text).split(/\n\s*\n/).map(function (p) {
      return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  if (typeof THREE === 'undefined') {
    fail('Die 3D-Bibliothek (vendor/three.min.js) konnte nicht geladen werden.');
    return;
  }

  // ====================================================================== Speicher

  var SAVE_KEY = 'tlh.spielstand.v2';
  var SETTINGS_KEY = 'tlh.einstellungen.v1';

  var Store = {
    available: (function () {
      try {
        var k = 'tlh.test';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    })(),
    get: function (key) {
      try {
        var v = window.localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
      } catch (e) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    has: function (key) {
      try {
        return window.localStorage.getItem(key) !== null;
      } catch (e) {
        return false;
      }
    }
  };

  // ====================================================================== Fortschritt

  var LIMITS = { sensMin: 0.5, sensMax: 6, fovMin: 50, fovMax: 100 };
  var DEFAULT_SETTINGS = { sensitivity: 2.5, invertY: false, fov: 72, showHint: true, unlockAll: false };

  function sanitizeSettings(s) {
    var out = {};
    for (var k in DEFAULT_SETTINGS) {
      out[k] = (s && typeof s[k] === typeof DEFAULT_SETTINGS[k]) ? s[k] : DEFAULT_SETTINGS[k];
    }
    out.sensitivity = clamp(out.sensitivity, LIMITS.sensMin, LIMITS.sensMax);
    out.fov = clamp(Math.round(out.fov), LIMITS.fovMin, LIMITS.fovMax);
    return out;
  }

  var P = {
    chapters: C.chapters,
    discovered: new Set(),
    current: null,
    endingSeen: false,
    settings: sanitizeSettings(Store.get(SETTINGS_KEY)),

    chapter: function (id) {
      for (var i = 0; i < this.chapters.length; i++) {
        if (this.chapters[i].id === id) { return this.chapters[i]; }
      }
      return null;
    },
    first: function () {
      for (var i = 0; i < this.chapters.length; i++) {
        if (this.chapters[i].available) { return this.chapters[i]; }
      }
      return null;
    },
    next: function (ch) {
      var i = this.chapters.indexOf(ch);
      return (i >= 0 && i + 1 < this.chapters.length) ? this.chapters[i + 1] : null;
    },
    info: function (id) {
      for (var i = 0; i < this.chapters.length; i++) {
        var pts = this.chapters[i].infoPoints;
        for (var j = 0; j < pts.length; j++) {
          if (pts[j].id === id) { return { chapter: this.chapters[i], point: pts[j] }; }
        }
      }
      return null;
    },
    count: function (ch) {
      var self = this;
      return ch.infoPoints.filter(function (p) { return self.discovered.has(p.id); }).length;
    },
    complete: function (ch) {
      return ch.infoPoints.length > 0 && this.count(ch) === ch.infoPoints.length;
    },
    unlocked: function (ch) {
      if (!ch.available) { return false; }
      if (this.settings.unlockAll) { return true; }
      var i = this.chapters.indexOf(ch);
      return i === 0 || this.complete(this.chapters[i - 1]);
    },
    total: function () {
      return this.chapters.reduce(function (n, c) { return n + c.infoPoints.length; }, 0);
    },
    currentChapter: function () {
      return this.chapter(this.current) || this.first();
    },
    reset: function () {
      this.discovered = new Set();
      this.endingSeen = false;
      this.current = this.first().id;
    },
    hasSave: function () {
      return Store.has(SAVE_KEY);
    },
    save: function (x, z, yaw, pitch) {
      return Store.set(SAVE_KEY, {
        version: 2,
        chapter: this.current,
        discovered: Array.from(this.discovered),
        endingSeen: this.endingSeen,
        pos: [x, z],
        yaw: yaw,
        pitch: pitch,
        savedAt: new Date().toISOString()
      });
    },
    load: function () {
      var s = Store.get(SAVE_KEY);
      if (!s || typeof s !== 'object' || !(s.version <= 2)) { return null; }
      var self = this;
      this.discovered = new Set((s.discovered || []).filter(function (id) { return self.info(id); }));
      var ch = this.chapter(s.chapter);
      this.current = (ch && ch.available) ? ch.id : this.first().id;
      this.endingSeen = !!s.endingSeen;
      return s;
    },
    saveSettings: function () {
      return Store.set(SETTINGS_KEY, this.settings);
    }
  };
  P.current = P.first().id;

  // ====================================================================== Renderer

  var canvas = document.getElementById('scene');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    fail(T('web.webgl_error'));
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(P.settings.fov, 1, 0.05, 220);
  camera.rotation.order = 'YXZ';

  function resize() {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ====================================================================== Halle

  // Masse in Metern (UE-Projekt: Zentimeter). Achsen: x = Hallenlaenge, z = Breite, y = Hoehe.
  var HL = 20, HW = 9, WH = 8, PORTAL_X = 18;
  var START = { x: -17, z: 0, yaw: -Math.PI / 2 };

  var hall = null;

  function color(arr, fallback) {
    var a = Array.isArray(arr) && arr.length === 3 ? arr : fallback;
    return new THREE.Color().setRGB(a[0], a[1], a[2]);
  }

  function autoLocation(i, n) {
    var sx = -HL + 6, ex = HL - 8;
    var step = n > 1 ? (ex - sx) / (n - 1) : 0;
    return { x: sx + i * step, z: (i % 2 === 0) ? -4.5 : 4.5 };
  }

  function textTexture(lines, opts) {
    // lines: [{text, font, color}] ; opts: {width, height, align}
    var W = opts.width || 1024, H = opts.height || 256;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var y = H / (lines.length + 1);
    lines.forEach(function (ln, idx) {
      var size = ln.size;
      do {
        g.font = (ln.weight || '700') + ' ' + size + 'px ' + ln.family;
        size -= 4;
      } while (g.measureText(ln.text).width > W * 0.94 && size > 12);
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 10;
      g.fillStyle = ln.color;
      g.fillText(ln.text, W / 2, y * (idx + 1));
    });
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  var DISPLAY_FONT = '"Cinzel", "Times New Roman", serif';
  var BODY_FONT = '"Alegreya Sans", "Segoe UI", Arial, sans-serif';

  function makeLabel(text, worldWidth, colorCss) {
    var tex = textTexture([{ text: text, size: 96, family: BODY_FONT, color: colorCss || '#f3e6c8' }], { width: 1024, height: 192 });
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    var spr = new THREE.Sprite(mat);
    spr.scale.set(worldWidth, worldWidth * 192 / 1024, 1);
    return spr;
  }

  function disposeObject(obj) {
    obj.traverse(function (o) {
      if (o.geometry) { o.geometry.dispose(); }
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (m.map) { m.map.dispose(); }
          m.dispose();
        });
      }
    });
  }

  function skyTexture(topColor, horizonColor) {
    var cv = document.createElement('canvas');
    cv.width = 2; cv.height = 256;
    var g = cv.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + topColor.getHexString());
    grad.addColorStop(0.62, '#' + horizonColor.getHexString());
    grad.addColorStop(1, '#' + horizonColor.clone().multiplyScalar(0.8).getHexString());
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function buildHall(chapter) {
    if (hall) {
      scene.remove(hall.group);
      disposeObject(hall.group);
      if (scene.background && scene.background.dispose) { scene.background.dispose(); }
    }

    var theme = chapter.theme || {};
    var floorC = color(theme.floor, [0.55, 0.47, 0.36]);
    var wallC = color(theme.wall, [0.32, 0.29, 0.25]);
    var colC = color(theme.column, [0.16, 0.15, 0.13]);
    var torchC = color(theme.torch, [1.0, 0.55, 0.25]);
    var sunPitch = typeof theme.sunPitch === 'number' ? theme.sunPitch : -38;
    var sunIntensity = typeof theme.sunIntensity === 'number' ? theme.sunIntensity : 7;
    var fogDensity = typeof theme.fog === 'number' ? theme.fog : 0.015;

    var group = new THREE.Group();
    var colliders = [];
    var animated = [];
    var interactables = [];
    var points = [];

    var matCache = {};
    function mat(c, extra) {
      var key = c.getHexString() + (extra ? JSON.stringify(extra) : '');
      if (!matCache[key]) {
        var params = { color: c.clone(), roughness: 0.88, metalness: 0.0 };
        if (extra) { for (var k in extra) { params[k] = extra[k]; } }
        matCache[key] = new THREE.MeshStandardMaterial(params);
      }
      return matCache[key];
    }

    function box(x, y, z, sx, sy, sz, c, collide, extra) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(c, extra));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      if (collide) {
        colliders.push({ t: 'b', x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2 });
      }
      return m;
    }

    function cylinder(x, y, z, r, h, c, collide) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      if (collide) { colliders.push({ t: 'c', x: x, z: z, r: r }); }
      return m;
    }

    function sphere(x, y, z, r, c, emissive) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20),
        emissive ? new THREE.MeshStandardMaterial({ color: c.clone(), emissive: c.clone(), emissiveIntensity: emissive, roughness: 0.4 })
          : mat(c));
      m.position.set(x, y, z);
      m.castShadow = !emissive;
      group.add(m);
      return m;
    }

    function pointLight(x, y, z, c, intensity, distance) {
      var l = new THREE.PointLight(c.clone(), intensity, distance, 1.2);
      l.position.set(x, y, z);
      group.add(l);
      return l;
    }

    // --- Boden, Mittelweg, Waende, Gesims
    box(0, -0.3, 0, HL * 2, 0.6, HW * 2, floorC, false);
    box(0, 0.011, 0, HL * 2 - 2, 0.02, 2.6, colC, false);
    [-1, 1].forEach(function (s) {
      box(0, WH / 2, s * (HW + 0.3), HL * 2, WH, 0.6, wallC, true);
      box(s * (HL + 0.3), WH / 2, 0, 0.6, WH, HW * 2 + 1.2, wallC, true);
      box(0, WH - 0.3, s * (HW - 0.2), HL * 2, 0.6, 0.8, colC, false);
    });

    // --- Saeulen
    var round = theme.columnShape !== 'eckig';
    for (var i = -3; i <= 3; i++) {
      [-1, 1].forEach(function (s) {
        var cx = i * 5.5 + 2.75, cz = s * (HW - 2.2);
        if (round) { cylinder(cx, WH / 2, cz, 0.45, WH, colC, true); }
        else { box(cx, WH / 2, cz, 0.8, WH, 0.8, colC, true); }
      });
    }

    // --- Wandlichter (Halter + Flamme), Lichtquellen sparsam
    for (var t = -3; t <= 3; t++) {
      [-1, 1].forEach(function (s) {
        var tx = t * 5.5, tz = s * (HW - 0.12);
        box(tx, 3.6, tz, 0.16, 0.5, 0.16, colC, false);
        var flame = sphere(tx, 3.95, tz - s * 0.05, 0.09, torchC, 2.4);
        animated.push({ type: 'flame', obj: flame, phase: Math.random() * 6.28 });
      });
    }
    [-11, 0, 11].forEach(function (lx) {
      [-1, 1].forEach(function (s) {
        pointLight(lx, 3.9, s * (HW - 0.8), torchC, 0.85, 15);
      });
    });

    // --- Monument in der Hallenmitte
    var M = theme.monument || 'keiner';
    var light = wallC.clone().multiplyScalar(1.4);
    if (M === 'feuer') {
      for (var k = 0; k < 10; k++) {
        var a = k * Math.PI * 2 / 10;
        box(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4, 0.5, 0.4, 0.5, colC, false);
      }
      colliders.push({ t: 'c', x: 0, z: 0, r: 1.7 });
      var ember = sphere(0, 0.2, 0, 0.45, new THREE.Color(1.0, 0.45, 0.1), 2.2);
      ember.scale.y = 0.35;
      var fire = pointLight(0, 0.9, 0, new THREE.Color(1.0, 0.5, 0.15), 1.6, 12);
      animated.push({ type: 'fire', obj: fire, base: 1.6, phase: 0 });
    } else if (M === 'obelisk') {
      box(0, 0.3, 0, 2.2, 0.6, 2.2, colC, true);
      box(0, 3.3, 0, 0.9, 5.4, 0.9, light, false);
      box(0, 6.3, 0, 0.55, 0.6, 0.55, new THREE.Color(0.85, 0.7, 0.3), false, { metalness: 0.6, roughness: 0.35 });
    } else if (M === 'zikkurat') {
      box(0, 0.5, 0, 3.2, 1, 3.2, colC, true);
      box(0, 1.5, 0, 2.3, 1, 2.3, light, false);
      box(0, 2.5, 0, 1.4, 1, 1.4, colC, false);
    } else if (M === 'kugel') {
      cylinder(0, 0.6, 0, 0.8, 1.2, colC, false);
      colliders.push({ t: 'c', x: 0, z: 0, r: 1.1 });
      var globe = sphere(0, 2.3, 0, 1.1, new THREE.Color(0.25, 0.5, 0.85), 0.25);
      animated.push({ type: 'spin', obj: globe });
    } else if (M === 'bogen') {
      box(0, 2, -1.5, 0.6, 4, 0.6, colC, true);
      box(0, 2, 1.5, 0.6, 4, 0.6, colC, true);
      box(0, 4.3, 0, 0.8, 0.6, 3.8, light, false);
    } else if (M === 'turm') {
      [-1.1, 1.1].forEach(function (px) {
        [-1.1, 1.1].forEach(function (pz) { box(px, 3, pz, 0.24, 6, 0.24, colC, true); });
      });
      [1.5, 3.3, 5.1].forEach(function (py) { box(0, py, 0, 2.44, 0.14, 2.44, light, false); });
      box(0, 6.8, 0, 0.3, 1.6, 0.3, new THREE.Color(0.8, 0.2, 0.15), false);
    }

    // --- Inschrift an der Stirnwand (ueber dem Tor)
    var insTex = textTexture([
      { text: chapter.number + '. ' + chapter.title, size: 120, family: DISPLAY_FONT, color: '#f0d7a0' },
      { text: chapter.era, size: 64, family: BODY_FONT, weight: '500', color: '#d8cbb0' }
    ], { width: 2048, height: 400 });
    var ins = new THREE.Mesh(new THREE.PlaneGeometry(14, 14 * 400 / 2048),
      new THREE.MeshBasicMaterial({ map: insTex, transparent: true, depthWrite: false }));
    ins.position.set(HL - 0.02, 6.0, 0);
    ins.rotation.y = -Math.PI / 2;
    group.add(ins);

    // --- Informationspunkte
    var n = chapter.infoPoints.length;
    chapter.infoPoints.forEach(function (entry, idx) {
      var loc = Array.isArray(entry.location) ? { x: entry.location[0] / 100, z: entry.location[1] / 100 } : autoLocation(idx, n);
      var root = new THREE.Group();
      root.position.set(loc.x, 0, loc.z);
      var ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 24), mat(new THREE.Color(0.12, 0.11, 0.1)));
      ped.position.y = 0.5;
      ped.castShadow = true;
      ped.receiveShadow = true;
      root.add(ped);
      var orbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 });
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 20), orbMat);
      orb.position.y = 1.35;
      root.add(orb);
      var pl = new THREE.PointLight(0xffffff, 0.9, 6, 1.2);
      pl.position.y = 1.75;
      root.add(pl);
      var label = makeLabel(entry.title, 1.9);
      label.position.y = 2.25;
      root.add(label);
      group.add(root);
      colliders.push({ t: 'c', x: loc.x, z: loc.z, r: 0.42 });

      var item = {
        kind: 'info', id: entry.id, title: entry.title,
        target: new THREE.Vector3(loc.x, 1.35, loc.z),
        orb: orb, light: pl, focused: false, discovered: false, phase: idx * 1.3
      };
      interactables.push(item);
      points.push(item);
    });

    // --- Tor
    var stone = new THREE.Color(0.09, 0.085, 0.08);
    box(PORTAL_X, 1.8, -1.65, 0.7, 3.6, 0.7, stone, true);
    box(PORTAL_X, 1.8, 1.65, 0.7, 3.6, 0.7, stone, true);
    box(PORTAL_X, 3.95, 0, 0.8, 0.7, 4.1, stone, false);
    var veilMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, transparent: true, opacity: 0.8 });
    var veil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.6, 2.6), veilMat);
    veil.position.set(PORTAL_X, 1.8, 0);
    group.add(veil);
    colliders.push({ t: 'b', x0: PORTAL_X - 0.2, x1: HL, z0: -1.3, z1: 1.3 });
    var portalLight = pointLight(PORTAL_X - 1.2, 2.2, 0, new THREE.Color(1, 1, 1), 1.2, 9);
    var portalLabelHolder = new THREE.Group();
    portalLabelHolder.position.set(PORTAL_X - 0.45, 4.85, 0);
    group.add(portalLabelHolder);
    var portal = {
      kind: 'portal', target: new THREE.Vector3(PORTAL_X, 1.6, 0),
      veil: veil, light: portalLight, labelHolder: portalLabelHolder, label: null, labelText: '',
      open: false, focused: false
    };
    interactables.push(portal);

    // --- Licht, Himmel, Nebel
    var t01 = clamp((-sunPitch - 8) / 40, 0, 1);
    var bright = clamp(sunIntensity / 7, 0.35, 1.25);
    var top = new THREE.Color().setRGB(lerp(0.07, 0.2, t01), lerp(0.09, 0.42, t01), lerp(0.22, 0.82, t01)).multiplyScalar(bright);
    var horizon = new THREE.Color().setRGB(lerp(0.95, 0.78, t01), lerp(0.55, 0.83, t01), lerp(0.38, 0.9, t01)).multiplyScalar(bright);
    scene.background = skyTexture(top, horizon);
    var fogFar = clamp(140 - fogDensity * 2500, 40, 140);
    scene.fog = new THREE.Fog(horizon.clone().multiplyScalar(0.85), 18, fogFar);

    var hemi = new THREE.HemisphereLight(horizon.clone(), floorC.clone().multiplyScalar(0.4), 0.42 * bright + 0.12);
    group.add(hemi);
    var el = THREE.MathUtils.degToRad(-sunPitch);
    var az = THREE.MathUtils.degToRad(35);
    var sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.9, 0.76), 1.5 * bright);
    sun.position.set(Math.cos(el) * Math.cos(az) * 40, Math.sin(el) * 40, Math.cos(el) * Math.sin(az) * 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 100;
    sun.shadow.bias = -0.0005;
    group.add(sun);
    group.add(sun.target);

    scene.add(group);
    hall = {
      chapterId: chapter.id, group: group, colliders: colliders, animated: animated,
      interactables: interactables, points: points, portal: portal
    };
  }

  function setLabel(holder, item, text, colorCss) {
    if (item.labelText === text) { return; }
    if (item.label) {
      holder.remove(item.label);
      disposeObject(item.label);
    }
    item.label = makeLabel(text, 3.4, colorCss);
    item.labelText = text;
    holder.add(item.label);
  }

  var GOLD = new THREE.Color(1.0, 0.68, 0.22);
  var MEMORY = new THREE.Color(0.30, 0.78, 1.0);
  var LOCKED = new THREE.Color(0.55, 0.12, 0.1);

  function refreshWorld() {
    if (!hall) { return; }
    hall.points.forEach(function (p) {
      p.discovered = P.discovered.has(p.id);
      var c = p.discovered ? MEMORY : GOLD;
      p.orb.material.color.copy(c);
      p.orb.material.emissive.copy(c);
      p.light.color.copy(c);
      p.light.intensity = p.focused ? 2.0 : 0.9;
    });

    var cur = P.currentChapter();
    var nxt = P.next(cur);
    var nextPlayable = !!(nxt && nxt.available);
    var portal = hall.portal;
    portal.open = nextPlayable ? P.unlocked(nxt) : P.complete(cur);
    var pc = portal.open ? MEMORY : LOCKED;
    portal.veil.material.emissive.copy(pc);
    portal.veil.material.emissiveIntensity = portal.open ? 1.3 : 0.45;
    portal.light.color.copy(pc);
    portal.light.intensity = (portal.open ? 1.4 : 0.5) * (portal.focused ? 1.8 : 1);
    var labelText = nextPlayable ? T('portal.label_next', nxt.number, nxt.title) : T('portal.label_end');
    setLabel(portal.labelHolder, portal, labelText, portal.open ? '#bfe6ff' : '#e9b7a8');
  }

  // ====================================================================== Spieler und Steuerung

  var player = { x: START.x, z: START.z, y: 0, vy: 0, yaw: START.yaw, pitch: 0, r: 0.35, eye: 1.65, grounded: true };
  var keys = {};
  var pointerLocked = false;
  var lastUnlockPause = 0;

  function resolveCollisions() {
    var r = player.r;
    for (var pass = 0; pass < 2; pass++) {
      player.x = clamp(player.x, -HL + r, HL - r);
      player.z = clamp(player.z, -HW + r, HW - r);
      for (var i = 0; i < hall.colliders.length; i++) {
        var c = hall.colliders[i];
        if (c.t === 'c') {
          var dx = player.x - c.x, dz = player.z - c.z;
          var d = Math.hypot(dx, dz), m = c.r + r;
          if (d < m) {
            if (d < 1e-6) { player.x = c.x - m; }
            else { player.x = c.x + dx / d * m; player.z = c.z + dz / d * m; }
          }
        } else {
          var cx = clamp(player.x, c.x0, c.x1), cz = clamp(player.z, c.z0, c.z1);
          var ex = player.x - cx, ez = player.z - cz;
          var dd = Math.hypot(ex, ez);
          if (dd > 0 && dd < r) {
            player.x = cx + ex / dd * r;
            player.z = cz + ez / dd * r;
          } else if (dd === 0) {
            var left = player.x - c.x0, right = c.x1 - player.x, front = player.z - c.z0, back = c.z1 - player.z;
            var mn = Math.min(left, right, front, back);
            if (mn === left) { player.x = c.x0 - r; }
            else if (mn === right) { player.x = c.x1 + r; }
            else if (mn === front) { player.z = c.z0 - r; }
            else { player.z = c.z1 + r; }
          }
        }
      }
    }
  }

  function movePlayer(dt) {
    var fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    var side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    var speed = (keys.ShiftLeft || keys.ShiftRight) ? 6.5 : 3.5;
    var len = Math.hypot(fwd, side);
    if (len > 0) {
      fwd /= len; side /= len;
      var sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      // Blickrichtung (-sin, -cos), rechts (cos, -sin)
      player.x += (-sy * fwd + cy * side) * speed * dt;
      player.z += (-cy * fwd - sy * side) * speed * dt;
    }
    if (keys.Space && player.grounded) {
      player.vy = 4.4;
      player.grounded = false;
    }
    player.vy -= 13 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; }
    resolveCollisions();
  }

  function look(dx, dy) {
    var s = P.settings.sensitivity * 0.0011;
    player.yaw -= dx * s;
    player.pitch -= dy * s * (P.settings.invertY ? -1 : 1);
    player.pitch = clamp(player.pitch, -1.45, 1.45);
  }

  function applyCamera() {
    camera.position.set(player.x, player.y + player.eye, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  function teleportToStart() {
    player.x = START.x; player.z = START.z; player.y = 0; player.vy = 0;
    player.yaw = START.yaw; player.pitch = 0;
  }

  // ====================================================================== Interaktion

  var focused = null;
  var tmpV = new THREE.Vector3();
  var tmpF = new THREE.Vector3();

  function setFocus(item) {
    if (focused === item) { return; }
    if (focused) { focused.focused = false; }
    focused = item;
    if (focused) { focused.focused = true; }
    refreshWorld();
  }

  function updateFocus() {
    applyCamera();
    camera.getWorldDirection(tmpF);
    var best = null, bestDot = 0.55;
    hall.interactables.forEach(function (it) {
      tmpV.copy(it.target).sub(camera.position);
      var d = tmpV.length();
      if (d > 3.8 || d < 1e-4) { return; }
      var dot = tmpF.dot(tmpV.divideScalar(d));
      if (dot > bestDot) { bestDot = dot; best = it; }
    });
    setFocus(best);
  }

  function promptText() {
    if (state !== 'playing' || !focused) { return ''; }
    if (focused.kind === 'info') {
      return T(P.discovered.has(focused.id) ? 'hud.interact_again' : 'hud.interact', focused.title);
    }
    var cur = P.currentChapter();
    if (!hall.portal.open) { return T('hud.portal_locked', P.count(cur), cur.infoPoints.length); }
    var nxt = P.next(cur);
    if (nxt && nxt.available) { return T('hud.portal_next', nxt.number, nxt.title); }
    return T('hud.portal_ending');
  }

  function interact() {
    if (!focused) { return; }
    if (focused.kind === 'info') {
      var id = focused.id;
      if (!P.discovered.has(id)) {
        P.discovered.add(id);
        refreshWorld();
        saveGame(false);
        var cur = P.currentChapter();
        toast(T(P.complete(cur) ? 'toast.chapter_complete' : 'toast.discovered'), 4.5);
      }
      openInfo(id);
    } else {
      usePortal();
    }
  }

  function usePortal() {
    var cur = P.currentChapter();
    var nxt = P.next(cur);
    if (nxt && nxt.available) {
      if (P.unlocked(nxt)) { travelTo(nxt.id); }
      else { toast(T('toast.portal_locked')); }
      return;
    }
    if (P.complete(cur)) {
      P.endingSeen = true;
      saveGame(false);
      setState('ending');
    } else {
      toast(T('toast.portal_locked'));
    }
  }

  function travelTo(chapterId) {
    var ch = P.chapter(chapterId);
    if (!ch || !P.unlocked(ch)) { return; }
    P.current = ch.id;
    focused = null;
    buildHall(ch);
    teleportToStart();
    refreshWorld();
    gameStarted = true;
    toast(T('toast.chapter', ch.number, ch.title), 5);
    setState('playing');
    saveGame(false);
  }

  function ensureHall() {
    var ch = P.currentChapter();
    if (!hall || hall.chapterId !== ch.id) {
      focused = null;
      buildHall(ch);
    }
  }

  // ====================================================================== Speichern / Laden

  function saveGame(showMessage) {
    if (!gameStarted) { return; }
    var ok = P.save(player.x, player.z, player.yaw, player.pitch);
    if (showMessage || !ok) {
      toast(ok ? T('toast.saved') : (Store.available ? T('toast.save_failed') : T('web.storage_off')));
    }
    if (state === 'pause') { renderMenu(true); }
  }

  function newGame() {
    P.reset();
    ensureHall();
    teleportToStart();
    refreshWorld();
    gameStarted = true;
    toast(T('toast.newgame'), 5);
    setState('playing');
  }

  function continueGame() {
    var s = P.load();
    if (!s) { toast(T('toast.nosave')); return; }
    ensureHall();
    teleportToStart();
    if (Array.isArray(s.pos) && s.pos.length === 2 && isFinite(s.pos[0]) && isFinite(s.pos[1])) {
      player.x = s.pos[0]; player.z = s.pos[1];
    }
    if (isFinite(s.yaw)) { player.yaw = s.yaw; }
    if (isFinite(s.pitch)) { player.pitch = clamp(s.pitch, -1.45, 1.45); }
    resolveCollisions();
    refreshWorld();
    gameStarted = true;
    toast(T('toast.loaded'));
    setState('playing');
  }

  // ====================================================================== Oberflaeche

  var screens = {
    menu: document.getElementById('menu'),
    info: document.getElementById('info'),
    overview: document.getElementById('overview'),
    options: document.getElementById('options'),
    ending: document.getElementById('ending')
  };
  var hud = document.getElementById('hud');
  var promptEl = document.getElementById('prompt');
  var toastEl = document.getElementById('toast');
  var chapterLineEl = document.getElementById('chapterLine');
  var hintEl = document.getElementById('hint');
  var lockHintEl = document.getElementById('lockHint');

  var state = 'boot';            // mainmenu, playing, pause, info, overview, options, ending
  var gameStarted = false;
  var showLong = false;
  var openInfoId = null;
  var returnFrom = { info: 'playing', overview: 'mainmenu', options: 'mainmenu' };
  var confirmNew = false;
  var toastTime = 0;

  function toast(text, seconds) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastTime = seconds || 3.2;
  }

  function button(action, label, opts) {
    opts = opts || {};
    return '<button type="button" data-action="' + action + '"' +
      (opts.id ? ' data-id="' + esc(opts.id) + '"' : '') +
      (opts.cls ? ' class="' + opts.cls + '"' : '') +
      (opts.disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  function renderMenu(pause) {
    var hasSave = P.hasSave();
    var html = '<div class="tablet" role="dialog" aria-label="' + esc(T('menu.title')) + '">';
    html += '<h1>' + esc(T('menu.title')) + '</h1>';
    html += '<div class="subtitle">' + esc(pause ? T('menu.pause_subtitle') : T('menu.subtitle')) + '</div>';
    html += '<div class="buttons">';
    if (pause) {
      html += button('resume', T('menu.resume'), { cls: 'primary' });
      html += button('save', T('menu.save'));
      html += button('load', T('menu.load'), { disabled: !hasSave });
      html += button('overview', T('menu.chapters'));
      html += button('options', T('menu.options'));
      html += button('mainmenu', T('menu.mainmenu'));
    } else if (confirmNew) {
      html += '<div class="confirm"><div>' + esc(T('web.confirm_new')) + '</div><div class="row">' +
        button('new-confirm', T('web.confirm_yes'), { cls: 'primary' }) + button('new-cancel', T('web.confirm_no')) + '</div></div>';
    } else {
      html += button('new', T('menu.new'), { cls: hasSave ? '' : 'primary' });
      html += button('continue', T('menu.continue'), { disabled: !hasSave, cls: hasSave ? 'primary' : '' });
      html += button('overview', T('menu.chapters'));
      html += button('options', T('menu.options'));
    }
    html += '</div>';
    html += '<div class="controls">' + esc(T('menu.controls')) + '\n' + esc(T('web.esc_note')) + '</div>';
    if (!pause && !hasSave) { html += '<div class="note">' + esc(T('menu.nosave_hint')) + '</div>'; }
    if (!Store.available) { html += '<div class="note warn">' + esc(T('web.storage_off')) + '</div>'; }
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches) {
      html += '<div class="note warn">' + esc(T('web.touch_hint')) + '</div>';
    }
    html += '</div>';
    screens.menu.innerHTML = html;
  }

  function renderInfo() {
    var found = P.info(openInfoId);
    if (!found) { return; }
    var ch = found.chapter, pt = found.point;
    var fiction = pt.kind === 'fiktion';
    var html = '<div class="tablet" role="dialog" aria-label="' + esc(pt.title) + '">';
    html += '<div class="eyebrow"><span>' + esc(T('info.chapter', ch.number, ch.title)) + '</span>' +
      '<span class="kind' + (fiction ? ' fiction' : '') + '">' + esc(T(fiction ? 'info.kind_fiction' : 'info.kind_fact')) + '</span></div>';
    html += '<h2>' + esc(pt.title) + '</h2>';
    html += '<div class="mode">' + esc(T(showLong ? 'info.label_long' : 'info.label_short')) + '</div>';
    html += '<div class="scroll reading">' + paragraphs(showLong ? pt.long : pt.short) + '</div>';
    html += '<div class="row">' + button('toggle-long', T(showLong ? 'info.toggle_short' : 'info.toggle_long')) +
      button('close', T('info.close'), { cls: 'primary' }) + '</div>';
    html += '</div>';
    screens.info.innerHTML = html;
  }

  function renderOverview() {
    var html = '<div class="tablet" role="dialog" aria-label="' + esc(T('chapters.title')) + '">';
    html += '<h2>' + esc(T('chapters.title')) + '</h2>';
    html += '<div class="total">' + esc(T('chapters.total', P.discovered.size, P.total())) + '</div>';
    html += '<div class="scroll"><div class="cards">';
    P.chapters.forEach(function (ch, idx) {
      var unlocked = P.unlocked(ch);
      var done = P.complete(ch);
      var here = gameStarted && P.current === ch.id;
      var status;
      if (!ch.available) { status = T('chapters.unavailable'); }
      else if (!unlocked) { status = T('chapters.locked', idx > 0 ? P.chapters[idx - 1].number : 0); }
      else { status = T(done ? 'chapters.complete' : 'chapters.discovered', P.count(ch), ch.infoPoints.length); }
      if (here) { status = T('chapters.current') + ' · ' + status; }
      var cls = 'card' + (unlocked ? ' open' : ' locked') + (done ? ' done' : '') + (here ? ' here' : '');
      html += '<div class="' + cls + '">';
      html += '<div class="head"><h3>' + esc(T('chapters.heading', ch.number, ch.title)) + '</h3><span class="status">' + esc(status) + '</span></div>';
      html += '<div class="era">' + esc(ch.era) + '</div>';
      html += '<div>' + esc(ch.summary) + '</div>';
      var entries = ch.infoPoints.filter(function (p) { return P.discovered.has(p.id); });
      if (entries.length) {
        html += '<div class="entries">' + entries.map(function (p) {
          return button('read', p.title, { id: p.id, cls: 'small' });
        }).join('') + '</div>';
      }
      if (gameStarted && unlocked && !here) {
        html += '<div class="enter">' + button('enter', T('chapters.enter'), { id: ch.id, cls: 'primary' }) + '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
    html += '<div class="row">' + button('back', T('chapters.back'), { cls: 'primary' }) + '</div>';
    html += '</div>';
    screens.overview.innerHTML = html;
  }

  function renderOptions() {
    var s = P.settings;
    var html = '<div class="tablet" role="dialog" aria-label="' + esc(T('options.title')) + '">';
    html += '<h2>' + esc(T('options.title')) + '</h2>';
    html += '<div class="scroll">';
    html += '<div class="opt"><label for="opt-sens">' + esc(T('options.sensitivity')) + '</label><div class="ctl">' +
      '<input id="opt-sens" type="range" min="' + LIMITS.sensMin + '" max="' + LIMITS.sensMax + '" step="0.1" value="' + s.sensitivity + '">' +
      '<output id="out-sens">' + s.sensitivity.toFixed(1) + '</output></div></div>';
    html += '<div class="opt"><label for="opt-fov">' + esc(T('options.fov')) + '</label><div class="ctl">' +
      '<input id="opt-fov" type="range" min="' + LIMITS.fovMin + '" max="' + LIMITS.fovMax + '" step="1" value="' + s.fov + '">' +
      '<output id="out-fov">' + s.fov + '</output></div></div>';
    [['opt-invert', 'invertY', 'options.invert_y'], ['opt-hint', 'showHint', 'options.controls_hint'], ['opt-unlock', 'unlockAll', 'options.unlock_all']]
      .forEach(function (o) {
        html += '<div class="opt"><label for="' + o[0] + '">' + esc(T(o[2])) + '</label><div class="ctl">' +
          '<input id="' + o[0] + '" type="checkbox" data-key="' + o[1] + '"' + (s[o[1]] ? ' checked' : '') + '></div></div>';
      });
    html += '<p class="hint">' + esc(T('options.unlock_all_hint')) + '</p>';
    html += '</div>';
    html += '<div class="row">' + button('back', T('options.back'), { cls: 'primary' }) + '</div>';
    html += '</div>';
    screens.options.innerHTML = html;
  }

  function renderEnding() {
    var html = '<div class="tablet memory" role="dialog" aria-label="' + esc(C.ending.title) + '">';
    html += '<h2>' + esc(C.ending.title) + '</h2>';
    html += '<div class="scroll reading">' + paragraphs(C.ending.text) + '</div>';
    html += '<div class="stats">' + esc(T('ending.stats', P.discovered.size, P.total())) + '</div>';
    html += '<div class="row">' + button('close', T('ending.continue')) + button('mainmenu', T('ending.mainmenu'), { cls: 'primary' }) + '</div>';
    html += '</div>';
    screens.ending.innerHTML = html;
  }

  function applySettings() {
    camera.fov = P.settings.fov;
    camera.updateProjectionMatrix();
    hintEl.hidden = !P.settings.showHint;
    refreshWorld();
  }

  function setState(next) {
    var prev = state;
    state = next;
    if (next === 'mainmenu') { confirmNew = false; renderMenu(false); }
    if (next === 'pause') { renderMenu(true); }
    if (next === 'info') { renderInfo(); }
    if (next === 'overview') { renderOverview(); }
    if (next === 'options') { renderOptions(); }
    if (next === 'ending') { renderEnding(); }

    screens.menu.hidden = !(next === 'mainmenu' || next === 'pause');
    screens.info.hidden = next !== 'info';
    screens.overview.hidden = next !== 'overview';
    screens.options.hidden = next !== 'options';
    screens.ending.hidden = next !== 'ending';
    hud.hidden = !(next === 'playing');

    if (next === 'playing') {
      requestLock();
      canvas.focus({ preventScroll: true });
    } else {
      setFocus(null);
      keys = {};
      if (document.pointerLockElement === canvas) { document.exitPointerLock(); }
      var first = document.querySelector('.screen:not([hidden]) button:not(:disabled)');
      if (first && prev !== next) { first.focus({ preventScroll: true }); }
    }
    updateHud();
  }

  function openInfo(id) {
    if (!P.info(id)) { return; }
    if (state !== 'info') { returnFrom.info = state; }
    openInfoId = id;
    setState('info');
  }

  function openSub(name) {
    if (state !== name) { returnFrom[name] = state; }
    setState(name);
  }

  function closeOverlay() {
    switch (state) {
      case 'pause':
      case 'ending':
        setState(gameStarted ? 'playing' : 'mainmenu');
        break;
      case 'info':
        setState(returnFrom.info === 'info' ? 'playing' : returnFrom.info);
        break;
      case 'overview':
        setState(returnFrom.overview === 'overview' ? 'mainmenu' : returnFrom.overview);
        break;
      case 'options':
        P.saveSettings();
        setState(returnFrom.options === 'options' ? 'mainmenu' : returnFrom.options);
        break;
      default:
        break;
    }
  }

  function updateHud() {
    if (state !== 'playing') { return; }
    var cur = P.currentChapter();
    chapterLineEl.textContent = T('hud.chapter', cur.number, cur.title, P.count(cur), cur.infoPoints.length);
    var pt = promptText();
    promptEl.hidden = !pt;
    if (pt && promptEl.textContent !== pt) { promptEl.textContent = pt; }
    hintEl.textContent = T('hud.controls');
    hintEl.hidden = !P.settings.showHint;
    lockHintEl.textContent = T('web.lock_hint');
    lockHintEl.hidden = pointerLocked || !lockSupported;
  }

  // Klicks in allen Tafeln
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('button[data-action]');
    if (!btn || btn.disabled) { return; }
    var a = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    switch (a) {
      case 'new':
        if (P.hasSave()) { confirmNew = true; renderMenu(false); var b = screens.menu.querySelector('button'); if (b) { b.focus(); } }
        else { newGame(); }
        break;
      case 'new-confirm': confirmNew = false; newGame(); break;
      case 'new-cancel': confirmNew = false; renderMenu(false); break;
      case 'continue': case 'load': continueGame(); break;
      case 'resume': closeOverlay(); break;
      case 'save': saveGame(true); break;
      case 'overview': openSub('overview'); break;
      case 'options': openSub('options'); break;
      case 'mainmenu': setState('mainmenu'); break;
      case 'toggle-long': showLong = !showLong; renderInfo(); break;
      case 'close': case 'back': closeOverlay(); break;
      case 'read': openInfo(id); break;
      case 'enter': travelTo(id); break;
      default: break;
    }
  });

  // Optionen live anwenden
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.id === 'opt-sens') {
      P.settings.sensitivity = clamp(parseFloat(el.value) || DEFAULT_SETTINGS.sensitivity, LIMITS.sensMin, LIMITS.sensMax);
      document.getElementById('out-sens').textContent = P.settings.sensitivity.toFixed(1);
    } else if (el.id === 'opt-fov') {
      P.settings.fov = clamp(parseInt(el.value, 10) || DEFAULT_SETTINGS.fov, LIMITS.fovMin, LIMITS.fovMax);
      document.getElementById('out-fov').textContent = String(P.settings.fov);
    }
    applySettings();
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.type === 'checkbox' && el.getAttribute('data-key')) {
      P.settings[el.getAttribute('data-key')] = el.checked;
      applySettings();
      if (state === 'options') { P.saveSettings(); }
    }
  });

  // ====================================================================== Maus / Zeigersperre

  // ?zeiger=aus schaltet das Einfangen der Maus ab (Umsehen dann mit gedrueckter Maustaste)
  var lockSupported = ('requestPointerLock' in canvas) && !/[?&]zeiger=aus/.test(window.location.search);

  function requestLock() {
    if (!lockSupported || document.pointerLockElement === canvas) { return; }
    try {
      var r = canvas.requestPointerLock();
      if (r && typeof r.catch === 'function') { r.catch(function () { /* Hinweis bleibt sichtbar */ }); }
    } catch (e) {
      /* Zeigersperre nicht moeglich: Umsehen per Ziehen mit gedrueckter Maustaste */
    }
  }

  document.addEventListener('pointerlockchange', function () {
    pointerLocked = document.pointerLockElement === canvas;
    if (!pointerLocked && state === 'playing') {
      // Esc im Browser gibt die Maus frei -> Pausenmenue
      lastUnlockPause = performance.now();
      setState('pause');
    }
    updateHud();
  });
  document.addEventListener('pointerlockerror', function () { updateHud(); });

  var dragging = false, lastMX = 0, lastMY = 0;
  canvas.addEventListener('mousedown', function (ev) {
    if (state !== 'playing') { return; }
    if (!pointerLocked) {
      requestLock();
      dragging = true;
      lastMX = ev.clientX; lastMY = ev.clientY;
    }
  });
  window.addEventListener('mouseup', function () { dragging = false; });
  document.addEventListener('mousemove', function (ev) {
    if (state !== 'playing') { return; }
    if (pointerLocked) {
      var mx = ev.movementX || 0, my = ev.movementY || 0;
      // Manche Browser melden direkt nach dem Einfangen der Maus unsinnig grosse Spruenge: ignorieren
      if (Math.abs(mx) > 250 || Math.abs(my) > 250) { return; }
      look(mx, my);
    } else if (dragging) {
      look(ev.clientX - lastMX, ev.clientY - lastMY);
      lastMX = ev.clientX; lastMY = ev.clientY;
    }
  });

  // ====================================================================== Tastatur

  var GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'];

  window.addEventListener('keydown', function (ev) {
    var code = ev.code;
    if (code === 'Tab' || code === 'F5') { ev.preventDefault(); }
    if (state === 'playing' && GAME_KEYS.indexOf(code) >= 0) {
      ev.preventDefault();
      keys[code] = true;
    }
    if (ev.repeat) { return; }

    if (code === 'KeyE') {
      if (state === 'playing') { interact(); }
      else if (state === 'info') { closeOverlay(); }
    } else if (code === 'Escape' || code === 'KeyP') {
      if (code === 'Escape' && performance.now() - lastUnlockPause < 400) { return; }
      if (state === 'playing') { setState('pause'); }
      else if (state !== 'mainmenu' && state !== 'boot') { closeOverlay(); }
    } else if (code === 'Tab' || code === 'KeyK') {
      if (state === 'overview') { closeOverlay(); }
      else if (state === 'playing' || state === 'pause') { openSub('overview'); }
    } else if (code === 'F5') {
      if (state === 'playing') { saveGame(true); }
    }
  });
  window.addEventListener('keyup', function (ev) { keys[ev.code] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  // ====================================================================== Spielschleife

  var clock = new THREE.Clock();
  var elapsed = 0;

  function tick() {
    // Auch auf langsamen Rechnern korrekt: grosse Zeitschritte in kleine Teilschritte zerlegen
    var dt = Math.min(clock.getDelta(), 0.25);
    elapsed += dt;

    if (state === 'playing') {
      var steps = Math.max(1, Math.ceil(dt / 0.02));
      for (var si = 0; si < steps; si++) { movePlayer(dt / steps); }
      updateFocus();
    } else if (!gameStarted) {
      // Titelbild: langsamer Blick durch die Halle
      player.x = -15; player.z = 0; player.y = 0.4;
      player.yaw = START.yaw + Math.sin(elapsed * 0.08) * 0.5;
      player.pitch = 0.08;
    }
    applyCamera();

    if (hall) {
      hall.points.forEach(function (p) {
        p.orb.position.y = 1.35 + Math.sin(elapsed * 1.8 + p.phase) * 0.06;
        var s = (p.focused ? 1.25 : 1) * (1 + Math.sin(elapsed * 3.1 + p.phase) * 0.05);
        p.orb.scale.setScalar(s);
      });
      hall.animated.forEach(function (a) {
        if (a.type === 'flame') { a.obj.scale.setScalar(1 + Math.sin(elapsed * 9 + a.phase) * 0.18); }
        else if (a.type === 'fire') { a.obj.intensity = a.base * (0.85 + Math.sin(elapsed * 7.3) * 0.08 + Math.sin(elapsed * 13.1) * 0.06); }
        else if (a.type === 'spin') { a.obj.rotation.y += dt * 0.25; }
      });
      if (hall.portal.open) {
        hall.portal.veil.scale.z = 1 + Math.sin(elapsed * 2.2) * 0.04;
      }
    }

    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) { toastEl.hidden = true; }
    }
    updateHud();
    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
  }

  // ====================================================================== Testschnittstelle (fuer automatische Tests)

  window.TLH = {
    state: function () { return state; },
    chapter: function () { return P.current; },
    discoveredCount: function () { return P.discovered.size; },
    total: function () { return P.total(); },
    player: function () { return { x: player.x, z: player.z, y: player.y, yaw: player.yaw, pitch: player.pitch }; },
    focused: function () { return focused ? (focused.kind === 'info' ? focused.id : 'portal') : null; },
    portalOpen: function () { return !!(hall && hall.portal.open); },
    points: function () {
      return hall ? hall.points.map(function (p) { return { id: p.id, x: p.target.x, z: p.target.z, discovered: p.discovered }; }) : [];
    },
    /** Stellt die Figur vor ein Ziel und dreht sie dorthin (simuliert Hinlaufen). */
    standBefore: function (x, z, distance) {
      var dx = player.x - x, dz = player.z - z;
      var d = Math.hypot(dx, dz) || 1;
      distance = distance || 1.6;
      player.x = x + dx / d * distance;
      player.z = z + dz / d * distance;
      resolveCollisions();
      var vx = x - player.x, vz = z - player.z;
      player.yaw = Math.atan2(-vx, -vz);
      player.pitch = -0.08;
      applyCamera();
    },
    /** Dreht die Figur zu einem Punkt (wie Maussteuerung). */
    face: function (x, z) {
      player.yaw = Math.atan2(-(x - player.x), -(z - player.z));
      player.pitch = -0.08;
    },
    portal: function () { return { x: PORTAL_X, z: 0 }; },
    prompt: function () { return promptEl.hidden ? '' : promptEl.textContent; },
    settings: function () { return JSON.parse(JSON.stringify(P.settings)); },
    fps: function () { return renderer.info.render.frame; }
  };

  // ====================================================================== Start

  function start() {
    buildHall(P.currentChapter());
    refreshWorld();
    applySettings();
    bootEl.hidden = true;
    setState('mainmenu');
    clock.start();
    window.requestAnimationFrame(tick);
  }

  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  var timeout = new Promise(function (res) { setTimeout(res, 2500); });
  Promise.race([fontsReady, timeout]).then(start, start);
})();
