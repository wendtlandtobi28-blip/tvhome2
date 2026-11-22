# Technische Architektur – THE LAST HUMANITY

## 1. Zielplattform und Werkzeuge

| Punkt | Festlegung |
|---|---|
| Engine | **Unreal Engine 5.4 oder neuer** (C++-Projekt) |
| Zielplattform | Windows 10/11, 64 Bit, DirectX 12 |
| Sprache im Code | C++ (Englisch für Bezeichner, deutsche Kommentare) |
| Spielsprache | Deutsch (alle Texte in `Content/Data/content_de.json`) |
| Build | Unreal Build Tool (Kompilieren), Unreal Automation Tool / „Projekt packen“ (Windows-Version) |
| Benötigt auf dem Entwicklungsrechner | Windows 10/11, Epic Games Launcher + UE 5.4+, Visual Studio 2022 mit „Spieleentwicklung mit C++“, Windows 10/11 SDK, .NET-Desktop-Runtime |

## 2. Grundprinzipien des Prototyps

1. **Alles aus Text-Quelldateien.** Phase 1 enthält keine binären `.uasset`/`.umap`-Dateien. Umgebung, Oberfläche und Steuerung entstehen zur Laufzeit in C++. Vorteil: vollständig versionierbar, kein Editor nötig, um den Code zu lesen oder zu prüfen. Nachteil: Grafik ist ein Platzhalter (Engine-Grundformen).
2. **Daten statt Code für Inhalte.** Kapitel, Informationspunkte und alle UI-Texte liegen in einer JSON-Datei. Neue Inhalte erfordern keinen neuen Code.
3. **Fakt und Fiktion getrennt.** Jeder Informationspunkt trägt `kind: "fakt"` oder `kind: "fiktion"` und wird im Spiel sichtbar gekennzeichnet.
4. **Klare Zuständigkeiten.** Logik (Subsystem) ist von Darstellung (Slate-Widgets) und Welt (Akteure) getrennt.

## 3. Verzeichnisstruktur

```
TheLastHumanity/
├── TheLastHumanity.uproject        Projektdatei (Modul, Zielplattform)
├── Config/
│   ├── DefaultEngine.ini           Startkarte, GameMode, Lumen, DX12
│   ├── DefaultGame.ini             Projektname, Packen (Data-Ordner, Grundformen)
│   └── DefaultInput.ini            Mausfang
├── Content/Data/kapitel/kapNN.json 20 Kapiteldateien (Quelle der Geschichtsinhalte)
├── Content/Data/basis_de.json      UI-Texte und Abspann (Quelle)
├── Content/Data/content_de.json    Daraus erzeugt (Tools/merge_content.py), UTF-8
├── Content/Data/story_de.json      Rahmenhandlung der Browser-Version
├── Source/
│   ├── TheLastHumanity.Target.cs           Spiel-Ziel
│   ├── TheLastHumanityEditor.Target.cs     Editor-Ziel
│   └── TheLastHumanity/
│       ├── TheLastHumanity.Build.cs        Modulabhängigkeiten
│       ├── TheLastHumanity.h/.cpp          Modul, Log-Kategorie LogTLH
│       ├── Core/   TLHTypes, TLHGameSubsystem, TLHGameMode, TLHPlayerController, TLHCharacter
│       ├── World/  TLHHallBuilder, TLHInteractable, TLHInfoPoint, TLHPortal
│       ├── UI/     TLHWidgets (Slate)
│       └── Save/   TLHSaveGame
├── 1_Editor_starten.bat            Kompilieren + Editor öffnen (Doppelklick)
├── 2_Windows_Spiel_erstellen.bat   Fertige .exe erzeugen (Doppelklick)
├── Tools/validate_project.py       Statische Prüfung ohne Engine
├── Tools/merge_content.py          Kapiteldateien → content_de.json
├── Tools/ue_find_engine.bat        Engine-Suche für die Skripte
└── *.md                            Dokumentation
```

## 4. Klassen und Zusammenspiel

