# THE LAST HUMANITY – Browser-Version 2

Science-Fiction-Erkundungsspiel in der dritten Person. Im Orbit des Gasriesen Tethys treibt die Raumstation **MNEMOSYNE**, die letzte Arche der Menschheit. Als Hüterin oder Hüter erweckst du das verstummte Archiv: 10 Archivsektoren mit 48 Erinnerungen aus der Geschichte der Menschheit, eingebettet in eine Rahmenhandlung auf der Station.

## Spielen

- **Doppelklick** auf `index.html`. Das Spiel läuft offline, alles steckt in `js/game.bundle.js`. Ohne Internet fehlen nur die Schriftarten.
- **Online-Link:** siehe `../TheLastHumanity/PROGRESS.md`.
- Empfohlen: aktueller Chrome, Edge oder Firefox an einem PC mit Tastatur und Maus. Ruckelt das Bild, stellst du in den Optionen „Grafikqualität: Mittel“ oder „Niedrig“ ein und lädst die Seite neu.

## Steuerung

| Taste | Funktion |
|---|---|
| W A S D | Gehen (relativ zur Kamera) |
| Maus | Kamera drehen (vorher einmal ins Bild klicken) · Mausrad: Kameraabstand |
| Shift | Sprinten (verbraucht Ausdauer, roter Balken) |
| Leertaste | Springen |
| E | Sprechen, untersuchen, Tor benutzen, Dialog weiter |
| 1–6 | Fähigkeiten (verbrauchen Energie, blauer Balken): Scan-Puls, Schub, Leuchtfeuer, Zeitecho, Rückruf, ab Stufe 10 gesperrt |
| J oder Tab | Journal (Quests, Archivsektoren, Erinnerungen erneut lesen) |
| I | Kodex (Datenkristalle, Orte, Personen) |
| K | Fähigkeiten |
| M | Karte |
| Esc oder P | Menü |
| F5 | Schnellspeichern |

## Geschichte und Ablauf

1. Neues Spiel: Du gibst deinen Namen ein und erwachst auf der Station.
2. Du sprichst mit Kommandantin Aris Velan.
3. Du erkundest drei Orte: Aussichtsplattform, Denkmal der Gründer, Archivtor.
4. Durch das Archivtor betrittst du Sektor 1 und erweckst alle Erinnerungen an den Datenterminals.
5. Durch das Sektortor kehrst du zurück und erstattest der Kommandantin Bericht.
6. Das wiederholt sich für alle 10 Sektoren, danach folgen das Abschlussgespräch und der Abspann.

Nebenbei findest du 10 Datenkristalle mit Geschichten der Station und sprichst mit weiteren Bewohnern. Mit wachsender Erfahrung steigt deine Stufe.

## Aufbau

| Datei / Ordner | Inhalt |
|---|---|
| `page.html` | Seite, HUD und Gestaltung (Quelle) |
| `index.html` | Daraus erzeugt (nicht von Hand bearbeiten) |
| `src/` | Spielcode: `main.js` (Logik, Kamera, Quests, Menüs), `world.js` (Station, Sektoren), `character.js` (Figur, Animation, Umhang), `sky.js` (Gasriese, Ringstadt, Schiffe), `assets.js`, `audio.js`, `util.js` |
| `js/game.bundle.js` | Gebündeltes Spiel (erzeugt) |
| `assets/models/*.glb` | Eigene 3D-Modelle, erzeugt mit `tools/blender_models.py` (Blender als Python-Modul) |
| `assets/emblem.svg` | Eigenes Emblem „Flamme der Erinnerung“ |
| `../TheLastHumanity/Content/Data/content_de.json` | Geschichtsinhalte (gemeinsam mit der Unreal-Version) |
| `../TheLastHumanity/Content/Data/story_de.json` | Rahmenhandlung: Personen, Dialoge, Quests, Kristalle, Fähigkeiten |
| `tests/e2e_test.js` | Automatischer Gesamttest (spielt das ganze Spiel durch) |
| `THIRD_PARTY_LICENSES.md` | Lizenzen der verwendeten Fremdbestandteile |

### Bauen
```
npm install
npm run build                       # erzeugt js/game.bundle.js und index.html
python3 ../TheLastHumanity/Tools/validate_project.py
```
Modelle neu erzeugen (optional, braucht `pip install bpy`): `python tools/blender_models.py`

### Gesamttest
```
python3 -m http.server 8123 --bind 127.0.0.1
node tests/e2e_test.js http://127.0.0.1:8123/index.html ./testergebnis niedrig
```
