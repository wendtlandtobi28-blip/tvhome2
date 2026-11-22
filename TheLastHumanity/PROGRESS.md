# Entwicklungsstand – THE LAST HUMANITY

Letzte Aktualisierung: 22.11.2026 · **Version 2.0.0 (Browser, Science-Fiction) / 0.9.0 (Unreal)** · Branch `claude/last-humanity-game-dev-l0fii0`

## Statusbegriffe

| Status | Bedeutung |
|---|---|
| ✅ Erfolgreich getestet | Implementiert und durch einen dokumentierten Test bestätigt |
| 🟡 Implementiert, nicht getestet | Quelltext vorhanden, aber noch nicht kompiliert/ausgeführt |
| ❌ Fehlgeschlagen | Test durchgeführt, Fehler offen |
| ⬜ Nicht implementiert | Noch nicht begonnen |

## Browser-Version 2.0.0 – Science-Fiction-Story-Modus (`../TheLastHumanity_Web/`)

Neue Richtung nach Vorgabe des Projektinhabers (Bildvorlage): Raumstation MNEMOSYNE, dritte Person, eigenes Emblem, HUD wie in der Vorlage. Komplette Geschichte spielbar (Station → 10 Archivsektoren → Abspann), **im Browser automatisch komplett durchgespielt** (`TESTS.md`, Abschnitt D: 86/86 bis zum Abspann in zwei Läufen, Menü-Teiltest 14/14).

| Bereich | Status |
|---|---|
| Station mit Gasriese, Ringstadt, Schiffen, spiegelnder Plaza, Gebäuden, Bannern, Denkmal, Archivtor | ✅ getestet |
| Spielfigur (eigenes Blender-Modell) mit Animation und Umhang; Nebenfiguren (5 sprechende, 6 laufende) | ✅ getestet |
| Steuerung 3. Person, Kamera mit Wandkollision, Sprint/Ausdauer, Springen | ✅ getestet (Maus mit Zeigersperre: nur manuell prüfbar) |
| Quests, Dialoge, Erkundung, Datenkristalle, Erfahrung/Stufen | ✅ getestet |
| 6 Fähigkeiten, Energie | ✅ getestet |
| HUD (Porträt, Balken, Quest, Kompass, Minikarte, Ort/Zeit, Protokoll, Fähigkeiten, Zähler) | ✅ sichtbar in Testbildern |
| Journal, Kodex, Fähigkeiten, Karte, Optionen (inkl. Grafikstufe, Lautstärke) | ✅ getestet |
| 10 Archivsektoren mit 48 Erinnerungen, Sektortore, Abspann | ✅ getestet |
| Speichern/Laden | ✅ getestet |
| Klang (prozedural) | 🟡 implementiert, im Test nicht hörbar |
| Umfang für 60 Stunden | ⬜ geplant (siehe `GAME_DESIGN.md`, Abschnitt 11) |
| Windows-Version | ⬜ nach Freigabe des Projektinhabers |

## Browser-Version 1.0.0 (Archiv-Version, ersetzt durch 2.0.0; im Git-Verlauf erhalten)

Auf Wunsch des Projektinhabers (22.11.2026, „Plan B“) gibt es das komplette Spiel zusätzlich als Browser-Version (three.js/WebGL). Sie hat dieselben Inhalte, Kapitel, Tore, Optionen, das Speichern und den Abspann wie das Unreal-Projekt, braucht keine Installation und **wurde in dieser Umgebung in einem echten Browser (Chromium) automatisch komplett durchgespielt** (siehe `TESTS.md`, Abschnitt C: **102 von 102 Prüfungen bestanden**).

- Spielen: `TheLastHumanity_Web/index.html` doppelt anklicken oder online: https://claude.ai/artifact/BwbfxSFqcD5b14Q8nPtaSH

## Wichtigste Einschränkung (Unreal-Version)

