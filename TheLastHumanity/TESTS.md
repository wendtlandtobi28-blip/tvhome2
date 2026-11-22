# Tests und Ergebnisse – THE LAST HUMANITY

Es sind nur Ergebnisse eingetragen, die tatsächlich ermittelt wurden. Nicht durchgeführte Tests sind als solche markiert.

## A. Durchgeführte Tests (Linux-Cloud-Umgebung, ohne Unreal Engine)

| ID | Datum | Test | Vorgehen | Ergebnis |
|---|---|---|---|---|
| T-01 | 21.11.2026 | Git-Bundle der Originalhistorie gültig | `git bundle verify` | ✅ „is okay“ |
| T-02 | 21.11.2026 | Wiederherstellung aus Git-Bundle | In leeren Ordner geklont (23 Commits), SHA-256 aller Originaldateien verglichen | ✅ alle Prüfsummen stimmen |
| T-03 | 21.11.2026 | Wiederherstellung aus tar.gz | Entpackt (20 Einträge), SHA-256 verglichen | ✅ alle Prüfsummen stimmen |
| T-04 | 21.11.2026 | Verfügbarkeit der Werkzeuge | Suche nach UnrealEditor, Windows, GPU, angeschlossenem Rechner | ❌ nichts davon vorhanden (Linux, keine GPU). Vorhanden: clang, gcc, cmake, Python 3, Node, Git |
| T-05 | 22.11.2026 | Statische Projektprüfung v0.9.0 | `python3 Tools/validate_project.py` | ✅ 17 bestanden, 0 Warnungen, 0 Fehler |
| T-06 | 22.11.2026 | Inhaltsdatei v0.9.0 | Teil von T-05: gültiges UTF-8-JSON; 10 Kapitel fortlaufend; 48 Erkenntnisse; eindeutige IDs; Pflichtfelder; Kurz- kürzer als Langtext; fakt/fiktion; Themen (Farben 0..1, Monument, Säulenform); Positionen (auch automatische) innerhalb der Halle, ohne Säulen-, Monument- und Portalkollision, ≥ 400 cm Abstand; Platzhalteranzahl aller UI-Texte; Titel/Epochen nur Latin-1 (3D-Schrift); Abspann vorhanden; alle 62 im Code verwendeten UI-Schlüssel vorhanden | ✅ bestanden |
| T-07 | 21.11.2026 | Prüfwerkzeug erkennt Fehler | Drei absichtlich beschädigte Kopien (UI-Schlüssel, Säulenkollision, Umlaut + Klammern im C++) | ✅ alle erkannt |
| T-08 | 22.11.2026 | Fachliche Prüfung der Texte (Kapitel 1–9) | Abgleich der Jahreszahlen und Fakten mit Fachliteratur und Referenzwerken; 4 Formulierungen korrigiert (Gutenberg-Bibel, Ausdehnung Roms, Hebräische Bibel, erste Universitäten) | ✅ redaktionell geprüft; **keine** unabhängige Expertenprüfung |
| T-09 | 22.11.2026 | Windows-Skripte: Format | `file`: ASCII, CRLF-Zeilenenden; keine Variablen mit Pfaden innerhalb von Klammerblöcken | ✅ · **Ausführung nicht getestet** (kein Windows) |

**Wichtig:** T-05 ersetzt **keine** Kompilierung. Ob der Code mit Unreal Build Tool fehlerfrei kompiliert, ist **noch nicht getestet**.

## B. Noch nicht durchgeführte Tests (benötigen Windows + Unreal Engine 5.4+)

