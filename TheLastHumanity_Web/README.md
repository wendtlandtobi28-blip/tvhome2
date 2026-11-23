# THE LAST HUMANITY – Browser-Version 3 (grober Entwurf, 20 Kapitel)

Science-Fiction-Erkundungsspiel in der dritten Person. Im Orbit des Gasriesen Tethys treibt die Raumstation **MNEMOSYNE**, die letzte Arche der Menschheit. Als Hüterin oder Hüter erweckst du das verstummte Archiv: **20 Archivsektoren mit 246 Erinnerungen** aus der Geschichte der Menschheit, dazu 80 Artefakte, 20 Zeitzeugen-Echos, 20 Wissensprüfungen und 20 Nebenaufgaben, eingebettet in eine Rahmenhandlung auf der Station.

> Stand: **grober Entwurf** für das 45-Stunden-Ziel. Die Grafik ist noch die bisherige; Texte sind Entwürfe (fachliche Prüfung steht aus).

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
| E | Sprechen, untersuchen, Tor benutzen, Dialog weiter · **gedrückt halten:** Datenrauschen beseitigen |
| 1 2 3 | In der Wissensprüfung: Antwort wählen |
| 1–6 | Fähigkeiten (verbrauchen Energie, blauer Balken): Scan-Puls, Schub, Leuchtfeuer, Zeitecho, Rückruf, ab Stufe 10 gesperrt |
| J oder Tab | Journal (Quests, Archivsektoren, Erinnerungen erneut lesen) |
| I | Kodex (Datenkristalle, Orte, Personen) |
| K | Fähigkeiten |
| M | Karte |
| Esc oder P | Menü |
| F5 | Schnellspeichern |
| Q | **Waffenkreuz** öffnen, dann W/D/S/A (oder Maus in die Richtung) und Q loslassen: Puls-Blaster (oben), Streukanone (rechts), Lichtlanze (unten), Energieklinge (links) |
| Linke Maustaste oder F | Feuern (gedrückt halten = Dauerfeuer) · R: nachladen · X: Waffe wegstecken/ziehen |

### Tablet (Touch)

Auf Tablets schaltet das Spiel automatisch auf Touch-Steuerung um (erzwingen: `?touch=an`, abschalten: `?touch=aus`):

| Geste / Knopf | Funktion |
|---|---|
| Linke Bildschirmhälfte: Finger auflegen und ziehen | Virtueller Joystick – Laufen (wenig ziehen = langsam) |
| Rechte Bildschirmhälfte: wischen | Kamera drehen |
| **E** (gold, unten rechts) | Sprechen, untersuchen, Tor, Dialog weiter · **gedrückt halten:** Datenrauschen |
| Sprint / Sprung | Sprinten ein/aus, Springen |
| Menü, Journal, Karte, Kodex (rechts) | wie Esc, J, M, I |
| Fähigkeiten-Symbole unten / gelber Hinweis | antippen = benutzen |
| **Waffen** | Waffenkreuz öffnen, Waffe antippen (Mitte = wegstecken) |
| **Feuer** (rot, erscheint mit gezogener Waffe) | gedrückt halten = schießen, leichte Zielhilfe · **Laden**: nachladen |

**Flüssiges Spielen:** Das Spiel misst laufend die Bildrate und senkt bei Bedarf automatisch die Auflösung, dann den Leuchteffekt und zuletzt die Schatten (abschaltbar mit `?auto=aus`). Auf Tablets ist der Leuchteffekt außer bei „Hoch“ aus, die Auflösung ist begrenzt, Wischbewegungen und Bildzeit werden geglättet. Ruckelt es trotzdem, in den Optionen „Niedrig“ wählen und neu laden. Querformat ist angenehmer.

### Waffen und Störsonden

Vier Waffen über das Waffenkreuz. Ziele sind **Störsonden** – schwebende, beschädigte Drohnen: in jedem Sektor 4–9 (je 25 Erfahrung), auf der Station drei Übungsziele südlich vom Startpunkt (kommen nach 6 s wieder, keine Erfahrung). Die Sonden greifen noch nicht an (erster Schritt; echte Kämpfe offen).

## Geschichte und Ablauf

