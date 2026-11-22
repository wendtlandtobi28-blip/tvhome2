/*
 * Kurztest: Pausenmenue (alle Knoepfe erreichbar), Optionen, Einstellungen nach Neuladen, schmaler Bildschirm.
 * Aufruf: node tests/teiltest_menues.js <URL zur index.html> <Ergebnisordner>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.argv[2] + '?zeiger=aus&grafik=niedrig';
const OUT = process.argv[3] || '.';
fs.mkdirSync(OUT, { recursive: true });
let failed = 0; const results = [];
const check = (c, l, d) => { results.push({ ok: !!c, label: l, detail: String(d ?? '') }); if (!c) failed++; console.log((c ? '  [OK]     ' : '  [FEHLER] ') + l + (d !== undefined ? '  (' + d + ')' : '')); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const ev = (f) => page.evaluate(f);
  const click = async (t) => { await page.locator('.screen:not([hidden]) button', { hasText: t }).first().click(); await page.waitForTimeout(200); };
  await page.goto(URL);
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  await click('Neues Spiel'); await click('Erwachen'); await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const labels = ['Weiterspielen', 'Spiel speichern', 'Journal', 'Kodex', 'Fähigkeiten', 'Karte', 'Optionen', 'Zum Hauptmenü'];
  for (const l of labels) {
    const box = await page.locator('#menu button', { hasText: l }).first().boundingBox();
    check(box && box.y >= 0 && box.y + box.height <= 640, `Pausenmenue (1024x640): "${l}" vollstaendig sichtbar`, box ? Math.round(box.y) + ' px' : 'fehlt');
  }
  await page.screenshot({ path: path.join(OUT, 'pausenmenue.jpg'), type: 'jpeg', quality: 75 });
  await click('Optionen');
  check(await ev(() => TLH.state()) === 'options', 'Optionen oeffnen sich');
  await page.locator('#opt-sens').fill('4');
  await page.locator('#opt-fov').fill('80');
  await page.locator('#opt-vol').fill('0.3');
  await page.locator('#opt-invert').check();
  await page.locator('#opt-quality').selectOption('mittel');
  const st = await ev(() => TLH.settings());
  check(Math.abs(st.sensitivity - 4) < 0.01 && st.fov === 80 && Math.abs(st.volume - 0.3) < 0.01 && st.invertY && st.quality === 'mittel', 'Optionen wirken sofort', JSON.stringify(st));
  await page.screenshot({ path: path.join(OUT, 'optionen.jpg'), type: 'jpeg', quality: 75 });
  await click('Speichern und zurück');
  check(await ev(() => TLH.state()) === 'pause', 'Zurueck ins Pausenmenue');
  await page.goto(process.argv[2] + '?zeiger=aus');
  await page.waitForFunction(() => window.TLH && TLH.state() === 'mainmenu', null, { timeout: 120000 });
  const st2 = await ev(() => TLH.settings());
  check(st2.sensitivity === 4 && st2.fov === 80 && st2.invertY && st2.quality === 'mittel', 'Einstellungen bleiben nach Neuladen erhalten (inkl. Grafikqualitaet)', JSON.stringify(st2));
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(400);
  const ov = await ev(() => document.documentElement.scrollWidth - innerWidth);
  check(ov <= 0, 'Kein waagerechtes Scrollen bei 390 px Breite', ov + ' px');
  await page.screenshot({ path: path.join(OUT, 'schmal.jpg'), type: 'jpeg', quality: 75 });
  check(errors.length === 0, 'Keine JavaScript-Fehler', errors.join(' | '));
  await browser.close();
  console.log(`=== ${results.filter((r) => r.ok).length} bestanden, ${failed} fehlgeschlagen ===`);
  fs.writeFileSync(path.join(OUT, 'ergebnis_menues.json'), JSON.stringify(results, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(2); });