| ID | Test | Erwartetes Ergebnis | Status |
|---|---|---|---|
| T-10 | `1_Editor_starten.bat` / Kompilieren *Development Editor Win64* | Keine Fehler, Editor startet | ⬜ |
| T-11 | Play im Editor | Hauptmenü über der Halle; Log „Inhalte geladen: 10 Kapitel, 48 Erkenntnisse“ und „Halle erzeugt: Kapitel 1“ | ⬜ |
| T-12 | Hauptmenü | „Fortsetzen“ ohne Spielstand deaktiviert; alle Knöpfe reagieren | ⬜ |
| T-13 | Umgebung | Boden, Wände, Säulen, Feuerstelle, Himmel, Licht sichtbar; Figur fällt nicht durch den Boden | ⬜ |
| T-14 | Steuerung | WASD/Pfeile, Maus (hoch = nach oben sehen), Shift, Leertaste; im Menü bewegt die Maus die Kamera nicht | ⬜ |
| T-15 | Informationspunkt | Hinweis erscheint in der Nähe; E öffnet Fenster; Licht wechselt gold → blau | ⬜ |
| T-16 | Textansicht | Kurzfassung als Standard; Umschalten; Scrollen; Umlaute und Sonderzeichen (Ç, ş, „“) korrekt | ⬜ |
| T-17 | Tor gesperrt | Vor Abschluss rot; Hinweis „(x von y)“; E zeigt Meldung | ⬜ |
| T-18 | Tor offen, Kapitelwechsel | Nach letzter Erkenntnis Meldung „Tor ist offen“; Tor blau; E → Halle Kapitel 2 mit anderen Farben, Spieler am Eingang | ⬜ |
| T-19 | Kapitelübersicht | Tab öffnet; Fortschritt stimmt; entdeckte Erkenntnisse anklickbar und schließen zurück zur Übersicht; „Halle betreten“ wechselt | ⬜ |
| T-20 | Optionen | Schieberegler wirken sofort; Werte bleiben nach Neustart erhalten | ⬜ |
| T-21 | „Alle Kapitel freischalten“ | Alle Hallen in der Übersicht betretbar; Tor offen | ⬜ |
| T-22 | Speichern | F5, Menü und automatisch: `TLH_Spielstand_1.sav` entsteht; Meldung erscheint | ⬜ |
| T-23 | Laden | Nach Neustart „Fortsetzen“: richtige Halle, Position, Blickrichtung, entdeckte Punkte | ⬜ |
| T-24 | Abspann | Kapitel 10 abschließen → letztes Tor → Abspann mit Statistik; beide Knöpfe funktionieren | ⬜ |
| T-25 | 3D-Schrift | Titel über Sockeln, Inschrift an der Stirnwand und Torbeschriftung lesbar (nicht gespiegelt) | ⬜ |
| T-26 | Alle 10 Hallen | Jede Halle baut sich auf, keine Erkenntnis steckt in Wand, Säule oder Monument | ⬜ |
| T-27 | `2_Windows_Spiel_erstellen.bat` | Erzeugt `Build\Windows\Windows\TheLastHumanity.exe` | ⬜ |
| T-28 | Gepackte Version | .exe startet; Texte werden geladen; Grundformen sichtbar | ⬜ |
| T-29 | Gepackte Version auf zweitem PC | Ordner kopiert, startet ohne installierte Engine | ⬜ |
| T-30 | Durchspielen | Kapitel 1–10 bis zum Abspann ohne Absturz | ⬜ |

## C. Browser-Version (`../TheLastHumanity_Web/`) – tatsächlich im Browser getestet

Umgebung: Chromium (Playwright) ohne Grafikkarte, 3D-Darstellung per Software (SwiftShader), 1024 × 640 Pixel; lokaler Webserver. Automatischer Gesamttest `TheLastHumanity_Web/tests/e2e_test.js`; Protokoll: `TheLastHumanity_Web/tests/ergebnisse/gesamttest_2026-11-22.txt`; Bilder: `TheLastHumanity_Web/docs/bilder/`.

| ID | Datum | Test | Ergebnis |
|---|---|---|---|
| W-01 | 22.11.2026 | 1. Gesamtlauf | ❌ 100/102. Gefunden und behoben: (a) **Maus-Sprung** nach dem Einfangen der Maus (Blick drehte sich um ~140°); die Browser-Version filtert solche Ausreißer jetzt. (b) Messung „Laufen schneller als Gehen“ auf der langsamen Testmaschine zu kurz → Test misst jetzt Geschwindigkeit pro Sekunde. Davor behoben: Ladebildschirm blieb stehen (CSS); Bewegung auf sehr langsamen Rechnern zu langsam → Bewegungsberechnung in Teilschritten. |
| W-02 | 22.11.2026 | 2. Gesamtlauf | ❌ 98/102. Spiel komplett durchgespielt; Fehler nur im Testaufbau: kopfloser Browser liefert bei eingefangener Maus keine echten Bewegungswerte (→ Test nutzt Umsehen per Ziehen, Schalter `?zeiger=aus`); Laufroutine pendelte vor dem Tor in Kapitel 4 (Tor war fokussiert und offen) → Zielzone vergrößert. |
| W-03 | 22.11.2026 | **3. Gesamtlauf** | ✅ **102 von 102 Prüfungen bestanden**, keine JavaScript-Fehler |
| W-04 | 22.11.2026 | Start per Doppelklick (`file://`) | ✅ Spiel startet, Gehen, F5-Speichern, keine Fehler |

**Was W-03 im Einzelnen geprüft hat** (alle ✅): Laden, Ladebildschirm verschwindet, Hauptmenü, „Fortsetzen“ ohne Spielstand gesperrt, Kapitelübersicht aus dem Hauptmenü (10 Kapitel, 9 gesperrt) · Neues Spiel, HUD · Gehen mit W/A/D/Pfeilen, Laufen mit Shift, Springen und Landen · Umsehen mit der Maus (rechts/oben) · Kollision mit Seitenwand und Feuerstelle · Esc und P öffnen/schließen das Pausenmenü, „Weiterspielen“ · Tor vor Abschluss gesperrt (Hinweis, kein Kapitelwechsel) · Informationsfenster: Titel, Kurzfassung, ausführliche Fassung (länger), zurück, Schließen, Zählung, automatische Speicherung, „Erneut lesen“ · **alle 48 Erkenntnisse in allen 10 Hallen zu Fuß erreicht, fokussiert, geöffnet und gelesen** · jedes Tor erreichbar, öffnet sich nach Abschluss, führt ins nächste Kapitel, Spieler am Halleneingang · Kapitelübersicht: aktuelles/abgeschlossenes Kapitel, Gesamtfortschritt, erneutes Lesen mit Rückkehr, Tab schließt · F5 speichert · Optionen: Empfindlichkeit, Sichtfeld, Y-Achse umkehren wirken sofort · nach **Neuladen der Seite**: Einstellungen erhalten, „Fortsetzen“ aktiv, richtiges Kapitel, Erkenntnisse und Position wiederhergestellt · **Abspann** nach Kapitel 10 mit „48 von 48“, weiter erkunden, zum Hauptmenü · Rückfrage vor dem Überschreiben des Spielstands (Abbrechen/Ja) · „Alle Kapitel freischalten“ und direkter Sprung in Kapitel 7 · kein waagerechtes Scrollen bei 390 px Breite.

