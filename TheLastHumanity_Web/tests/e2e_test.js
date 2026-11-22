/*
 * THE LAST HUMANITY - automatischer Gesamttest (Playwright + Chromium), Stand: 20 Kapitel.
 *
 * Teil A (zu Fuss, wie ein Mensch): Hauptmenue, Namenseingabe, Steuerung, Kamera, Kollision,
 *   Gespraech, Erkundung, Datenkristalle, Faehigkeiten, Menues, zwei Nebenquests,
 *   Sektor 1 komplett (Erinnerungen, Datenrauschen, Artefakte, Echo, Wissenspruefung, Sektortor), Bericht.
 * Teil B (beschleunigt): Sektoren 2-20. In jedem Sektor wird zuerst per Wegsuche geprueft, dass alle
 *   Ziele erreichbar sind; danach springt die Figur zu jedem Ziel und erledigt es mit Tastendruecken.
 *   Nebenquests werden unterwegs erledigt. Danach Abschlussgespraech, Abspann, Optionen, schmaler Bildschirm.
 *
 * Aufruf:  node tests/e2e_test.js <URL zur index.html> <Ergebnisordner> [grafik]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const QUALITY = process.argv[4] || 'niedrig';
const URL = process.argv[2] + (process.argv[2].includes('?') ? '&' : '?') + 'zeiger=aus&grafik=' + QUALITY;
const OUT = process.argv[3] || '.';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let failed = 0;
function check(cond, label, detail) {
  results.push({ ok: !!cond, label, detail: detail === undefined ? '' : String(detail) });
  if (!cond) failed++;
  console.log((cond ? '  [OK]     ' : '  [FEHLER] ') + label + (detail !== undefined ? '  (' + detail + ')' : ''));
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t0 = Date.now();

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const state = () => ev(() => TLH.state());
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 72 });
  async function waitState(s, timeout) { await page.waitForFunction((x) => window.TLH && TLH.state() === x, s, { timeout: timeout || 20000 }); }
  async function press(key) { await page.keyboard.press(key); await wait(140); }
  async function hold(combo, ms) {
    const parts = combo.split('+');
    for (const k of parts) await page.keyboard.down(k);
    await wait(ms);
    for (const k of parts.reverse()) await page.keyboard.up(k);
  }
  async function click(text) { await page.locator('.screen:not([hidden]) button', { hasText: text }).first().click(); await wait(200); }

  async function walkTo(x, z, stopDist) {
    let last = Infinity, stuck = 0;
    for (let i = 0; i < 160; i++) {
      const p = await ev(() => TLH.player());
      const d = Math.hypot(p.x - x, p.z - z);
      if (d <= stopDist) return true;
      if (last - d < 0.05) stuck++; else stuck = 0;
      if (stuck > 5) return false;
      last = d;
      await ev(([tx, tz]) => TLH.face(tx, tz), [x, z]);
      await hold(d > 6 ? 'Shift+KeyW' : 'KeyW', d > 6 ? 500 : 220);
    }
    return false;
  }
  /** Im Sektor: geht ueber die Tueren der Trennwaende (x = -15 / 15, z = 0) statt gerade durch die Wand. */
  async function walkSector(x, z, stopDist) {
    const p = await ev(() => TLH.player());
    for (const px of (x > p.x ? [-15, 15] : [15, -15])) {
      if ((p.x - px) * (x - px) < 0) {
        const s = Math.sign(x - px);
        await walkTo(px - s * 2.5, 0, 0.8);
        await walkTo(px + s * 2.5, 0, 0.8);
      }
    }
    return walkTo(x, z, stopDist);
  }
  /** Stellt die Figur neben ein Ziel (beschleunigter Modus) und dreht sie hin. */
  async function standAt(x, z, off) {
    await ev(([tx, tz, o]) => {
      if (Math.abs(tz) > 5) TLH.teleport(tx, tz - Math.sign(tz) * o); else TLH.teleport(tx - o, tz);
      TLH.face(tx, tz);
    }, [x, z, off || 1.3]);
    await wait(150);
  }
  async function dialogThrough() { let n = 0; while (await state() === 'dialog' && n < 14) { await press('KeyE'); n++; } return n; }
  async function holdNoiseIfNeeded(id) {
    for (let t = 0; t < 3 && (await ev(() => TLH.noisy())).includes(id); t++) {
      if (t) console.log('    Rauschen: neuer Versuch', id, await ev(() => TLH.focused()));
      await page.keyboard.down('KeyE'); await wait(1900); await page.keyboard.up('KeyE'); await wait(200);
    }
    return !(await ev(() => TLH.noisy())).includes(id);
  }
  async function talkToNpc(id, walk) {
    const n = await ev((i) => TLH.npc(i), id);
    if (!n) return { ok: false };
    let reached = true;
    if (walk) reached = await walkTo(n.x, n.z, 2.2);
    else await ev(([x, z]) => { TLH.teleport(x + 1.8, z + 0.4); TLH.face(x, z); }, [n.x, n.z]);
    await ev(([x, z]) => TLH.face(x, z), [n.x, n.z]);
    await wait(200);
    const foc = await ev(() => TLH.focused());
    await press('KeyE');
    const lines = await dialogThrough();
    return { ok: reached && foc === 'npc:' + id && lines > 0, foc, lines, reached };
  }
  async function enterGate(expect, walk) {
    const g = await ev(() => TLH.gate());
    let reached = true;
    if (walk) reached = await walkTo(g.x - 2.5, g.z, 1.2); else await ev(([x, z]) => TLH.teleport(x - 2.5, z), [g.x, g.z]);
    await ev(([x, z]) => TLH.face(x + 2, z), [g.x, g.z]);
    await wait(200);
    await press('KeyE');
    await wait(500);
    return reached && await ev(() => TLH.area()) === 'sector' && await ev(() => TLH.chapter()) === expect;
  }

  /** Erledigt einen Sektor vollstaendig. walk=true: zu Fuss, sonst beschleunigt. */
  async function completeSector(no, walk) {
    const reach = await ev(() => TLH.reachability());
    const bad = reach.filter((r) => !r.ok);
    check(bad.length === 0, `Sektor ${no}: alle ${reach.length} Ziele erreichbar (Wegsuche)`, bad.map((b) => b.kind + ':' + b.id).join(', '));
    let memOk = 0;
    const pts = await ev(() => TLH.points());
    const noisyBefore = (await ev(() => TLH.noisy())).length;
    for (const p of pts) {
      if (walk) { await walkSector(p.x, p.z + (p.z > 0 ? -1.5 : 1.5), 0.8); await ev(([x, z]) => TLH.face(x, z), [p.x, p.z]); await wait(150); }
      else await standAt(p.x, p.z, 1.3);
      if ((await ev(() => TLH.focused())) !== 'memory:' + p.id) { console.log('    kein Fokus', p.id, await ev(() => TLH.focused())); continue; }
      if (!(await holdNoiseIfNeeded(p.id))) console.log('    Rauschen bleibt', p.id, await ev(() => TLH.focused()), await ev(() => TLH.prompt()));
      await press('KeyE');
      if (await state() === 'info') { memOk++; await press('KeyE'); } else console.log('    nicht geoeffnet', p.id, await state(), await ev(() => TLH.prompt()));
    }
    check(memOk === pts.length, `Sektor ${no}: alle ${pts.length} Erinnerungen gelesen`, `${memOk}/${pts.length}`);
    check(noisyBefore >= 2 && (await ev(() => TLH.noisy())).length === 0, `Sektor ${no}: Datenrauschen beseitigt`, `${noisyBefore} Stellen`);
    let artOk = 0;
    const arts = await ev(() => TLH.artifacts());
    for (const a of arts) {
      if (walk) { await walkSector(a.x, a.z + (a.z > 0 ? -1.4 : 1.4), 0.9); await ev(([x, z]) => TLH.face(x, z), [a.x, a.z]); await wait(150); }
      else await standAt(a.x, a.z, 1.3);
      if ((await ev(() => TLH.focused())) === 'artifact:' + a.id) { await press('KeyE'); artOk++; }
    }
    check(artOk === arts.length, `Sektor ${no}: alle ${arts.length} Artefakte gefunden`, `${artOk}/${arts.length}`);
    const e = await ev(() => TLH.echo());
    if (walk) await walkSector(e.x - 2.2, e.z, 0.8); else await ev(([x, z]) => TLH.teleport(x - 2, z), [e.x, e.z]);
    await ev(([x, z]) => TLH.face(x, z), [e.x, e.z]);
    await wait(150);
    const efoc = await ev(() => TLH.focused());
    await press('KeyE');
    const el = await dialogThrough();
    check(efoc && efoc.startsWith('echo:') && el >= 3, `Sektor ${no}: Gespraech mit dem Zeitzeugen-Echo`, `${el} Zeilen`);
    const q = await ev(() => TLH.quizPos());
    if (walk) await walkSector(q.x - 2.2, q.z, 0.8); else await ev(([x, z]) => TLH.teleport(x - 2, z), [q.x, q.z]);
    await ev(([x, z]) => TLH.face(x, z), [q.x, q.z]);
    await wait(150);
    await press('KeyE');
    let quizOk = await state() === 'quiz';
    if (quizOk && walk) {
      const c0 = await ev(() => TLH.quizCorrect());
      await press('Digit' + (((c0 + 1) % 3) + 1));
      quizOk = (await page.locator('.quiz-feedback.bad').count()) === 1;
      await shot('quiz_falsch');
      await press('KeyE');
    }
    for (let i = 0; i < 3 && await state() === 'quiz'; i++) { const c = await ev(() => TLH.quizCorrect()); await press('Digit' + (c + 1)); await press('KeyE'); }
    const passed = (await ev(() => TLH.quizPassed())).includes(await ev(() => TLH.chapter()));
    check(quizOk && passed && await ev(() => TLH.portalOpen()), `Sektor ${no}: Wissenspruefung bestanden${walk ? ' (nach einer falschen Antwort)' : ''}, Tor offen`);
    const portal = await ev(() => TLH.portal());
    if (walk) await walkSector(portal.x - 2, 0, 1.0); else await ev(([x]) => TLH.teleport(x - 2, 0), [portal.x]);
    await ev(([x]) => TLH.face(x, 0), [portal.x]);
    await wait(150);
    await press('KeyE');
    await wait(400);
    check(await ev(() => TLH.area()) === 'hub', `Sektor ${no}: Rueckkehr zur Station`);
  }

  async function doSideQuests(walk, maxCount) {
    for (let k = 0; k < (maxCount || 20); k++) {
      const avail = await ev(() => TLH.sideAvailable());
      if (!avail.length) break;
      const sq = avail[0];
      const before = await ev(() => TLH.sideDone());
      const r1 = await talkToNpc(sq.giver, walk);
      if (!(await ev(() => TLH.side()))) { check(false, `Nebenquest ${sq.id} annehmen`, JSON.stringify(r1)); break; }
      if (sq.type === 'fetch') {
        if (walk) await walkTo(sq.pos[0], sq.pos[1], 1.4); else await ev(([x, z]) => TLH.teleport(x - 1.2, z), sq.pos);
        await ev(([x, z]) => TLH.face(x, z), sq.pos);
        await wait(150);
        await press('KeyE');
        await talkToNpc(sq.giver, walk);
      } else if (sq.type === 'visit') {
        if (walk) await walkTo(sq.pos[0], sq.pos[1], 3); else { await ev(([x, z]) => TLH.teleport(x, z - 1), sq.pos); await wait(300); }
        await talkToNpc(sq.giver, walk);
      } else {
        await talkToNpc(sq.to, walk);
      }
      const after = await ev(() => TLH.sideDone());
      check(after === before + 1, `Nebenquest ${sq.id} (${sq.type}) erledigt`, `${after} gesamt`);
      if (after !== before + 1) break;
    }
  }

  // ======================================================= A1 Start
  console.log('\nA1. Laden, Hauptmenue, Namenseingabe');
  await page.goto(URL);
  await waitState('mainmenu', 120000);
  await ev(() => localStorage.clear());
  await page.reload();
  await waitState('mainmenu', 120000);
  check(true, 'Spiel laedt, Hauptmenue erscheint', `${Date.now() - t0} ms`);
  check(await page.locator('#menu button', { hasText: 'Fortsetzen' }).isDisabled(), '"Fortsetzen" ohne Spielstand deaktiviert');
  await shot('01_hauptmenue');
  await click('Neues Spiel');
  await page.locator('#heroname').fill('Testhüterin');
  await click('Erwachen');
  check(await state() === 'intro', 'Einleitung erscheint');
  await press('KeyE');
  check(await state() === 'playing' && (await page.locator('#pname').textContent()) === 'Testhüterin', 'Spiel startet mit eigenem Namen');
  check((await ev(() => TLH.total())) >= 240, 'Spiel enthaelt ueber 240 Erinnerungen', await ev(() => TLH.total()));

  // ======================================================= A2 Steuerung
  console.log('\nA2. Steuerung, Kamera, Kollision');
  await ev(() => TLH.face(0, 30));
  const a0 = await ev(() => TLH.player());
  await hold('KeyW', 900);
  const a1 = await ev(() => TLH.player());
  check(a1.z - a0.z > 1, 'W: vorwaerts gehen', `${(a1.z - a0.z).toFixed(2)} m`);
  await hold('KeyD', 600);
  const a2 = await ev(() => TLH.player());
  check(a2.x - a1.x < -0.5, 'D: nach rechts (kamerarelativ)');
  const s0 = (await ev(() => TLH.player())).stamina;
  await hold('Shift+KeyW', 1200);
  check((await ev(() => TLH.player())).stamina < s0 - 5, 'Sprinten verbraucht Ausdauer');
  await page.keyboard.down('Space'); await wait(150);
  const jy = (await ev(() => TLH.player())).y;
  await page.keyboard.up('Space'); await wait(1000);
  check(jy > 0.1 && (await ev(() => TLH.player())).y === 0, 'Springen und landen');
  const y0 = await ev(() => TLH.player());
  await page.mouse.move(512, 320); await page.mouse.down(); await page.mouse.move(612, 280, { steps: 5 }); await page.mouse.up();
  const y1 = await ev(() => TLH.player());
  check(y1.camYaw < y0.camYaw && y1.pitch < y0.pitch, 'Maus dreht die Kamera (rechts, oben)');
  await press('Escape');
  check(await state() === 'pause', 'Esc oeffnet das Menue');
  const box = await page.locator('#menu button', { hasText: 'Optionen' }).boundingBox();
  check(box && box.y + box.height <= 640, 'Pausenmenue: "Optionen" sichtbar (640 px Hoehe)');
  await press('Escape');

  // ======================================================= A3 Station
  console.log('\nA3. Station: Gespraech, Erkundung, Kristalle, Faehigkeiten, Menues');
  const g = await ev(() => TLH.gate());
  await walkTo(g.x - 2.5, g.z, 1.2);
  await ev(([x, z]) => TLH.face(x + 2, z), [g.x, g.z]);
  await wait(200);
  check((await ev(() => TLH.prompt())).includes('versiegelt'), 'Archivtor anfangs versiegelt');
  const t1 = await talkToNpc('kommandantin', true);
  check(t1.ok && await ev(() => TLH.stage()) === 'explore', 'Gespraech mit der Kommandantin, Quest weiter', JSON.stringify(t1));
  for (const [id, p] of Object.entries(await ev(() => TLH.landmarks()))) check(await walkTo(p.x, p.z, id === 'aussicht' ? 3 : 4), `Erkundet: ${id}`);
  check(await ev(() => TLH.stage()) === 'gate', 'Quest: Archivtor betreten');
  for (const c of await ev(() => TLH.crystals())) await walkTo(c.x, c.z, 1.0);
  check(await ev(() => TLH.crystalCount()) === 10, 'Alle 10 Datenkristalle eingesammelt');
  await wait(2000);
  const e0 = (await ev(() => TLH.player())).energy;
  await press('Digit1');
  check((await ev(() => TLH.player())).energy < e0 - 20, 'Faehigkeit Scan-Puls');
  await press('Digit5');
  const r5 = await ev(() => TLH.player());
  check(Math.abs(r5.x) < 0.5 && Math.abs(r5.z + 22) < 0.5, 'Faehigkeit Rueckruf');
  for (const [k, st] of [['KeyJ', 'journal'], ['KeyI', 'codex'], ['KeyK', 'skills'], ['KeyM', 'map']]) { await press(k); check(await state() === st, `Menue ${st} (${k.slice(3)})`); if (st === 'journal') await shot('02_journal'); await press(k); }

  // ======================================================= A4 Nebenquests zu Fuss
  console.log('\nA4. Nebenquests zu Fuss');
  await doSideQuests(true, 2);

  // ======================================================= A5 Sektor 1 zu Fuss
  console.log('\nA5. Sektor 1 komplett zu Fuss');
  check(await enterGate('kap01_urspruenge', true), 'Archivtor fuehrt in Sektor 1');
  await shot('03_sektor1');
  await completeSector(1, true);
  check(await ev(() => TLH.stage()) === 'report', 'Quest: Bericht an die Kommandantin');
  const rep = await talkToNpc('kommandantin', true);
  check(rep.ok && rep.lines >= 3 && await ev(() => TLH.stage()) === 'gate', 'Bericht inkl. Ankuendigung des naechsten Sektors', `${rep.lines} Zeilen`);

  // ======================================================= A6 Speichern/Laden
  console.log('\nA6. Speichern und Laden');
  await press('F5');
  const snap = async () => JSON.stringify({ d: await ev(() => TLH.discoveredCount()), a: await ev(() => TLH.artifactCount()), s: await ev(() => TLH.sideDone()), q: (await ev(() => TLH.quizPassed())).length, st: await ev(() => TLH.stage()), xp: await ev(() => TLH.xp()) });
  const before = await snap();
  await page.reload();
  await waitState('mainmenu', 120000);
  await click('Fortsetzen');
  await waitState('playing');
  check(before === await snap(), 'Nach Neuladen alles wiederhergestellt', before);

  // ======================================================= B Sektoren 2-20
  console.log('\nB. Sektoren 2 bis 20 (beschleunigt) mit Nebenquests');
  const ids = await ev(() => TLH.chapterIds());
  for (let n = 2; n <= ids.length; n++) {
    check(await enterGate(ids[n - 1], false), `Archivtor fuehrt in Sektor ${n}`);
    if (n % 5 === 0) await shot('sektor_' + String(n).padStart(2, '0'));
    await completeSector(n, false);
    if (n < ids.length) {
      const r = await talkToNpc('kommandantin', false);
      check(r.ok && await ev(() => TLH.stage()) === 'gate', `Bericht nach Sektor ${n}`);
      await doSideQuests(false, 3);
    }
  }
  check(await ev(() => TLH.stage()) === 'final', 'Alle Sektoren abgeschlossen: letzte Quest');
  await doSideQuests(false, 8);
  check(await ev(() => TLH.sideDone()) === 25, 'Alle 25 Nebenquests erledigt', await ev(() => TLH.sideDone()));
  const fin = await talkToNpc('kommandantin', false);
  await wait(300);
  check(fin.ok && await state() === 'ending', 'Abschlussgespraech und Abspann');
  const total = await ev(() => TLH.total());
  check((await page.locator('#ending .stats').textContent()).includes(`${total} von ${total}`), `Abspann: ${total} von ${total} Erinnerungen`, await page.locator('#ending .stats').textContent());
  await shot('04_abspann');
  check(await ev(() => TLH.artifactCount()) === 80, 'Alle 80 Artefakte gefunden', await ev(() => TLH.artifactCount()));
  await click('Weiter auf der Station umsehen');

  // ======================================================= C Optionen, schmaler Bildschirm
  console.log('\nC. Optionen, schmaler Bildschirm');
  await press('Escape');
  await click('Optionen');
  await page.locator('#opt-sens').fill('4');
  await page.locator('#opt-invert').check();
  const st = await ev(() => TLH.settings());
  check(st.sensitivity === 4 && st.invertY, 'Optionen wirken sofort');
  await click('Speichern und zurück');
  await click('Zum Hauptmenü');
  await page.setViewportSize({ width: 390, height: 780 });
  await wait(400);
  check(await ev(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'Kein waagerechtes Scrollen bei 390 px');

  check(errors.length === 0, 'Keine JavaScript-Fehler', errors.join(' | ').slice(0, 300));
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== ${passed} bestanden, ${failed} fehlgeschlagen · Dauer ${Math.round((Date.now() - t0) / 60000)} min ===`);
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ url: URL, passed, failed, minutes: Math.round((Date.now() - t0) / 60000), results }, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(2); });