```
UGameInstance
└── UTLHGameSubsystem  (lebt während der ganzen Spielsitzung)
      · lädt content_de.json → Kapitel (inkl. Thema), Erkenntnisse, Abspann, UI-Texte
      · Fortschritt: entdeckte Erkenntnisse, aktuelles Kapitel, Abspann gesehen
      · Freischaltung: Kapitel 1 immer; Kapitel n, wenn Kapitel n-1 vollständig
        (oder Option „alle Kapitel freischalten“)
      · SaveGame()/LoadGame() → UTLHSaveGame  (Slot "TLH_Spielstand_1", Format v2)
      · Einstellungen          → UTLHSettingsSave (Slot "TLH_Einstellungen")

ATLHGameMode
  · StartPlay(): erzeugt ATLHHallBuilder → BuildHall(aktuelles Kapitel)
  · SpawnDefaultPawnAtTransform(): fester Startpunkt am Halleneingang

ATLHHallBuilder        BuildHall(Kapitel) räumt die alte Halle ab und baut neu:
                       Boden, Wände, Gesims, Säulen (rund/eckig), Monument
                       (feuer/obelisk/zikkurat/kugel/bogen/turm), Sonne, Himmel, Nebel,
                       Wandlichter, Inschrift; spawnt ATLHInfoPoint je Erkenntnis
                       (feste oder automatische Position) und ein ATLHPortal

ATLHInteractable       Abstrakte Basis für alles, was mit E benutzt wird
 ├─ ATLHInfoPoint      Sockel, schwebende Kugel, Licht, Titel; gold = neu, blau = entdeckt
 └─ ATLHPortal         Tor am Hallenende; rot = gesperrt, blau = offen;
                       führt ins nächste Kapitel bzw. nach Kapitel 10 zum Abspann

ATLHCharacter          Ego-Perspektive; WASD/Pfeile, Maus, Shift, Leertaste;
                       übernimmt Mausempfindlichkeit, Y-Achse, Sichtfeld

ATLHPlayerController   Zustandsautomat der Oberfläche:
                       MainMenu, Playing, PauseMenu, InfoPanel, ChapterOverview, Options, Ending
                       (jeweils mit Rücksprung an den aufrufenden Zustand)
                       · Fokus: nächstes Interaktionsobjekt im Blickkegel (≤ 380 cm, ~56°)
                       · TravelToChapter(): Halle neu bauen, Spieler an den Eingang, speichern
                       · automatische Speicherung bei neuer Erkenntnis und Kapitelwechsel

TLHWidgets (Slate)     MakeHud, MakeMenu, MakeInfoPanel, MakeChapterOverview,
                       MakeOptions, MakeEnding
```

### Inhaltsformat (Auszug)
```json
{ "ui": { "schlüssel": "Text mit {0}" },
  "ending": { "title": "...", "text": "..." },
  "chapters": [ { "id": "kap02_...", "number": 2, "available": true,
      "title": "...", "era": "...", "summary": "...",
      "theme": { "floor": [r,g,b], "wall": [r,g,b], "column": [r,g,b], "torch": [r,g,b],
                 "columnShape": "rund|eckig", "monument": "feuer|obelisk|zikkurat|kugel|bogen|turm|keiner",
                 "sunPitch": -40, "sunIntensity": 7, "fog": 0.015 },
      "infoPoints": [ { "id": "...", "kind": "fakt|fiktion", "title": "...",
                        "short": "...", "long": "...", "location": [x,y,z] /* optional */ } ] } ] }
```
Ohne `location` werden Erkenntnisse automatisch abwechselnd links und rechts entlang der Halle verteilt (`ATLHHallBuilder::GetAutoLocation`, identisch nachgebildet im Prüfwerkzeug).

### Build-Skripte (Windows)
- `Tools/ue_find_engine.bat`: sucht UE 5.4 bis 5.7 über die Registry (Epic Launcher) und den Standardpfad; `UE_ROOT` kann vorgegeben werden.
- `1_Editor_starten.bat`: `Build.bat TheLastHumanityEditor Win64 Development`, dann `UnrealEditor.exe`.
- `2_Windows_Spiel_erstellen.bat`: Editor-Modul bauen, dann `RunUAT BuildCookRun -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive` nach `Build\Windows`.

### Eingabe
Phase 1 liest Tasten direkt ab (`IsInputKeyDown`, `GetInputMouseDelta`, `BindKey`). Das funktioniert ohne Input-Assets. **Geplant:** Umstellung auf Enhanced-Input-Assets (frei belegbare Tasten, Gamepad), sobald im Editor gearbeitet werden kann.

