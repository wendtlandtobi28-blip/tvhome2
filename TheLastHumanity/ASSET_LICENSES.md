# Herkunft und Lizenzen der Ressourcen

Stand: Version 0.9.0. Dieses Dokument wird bei jeder neuen Ressource ergänzt.

## 1. Im Projekt enthaltene Dateien

| Ressource | Pfad | Herkunft | Lizenz |
|---|---|---|---|
| C++-Quelltexte, Konfiguration, Projektdatei | `Source/`, `Config/`, `TheLastHumanity.uproject` | Für dieses Projekt neu geschrieben | Eigentum des Projektinhabers |
| Spieltexte (Deutsch) | `Content/Data/content_de.json` | Für dieses Projekt neu geschrieben; Fakten nach den in `LORE_BIBLE.md` genannten Quellen, eigene Formulierungen | Eigentum des Projektinhabers |
| Prüfwerkzeug | `Tools/validate_project.py` | Neu geschrieben | Eigentum des Projektinhabers |
| Windows-Skripte | `1_Editor_starten.bat`, `2_Windows_Spiel_erstellen.bat`, `Tools/ue_find_engine.bat` | Neu geschrieben | Eigentum des Projektinhabers |
| Abspann- und Rahmenhandlungstexte | `Content/Data/content_de.json` (`ending`, Kapitel 10) | Neu geschrieben, frei erfunden | Eigentum des Projektinhabers |

Es sind **keine** Bilder, Modelle, Texturen, Klänge, Musik oder Schriftarten Dritter im Projektordner enthalten.

## 1a. Browser-Version 2 (`TheLastHumanity_Web/`)

| Ressource | Pfad / Quelle | Herkunft | Lizenz |
|---|---|---|---|
| Spielcode, Seite, HUD, Tests, Build-Skripte | `src/`, `page.html`, `index.html`, `tests/`, `tools/` | Für dieses Projekt neu geschrieben | Eigentum des Projektinhabers |
| 3D-Modelle Spielfigur, Shuttle, Kreuzer | `assets/models/*.glb`, erzeugt mit `tools/blender_models.py` | Für dieses Projekt per Skript neu erstellt | Eigentum des Projektinhabers |
| Emblem „Flamme der Erinnerung“ | `assets/emblem.svg` | Für dieses Projekt neu gestaltet; enthält bewusst keine Motive fremder Marken (kein Totenkopf, kein Adler) | Eigentum des Projektinhabers |
| Rahmenhandlung, Dialoge, Kristalltexte | `Content/Data/story_de.json` | Neu geschrieben, frei erfunden | Eigentum des Projektinhabers |
| Klänge | im Programm erzeugt (`src/audio.js`), keine Audiodateien | Neu | Eigentum des Projektinhabers |
| three.js 0.170.0 | im Bündel `js/game.bundle.js`, über npm | three.js authors | MIT License |
| HDRIs „sunset“, „night“ und Normalen-Texturen 0008, 0016, 0025 | npm-Paket `@pmndrs/assets` 1.7.0 (HDRIs ursprünglich von Poly Haven) | Poimandres / Poly Haven | CC0 1.0 |
| Schriften „Rajdhani“, „Exo 2“ | Google Fonts, zur Laufzeit geladen | Indian Type Foundry / Natanael Gama | SIL Open Font License 1.1 |

Werkzeuge (nicht im Spiel enthalten): Blender 5.3 als Python-Modul `bpy` (GPL, betrifft nicht die erzeugten Modelle), esbuild (MIT). Details: `TheLastHumanity_Web/THIRD_PARTY_LICENSES.md`.

## 2. Zur Laufzeit genutzte Bestandteile der Unreal Engine

Diese Dateien liegen nicht im Projekt, sondern werden aus der installierten Engine verwendet und beim Packen mitgeliefert:

| Ressource | Engine-Pfad | Lizenz |
|---|---|---|
| Grundformen Würfel, Zylinder, Kugel (Hallen, Monumente, Tore, Sockel) | `/Engine/BasicShapes/` | Unreal Engine EULA (Nutzung in mit UE erstellten Produkten erlaubt) |
| Material `BasicShapeMaterial` | `/Engine/BasicShapes/` | Unreal Engine EULA |
| Leere Trägerkarte | `/Engine/Maps/Entry` | Unreal Engine EULA |
| Standardschrift der Oberfläche (Slate, Roboto) | Engine-Fonts | Roboto: Apache License 2.0; Auslieferung als Teil der Engine |

Hinweis zur Unreal Engine EULA: Die Engine ist kostenlos nutzbar. Für kommerziell veröffentlichte Spiele fallen nach den aktuellen Bedingungen von Epic Games erst ab einer bestimmten Umsatzschwelle Lizenzgebühren an. Vor einer Veröffentlichung sind die dann gültigen Bedingungen zu prüfen.

## 3. Nicht übernommen aus dem Altprojekt TvHome

`bg.jpg`, `banner.png`, App-Icons, Kotlin-Quelltexte und `tvhome.keystore` wurden bewusst **nicht** übernommen (siehe `ANALYSE_AUSGANGSPROJEKT.md`).

## 4. Regeln für künftige Ressourcen

- Nur Ressourcen mit eindeutig dokumentierter Lizenz (z. B. eigene Werke, CC0, CC BY mit Namensnennung, Fab-Inhalte mit Standardlizenz, Quixel Megascans gemäß Fab-Lizenz).
- Keine Inhalte, Marken oder Figuren aus anderen Spielen, Filmen oder Apps.
- Historische Abbildungen nur gemeinfrei oder mit passender Lizenz; Fotos von Kunstwerken (z. B. Höhlenmalerei) nur mit geklärten Rechten. Sonst eigene Nachbildungen verwenden.
- Jede neue Ressource hier mit Quelle, Autor, Lizenz und Datum eintragen.