**Nicht automatisch prüfbar:** Umsehen mit eingefangener Maus (Zeigersperre) – kopflose Testbrowser liefern dabei keine echten Mauswerte. Die Logik dahinter ist dieselbe wie beim getesteten Umsehen per Ziehen. Darstellungsqualität und Bildrate auf einem echten PC mit Grafikkarte: bitte beim eigenen Durchspielen beurteilen.

## D. Browser-Version 2 (Science-Fiction-Story-Modus) – im Browser getestet

Umgebung: Chromium (Playwright), 3D per Software ohne Grafikkarte, 1024 × 640, Grafikstufe „niedrig“ (für die Testgeschwindigkeit). Test: `TheLastHumanity_Web/tests/e2e_test.js` und `tests/teiltest_menues.js`. Protokolle: `TheLastHumanity_Web/tests/ergebnisse/`. Bilder: `TheLastHumanity_Web/docs/bilder/`.

| ID | Datum | Test | Ergebnis |
|---|---|---|---|
| V2-01 | 22.11.2026 | Sicht- und Fehlerprüfung „hoch“ (Spiegelung, Leuchteffekte) | Gefunden und behoben: Streifen auf dem Boden (Z-Fighting mit dem Plattform-Unterbau), dunkler Gasriese (Nachtseite), Türme verdeckten den Himmel, zu lange Schatten. Danach ✅ keine Fehler |
| V2-02 | 22.11.2026 | 1. Gesamtlauf | ✅ 86 von 86 Prüfungen bis zum Abspann, danach Abbruch: **echter Fehler** gefunden: im Pausenmenü lagen bei 640 px Höhe die unteren Knöpfe (z. B. „Optionen“) außerhalb des Bildschirms → behoben (zwei Spalten, scrollbar, kompaktere Darstellung bei niedrigen Bildschirmen) |
| V2-03 | 22.11.2026 | 2. Gesamtlauf | ✅ 86 von 86 Prüfungen bis zum Abspann; Abbruch im letzten Abschnitt durch einen Fehler im Testskript (Schiebereglerwert „4.0“ statt „4“), nicht im Spiel |
| V2-04 | 22.11.2026 | Teiltest Menüs/Optionen/schmaler Bildschirm | ✅ 14 von 14 |

**Was V2-03 geprüft hat** (alle ✅): Laden (ca. 8–11 s), Hauptmenü, Namenseingabe, Einleitung, eigener Name im HUD · Gehen kameraabhängig, Sprinten verbraucht Ausdauer, Springen und Landen, Kamera per Maus (rechts/oben), Geländer am Plattformrand hält die Figur auf (44,4 m), Esc-Menü · Archivtor anfangs versiegelt · Gespräch mit der Kommandantin (4 Zeilen) · drei Orte erkundet → nächste Quest · **alle 10 Datenkristalle** eingesammelt, Kodex zeigt die Texte · Fähigkeiten 1–5 wirken (Energie, Schub, Leuchtfeuer, Zeitecho, Rückruf), Fähigkeit 6 gesperrt · Fähigkeiten, Karte und Journal öffnen und schließen · Sektortor vor Abschluss gesperrt · ausführliche Fassung länger als die Kurzfassung · **alle 10 Archivsektoren mit allen 48 Erinnerungen zu Fuß erreicht, geöffnet und gelesen** · jedes Archiv- und Sektortor funktioniert · jeder Bericht bei der Kommandantin · F5 speichert, nach Neuladen sind Fortschritt, Kristalle, Erfahrung und Quest wiederhergestellt · letzte Quest, Abschlussgespräch, **Abspann** („48 von 48“, Stufe 22) · weiterspielen nach dem Abspann.

**V2-04:** Alle 8 Knöpfe des Pausenmenüs bei 1024 × 640 vollständig sichtbar · Optionen (Empfindlichkeit, Sichtfeld, Lautstärke, Y-Achse, Grafikqualität) wirken sofort und bleiben nach dem Neuladen erhalten · kein waagerechtes Scrollen bei 390 px · keine JavaScript-Fehler.

**Nicht automatisch prüfbar:** Kamera mit eingefangener Maus (kopflose Testbrowser liefern keine echten Mauswerte; gleiche Logik wie das getestete Ziehen) · Klang (wird erzeugt, ist aber im Test nicht hörbar) · Bildrate und Aussehen auf einem echten PC mit Grafikkarte → bitte beim eigenen Spielen beurteilen.
