# Entwicklungsstand – THE LAST HUMANITY

Letzte Aktualisierung: 21.11.2026 · Version 0.1.0 · Branch `claude/last-humanity-game-dev-l0fii0`

## Statusbegriffe

| Status | Bedeutung |
|---|---|
| ✅ Erfolgreich getestet | Implementiert und durch einen dokumentierten Test bestätigt |
| 🟡 Implementiert, nicht getestet | Quelltext vorhanden, aber noch nicht kompiliert/ausgeführt |
| ❌ Fehlgeschlagen | Test durchgeführt, Fehler offen |
| ⬜ Nicht implementiert | Noch nicht begonnen |

## Wichtigste Einschränkung

**Die bisherige Entwicklungsumgebung (Linux-Cloud-Container ohne Grafikkarte) enthält keine Unreal Engine und kann kein Windows-Spiel bauen.** Deshalb konnte der C++-Code weder kompiliert noch gestartet werden. Alle Spielfunktionen sind daher höchstens „🟡 Implementiert, nicht getestet“. Getestet werden konnten nur Bestandteile ohne Engine: Sicherung, Inhaltsdatei und statische Quelltextprüfung. Voraussetzungen für die nächsten Schritte: siehe `TODO.md`, Abschnitt „Blockiert“.

## Phase 0 – Analyse und Sicherung

| Aufgabe | Status |
|---|---|
| Analyse Altprojekt TvHome (`ANALYSE_AUSGANGSPROJEKT.md`) | ✅ abgeschlossen |
| Vollsicherung (Git-Bundle, tar.gz, SHA-256) | ✅ getestet (T-01 bis T-03) |
| Original unverändert | ✅ getestet (T-03) |
| Prüfung der Werkzeuge (Unreal, Windows, GPU) | ✅ durchgeführt: nicht verfügbar (T-04) |

## Phase 1 – Spielbarer Prototyp

| Funktion | Dateien | Status |
|---|---|---|
| Projektstruktur, `.uproject`, Targets, Build.cs, Config | `TheLastHumanity.uproject`, `Source/*.cs`, `Config/` | 🟡 implementiert, nicht kompiliert (statische Prüfung ✅ T-05) |
| Inhalte laden (JSON → Kapitel/Infopunkte/UI-Texte) | `Core/TLHGameSubsystem` | 🟡 implementiert, nicht getestet · Inhaltsdatei ✅ geprüft (T-06) |
| Startmenü | `UI/TLHWidgets` (MakeMenu), `Core/TLHPlayerController` | 🟡 implementiert, nicht getestet |
| Erste begehbare 3D-Umgebung „Halle der Ursprünge“ | `World/TLHHallBuilder`, `Core/TLHGameMode` | 🟡 implementiert, nicht getestet · Positionen ✅ geprüft (T-06) |
| Steuerung Tastatur + Maus | `Core/TLHCharacter`, `Core/TLHPlayerController` | 🟡 implementiert, nicht getestet |
| Interaktiver Informationspunkt | `World/TLHInfoPoint`, PlayerController | 🟡 implementiert, nicht getestet |
| Deutsche Erklärungen (5 Punkte, Kapitel 1) | `Content/Data/content_de.json` | ✅ Inhalt geprüft (T-06, T-08) · Anzeige im Spiel nicht getestet |
| Kurze und ausführliche Textansicht | `UI/TLHWidgets` (MakeInfoPanel) | 🟡 implementiert, nicht getestet |
| Einfache Kapitelübersicht | `UI/TLHWidgets` (MakeChapterOverview) | 🟡 implementiert, nicht getestet |
| Speicherfunktion (auto, manuell, F5, Laden) | `Save/TLHSaveGame`, `Core/TLHGameSubsystem` | 🟡 implementiert, nicht getestet |
| Statisches Prüfwerkzeug | `Tools/validate_project.py` | ✅ getestet inkl. Fehlererkennung (T-05, T-07) |
| Ausführbare Windows-Version | – | ⬜ nicht möglich in dieser Umgebung |

## Nächster Schritt

1. Auf einem Windows-Rechner mit UE 5.4+ kompilieren (Anleitung `README.md`).
2. Kompilierfehler beheben und danach jede Funktion einzeln testen (Testfälle T-10 bis T-21 in `TESTS.md`).
3. Erst danach: Phase 2 (eigene Karte, Freischaltlogik, Kapitel 2).
