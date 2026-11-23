/*
 * THE LAST HUMANITY - Test der Tablet-Steuerung (Touch) mit emuliertem iPad (Playwright + Chromium).
 * Prueft: Touch-Erkennung, Bedienung der Menues per Antippen, Joystick, Wischen zum Umsehen,
 * Knoepfe (E, Sprung, Sprint, Menue, Journal, Karte, Kodex), Faehigkeit antippen, Gespraech,
 * Datenrauschen per gehaltenem E-Knopf, Wissenspruefung per Antippen, Hoch- und Querformat.
 *
 * Aufruf: node tests/touch_test.js <URL zur index.html> <Ergebnisordner>
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] + (process.argv[2].includes('?') ? '&' : '?') + 'grafik=niedrig';
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
  const ctx = await browser.newContext({ ...devices['iPad Pro 11 landscape'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const state = () => ev(() => TLH.state());
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 75 });
  const tapBtn = async (text) => { await page.locator('.screen:not([hidden]) button', { hasText: text }).first().tap(); await wait(250); };
  /** Fingerbewegung auf der 3D-Ansicht (Pointer Events wie auf dem Tablet) */
  const finger = (type, id, x, y) => ev(([t, i, px, py]) => {
    const c = document.getElementById('scene');
    c.dispatchEvent(new PointerEvent(t, { pointerId: i, pointerType: 'touch', clientX: px, clientY: py, bubbles: true, cancelable: true, isPrimary: i === 1 }));
  }, [type, id, x, y]);
  /** Knopf druecken/loslassen per Pointer Events */
  const press = (sel, type) => ev(([s, t]) => {
    document.querySelector(s).dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true }));
  }, [sel, type]);
  const tapKey = async (sel) => { await press(sel, 'pointerdown'); await wait(120); await press(sel, 'pointerup'); await wait(250); };

  console.log('\nT1. Start auf dem Tablet');
  await page.goto(URL);
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  check(await ev(() => document.body.classList.contains('touch')), 'Tablet wird erkannt (Touch-Modus)');
  await tapBtn('Neues Spiel');
  await page.locator('#heroname').fill('Tablet');
  await tapBtn('Erwachen');
  if (await state() === 'intro') await page.locator('#intro button').first().tap();
  await wait(300);
  check(await state() === 'playing', 'Menues per Antippen bedienbar, Spiel startet');
  check(await page.locator('#touch').isVisible() && await page.locator('#t-use').isVisible(), 'Touch-Steuerung sichtbar');
  check(!(await page.locator('#hint').isVisible()), 'Tastatur-Hinweise ausgeblendet');
  await shot('tablet_quer');

  console.log('\nT2. Joystick, Umsehen, Knoepfe');
  await ev(() => TLH.face(0, 30));
  const p0 = await ev(() => TLH.player());
  await finger('pointerdown', 1, 160, 600);
  await finger('pointermove', 1, 160, 540);
  await wait(1200);
  const p1 = await ev(() => TLH.player());
  await finger('pointerup', 1, 160, 540);
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, 'Joystick: Figur laeuft', `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)} m`);
  await wait(400);
  const p2 = await ev(() => TLH.player());
  await wait(400);
  const p3 = await ev(() => TLH.player());
  check(Math.hypot(p3.x - p2.x, p3.z - p2.z) < 0.1, 'Joystick loslassen: Figur bleibt stehen');
  const y0 = await ev(() => TLH.player());
  await finger('pointerdown', 2, 800, 400);
  for (let i = 1; i <= 5; i++) await finger('pointermove', 2, 800 + i * 30, 400 - i * 8);
  await finger('pointerup', 2, 950, 360);
  const y1 = await ev(() => TLH.player());
  check(y1.camYaw < y0.camYaw && y1.pitch < y0.pitch, 'Wischen rechts: Kamera dreht sich');
  // Laufen und gleichzeitig umsehen (zwei Finger)
  const q0 = await ev(() => TLH.player());
  await finger('pointerdown', 1, 160, 600); await finger('pointermove', 1, 160, 540);
  await finger('pointerdown', 2, 800, 400); await finger('pointermove', 2, 860, 400);
  await wait(600);
  await finger('pointerup', 2, 860, 400); await finger('pointerup', 1, 160, 540);
  const q1 = await ev(() => TLH.player());
  check(Math.hypot(q1.x - q0.x, q1.z - q0.z) > 0.5 && q1.camYaw !== q0.camYaw, 'Zwei Finger: laufen und umsehen gleichzeitig');
  await tapKey('#t-run');
  check(await ev(() => document.getElementById('t-run').classList.contains('on')), 'Sprint-Knopf schaltet ein');
  const s0 = (await ev(() => TLH.player())).stamina;
  await finger('pointerdown', 1, 160, 600); await finger('pointermove', 1, 160, 530);
  await wait(1200);
  await finger('pointerup', 1, 160, 530);
  check((await ev(() => TLH.player())).stamina < s0 - 5, 'Sprinten per Knopf verbraucht Ausdauer');
  await tapKey('#t-run');
  await press('#t-jump', 'pointerdown'); await wait(200);
  const jy = (await ev(() => TLH.player())).y;
  await press('#t-jump', 'pointerup'); await wait(1000);
  check(jy > 0.1, 'Sprung-Knopf');
  await wait(1500);
  const e0 = (await ev(() => TLH.player())).energy;
  await tapKey('#ab1');
  check((await ev(() => TLH.player())).energy < e0 - 20, 'Faehigkeit antippen (Scan-Puls)');
  for (const [sel, st] of [['.ttop [data-key="KeyJ"]', 'journal'], ['.ttop [data-key="KeyM"]', 'map'], ['.ttop [data-key="KeyI"]', 'codex']]) {
    await tapKey(sel);
    check(await state() === st, `Knopf oeffnet ${st}`);
    if (st === 'journal') await shot('tablet_journal');
    await tapBtn('Zurück');
    check(await state() === 'playing', `${st} per Antippen schliessen`);
  }
  await tapKey('.ttop [data-key="Escape"]');
  check(await state() === 'pause', 'Menue-Knopf oeffnet das Menue');
  await tapBtn('Weiterspielen');
  check(await state() === 'playing', '"Weiterspielen" antippen');

  console.log('\nT3. Gespraech und Sektor per Touch');
  const n = await ev(() => TLH.npc('kommandantin'));
  await ev(([x, z]) => { TLH.teleport(x + 1.8, z + 0.4); TLH.face(x, z); }, [n.x, n.z]);
  await wait(300);
  check(await page.locator('#prompt').isVisible(), 'Hinweis erscheint bei der Kommandantin');
  await tapKey('#t-use');
  check(await state() === 'dialog', 'E-Knopf startet Gespraech');
  for (let i = 0; i < 12 && await state() === 'dialog'; i++) await tapKey('#t-use');
  check(await state() === 'playing' && await ev(() => TLH.stage()) === 'explore', 'Gespraech per E-Knopf durchgeklickt, Quest weiter');
  // Sektor 1 direkt (Option "Alle Sektoren freischalten") ueber das Journal betreten
  await tapKey('.ttop [data-key="Escape"]');
  await tapBtn('Optionen');
  await page.locator('#opt-unlock').tap();
  await tapBtn('Speichern und zurück');
  await tapBtn('Weiterspielen');
  await tapKey('.ttop [data-key="KeyJ"]');
  await page.locator('#journal button', { hasText: 'Sektor betreten' }).first().tap();
  await wait(800);
  check(await ev(() => TLH.area()) === 'sector', 'Sektor 1 per Antippen im Journal betreten');
  const noisy = await ev(() => TLH.noisy());
  const pts = await ev(() => TLH.points());
  const np = pts.find((p) => p.id === noisy[0]);
  await ev(([x, z]) => { TLH.teleport(x, z - Math.sign(z) * 1.3); TLH.face(x, z); }, [np.x, np.z]);
  await wait(300);
  await press('#t-use', 'pointerdown'); await wait(1900); await press('#t-use', 'pointerup'); await wait(300);
  check(!(await ev(() => TLH.noisy())).includes(np.id), 'Datenrauschen: E-Knopf gedrueckt halten');
  await tapKey('#t-use');
  check(await state() === 'info', 'Erinnerung per E-Knopf geoeffnet');
  await shot('tablet_erinnerung');
  await page.locator('#info button[data-action="close"]').tap(); await wait(250);
  check(await state() === 'playing', 'Erinnerung per Antippen geschlossen');
  // Wissenspruefung per Antippen (Terminal ist erst nach allen Erinnerungen aktiv -> Antworten antippen pruefen, falls offen)
  const q = await ev(() => TLH.quizPos());
  await ev(([x, z]) => { TLH.teleport(x - 2, z); TLH.face(x, z); }, [q.x, q.z]);
  await wait(300);
  await tapKey('#t-use');
  if (await state() === 'quiz') {
    const c = await ev(() => TLH.quizCorrect());
    await page.locator('#quiz button[data-action="quiz-answer"]').nth(c).tap();
    await wait(250);
    check(await page.locator('#quiz .quiz-feedback').count() === 1, 'Wissenspruefung: Antwort antippen');
    await shot('tablet_quiz');
  } else {
    check((await ev(() => TLH.prompt())).length > 0, 'Prueftterminal reagiert (Pruefung erst nach allen Erinnerungen)', await ev(() => TLH.prompt()));
  }

  console.log('\nT4. Hochformat');
  await page.setViewportSize({ width: 834, height: 1194 });
  await wait(600);
  if (await state() !== 'playing') await ev(() => { const b = document.querySelector('.screen:not([hidden]) button[data-action="close"], .screen:not([hidden]) button[data-action="back"]'); if (b) b.click(); });
  await wait(300);
  await shot('tablet_hoch');
  const overlap = await ev(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const a = r('#t-use'), b = r('#abilities'), m = r('#minimap'), t = r('.ttop');
    const hit = (x, y) => !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top);
    return { useAb: hit(a, b), menuMap: hit(t, m), inside: a.right <= innerWidth && a.bottom <= innerHeight };
  });
  check(!overlap.useAb && !overlap.menuMap && overlap.inside, 'Hochformat: Knoepfe ueberlappen nicht und sind im Bild', JSON.stringify(overlap));
  check(await ev(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'Hochformat: kein waagerechtes Scrollen');

  check(errors.length === 0, 'Keine JavaScript-Fehler', errors.join(' | ').slice(0, 300));
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== ${passed} bestanden, ${failed} fehlgeschlagen ===`);
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ passed, failed, results }, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(2); });
