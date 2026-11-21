# Tests und Ergebnisse – THE LAST HUMANITY

Es sind nur Ergebnisse eingetragen, die tatsächlich ermittelt wurden. Nicht durchgeführte Tests sind als solche markiert.

## A. Durchgeführte Tests (21.11.2026, Linux-Cloud-Umgebung)

| ID | Test | Vorgehen | Ergebnis |
|---|---|---|---|
| T-01 | Git-Bundle der Originalhistorie gültig | `git bundle verify` | ✅ „is okay“ |
| T-02 | Wiederherstellung aus Git-Bundle | Bundle in leeren Ordner geklont, 23 Commits, SHA-256 aller Originaldateien verglichen | ✅ alle Prüfsummen stimmen |
| T-03 | Wiederherstellung aus tar.gz | Archiv in leeren Ordner entpackt, SHA-256 verglichen (20 Einträge im Archiv) | ✅ alle Prüfsummen stimmen |
| T-04 | Verfügbarkeit der Werkzeuge | Suche nach UnrealEditor, Epic-Installation, Windows, GPU (`nvidia-smi`), angeschlossenem eigenen Rechner | ❌ Unreal Engine nicht vorhanden; Linux statt Windows; keine GPU; kein Rechner angeschlossen. Vorhanden: clang, gcc, cmake, Python 3, Node, Git |
| T-05 | Statische Projektprüfung | `python3 Tools/validate_project.py` | ✅ 15 bestanden, 0 Warnungen, 0 Fehler |
| T-06 | Inhaltsdatei | Teil von T-05: gültiges UTF-8-JSON, 10 Kapitel fortlaufend, eindeutige IDs, Pflichtfelder, Kurz- kürzer als Langtext, Kennzeichnung fakt/fiktion, Infopunkte innerhalb der Halle, ohne Säulenkollision, ≥ 400 cm Abstand | ✅ bestanden |
| T-07 | Prüfwerkzeug erkennt Fehler | Drei absichtlich beschädigte Kopien: (a) UI-Schlüssel umbenannt, (b) Infopunkt auf Säule verschoben, (c) Umlaut + offene Klammern in C++ | ✅ alle drei Fehler erkannt (Exitcode ≠ 0) |
| T-08 | Fachliche Prüfung der Texte von Kapitel 1 | Abgleich der Jahreszahlen mit der Fachliteratur (Quellen in `LORE_BIBLE.md`) | ✅ redaktionell geprüft; keine unabhängige Expertenprüfung |

**Wichtig:** T-05 ersetzt **keine** Kompilierung. Es wurde geprüft, was ohne Engine prüfbar ist (Syntaxbalance, Include-Pfade, Reflexions-Header, Zeichensatz, Datenkonsistenz). Ob der Code mit Unreal Build Tool fehlerfrei kompiliert, ist **noch nicht getestet**.

## B. Noch nicht durchgeführte Tests (benötigen Windows + Unreal Engine 5.4+)

| ID | Test | Erwartetes Ergebnis | Status |
|---|---|---|---|
| T-10 | Kompilieren *Development Editor Win64* | Keine Fehler | ⬜ nicht getestet |
| T-11 | Start im Editor (Play) | Hauptmenü über der Halle sichtbar, Log „Inhalte geladen: 10 Kapitel“ und „Halle erzeugt: Kapitel 1 mit 5 Informationspunkten“ | ⬜ nicht getestet |
| T-12 | Hauptmenü | „Fortsetzen“ ohne Spielstand deaktiviert; alle Knöpfe reagieren | ⬜ nicht getestet |
| T-13 | Umgebung | Boden, Wände, Säulen, Himmel, Licht sichtbar; Figur fällt nicht durch den Boden | ⬜ nicht getestet |
| T-14 | Steuerung | WASD/Pfeile, Maus (hoch = nach oben sehen), Shift, Leertaste funktionieren; Maus bewegt im Menü nicht die Kamera | ⬜ nicht getestet |
| T-15 | Informationspunkt | Hinweis „[E] Untersuchen: …“ erscheint in der Nähe; E öffnet Fenster; Licht wechselt von gold zu blau | ⬜ nicht getestet |
| T-16 | Textansicht | Kurzfassung als Standard; Umschalten auf ausführliche Fassung und zurück; Scrollen; Umlaute korrekt | ⬜ nicht getestet |
| T-17 | Kapitelübersicht | Tab/K öffnet; 10 Kapitel; Kapitel 1 „x von 5“; Kapitel 2–10 „Noch nicht verfügbar“ | ⬜ nicht getestet |
| T-18 | Speichern | F5 und „Spiel speichern“ erzeugen `Saved/SaveGames/TLH_Spielstand_1.sav`; Meldung erscheint | ⬜ nicht getestet |
| T-19 | Laden | Nach Neustart: „Fortsetzen“ aktiv; Position, Blickrichtung und entdeckte Punkte wiederhergestellt | ⬜ nicht getestet |
| T-20 | Titel-Ausrichtung | Schriftzüge über den Sockeln und an der Stirnwand sind lesbar (nicht gespiegelt) | ⬜ nicht getestet |
| T-21 | Gepackte Windows-Version | `TheLastHumanity.exe` startet; Texte werden aus `Content/Data` geladen; Grundformen sichtbar | ⬜ nicht getestet |
