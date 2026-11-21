# Analyse des Ausgangsprojekts (TvHome)

Stand: 21.11.2026 · Grundlage: Repository `tvhome2`, Commit `003477f`

## 1. Was ist vorhanden?

| Bestandteil | Inhalt |
|---|---|
| `TvHome (1).zip` … `TvHome_vA16.zip` | 16 Versionsstände einer **Android-TV-Launcher-App** („TvHome“ für den Fire TV Stick Lite) |
| `bg.jpg` | Hintergrundfoto (1920 × 1200, Smartphone-Aufnahme) |
| `.github/workflows/build.yml` | GitHub-Actions-Workflow: entpackt die neueste ZIP-Datei, baut mit Gradle eine Debug-APK und veröffentlicht sie als Release „latest“ |

Inhalt der neuesten Version (`TvHome_vA16.zip`, 32 Dateien):

- Sprache/Technik: Kotlin, Jetpack Compose, `androidx.tv:tv-material`, Gradle (Kotlin DSL), Android SDK 35, minSdk 28
- Quelltexte: `MainActivity.kt` (Startbildschirm mit App-Kacheln, Uhr), `SettingsScreens.kt` (Einstellungen), `Extras.kt` (Statusanzeige, Wetter, Update-Installation), `Icons.kt`, `HomeWatchService.kt`, `BootReceiver.kt`
- Ressourcen: `banner.png`, `ic_launcher.xml`, Themes, Strings
- Signaturschlüssel `tvhome.keystore` (Passwort steht im Klartext in `app/build.gradle.kts`)

## 2. Prüfung auf Wiederverwendbarkeit

| Bestandteil | Wiederverwendbar für THE LAST HUMANITY? | Begründung |
|---|---|---|
| Kotlin-/Compose-Quelltext | **Nein** | Android-Launcher-Logik (App-Liste, Home-Taste, Systemdienste). Unreal Engine 5 nutzt C++/Blueprints; kein Code ist übertragbar. |
| Gradle-Build | **Nein** | Unreal nutzt Unreal Build Tool (UBT) und Unreal Automation Tool (UAT). |
| Grafiken (`banner.png`, `bg.jpg`, Icons) | **Nein** | Gehören zur alten App bzw. sind private Fotos; laut Auftrag werden keine alten Inhalte übernommen. |
| Signaturschlüssel | **Nein** | Nur für Android-APKs; zudem Sicherheitsrisiko (Passwort im Klartext). Wurde **nicht** in das neue Projekt kopiert. |
| Idee „automatischer Build per GitHub Actions“ | **Nur als Konzept** | Ein Unreal-Build braucht eine installierte Engine. Auf GitHub-eigenen Runnern ist das praktisch nicht möglich (Größe, Lizenz); nur mit eigenem Windows-Rechner als „self-hosted runner“. |
| Arbeitsweise (deutsche Oberfläche, Versionsnummern, README mit Installationsanleitung) | **Ja, als Vorgehen** | Deutsche Texte, nachvollziehbare Versionen und Schritt-für-Schritt-Anleitungen wurden übernommen. |

**Ergebnis:** Technisch ist aus dem Altprojekt nichts direkt wiederverwendbar. Das Repository dient als Ablageort; THE LAST HUMANITY wurde vollständig neu im Ordner `TheLastHumanity/` angelegt.

## 3. Sicherung des Originals

Das Original wurde **nicht verändert, verschoben oder gelöscht**. Zusätzlich gesichert in `../_BACKUP_TvHome_Original/`:

| Datei | Zweck |
|---|---|
| `tvhome_komplette_historie.bundle` | Vollständige Git-Historie (alle Branches). Wiederherstellen: `git clone tvhome_komplette_historie.bundle TvHome_wiederhergestellt` |
| `tvhome_originaldateien.tar.gz` | Alle Originaldateien (ZIPs, `bg.jpg`, Workflow) |
| `SHA256SUMS_original.txt` | Prüfsummen aller Originaldateien |
| `ORIGINAL_COMMIT.txt` | Commit-Kennung des gesicherten Stands |

Außerdem liegt der Originalstand unverändert auf dem Branch `main` des Repositorys. Die Wiederherstellung aus beiden Sicherungen wurde getestet (siehe `TESTS.md`, T-01 bis T-03).

## 4. Hinweise

- Der Workflow `.github/workflows/build.yml` reagiert nur auf Pushes nach `main`. Die Arbeit an THE LAST HUMANITY findet auf einem eigenen Branch statt und löst ihn daher nicht aus.
- Sicherheitshinweis zum Altprojekt: Das Keystore-Passwort steht im Klartext im Repository. Falls die App weiter genutzt wird, sollte der Schlüssel als ersetzt betrachtet werden.
