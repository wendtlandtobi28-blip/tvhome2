# THE LAST HUMANITY – Die Geschichte der Menschheit

Ein Erkundungsspiel in der Ego-Perspektive für Windows (Unreal Engine 5). Du bist die letzte Hüterin oder der letzte Hüter des Archivs MNEMOSYNE und erweckst die Geschichte der Menschheit Kapitel für Kapitel wieder: Du gehst durch begehbare Hallen und untersuchst leuchtende Informationspunkte. Zu jedem Punkt gibt es eine Kurzfassung und eine ausführliche Fassung auf Deutsch.

> **Aktueller Stand:** Phase 1 (spielbarer Prototyp) ist als Quelltext umgesetzt, wurde aber **noch nicht kompiliert und nicht im Spiel getestet**, weil in der bisherigen Entwicklungsumgebung keine Unreal Engine verfügbar ist. Details stehen in [`PROGRESS.md`](PROGRESS.md) und [`TESTS.md`](TESTS.md).

## Inhalt von Phase 1

- Startmenü (Neues Spiel, Fortsetzen, Kapitelübersicht, Beenden)
- Begehbare 3D-Umgebung „Halle der Ursprünge“, zur Laufzeit erzeugt
- Steuerung mit Tastatur und Maus
- 5 interaktive Informationspunkte (Kapitel 1) mit deutschen Texten
- Umschaltung zwischen Kurzfassung und ausführlicher Fassung
- Kapitelübersicht (10 Kapitel, Kapitel 1 spielbar, Fortschrittsanzeige)
- Speichern: automatisch bei neuer Erkenntnis, manuell im Pausenmenü und mit F5; Laden über „Fortsetzen“

## Voraussetzungen (Windows-Rechner)

1. **Epic Games Launcher** installieren und darin **Unreal Engine 5.4 oder neuer** installieren (kostenlos; Epic-Konto nötig).
2. **Visual Studio 2022** (Community genügt) mit der Arbeitsauslastung **„Spieleentwicklung mit C++“** und einem aktuellen **Windows 10/11 SDK**.
3. Etwa 60 GB freier Speicher für Engine und Projekt.

## Starten im Editor

1. Den Ordner `TheLastHumanity` auf den Windows-Rechner kopieren (oder das Repository klonen).
2. Rechtsklick auf `TheLastHumanity.uproject` → **„Generate Visual Studio project files“**.
   *Falls eine andere Engine-Version als 5.4 installiert ist:* Rechtsklick → „Switch Unreal Engine version…“.
3. Doppelklick auf `TheLastHumanity.uproject`. Die Frage „Module missing… rebuild now?“ mit **Ja** beantworten. Der C++-Code wird dabei kompiliert.
   *Wenn das Kompilieren scheitert:* `TheLastHumanity.sln` in Visual Studio öffnen, Konfiguration **Development Editor / Win64** wählen, **Erstellen**. Die Fehlermeldungen bitte an die Entwicklung weitergeben.
4. Im Editor auf **Play** (Alt+P) klicken. Hinweis: Im Editor beendet **Esc** die Vorschau. Das Menü öffnest du dort mit **P**.

## Windows-Version erstellen (Packen)

Im Editor: **Platforms → Windows → Package Project** und einen Zielordner wählen. Das Ergebnis ist `Windows/TheLastHumanity.exe`.
Alternativ über die Kommandozeile:
```
"<UE-Pfad>\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="<Pfad>\TheLastHumanity.uproject" -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive -archivedirectory="<Zielordner>"
```

## Steuerung

| Taste | Funktion |
|---|---|
| W A S D / Pfeiltasten | Gehen |
| Maus | Umsehen |
| Shift | Laufen |
| Leertaste | Springen |
| E | Informationspunkt untersuchen / Textfenster schließen |
| Tab oder K | Kapitelübersicht |
| Esc oder P | Pausenmenü / Fenster schließen |
| F5 | Schnellspeichern |

## Inhalte bearbeiten

Alle Texte, Kapitel und die Positionen der Informationspunkte stehen in `Content/Data/content_de.json`. Nach Änderungen prüfen:
```
python3 Tools/validate_project.py
```

## Dokumentation

| Datei | Inhalt |
|---|---|
| [`GAME_DESIGN.md`](GAME_DESIGN.md) | Spielkonzept |
| [`LORE_BIBLE.md`](LORE_BIBLE.md) | Universum, Rahmenhandlung, Chronologie |
| [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) | Technischer Aufbau |
| [`ASSET_LICENSES.md`](ASSET_LICENSES.md) | Herkunft und Lizenzen aller Ressourcen |
| [`PROGRESS.md`](PROGRESS.md) | Entwicklungsstand |
| [`TESTS.md`](TESTS.md) | Durchgeführte Tests und Ergebnisse |
| [`TODO.md`](TODO.md) | Offene Aufgaben |
| [`ANALYSE_AUSGANGSPROJEKT.md`](ANALYSE_AUSGANGSPROJEKT.md) | Analyse und Sicherung des Altprojekts TvHome |