### Benutzeroberfläche
Slate statt UMG, weil UMG-Widgets als Editor-Assets erstellt werden müssten. Die Slate-Funktionen sind so gekapselt, dass sie später durch UMG-Widgets ersetzt werden können, ohne Logik zu ändern.

### Speichern
`USaveGame` über `UGameplayStatics::SaveGameToSlot`. Ablage unter Windows: `%LOCALAPPDATA%\TheLastHumanity\Saved\SaveGames\TLH_Spielstand_1.sav` (gepackte Version) bzw. `Saved/SaveGames/` im Projektordner (Editor). Gespeichert werden: Format-Version, Position, Blickrichtung, entdeckte Informationspunkte, aktuelles Kapitel, Zeitpunkt. Beim Laden werden IDs verworfen, die es in den Inhalten nicht mehr gibt; neuere Format-Versionen werden abgelehnt.

### Inhalte und Packen
`content_de.json` wird über `DirectoriesToAlwaysStageAsNonUFS=(Path="Data")` als lose Datei mit ausgeliefert und mit `FPaths::ProjectContentDir()` gefunden. Die Engine-Grundformen werden über `DirectoriesToAlwaysCook=/Engine/BasicShapes` sicher mitgekocht. Die C++-Quelltexte enthalten bewusst nur ASCII-Zeichen; Umlaute stehen ausschließlich in der UTF-8-JSON-Datei.

## 5. Bekannte Einschränkungen

- Als Startkarte dient die leere Engine-Karte `/Engine/Maps/Entry`. Eine eigene Karte muss im Editor angelegt werden (TODO).
- Grafik besteht aus Platzhalter-Grundformen mit einfarbigem Material.
- Texte werden über `FText::FromString` geladen und sind damit noch nicht über das Unreal-Lokalisierungssystem übersetzbar (später: String Tables).
- **Der Code wurde bisher nicht mit Unreal Build Tool kompiliert**, weil in der Entwicklungsumgebung keine Unreal Engine verfügbar ist (siehe `PROGRESS.md`).

## 6. Ausbau (spätere Phasen)

| Bereich | Plan |
|---|---|
| Welt | Eigene Level je Kapitel (World Partition), Megascans/eigene Modelle, Level-Streaming zwischen Hallen |
| Inhalte | DataAssets oder DataTables statt JSON (JSON als Import-Format behalten) |
| UI | UMG + CommonUI, Optionen (Grafik, Audio, Steuerung, Textgröße), Barrierefreiheit |
| Audio | Erzählerstimme (Deutsch), Musik, Umgebungsgeräusche |
| Build | Automatisches Packen per Skript (`RunUAT BuildCookRun`), optional self-hosted Runner |


## 7. Inhalts-Pipeline (ab Browser-Version 3, grober 45-Stunden-Entwurf)

- Jedes Kapitel liegt in einer eigenen Datei `Content/Data/kapitel/kapNN.json`: `id`, `number`, `title`, `era`, `summary`, `theme`, `infoPoints` (12–15 Erinnerungen), `artifacts` (4), `echo` (`name`, `role`, `lines`), `quiz` (3 Fragen mit je 3 Antworten und `correct`).
- `python3 Tools/merge_content.py` fügt die Kapitel mit `basis_de.json` zu `content_de.json` (`schemaVersion` 3) zusammen. Die Browser-Version liest diese Datei beim Bündeln ein (`TheLastHumanity_Web/tools/bundle.mjs`).
- `Tools/validate_project.py` prüft u. a. Anzahl der Erinnerungen, Artefakte, Echo, Quizfragen, Latin-1-Titel, Übereinstimmung der Kapiteldateien mit `content_de.json` sowie die Nebenaufgaben in `story_de.json`.
- **Einschränkung Unreal-Version:** Der C++-Code wurde für 10 Kapitel mit bis zu 7 Erkenntnissen geschrieben. Artefakte, Echo und Wissensprüfung gibt es dort noch nicht; die neuen Felder werden ignoriert. Hallenaufbau und Positionen für 12–15 Punkte müssen beim Ausbau in Unreal angepasst werden.