**Die bisherige Entwicklungsumgebung (Linux-Cloud-Container ohne Grafikkarte) enthält keine Unreal Engine und kein Windows.** Der C++-Code wurde deshalb **weder kompiliert noch gestartet**. Alle Spielfunktionen sind „🟡 Implementiert, nicht getestet“. Mit Kompilierfehlern beim ersten Build ist zu rechnen; sie werden nach Rückmeldung behoben. Getestet wurde nur, was ohne Engine prüfbar ist (siehe `TESTS.md`).

## Phase 0 – Analyse und Sicherung ✅

Analyse TvHome, Vollsicherung mit getesteter Wiederherstellung, Original unverändert (T-01 bis T-04).

## Phase 1 – Prototyp (v0.1.0) → aufgegangen in v0.9.0

## Version 0.9.0 – inhaltlich vollständiges Spiel

| Funktion | Dateien | Status |
|---|---|---|
| Projektdatei, Targets, Build.cs, Config | `TheLastHumanity.uproject`, `Source/*.cs`, `Config/` | 🟡 nicht kompiliert (statische Prüfung ✅ T-05) |
| Inhalte laden (Kapitel, Themen, Erkenntnisse, Abspann, UI-Texte) | `Core/TLHGameSubsystem` | 🟡 · Datei ✅ geprüft (T-06) |
| **10 Kapitel, 48 Erkenntnisse** (Kurz- und Langtext, Deutsch) | `Content/Data/content_de.json` | ✅ Inhalt geprüft (T-06, T-08) · Anzeige 🟡 |
| Hauptmenü, Pausenmenü | `UI/TLHWidgets`, `Core/TLHPlayerController` | 🟡 |
| Begehbare Hallen, je Kapitel eigene Farben, Säulenform, Monument, Licht | `World/TLHHallBuilder` | 🟡 · Positionen ✅ geprüft (T-06) |
| Steuerung Tastatur + Maus | `Core/TLHCharacter` | 🟡 |
| Informationspunkte (gold/blau, Fokus) | `World/TLHInfoPoint`, `World/TLHInteractable` | 🟡 |
| Kurz- und ausführliche Textansicht | `UI/TLHWidgets` | 🟡 |
| Tor am Hallenende, Freischaltung des nächsten Kapitels | `World/TLHPortal`, `Core/TLHGameSubsystem` | 🟡 |
| Kapitelwechsel (Tor oder Kapitelübersicht) | `Core/TLHPlayerController::TravelToChapter` | 🟡 |
| Kapitelübersicht mit Fortschritt, erneutem Lesen, „Halle betreten“ | `UI/TLHWidgets` | 🟡 |
| Optionen (Maus, Sichtfeld, Y-Achse, Hinweis, alle Kapitel freischalten), dauerhaft gespeichert | `UI/TLHWidgets`, `Save/TLHSaveGame` | 🟡 |
| Abspann nach Kapitel 10 | `UI/TLHWidgets::MakeEnding` | 🟡 |
| Speichern (automatisch, Menü, F5) und Laden inkl. Kapitel | `Save/TLHSaveGame`, Subsystem | 🟡 |
| Doppelklick-Skripte: Editor starten / Windows-.exe erstellen | `1_Editor_starten.bat`, `2_Windows_Spiel_erstellen.bat`, `Tools/ue_find_engine.bat` | 🟡 nicht ausgeführt (kein Windows) |
| Statisches Prüfwerkzeug | `Tools/validate_project.py` | ✅ (T-05, T-07) |
| Ausführbare Windows-Version | – | ⬜ erst auf einem Windows-PC möglich (Skript vorhanden) |

## Bewusst nicht enthalten (Grenzen dieser Version)

- Grafik aus Grundformen mit Farben und Licht, keine detaillierten 3D-Modelle oder Texturen
- Kein Ton (Musik, Geräusche, Sprecher)
- Nur Deutsch
- Keine Gamepad-Unterstützung

## Nächster Schritt

1. Auf einem Windows-PC `2_Windows_Spiel_erstellen.bat` ausführen (Anleitung `README.md`).
2. Fehlermeldungen zurückmelden → Behebung → Testfälle T-10 bis T-30 in `TESTS.md`.
