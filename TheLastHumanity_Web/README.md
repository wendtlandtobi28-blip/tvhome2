# THE LAST HUMANITY – Browser-Version

Das komplette Spiel läuft im Browser, ohne Installation: 10 Hallen, 48 Erkenntnisse, Tore, Kapitelübersicht, Optionen, Speichern und Abspann. Die Inhalte sind dieselben wie im Unreal-Engine-Projekt (`../TheLastHumanity`).

## Spielen

**Möglichkeit 1: Doppelklick.** `index.html` im Ordner `TheLastHumanity_Web` doppelt anklicken. Das Spiel öffnet sich im Standardbrowser und funktioniert auch ohne Internet. Ohne Internet fehlen nur die besonderen Schriftarten.

**Möglichkeit 2: Online-Link.** Den veröffentlichten Link öffnen (siehe `../TheLastHumanity/PROGRESS.md`).

Empfohlen: aktueller **Chrome, Edge oder Firefox** an einem PC oder Laptop mit Tastatur und Maus.

## Steuerung

| Taste | Funktion |
|---|---|
| W A S D / Pfeiltasten | Gehen |
| Maus | Umsehen (nach dem ersten Klick ins Bild wird die Maus „eingefangen“) |
| Shift | Laufen |
| Leertaste | Springen |
| E | Untersuchen / Tor benutzen / Textfenster schließen |
| Tab oder K | Kapitelübersicht |
| Esc oder P | Pausenmenü. Esc gibt auch die Maus frei. |
| F5 | Schnellspeichern (lädt die Seite **nicht** neu) |

Kann der Browser die Maus nicht einfangen, kannst du dich mit **gedrückter linker Maustaste** umsehen.

## Speicherstand

Spielstand und Einstellungen werden im Browser gespeichert (`localStorage`). Sie gelten also nur in diesem Browser auf diesem Gerät. Ein privates Fenster speichert nichts dauerhaft. Das Spiel zeigt dann einen Hinweis.

## Aufbau

| Datei | Inhalt |
|---|---|
| `page.html` | Seite und Gestaltung (Quelle) |
| `index.html` | Daraus erzeugte vollständige Seite (nicht von Hand bearbeiten) |
| `js/game.js` | Spiellogik, 3D-Welt, Steuerung, Oberfläche, Speichern |
| `js/content_de.js` | Erzeugt aus `../TheLastHumanity/Content/Data/content_de.json` (einzige Inhaltsquelle) |
| `vendor/three.min.js` | three.js 0.149.0 (3D-Bibliothek, MIT-Lizenz, `vendor/THREE_LICENSE.txt`) |
| `tools/build.py` | Erzeugt `js/content_de.js` und `index.html` |
| `tests/e2e_test.js` | Automatischer Gesamttest: spielt das ganze Spiel im Browser durch |

### Nach Änderungen an Texten oder Seite
```
python3 tools/build.py
python3 ../TheLastHumanity/Tools/validate_project.py
```

### Gesamttest ausführen (Node.js + Playwright)
```
python3 -m http.server 8123 --bind 127.0.0.1      # im Ordner TheLastHumanity_Web
node tests/e2e_test.js http://127.0.0.1:8123/index.html ./testergebnis
```
