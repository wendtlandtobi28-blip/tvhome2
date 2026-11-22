/*
 * THE LAST HUMANITY - automatischer Gesamttest der Browser-Version (Playwright + Chromium).
 *
 * Spielt das Spiel wie ein Mensch mit Tastatur und Maus: Startmenue, Laufen, Umsehen,
 * Kollision, alle 48 Erkenntnisse in allen 10 Hallen ablaufen und lesen, Tore,
 * Kapiteluebersicht, Optionen, Speichern/Laden nach Neuladen, Abspann, Handy-Breite.
 *
 * Aufruf:  node tests/e2e_test.js <URL zur index.html> <Ordner fuer Screenshots>
 * Beispiel: node tests/e2e_test.js http://localhost:8123/index.html /tmp/shots
 * Exitcode 0 = alle Pruefungen bestanden.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const OUT = process.argv[3] || '.';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let failed = 0;
function check(cond, label, detail) {
  results.push({ ok: !!cond, label, detail: detail === undefined ? '' : String(detail) });
  if (!cond) { failed++; }
  console.log((cond ? '  [OK]     ' : '  [FEHLER] ') + label + (detail !== undefined ? '  (' + detail + ')' : ''));
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const state = () => ev(() => TLH.state());
  const wait = ms => page.waitForTimeout(ms);
  async function waitState(s, timeout) {
    await page.waitForFunction(x => window.TLH && TLH.state() === x, s, { timeout: timeout || 15000 });
  }
  async function press(key) { await page.keyboard.press(key); await wait(120); }
  async function hold(combo, ms) {
    const parts = combo.split('+');
    for (const k of parts) { await page.keyboard.down(k); }
    await wait(ms);
    for (const k of parts.reverse()) { await page.keyboard.up(k); }
  }
  async function clickButton(text) {
    await page.locator('.screen:not([hidden]) button', { hasText: text }).first().click();
    await wait(150);
  }

  /** Laeuft mit W zum Ziel (dreht sich vorher hin). true, wenn Abstand <= stopDist erreicht. */
  async function walkTo(x, z, stopDist) {
    let last = Infinity, stuck = 0;
    for (let i = 0; i < 80; i++) {
      const p = await ev(() => TLH.player());
      const d = Math.hypot(p.x - x, p.z - z);
      if (d <= stopDist) { return true; }
      if (last - d < 0.05) { stuck++; } else { stuck = 0; }
      if (stuck > 4) { return false; }
      last = d;
      await ev(([tx, tz]) => TLH.face(tx, tz), [x, z]);
      await hold(d > 4 ? 'Shift+KeyW' : 'KeyW', d > 4 ? 450 : 220);
    }
    return false;
  }

  /** Geht zur Erkenntnis, prueft Fokus/Hinweis, liest sie (kurz + lang) und schliesst. */
  async function discover(pt, chapterNo, opts) {
    const reached = await walkTo(pt.x, pt.z, 1.7);
    await ev(([tx, tz]) => TLH.face(tx, tz), [pt.x, pt.z]);
    await wait(250);
    const foc = await ev(() => TLH.focused());
    const ok = reached && foc === pt.id;
    if (!ok || opts.verbose) {
      check(ok, `Kap. ${chapterNo}: ${pt.id} erreichbar und fokussiert`, `erreicht=${reached}, Fokus=${foc}`);
    }
    if (!ok) { return false; }
    await press('KeyE');
    const st = await state();
    if (opts.verbose) {
      check(st === 'info', 'E oeffnet das Informationsfenster', st);
      const title = await page.locator('#info h2').textContent();
      check(title && title.length > 2, 'Titel wird angezeigt', title);
      const shortLen = (await page.locator('#info .reading').textContent()).length;
      await clickButton('Ausführlich lesen');
      const longLen = (await page.locator('#info .reading').textContent()).length;
      check(longLen > shortLen, 'Ausfuehrliche Fassung ist laenger als die Kurzfassung', `${shortLen} -> ${longLen} Zeichen`);
      check((await page.locator('#info .mode').textContent()).includes('Ausführlich'), 'Anzeige "Ausführliche Fassung"');
      await page.screenshot({ path: path.join(OUT, `info_${pt.id}.png`) });
      await clickButton('Kurzfassung zeigen');
      check((await page.locator('#info .mode').textContent()).includes('Kurzfassung'), 'Zurueck zur Kurzfassung');
      await clickButton('Schließen');
    } else {
      if (st !== 'info') { check(false, `Kap. ${chapterNo}: ${pt.id} oeffnet Fenster`, st); return false; }
      await press('KeyE'); // E schliesst
    }
    const after = await state();
    if (after !== 'playing') { check(false, `Kap. ${chapterNo}: Fenster schliesst`, after); return false; }
    return true;
  }

  async function completeChapter(chapterNo, verbose) {
    const pts = await ev(() => TLH.points());
    let all = true;
    for (const pt of pts) {
      if (pt.discovered) { continue; }
      const ok = await discover(pt, chapterNo, { verbose: verbose && pt === pts.find(p => !p.discovered) });
      all = all && ok;
    }
    const left = (await ev(() => TLH.points())).filter(p => !p.discovered).length;
    check(all && left === 0, `Kapitel ${chapterNo}: alle ${pts.length} Erkenntnisse gefunden und gelesen`, `offen: ${left}`);
    return all && left === 0;
  }

  async function usePortal(chapterNo) {
    const portal = await ev(() => TLH.portal());
    const reached = await walkTo(portal.x - 1.2, 0, 0.5);
    await ev(([tx, tz]) => TLH.face(tx, tz), [portal.x, 0]);
    await wait(250);
    const foc = await ev(() => TLH.focused());
    const open = await ev(() => TLH.portalOpen());
    check(reached && foc === 'portal' && open, `Kapitel ${chapterNo}: Tor erreichbar und offen`, `erreicht=${reached}, Fokus=${foc}, offen=${open}`);
    await press('KeyE');
    await wait(400);
  }

  // =================================================================== 1. Start
  console.log('\n1. Laden und Hauptmenue');
  await page.goto(URL);
  await waitState('mainmenu', 30000);
  await ev(() => localStorage.clear());
  await page.reload();
  await waitState('mainmenu', 30000);
  await wait(800);
  check(true, 'Seite laedt, Hauptmenue erscheint');
  check(await page.locator('#boot').isHidden(), 'Ladebildschirm verschwindet');
  check(await page.locator('#menu button', { hasText: 'Fortsetzen' }).isDisabled(), '"Fortsetzen" ist ohne Spielstand deaktiviert');
  await page.screenshot({ path: path.join(OUT, '01_hauptmenue.png') });

  // Kapiteluebersicht aus dem Hauptmenue
  await clickButton('Kapitelübersicht');
  check(await state() === 'overview', 'Kapiteluebersicht aus dem Hauptmenue');
  check(await page.locator('#overview .card').count() === 10, '10 Kapitel werden aufgelistet');
  check(await page.locator('#overview .card.locked').count() === 9, 'Kapitel 2-10 sind anfangs gesperrt');
  await clickButton('Zurück');
  check(await state() === 'mainmenu', 'Zurueck zum Hauptmenue');

  // =================================================================== 2. Neues Spiel, Steuerung
  console.log('\n2. Neues Spiel und Steuerung');
  await clickButton('Neues Spiel');
  await waitState('playing');
  check(await ev(() => TLH.chapter()) === 'kap01_urspruenge', 'Neues Spiel startet in Kapitel 1');
  check((await page.locator('#chapterLine').textContent()).includes('Kapitel 1'), 'HUD zeigt Kapitel und Fortschritt', await page.locator('#chapterLine').textContent());
  await wait(500);
  await page.screenshot({ path: path.join(OUT, '02_start_kapitel1.png') });

  let p0 = await ev(() => TLH.player());
  await hold('KeyW', 800);
  let p1 = await ev(() => TLH.player());
  check(p1.x - p0.x > 0.5, 'W: vorwaerts gehen', `dx=${(p1.x - p0.x).toFixed(2)} m`);
  await hold('KeyA', 600);
  let p2 = await ev(() => TLH.player());
  check(p2.z - p1.z < -0.3, 'A: nach links gehen', `dz=${(p2.z - p1.z).toFixed(2)} m`);
  await hold('KeyD', 600);
  await hold('ArrowDown', 500);
  let p3 = await ev(() => TLH.player());
  check(p3.x < p2.x, 'Pfeiltaste: rueckwaerts gehen', `dx=${(p3.x - p2.x).toFixed(2)} m`);
  // Geschwindigkeit ueber Spielzeit messen (unabhaengig von der Bildrate der Testmaschine)
  async function speed(combo) {
    await ev(() => TLH.face(30, -0.4));
    const a = await ev(() => ({ p: TLH.player(), t: performance.now() }));
    await hold(combo, 1500);
    const b = await ev(() => ({ p: TLH.player(), t: performance.now() }));
    return Math.hypot(b.p.x - a.p.x, b.p.z - a.p.z) / ((b.t - a.t) / 1000);
  }
  await ev(() => TLH.standBefore(-16, -0.4, 0.01));
  const vWalk = await speed('KeyW');
  await ev(() => TLH.standBefore(-16, -0.4, 0.01));
  const vRun = await speed('Shift+KeyW');
  const tWalk0 = { x: 0 }, tWalk1 = { x: vWalk }, tWalk2 = { x: vWalk + vRun };
  check(vRun > vWalk * 1.4, 'Shift: laufen ist schneller als gehen',
    `gehen ${vWalk.toFixed(2)} m/s, laufen ${vRun.toFixed(2)} m/s`);
  await page.keyboard.down('Space');
  await wait(150);
  const jumpY = (await ev(() => TLH.player())).y;
  await page.keyboard.up('Space');
  await wait(900);
  check(jumpY > 0.1 && (await ev(() => TLH.player())).y === 0, 'Leertaste: springen und landen', `Hoehe ${jumpY.toFixed(2)} m`);

  // Maus: Ziehen (Fallback ohne Zeigersperre)
  const y0 = await ev(() => TLH.player());
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(740, 350, { steps: 5 });
  await page.mouse.up();
  const y1 = await ev(() => TLH.player());
  check(y1.yaw < y0.yaw, 'Maus nach rechts: Blick dreht nach rechts', `yaw ${y0.yaw.toFixed(2)} -> ${y1.yaw.toFixed(2)}`);
  check(y1.pitch > y0.pitch, 'Maus nach oben: Blick nach oben', `pitch ${y0.pitch.toFixed(2)} -> ${y1.pitch.toFixed(2)}`);

  // Kollision: Laufen gegen die Seitenwand und das Monument
  await ev(() => TLH.face(-5, -40));
  await hold('Shift+KeyW', 2500);
  const wallP = await ev(() => TLH.player());
  check(wallP.z >= -9 + 0.34, 'Kollision: Seitenwand haelt die Figur auf', `z=${wallP.z.toFixed(2)}`);
  await walkTo(-4, 0, 0.6);
  await ev(() => TLH.face(0, 0));
  await hold('KeyW', 2500);
  const monP = await ev(() => TLH.player());
  check(Math.hypot(monP.x, monP.z) >= 1.7 + 0.34, 'Kollision: Feuerstelle in der Mitte ist nicht begehbar', `Abstand ${Math.hypot(monP.x, monP.z).toFixed(2)} m`);

  // Escape / P (ohne Zeigersperre)
  await press('Escape');
  check(await state() === 'pause', 'Esc oeffnet das Pausenmenue');
  await press('Escape');
  check(await state() === 'playing', 'Esc schliesst das Pausenmenue');
  await press('KeyP');
  check(await state() === 'pause', 'P oeffnet das Pausenmenue');
  await clickButton('Weiterspielen');
  check(await state() === 'playing', '"Weiterspielen" setzt fort');

  // =================================================================== 3. Erkenntnisse, Tor gesperrt
  console.log('\n3. Informationspunkte und Tor in Kapitel 1');
  const pts1 = await ev(() => TLH.points());
  check(pts1.length === 5, 'Kapitel 1 hat 5 Informationspunkte', pts1.length);
  // Tor vor Abschluss
  const portal = await ev(() => TLH.portal());
  await walkTo(portal.x - 1.2, 0, 0.5);
  await ev(([tx]) => TLH.face(tx, 0), [portal.x]);
  await wait(250);
  check(await ev(() => TLH.focused()) === 'portal', 'Tor wird fokussiert');
  check(!(await ev(() => TLH.portalOpen())), 'Tor ist vor Abschluss gesperrt');
  check((await ev(() => TLH.prompt())).includes('verschlossen'), 'Hinweis: Tor verschlossen', await ev(() => TLH.prompt()));
  await press('KeyE');
  check(await ev(() => TLH.chapter()) === 'kap01_urspruenge', 'Gesperrtes Tor wechselt nicht das Kapitel');
  await page.screenshot({ path: path.join(OUT, '03_tor_gesperrt.png') });

  // erster Punkt ausfuehrlich
  const first = pts1[0];
  await discover(first, 1, { verbose: true });
  check(await ev(() => TLH.discoveredCount()) === 1, 'Erkenntnis wird gezaehlt');
  check(await ev(() => !!localStorage.getItem('tlh.spielstand.v2')), 'Automatische Speicherung nach neuer Erkenntnis');
  await ev(([tx, tz]) => TLH.face(tx, tz), [first.x, first.z]);
  await wait(200);
  check((await ev(() => TLH.prompt())).includes('Erneut lesen'), 'Bekannter Punkt: Hinweis "Erneut lesen"', await ev(() => TLH.prompt()));

  // restliche Punkte, dann Tor
  await completeChapter(1, false);
  check(await ev(() => TLH.portalOpen()), 'Nach allen Erkenntnissen ist das Tor offen');
  await page.screenshot({ path: path.join(OUT, '04_kapitel1_fertig.png') });
  await usePortal(1);
  check(await ev(() => TLH.chapter()) === 'kap02_sesshaftigkeit', 'Tor fuehrt in Kapitel 2');
  const startP = await ev(() => TLH.player());
  check(Math.abs(startP.x + 17) < 0.1, 'Spieler steht am Eingang der neuen Halle', `x=${startP.x.toFixed(2)}`);

  // =================================================================== 4. Uebersicht, Speichern, Optionen, Laden
  console.log('\n4. Kapiteluebersicht, Speichern, Optionen, Laden');
  await press('Tab');
  check(await state() === 'overview', 'Tab oeffnet die Kapiteluebersicht');
  check(await page.locator('#overview .card.here').count() === 1, 'Aktuelles Kapitel ist markiert');
  check(await page.locator('#overview .card.done').count() === 1, 'Kapitel 1 ist als abgeschlossen markiert');
  check((await page.locator('#overview .total').textContent()).includes('5 von 48'), 'Gesamtfortschritt 5 von 48', await page.locator('#overview .total').textContent());
  await page.screenshot({ path: path.join(OUT, '05_kapiteluebersicht.png') });
  await page.locator('#overview button[data-action="read"]').first().click();
  await wait(150);
  check(await state() === 'info', 'Entdeckte Erkenntnis aus der Uebersicht erneut lesen');
  await clickButton('Schließen');
  check(await state() === 'overview', 'Schliessen fuehrt zurueck zur Uebersicht');
  await press('Tab');
  check(await state() === 'playing', 'Tab schliesst die Uebersicht');

  await hold('KeyW', 700);
  await press('F5');
  check((await page.locator('#toast').textContent()).includes('gespeichert'), 'F5 speichert (Meldung)', await page.locator('#toast').textContent());
  const savedPos = await ev(() => TLH.player());

  await press('KeyP');
  await clickButton('Optionen');
  check(await state() === 'options', 'Optionen aus dem Pausenmenue');
  await page.locator('#opt-sens').fill('4.2');
  await page.locator('#opt-fov').fill('85');
  await page.locator('#opt-invert').check();
  const st1 = await ev(() => TLH.settings());
  check(Math.abs(st1.sensitivity - 4.2) < 0.01 && st1.fov === 85 && st1.invertY === true, 'Optionen wirken sofort', JSON.stringify(st1));
  await page.screenshot({ path: path.join(OUT, '06_optionen.png') });
  await clickButton('Speichern und zurück');
  check(await state() === 'pause', 'Zurueck ins Pausenmenue');
  await clickButton('Weiterspielen');
  // Invertierte Maus pruefen
  const iv0 = await ev(() => TLH.player());
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(640, 340, { steps: 4 }); await page.mouse.up();
  const iv1 = await ev(() => TLH.player());
  check(iv1.pitch < iv0.pitch, 'Y-Achse umgekehrt: Maus hoch = Blick runter', `${iv0.pitch.toFixed(2)} -> ${iv1.pitch.toFixed(2)}`);

  // Neu laden: Spielstand + Einstellungen
  await page.reload();
  await waitState('mainmenu', 30000);
  await wait(500);
  check(!(await page.locator('#menu button', { hasText: 'Fortsetzen' }).isDisabled()), 'Nach Neuladen: "Fortsetzen" ist aktiv');
  const st2 = await ev(() => TLH.settings());
  check(Math.abs(st2.sensitivity - 4.2) < 0.01 && st2.fov === 85 && st2.invertY, 'Einstellungen bleiben nach Neuladen erhalten');
  await clickButton('Fortsetzen');
  await waitState('playing');
  const lp = await ev(() => TLH.player());
  check(await ev(() => TLH.chapter()) === 'kap02_sesshaftigkeit', 'Laden: richtiges Kapitel');
  check(await ev(() => TLH.discoveredCount()) === 5, 'Laden: entdeckte Erkenntnisse');
  check(Math.hypot(lp.x - savedPos.x, lp.z - savedPos.z) < 0.05, 'Laden: Position wiederhergestellt', `${lp.x.toFixed(2)}/${lp.z.toFixed(2)}`);
  // Einstellungen zuruecksetzen fuer den Rest
  await press('KeyP'); await clickButton('Optionen');
  await page.locator('#opt-invert').uncheck();
  await page.locator('#opt-sens').fill('2.5');
  await clickButton('Speichern und zurück'); await clickButton('Weiterspielen');

  // =================================================================== 5. Komplettes Durchspielen Kapitel 2-10
  console.log('\n5. Kapitel 2 bis 10 komplett durchspielen');
  for (let ch = 2; ch <= 10; ch++) {
    await wait(300);
    await page.screenshot({ path: path.join(OUT, `halle_${String(ch).padStart(2, '0')}.png`), type: 'jpeg', quality: 70 });
    const okCh = await completeChapter(ch, ch === 10);
    if (!okCh) { break; }
    await usePortal(ch);
    if (ch < 10) {
      const expect = await ev(n => TLH_CONTENT.chapters[n].id, ch);
      check(await ev(() => TLH.chapter()) === expect, `Tor fuehrt in Kapitel ${ch + 1}`);
    }
  }

  // =================================================================== 6. Abspann
  console.log('\n6. Abspann');
  check(await state() === 'ending', 'Letztes Tor zeigt den Abspann');
  check((await page.locator('#ending .stats').textContent()).includes('48 von 48'), 'Abspann-Statistik 48 von 48', await page.locator('#ending .stats').textContent());
  await page.screenshot({ path: path.join(OUT, '07_abspann.png') });
  await clickButton('Weiter im Archiv umsehen');
  check(await state() === 'playing', 'Nach dem Abspann weiter erkunden');
  await press('KeyP');
  await clickButton('Zum Hauptmenü');
  check(await state() === 'mainmenu', 'Zum Hauptmenue');

  // =================================================================== 7. Neues Spiel mit Rueckfrage, alle Kapitel freischalten
  console.log('\n7. Rueckfrage bei "Neues Spiel" und Option "Alle Kapitel freischalten"');
  await clickButton('Neues Spiel');
  check(await page.locator('#menu .confirm').isVisible(), 'Rueckfrage vor dem Ueberschreiben des Spielstands');
  await clickButton('Abbrechen');
  check(await page.locator('#menu .confirm').count() === 0, 'Abbrechen schliesst die Rueckfrage');
  await clickButton('Neues Spiel');
  await clickButton('Ja, neu beginnen');
  await waitState('playing');
  check(await ev(() => TLH.discoveredCount()) === 0 && await ev(() => TLH.chapter()) === 'kap01_urspruenge', 'Neues Spiel setzt den Fortschritt zurueck');
  await press('KeyP'); await clickButton('Optionen');
  await page.locator('#opt-unlock').check();
  await clickButton('Speichern und zurück');
  await clickButton('Kapitelübersicht');
  check(await page.locator('#overview .card.locked').count() === 0, 'Alle Kapitel freigeschaltet');
  await page.locator('#overview button[data-action="enter"][data-id="kap07_industrie"]').click();
  await wait(300);
  check(await ev(() => TLH.chapter()) === 'kap07_industrie' && await state() === 'playing', '"Halle betreten" springt direkt in Kapitel 7');
  check(await ev(() => TLH.portalOpen()), 'Bei freigeschalteten Kapiteln ist das Tor offen');
  await press('KeyP'); await clickButton('Optionen');
  await page.locator('#opt-unlock').uncheck();
  await clickButton('Speichern und zurück'); await clickButton('Weiterspielen');

  // =================================================================== 8. Handy-Breite
  console.log('\n8. Darstellung bei schmalem Bildschirm');
  await press('KeyP'); await clickButton('Zum Hauptmenü');
  await page.setViewportSize({ width: 390, height: 780 });
  await wait(400);
  const overflow = await ev(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, 'Kein waagerechtes Scrollen bei 390 px Breite', `Ueberstand ${overflow} px`);
  await page.screenshot({ path: path.join(OUT, '08_schmal.png') });

  // =================================================================== Ergebnis
  check(errors.length === 0, 'Keine JavaScript-Fehler in der Konsole', errors.join(' | ').slice(0, 300));
  await browser.close();

  const passed = results.filter(r => r.ok).length;
  console.log(`\n=== ${passed} bestanden, ${failed} fehlgeschlagen ===`);
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ url: URL, passed, failed, results }, null, 2));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ABBRUCH:', e); process.exit(2); });
