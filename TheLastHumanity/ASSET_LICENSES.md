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

## 1a. Browser-Version (`TheLastHumanity_Web/`)

| Ressource | Pfad / Quelle | Herkunft | Lizenz |
|---|---|---|---|
| Spiellogik, Seite, Gestaltung, Tests, Build-Skript | `js/game.js`, `page.html`, `index.html`, `tests/`, `tools/` | Für dieses Projekt neu geschrieben | Eigentum des Projektinhabers |
| three.js 0.149.0 (3D-Bibliothek) | `vendor/three.min.js`, Lizenztext `vendor/THREE_LICENSE.txt`; bezogen über npm (Paket `three`) | three.js authors | MIT License |
| Schrift „Cinzel“ (Überschriften) | Google Fonts, zur Laufzeit geladen (nicht im Projekt gespeichert) | Natanael Gama | SIL Open Font License 1.1 |
| Schrift „Alegreya Sans“ (Text) | Google Fonts, zur Laufzeit geladen (nicht im Projekt gespeichert) | Juan Pablo del Peral / Huerta Tipográfica | SIL Open Font License 1.1 |

Alle 3D-Formen, Farben, Himmel und Lichter der Browser-Version werden im Programm erzeugt; es gibt keine Bild-, Modell- oder Tondateien.

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
