/*
 * THE LAST HUMANITY - Test Waffen am PC (Tastatur) und Leistungsanpassung.
 * Prueft: Waffenkreuz mit Q + Richtungstaste, alle vier Waffen, Feuern mit F, Nachladen mit R,
 * Treffer an Stoersonden (Station: Uebungsziele kommen wieder; Sektor: Erfahrung), Speichern der Waffe.
 * Aufruf: node tests/waffen_test.js <URL zur index.html> <Ergebnisordner>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.argv[2] + (process.argv[2].includes('?') ? '&' : '?') + 'grafik=niedrig&zeiger=aus';
const OUT = process.argv[3] || '.';
fs.mkdirSync(OUT, { recursive: true });
const results = []; let failed = 0;
function check(c, label, d) { results.push({ ok: !!c, label, detail: d === undefined ? '' : String(d) }); if (!c) failed++; console.log((c ? '  [OK]     ' : '  [FEHLER] ') + label + (d !== undefined ? '  (' + d + ')' : '')); }
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const ev = (fn, a) => page.evaluate(fn, a); const wait = (ms) => page.waitForTimeout(ms);
  const key = async (k, ms = 80) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(150); };
  await page.goto(URL);
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  await ev(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  check(!(await ev(() => document.body.classList.contains('touch'))), 'PC: kein Touch-Modus');
  await page.locator('.screen:not([hidden]) button', { hasText: 'Neues Spiel' }).first().click();
  await page.locator('#heroname').fill('Schuetze');
  await page.locator('.screen:not([hidden]) button', { hasText: 'Erwachen' }).first().click();
  await wait(300);
  if (await ev(() => TLH.state()) === 'intro') await page.keyboard.press('Enter');
  await wait(400);
  console.log('\nW1. Waffenkreuz');
  await page.keyboard.down('KeyQ'); await wait(200);
  check(await ev(() => TLH.wheelOpen()), 'Q oeffnet das Waffenkreuz');
  await page.screenshot({ path: path.join(OUT, 'pc_waffenkreuz.jpg'), type: 'jpeg', quality: 75 });
  await page.keyboard.press('KeyW'); await page.keyboard.up('KeyQ'); await wait(200);
  check(await ev(() => TLH.weapon()) === 'blaster', 'Q + W: Puls-Blaster', await ev(() => TLH.weapon()));
  for (const [k, id] of [['KeyD', 'streuer'], ['KeyS', 'lanze'], ['KeyA', 'klinge']]) {
    await key('KeyQ'); await key(k);
    check(await ev(() => TLH.weapon()) === id && !(await ev(() => TLH.wheelOpen())), 'Q, dann ' + k + ': ' + id, await ev(() => TLH.weapon()));
  }
  await key('KeyX');
  check(await ev(() => TLH.weapon()) === null, 'X steckt die Waffe weg');
  await key('KeyX');
  check(await ev(() => TLH.weapon()) === 'klinge', 'X zieht die letzte Waffe wieder');
  console.log('\nW2. Feuern auf der Station (Uebungsziele)');
  await key('KeyQ'); await key('KeyS');
  const d = (await ev(() => TLH.drones()))[0];
  await ev(([x, z]) => TLH.teleport(x, z + 9), [d.x, d.z]);
  await ev(([x, y, z]) => TLH.aimAt(x, y, z), [d.x, d.y, d.z]);
  await wait(300);
  await key('KeyF', 120);
  await wait(300);
  await page.screenshot({ path: path.join(OUT, 'pc_lichtlanze.jpg'), type: 'jpeg', quality: 75 });
  check(await ev(() => TLH.ammo('lanze')) === 3, 'F feuert die Lichtlanze (Ladung 3 von 4)', await ev(() => TLH.ammo('lanze')));
  let killed = !(await ev(() => TLH.drones()))[0].alive;
  for (let i = 0; i < 6 && !killed; i++) {
    const t = (await ev(() => TLH.drones()))[0];
    await ev(([x, y, z]) => TLH.aimAt(x, y, z), [t.x, t.y, t.z]);
    await key('KeyF', 120); await wait(1100);
    killed = !(await ev(() => TLH.drones()))[0].alive;
  }
  check(killed, 'Uebungsziel zerstoert');
  check(await ev(() => TLH.dronesKilled()) === 0, 'Uebungsziele geben keine Erfahrung (kein Farmen)');
  await key('KeyR');
  check(await ev(() => TLH.reloading()), 'R laedt nach');
  await wait(2600);
  check(await ev(() => TLH.ammo('lanze')) === 4 && !(await ev(() => TLH.reloading())), 'Nachladen fertig (4 von 4)');
  await wait(4000);
  check((await ev(() => TLH.drones()))[0].alive, 'Uebungsziel kommt nach einigen Sekunden wieder');
  check(errors.length === 0, 'Keine JavaScript-Fehler', errors.join(' | ').slice(0, 300));
  const pf = await ev(() => TLH.perf());
  console.log('  Leistung:', JSON.stringify(pf));
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== ${passed} bestanden, ${failed} fehlgeschlagen ===`);
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ passed, failed, results }, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(2); });
