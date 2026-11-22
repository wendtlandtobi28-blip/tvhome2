// Laedt alle eingebetteten Ressourcen (Modelle, Himmelslicht, Normalen, Emblem).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

import heroGlb from '../assets/models/hero.glb';
import shuttleGlb from '../assets/models/shuttle.glb';
import cruiserGlb from '../assets/models/cruiser.glb';
import emblemSvg from '../assets/emblem.svg';
import sunsetExr from '@pmndrs/assets/hdri/sunset.exr.js';
import nightExr from '@pmndrs/assets/hdri/night.exr.js';
import normalTiles from '@pmndrs/assets/normals/0025.webp.js';
import normalPanels from '@pmndrs/assets/normals/0016.webp.js';
import normalMetal from '@pmndrs/assets/normals/0008.webp.js';

function toArrayBuffer(u8) {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function base64ToArrayBuffer(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function parseGlb(u8) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(toArrayBuffer(u8), '', resolve, reject);
  });
}

function loadExr(dataUrl) {
  const parsed = new EXRLoader().parse(base64ToArrayBuffer(dataUrl));
  const tex = new THREE.DataTexture(parsed.data, parsed.width, parsed.height, parsed.format, parsed.type);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

function loadImageTexture(dataUrl, repeat) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (repeat) t.repeat.set(repeat, repeat);
      t.anisotropy = 8;
      t.needsUpdate = true;
      resolve(t);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Emblem als Bild (fuer Banner, Umhang, Oberflaeche) */
export function emblemDataUrl(color) {
  const svg = emblemSvg.replace(/currentColor/g, color);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function loadSvgImage(color) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = emblemDataUrl(color);
  });
}

export async function loadAssets(renderer) {
  const [hero, shuttle, cruiser, tiles, panels, metal, emblemGold, emblemDark] = await Promise.all([
    parseGlb(heroGlb), parseGlb(shuttleGlb), parseGlb(cruiserGlb),
    loadImageTexture(normalTiles), loadImageTexture(normalPanels), loadImageTexture(normalMetal),
    loadSvgImage('#e2b866'), loadSvgImage('#1b1b1f')
  ]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sunsetHdr = loadExr(sunsetExr);
  const nightHdr = loadExr(nightExr);
  const envSunset = pmrem.fromEquirectangular(sunsetHdr).texture;
  const envNight = pmrem.fromEquirectangular(nightHdr).texture;
  sunsetHdr.dispose();
  nightHdr.dispose();
  pmrem.dispose();
  return { hero, shuttle, cruiser, normals: { tiles, panels, metal }, emblem: { gold: emblemGold, dark: emblemDark }, env: { sunset: envSunset, night: envNight } };
}