1. Neues Spiel: Du gibst deinen Namen ein und erwachst auf der Station.
2. Du sprichst mit Kommandantin Aris Velan und erkundest drei Orte.
3. Durch das Archivtor betrittst du einen Sektor (drei Kammern). Dort:
   - **Erinnerungen** an den Datenterminals lesen (12–15 pro Sektor),
   - **Datenrauschen** an zwei beschädigten Terminals beseitigen (E gedrückt halten),
   - **4 Artefakte** finden,
   - mit dem **Zeitzeugen-Echo** in der Mitte sprechen,
   - am Ende die **Wissensprüfung** (3 Fragen) bestehen – falsche Antworten dürfen wiederholt werden.
4. Durch das Sektortor kehrst du zurück und erstattest Bericht; die Kommandantin kündigt den nächsten Sektor an.
5. Zwischen den Sektoren vergeben die Bewohner **Nebenaufgaben** (bringen, holen, besuchen; Markierung blau, Hauptquest gold).
6. Nach Sektor 20 folgen Abschlussgespräch und Abspann.

Nebenbei findest du 10 Datenkristalle mit Geschichten der Station. Mit wachsender Erfahrung steigt deine Stufe.

**Kapitel:** 1 Ursprünge · 2 Aufbruch · 3 Sesshaftigkeit · 4 Metall, Rad und Städte · 5 Ägypten · 6 Alter Orient · 7 Frühe Kulturen Asiens und des Pazifiks · 8 Griechenland · 9 Rom · 10 Großreiche Asiens und Afrikas · 11 Spätantike · 12 Islamische Welt und Afrika · 13 Europas Mittelalter · 14 Asien und Amerika im Mittelalter · 15 Renaissance und Reformation · 16 Entdeckungen und Kolonialismus · 17 Aufklärung und Revolutionen · 18 Industrie · 19 Zeitalter der Extreme · 20 Vernetzte Welt und das letzte Kapitel (Fiktion)

## Aufbau

| Datei / Ordner | Inhalt |
|---|---|
| `page.html` | Seite, HUD und Gestaltung (Quelle) |
| `index.html` | Daraus erzeugt (nicht von Hand bearbeiten) |
| `src/` | Spielcode: `main.js` (Logik, Kamera, Quests, Menüs), `world.js` (Station, Sektoren), `character.js` (Figur, Animation, Umhang), `sky.js` (Gasriese, Ringstadt, Schiffe), `assets.js`, `audio.js`, `util.js` |
| `js/game.bundle.js` | Gebündeltes Spiel (erzeugt) |
| `assets/models/*.glb` | Eigene 3D-Modelle, erzeugt mit `tools/blender_models.py` (Blender als Python-Modul) |
| `assets/emblem.svg` | Eigenes Emblem „Flamme der Erinnerung“ |
| `../TheLastHumanity/Content/Data/kapitel/kap01.json` … `kap20.json` | Ein Kapitel pro Datei: Erinnerungen, Artefakte, Echo, Wissensprüfung |
| `../TheLastHumanity/Content/Data/content_de.json` | Daraus erzeugt mit `Tools/merge_content.py` (gemeinsam mit der Unreal-Version) |
| `../TheLastHumanity/Content/Data/story_de.json` | Rahmenhandlung: Personen, Dialoge, Quests, Kristalle, Fähigkeiten, Nebenaufgaben |
| `tests/e2e_test.js` | Automatischer Gesamttest (spielt das ganze Spiel durch) |
| `tests/touch_test.js` | Test der Tablet-Steuerung (emuliertes iPad, inkl. Waffen) |
| `tests/waffen_test.js` | Test der Waffen am PC (Tastatur) |
| `src/weapons.js` | Waffen, Geschosse, Effekte, Störsonden |
| `THIRD_PARTY_LICENSES.md` | Lizenzen der verwendeten Fremdbestandteile |

### Bauen
```
npm install
python3 ../TheLastHumanity/Tools/merge_content.py   # Kapiteldateien zusammenführen
npm run build                       # erzeugt js/game.bundle.js und index.html
python3 ../TheLastHumanity/Tools/validate_project.py
```
Modelle neu erzeugen (optional, braucht `pip install bpy`): `python tools/blender_models.py`

### Gesamttest
```
python3 -m http.server 8123 --bind 127.0.0.1
node tests/e2e_test.js http://127.0.0.1:8123/index.html ./testergebnis niedrig
```
