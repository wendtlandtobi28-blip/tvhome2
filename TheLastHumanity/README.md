# THE LAST HUMANITY – Die Geschichte der Menschheit

Ein Erkundungsspiel in der Ego-Perspektive für Windows (Unreal Engine 5). Du bist die letzte Hüterin oder der letzte Hüter des Archivs MNEMOSYNE und erweckst die Geschichte der Menschheit Halle für Halle wieder, von den ersten Feuerstellen bis zur Gegenwart.

**Version 0.9.0. Inhaltlich vollständig:** 10 Kapitel, 48 Erkenntnisse mit Kurz- und Langtext, Freischaltung von Kapitel zu Kapitel, Abspann, Optionen und Speichern.

> **Wichtig:** Das Spiel wurde **noch nie kompiliert und noch nie gestartet**. In der bisherigen Entwicklungsumgebung gibt es keine Unreal Engine und kein Windows. Beim ersten Kompilieren können Fehler auftreten. Diese bitte melden (siehe unten). Details: [`PROGRESS.md`](PROGRESS.md), [`TESTS.md`](TESTS.md).

## Einmalig installieren (Windows 10/11)

1. **Epic Games Launcher** installieren: https://store.epicgames.com/download. Dort anmelden (kostenloses Epic-Konto).
2. Im Launcher: **Unreal Engine → Bibliothek → „+“** und **Version 5.4 oder neuer** installieren (ca. 40–60 GB).
3. **Visual Studio 2022 Community** (kostenlos) installieren: https://visualstudio.microsoft.com/de/. Im Installer die Arbeitsauslastung **„Spieleentwicklung mit C++“** anhaken. Rechts unter den Details zusätzlich ein aktuelles **Windows 11 SDK** wählen.
4. Den Ordner `TheLastHumanity` auf den PC kopieren, möglichst an einen kurzen Pfad, z. B. `C:\Spiele\TheLastHumanity`.

## Spielen – zwei Wege

### Weg A: Fertige Windows-Version erstellen (empfohlen)
Doppelklick auf **`2_Windows_Spiel_erstellen.bat`**.
Das Skript findet die Engine, kompiliert, kocht und verpackt das Spiel. Beim ersten Mal dauert das etwa 15–60 Minuten. Danach liegt das Spiel unter
`Build\Windows\Windows\TheLastHumanity.exe`, und das Skript fragt, ob es gestartet werden soll. Den Ordner `Build\Windows\Windows` kannst du auf jeden Windows-PC kopieren.

### Weg B: Im Unreal Editor starten
Doppelklick auf **`1_Editor_starten.bat`**: kompilieren, Editor öffnen, dann **Play** drücken.
Im Editor beendet **Esc** die Vorschau. Das Spielmenü öffnest du dort mit **P**.

### Wenn etwas schiefgeht
- **„Keine Unreal Engine gefunden“:** Engine im Launcher installieren. Bei einem ungewöhnlichen Installationsort vorher in einer Eingabeaufforderung `set UE_ROOT=D:\Pfad\UE_5.x` setzen und das Skript aus derselben Eingabeaufforderung starten.
- **Kompilierfehler:** Den roten Text aus dem Fenster kopieren (oder `%LOCALAPPDATA%\UnrealBuildTool\Log.txt`) und an die Entwicklung schicken. Er wird dann gezielt behoben.

## Spielablauf

1. **Neues Spiel**: Du stehst am Eingang der Halle „Die Ursprünge“.
2. Gehe zu den **goldenen Lichtern** und drücke **E**. Du liest zuerst die Kurzfassung, mit „Ausführlich lesen“ die lange Fassung.
3. Untersuchte Punkte leuchten **blau**. Jede neue Erkenntnis wird automatisch gespeichert.
4. Sind alle Erkenntnisse einer Halle gefunden, öffnet sich das **Tor am Ende der Halle**. Es führt ins nächste Kapitel.
5. Nach Kapitel 10 führt das letzte Tor zum **Abspann**.

In der **Kapitelübersicht** (Tab) siehst du deinen Fortschritt. Dort kannst du Erkenntnisse erneut lesen und freigeschaltete Hallen direkt betreten. In den **Optionen** gibt es Mausempfindlichkeit, Sichtfeld, Y-Achse umkehren, Steuerungshinweis und **„Alle Kapitel freischalten“** (für Unterricht oder zum Testen).

## Steuerung

| Taste | Funktion |
|---|---|
| W A S D / Pfeiltasten | Gehen |
| Maus | Umsehen |
| Shift | Laufen |
| Leertaste | Springen |
| E | Untersuchen / Tor benutzen / Textfenster schließen |
| Tab oder K | Kapitelübersicht |
| Esc oder P | Pausenmenü / Fenster schließen |
| F5 | Schnellspeichern |

Spielstand und Einstellungen liegen unter `%LOCALAPPDATA%\TheLastHumanity\Saved\SaveGames\`.

## Inhalte bearbeiten

Alle Texte, Kapitel, Farben der Hallen und Positionen stehen in `Content/Data/content_de.json`. Nach Änderungen prüfen (Python 3):
```
python Tools/validate_project.py
```

## Dokumentation

| Datei | Inhalt |
|---|---|
| [`GAME_DESIGN.md`](GAME_DESIGN.md) | Spielkonzept |
| [`LORE_BIBLE.md`](LORE_BIBLE.md) | Universum, Rahmenhandlung, Chronologie, Quellen |
| [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) | Technischer Aufbau |
| [`ASSET_LICENSES.md`](ASSET_LICENSES.md) | Herkunft und Lizenzen aller Ressourcen |
| [`PROGRESS.md`](PROGRESS.md) | Entwicklungsstand |
| [`TESTS.md`](TESTS.md) | Durchgeführte und ausstehende Tests |
| [`TODO.md`](TODO.md) | Offene Aufgaben |
| [`ANALYSE_AUSGANGSPROJEKT.md`](ANALYSE_AUSGANGSPROJEKT.md) | Analyse und Sicherung des Altprojekts TvHome |
