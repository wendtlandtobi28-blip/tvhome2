/*
 * THE LAST HUMANITY - automatischer Gesamttest der Browser-Version 2 (Playwright + Chromium).
 *
 * Spielt die komplette Geschichte wie ein Mensch mit Tastatur und Maus:
 * Hauptmenue mit Namenseingabe, Einleitung, Laufen/Sprinten/Springen, Kamera, Kollision,
 * Gespraeche, Erkundung, Datenkristalle, alle Faehigkeiten, Archivtor, alle 10 Archivsektoren
 * mit allen 48 Erinnerungen, Bericht bei der Kommandantin, Abspann, Journal/Kodex/Faehigkeiten/Karte,
 * Optionen, Speichern und Laden nach Neuladen, schmaler Bildschirm.
 *
 * Aufruf:  node tests/e2e_test.js <URL zur index.html> <Ordner fuer Ergebnisse> [grafik]
 * Exitcode 0 = alle Pruefungen bestanden.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const QUALITY = process.argv[4] || 'niedrig';
// Kopflose Testbrowser liefern bei eingefangener Maus keine echten Bewegungswerte -> Umsehen per Ziehen testen
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

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const state = () => ev(() => TLH.state());
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 72 });
  async function waitState(s, timeout) { await page.waitForFunction((x) => window.TLH && TLH.state() === x, s, { timeout: timeout || 20000 }); }
  async function press(key) { await page.keyboard.press(key); await wait(150); }
  async function hold(combo, ms) {
    const parts = combo.split('+');
    for (const k of parts) await page.keyboard.down(k);
    await wait(ms);
    for (const k of parts.reverse()) await page.keyboard.up(k);
  }
  async function click(text) { await page.locator('.screen:not([hidden]) button', { hasText: text }).first().click(); await wait(200); }

  /** Laeuft mit W (und Shift auf langen Strecken) zum Ziel. */
  async function walkTo(x, z, stopDist) {
    let last = Infinity, stuck = 0;
    for (let i = 0; i < 120; i++) {
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

  async function talkThrough() {
    let n = 0;
    while (await state() === 'dialog' && n < 12) { await press('KeyE'); n++; }
    return n;
  }

  async function talkToCommander(label) {
    const c = await ev(() => TLH.npc('kommandantin'));
    const ok = await walkTo(c.x, c.z, 2.2);
    await ev(([tx, tz]) => TLH.face(tx, tz), [c.x, c.z]);
    await wait(250);
    const foc = await ev(() => TLH.focused());
    await press('KeyE');
    const st = await state();
    const lines = await talkThrough();
    check(ok && foc === 'npc:kommandantin' && st === 'dialog' && lines > 0, label, `erreicht=${ok}, Fokus=${foc}, Zeilen=${lines}`);
  }

  async function completeSector(no, verbose) {
    const pts = await ev(() => TLH.points());
    let ok = true;
    for (const pt of pts) {
      if (pt.discovered) continue;
      const reached = await walkTo(pt.x, pt.z, 1.8);
      await ev(([tx, tz]) => TLH.face(tx, tz), [pt.x, pt.z]);
      await wait(200);
      const foc = await ev(() => TLH.focused());
      if (!reached || foc !== 'memory:' + pt.id) { check(false, `Sektor ${no}: ${pt.id} erreichbar`, `erreicht=${reached}, Fokus=${foc}`); ok = false; continue; }
      await press('KeyE');
      if (await state() !== 'info') { check(false, `Sektor ${no}: ${pt.id} oeffnet Text`); ok = false; continue; }
      if (verbose && pt === pts[0]) {
        const shortLen = (await page.locator('#info .reading').textContent()).length;
        await click('Ausführlich lesen');
        const longLen = (await page.locator('#info .reading').textContent()).length;
        check(longLen > shortLen, 'Ausfuehrliche Fassung ist laenger als die Kurzfassung', `${shortLen} -> ${longLen}`);
        await shot('info_ausfuehrlich');
        await click('Kurzfassung zeigen');
      }
      await press('KeyE');
      if (await state() !== 'playing') { check(false, `Sektor ${no}: Text schliesst`); ok = false; }
    }
    const left = (await ev(() => TLH.points())).filter((p) => !p.discovered).length;
    check(ok && left === 0, `Sektor ${no}: alle ${pts.length} Erinnerungen gefunden und gelesen`, `offen: ${left}`);
    return left === 0;
  }

  async function leaveSector(no) {
    const portal = await ev(() => TLH.portal());
    const reached = await walkTo(portal.x - 1.8, 0, 1.0);
    await ev(([tx]) => TLH.face(tx, 0), [portal.x]);
    await wait(200);
    const foc = await ev(() => TLH.focused());
    const open = await ev(() => TLH.portalOpen());
    await press('KeyE');
    await wait(400);
    const area = await ev(() => TLH.area());
    check(reached && foc === 'portal:sektortor' && open && area === 'hub', `Sektor ${no}: Sektortor offen, Rueckkehr zur Station`, `erreicht=${reached}, Fokus=${foc}, offen=${open}, Bereich=${area}`);
  }

  async function enterGate(expectChapter) {
    const g = await ev(() => TLH.gate());
    const reached = await walkTo(g.x - 2.5, g.z, 1.2);
    await ev(([tx, tz]) => TLH.face(tx, tz), [g.x + 2, g.z]);
    await wait(200);
    const foc = await ev(() => TLH.focused());
    await press('KeyE');
    await wait(400);
    const ch = await ev(() => TLH.chapter());
    const area = await ev(() => TLH.area());
    check(reached && foc === 'gate:archivtor' && area === 'sector' && ch === expectChapter, `Archivtor fuehrt in ${expectChapter}`, `erreicht=${reached}, Fokus=${foc}, Bereich=${area}, Kapitel=${ch}`);
  }

  // ================================================================ 1. Start
  console.log('\n1. Laden, Hauptmenue, Namenseingabe, Einleitung');
  const t0 = Date.now();
  await page.goto(URL);
  await waitState('mainmenu', 120000);
  await ev(() => localStorage.clear());
  await page.reload();
  await waitState('mainmenu', 120000);
  check(true, 'Spiel laedt, Hauptmenue erscheint', `${Date.now() - t0} ms`);
  check(await page.locator('#menu button', { hasText: 'Fortsetzen' }).isDisabled(), '"Fortsetzen" ohne Spielstand deaktiviert');
  await shot('01_hauptmenue');
  await click('Neues Spiel');
  check(await page.locator('#heroname').isVisible(), 'Namenseingabe erscheint');
  await page.locator('#heroname').fill('Testhüterin');
  await click('Erwachen');
  check(await state() === 'intro', 'Einleitungstext erscheint');
  await press('KeyE');
  check(await state() === 'playing', 'Spiel startet auf der Station');
  check((await page.locator('#pname').textContent()) === 'Testhüterin', 'Eigener Name im HUD', await page.locator('#pname').textContent());
  check((await ev(() => TLH.questLines()))[0].includes('Kommandantin'), 'Erste Quest: Sprich mit der Kommandantin');
  await wait(400);
  await shot('02_station');

  // ================================================================ 2. Steuerung
  console.log('\n2. Steuerung, Kamera, Kollision');
  await ev(() => TLH.face(0, 30));
  let a = await ev(() => TLH.player());
  await hold('KeyW', 900);
  let b = await ev(() => TLH.player());
  check(b.z - a.z > 1, 'W: vorwaerts gehen', `dz=${(b.z - a.z).toFixed(2)} m`);
  await hold('KeyD', 600);
  const c1 = await ev(() => TLH.player());
  check(c1.x - b.x < -0.5, 'D: nach rechts gehen (Kamera-relativ)', `dx=${(c1.x - b.x).toFixed(2)} m`);
  const s0 = (await ev(() => TLH.player())).stamina;
  await ev(() => TLH.face(0, 40));
  await hold('Shift+KeyW', 1200);
  const s1 = await ev(() => TLH.player());
  check(s1.stamina < s0 - 5, 'Shift: Sprinten verbraucht Ausdauer (roter Balken)', `${s0.toFixed(0)} -> ${s1.stamina.toFixed(0)}`);
  await page.keyboard.down('Space'); await wait(150);
  const jy = (await ev(() => TLH.player())).y;
  await page.keyboard.up('Space'); await wait(1000);
  check(jy > 0.1 && (await ev(() => TLH.player())).y === 0, 'Leertaste: springen und landen', `Hoehe ${jy.toFixed(2)} m`);
  const y0 = await ev(() => TLH.player());
  await page.mouse.move(512, 320); await page.mouse.down(); await page.mouse.move(612, 280, { steps: 5 }); await page.mouse.up();
  const y1 = await ev(() => TLH.player());
  check(y1.camYaw < y0.camYaw, 'Maus: Kamera dreht nach rechts', `${y0.camYaw.toFixed(2)} -> ${y1.camYaw.toFixed(2)}`);
  check(y1.pitch < y0.pitch, 'Maus nach oben: Kamera schaut nach oben', `${y0.pitch.toFixed(2)} -> ${y1.pitch.toFixed(2)}`);
  // bis zum Rand laufen, bis sich die Position nicht mehr aendert
  let prevD = -1, edge = null;
  for (let i = 0; i < 40; i++) {
    await ev(() => TLH.face(0, 200));
    await hold('Shift+KeyW', 800);
    edge = await ev(() => TLH.player());
    const dd = Math.hypot(edge.x, edge.z);
    if (Math.abs(dd - prevD) < 0.05) break;
    prevD = dd;
  }
  check(Math.hypot(edge.x, edge.z) <= 44.5 && Math.hypot(edge.x, edge.z) > 43, 'Kollision: Gelaender am Plattformrand haelt die Figur auf', `Abstand zur Mitte ${Math.hypot(edge.x, edge.z).toFixed(1)} m`);
  await press('Escape');
  check(await state() === 'pause', 'Esc oeffnet das Pausenmenue');
  await press('Escape');
  check(await state() === 'playing', 'Esc schliesst das Pausenmenue');

  // ================================================================ 3. Geschichte auf der Station
  console.log('\n3. Gespraech, Erkundung, Kristalle, Faehigkeiten');
  // Archivtor ist anfangs versiegelt
  const g = await ev(() => TLH.gate());
  await walkTo(g.x - 2.5, g.z, 1.2);
  await ev(([tx, tz]) => TLH.face(tx, tz), [g.x + 2, g.z]);
  await wait(200);
  check((await ev(() => TLH.prompt())).includes('versiegelt'), 'Archivtor vor dem Gespraech versiegelt', await ev(() => TLH.prompt()));
  await talkToCommander('Gespraech mit der Kommandantin (4 Zeilen)');
  await shot('03_nach_gespraech');
  check(await ev(() => TLH.stage()) === 'explore', 'Quest weiter: Erkunde die Raumstation');
  const marks = await ev(() => TLH.landmarks());
  for (const [id, p] of Object.entries(marks)) {
    const ok = await walkTo(p.x, p.z, id === 'aussicht' ? 3 : 4);
    check(ok, `Erkundet: ${id}`);
  }
  check(await ev(() => TLH.stage()) === 'gate', 'Nach drei Orten: Quest "Betritt das Archivtor"');
  // Kristalle
  const crystals = await ev(() => TLH.crystals());
  let got = 0;
  for (const cr of crystals.slice(0, 10)) {
    if (await walkTo(cr.x, cr.z, 1.0)) got++;
  }
  check(await ev(() => TLH.crystalCount()) === 10, 'Alle 10 Datenkristalle eingesammelt', `${await ev(() => TLH.crystalCount())}/10, erreicht ${got}`);
  await press('KeyI');
  check(await state() === 'codex' && (await page.locator('#codex .codex li:not(.unknown)').count()) >= 10, 'Kodex (I) zeigt gefundene Kristalltexte');
  await shot('04_kodex');
  await press('KeyI');
  // Faehigkeiten
  await wait(2500);
  const e0 = (await ev(() => TLH.player())).energy;
  await press('Digit1');
  const e1 = (await ev(() => TLH.player())).energy;
  check(e1 < e0 - 20, 'Faehigkeit 1 (Scan-Puls) verbraucht Energie', `${e0.toFixed(0)} -> ${e1.toFixed(0)}`);
  await ev(() => TLH.face(0, 0));
  const d0 = await ev(() => TLH.player());
  await press('Digit2'); await wait(700);
  const d1 = await ev(() => TLH.player());
  check(Math.hypot(d1.x - d0.x, d1.z - d0.z) > 1.5, 'Faehigkeit 2 (Schub) bewegt die Figur', `${Math.hypot(d1.x - d0.x, d1.z - d0.z).toFixed(2)} m`);
  await wait(3500);
  await press('Digit3');
  check((await page.locator('#toast').textContent()).length > 0, 'Faehigkeit 3 (Leuchtfeuer) ausloesbar');
  await press('Digit5');
  const r1 = await ev(() => TLH.player());
  check(Math.abs(r1.x) < 0.5 && Math.abs(r1.z + 22) < 0.5, 'Faehigkeit 5 (Rueckruf) zum Startpunkt', `${r1.x.toFixed(1)}/${r1.z.toFixed(1)}`);
  await press('Digit6');
  check((await page.locator('#toast').textContent()).includes('Stufe'), 'Faehigkeit 6 ist bis Stufe 10 gesperrt');
  await press('KeyK');
  check(await state() === 'skills', 'Faehigkeiten-Uebersicht (K)');
  await press('KeyK');
  await press('KeyM');
  check(await state() === 'map', 'Karte (M)');
  await shot('05_karte');
  await press('KeyM');
  await press('KeyJ');
  check(await state() === 'journal', 'Journal (J)');
  await shot('06_journal');
  await press('KeyJ');

  // ================================================================ 4. Erster Sektor
  console.log('\n4. Archivsektor 1');
  await enterGate('kap01_urspruenge');
  await shot('07_sektor1');
  check((await ev(() => TLH.questLines()))[0].includes('Sektor 1'), 'Quest: Erinnerungen in Sektor 1 erwecken');
  const portal = await ev(() => TLH.portal());
  await walkTo(portal.x - 1.8, 0, 1.0);
  await ev(([tx]) => TLH.face(tx, 0), [portal.x]);
  await wait(200);
  check(!(await ev(() => TLH.portalOpen())), 'Sektortor vor Abschluss gesperrt');
  await press('Digit4');
  check((await page.locator('#toast').textContent()).includes('Zeitecho') || (await page.locator('#toast').textContent()).includes('Energie'), 'Faehigkeit 4 (Zeitecho) setzt Wegpunkt');
  await completeSector(1, true);
  await leaveSector(1);
  check(await ev(() => TLH.stage()) === 'report', 'Quest: Bericht an die Kommandantin');
  await talkToCommander('Bericht nach Sektor 1');
  check(await ev(() => TLH.stage()) === 'gate', 'Danach: naechster Sektor ueber das Archivtor');

  // Speichern und Laden
  console.log('\n5. Speichern und Laden');
  await press('F5');
  check((await page.locator('#toast').textContent()).includes('gespeichert'), 'F5 speichert');
  const before = { d: await ev(() => TLH.discoveredCount()), c: await ev(() => TLH.crystalCount()), xp: await ev(() => TLH.xp()), stage: await ev(() => TLH.stage()) };
  await page.reload();
  await waitState('mainmenu', 120000);
  await click('Fortsetzen');
  await waitState('playing');
  const after = { d: await ev(() => TLH.discoveredCount()), c: await ev(() => TLH.crystalCount()), xp: await ev(() => TLH.xp()), stage: await ev(() => TLH.stage()) };
  check(JSON.stringify(before) === JSON.stringify(after), 'Nach Neuladen: Fortschritt, Kristalle, Erfahrung, Quest wiederhergestellt', JSON.stringify(after));

  // ================================================================ 6. Sektoren 2-10
  console.log('\n6. Archivsektoren 2 bis 10 und Abspann');
  const ids = await ev(() => TLH.chapterIds());
  for (let n = 2; n <= 10; n++) {
    await enterGate(ids[n - 1]);
    await wait(250);
    await shot('sektor_' + String(n).padStart(2, '0'));
    const ok = await completeSector(n, false);
    if (!ok) break;
    await leaveSector(n);
    if (n < 10) {
      await talkToCommander(`Bericht nach Sektor ${n}`);
    }
  }
  check(await ev(() => TLH.stage()) === 'final', 'Alle Sektoren erweckt: letzte Quest');
  await talkToCommander('Letztes Gespraech mit der Kommandantin');
  await wait(300);
  check(await state() === 'ending', 'Abspann erscheint');
  check((await page.locator('#ending .stats').textContent()).includes('48 von 48'), 'Abspann: 48 von 48 Erinnerungen', await page.locator('#ending .stats').textContent());
  await shot('08_abspann');
  check(await ev(() => TLH.level()) >= 10, 'Stufe 10 erreicht', 'Stufe ' + await ev(() => TLH.level()));
  await click('Weiter auf der Station umsehen');
  check(await state() === 'playing', 'Nach dem Abspann weiter spielen');

  // ================================================================ 7. Optionen und schmaler Bildschirm
  console.log('\n7. Optionen, schmaler Bildschirm');
  await press('Escape');
  await click('Optionen');
  await page.locator('#opt-sens').fill('4.0');
  await page.locator('#opt-invert').check();
  const st = await ev(() => TLH.settings());
  check(Math.abs(st.sensitivity - 4) < 0.01 && st.invertY, 'Optionen wirken sofort', JSON.stringify(st));
  await click('Speichern und zurück');
  await click('Zum Hauptmenü');
  await page.setViewportSize({ width: 390, height: 780 });
  await wait(400);
  const overflow = await ev(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 0, 'Kein waagerechtes Scrollen bei 390 px', `${overflow} px`);
  await shot('09_schmal');

  check(errors.length === 0, 'Keine JavaScript-Fehler', errors.join(' | ').slice(0, 300));
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== ${passed} bestanden, ${failed} fehlgeschlagen (Grafik: ${QUALITY}) ===`);
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ url: URL, passed, failed, results }, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(2); });
