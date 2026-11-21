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
├── Content/Data/content_de.json    Kapitel, Informationspunkte, UI-Texte (UTF-8)
├── Source/
│   ├── TheLastHumanity.Target.cs           Spiel-Ziel
│   ├── TheLastHumanityEditor.Target.cs     Editor-Ziel
│   └── TheLastHumanity/
│       ├── TheLastHumanity.Build.cs        Modulabhängigkeiten
│       ├── TheLastHumanity.h/.cpp          Modul, Log-Kategorie LogTLH
│       ├── Core/   TLHTypes, TLHGameSubsystem, TLHGameMode, TLHPlayerController, TLHCharacter
│       ├── World/  TLHHallBuilder, TLHInfoPoint
│       ├── UI/     TLHWidgets (Slate)
│       └── Save/   TLHSaveGame
├── Tools/validate_project.py       Statische Prüfung ohne Engine
└── *.md                            Dokumentation
```

## 4. Klassen und Zusammenspiel

```
UGameInstance
└── UTLHGameSubsystem  (lebt während der ganzen Spielsitzung)
      · lädt content_de.json  → TArray<FTLHChapter>, UI-Texte
      · Fortschritt: TSet<FName> entdeckter Informationspunkte
      · SaveGame()/LoadGame() → UTLHSaveGame (Slot "TLH_Spielstand_1")

ATLHGameMode
  · StartPlay(): erzeugt ATLHHallBuilder → BuildHall(erstes spielbares Kapitel)
  · SpawnDefaultPawnAtTransform(): fester Startpunkt (Trägerkarte hat keinen PlayerStart)
  · DefaultPawn = ATLHCharacter, PlayerController = ATLHPlayerController

ATLHHallBuilder        Boden, Wände, Säulen, Sonne, Himmel, Nebel, Fackellichter,
                       Kapitel-Inschrift; spawnt je Eintrag ein ATLHInfoPoint
ATLHInfoPoint          Sockel + schwebende Lichtkugel + Punktlicht + Titel (zur Kamera gedreht)
                       Farbe: gold = neu, blau = entdeckt; heller bei Fokus

ATLHCharacter          Ego-Perspektive; WASD/Pfeile, Maus, Shift, Leertaste
                       Bewegung nur, wenn kein Menü offen ist (SetGameplayInputEnabled)

ATLHPlayerController   Zustandsautomat der Oberfläche:
                       MainMenu → Playing ⇄ PauseMenu / InfoPanel / ChapterOverview
                       · E: Informationspunkt im Blickkegel (≤ 380 cm, ~56°) öffnen
                       · Esc/P: Menü · Tab/K: Kapitelübersicht · F5: Schnellspeichern
                       · automatische Speicherung bei neuer Erkenntnis

TLHWidgets (Slate)     MakeHud, MakeMenu, MakeInfoPanel (Kurz-/Langtext umschaltbar),
                       MakeChapterOverview
```

### Eingabe
Phase 1 liest Tasten direkt ab (`IsInputKeyDown`, `GetInputMouseDelta`, `BindKey`). Das funktioniert ohne Input-Assets. **Geplant:** Umstellung auf Enhanced-Input-Assets (frei belegbare Tasten, Gamepad), sobald im Editor gearbeitet werden kann.

### Benutzeroberfläche
Slate statt UMG, weil UMG-Widgets als Editor-Assets erstellt werden müssten. Die Slate-Funktionen sind so gekapselt, dass sie später durch UMG-Widgets ersetzt werden können, ohne Logik zu ändern.

### Speichern
`USaveGame` über `UGameplayStatics::SaveGameToSlot`. Ablage unter Windows: `%LOCALAPPDATA%\TheLastHumanity\Saved\SaveGames\TLH_Spielstand_1.sav` (gepackte Version) bzw. `Saved/SaveGames/` im Projektordner (Editor). Gespeichert werden: Format-Version, Position, Blickrichtung, entdeckte Informationspunkte, aktuelles Kapitel, Zeitpunkt. Beim Laden werden IDs verworfen, die es in den Inhalten nicht mehr gibt; neuere Format-Versionen werden abgelehnt.

### Inhalte und Packen
`content_de.json` wird über `DirectoriesToAlwaysStageAsNonUFS=(Path="Data")` als lose Datei mit ausgeliefert und mit `FPaths::ProjectContentDir()` gefunden. Die Engine-Grundformen werden über `DirectoriesToAlwaysCook=/Engine/BasicShapes` sicher mitgekocht. Die C++-Quelltexte enthalten bewusst nur ASCII-Zeichen; Umlaute stehen ausschließlich in der UTF-8-JSON-Datei.

## 5. Bekannte Einschränkungen von Phase 1

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
