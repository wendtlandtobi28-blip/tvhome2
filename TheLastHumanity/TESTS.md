# Tests und Ergebnisse – THE LAST HUMANITY

Es sind nur Ergebnisse eingetragen, die tatsächlich ermittelt wurden. Nicht durchgeführte Tests sind als solche markiert.

## A. Durchgeführte Tests (Linux-Cloud-Umgebung, ohne Unreal Engine)

| ID | Datum | Test | Vorgehen | Ergebnis |
|---|---|---|---|---|
| T-01 | 21.11.2026 | Git-Bundle der Originalhistorie gültig | `git bundle verify` | ✅ „is okay“ |
| T-02 | 21.11.2026 | Wiederherstellung aus Git-Bundle | In leeren Ordner geklont (23 Commits), SHA-256 aller Originaldateien verglichen | ✅ alle Prüfsummen stimmen |
| T-03 | 21.11.2026 | Wiederherstellung aus tar.gz | Entpackt (20 Einträge), SHA-256 verglichen | ✅ alle Prüfsummen stimmen |
| T-04 | 21.11.2026 | Verfügbarkeit der Werkzeuge | Suche nach UnrealEditor, Windows, GPU, angeschlossenem Rechner | ❌ nichts davon vorhanden (Linux, keine GPU). Vorhanden: clang, gcc, cmake, Python 3, Node, Git |
| T-05 | 22.11.2026 | Statische Projektprüfung v0.9.0 | `python3 Tools/validate_project.py` | ✅ 17 bestanden, 0 Warnungen, 0 Fehler |
| T-06 | 22.11.2026 | Inhaltsdatei v0.9.0 | Teil von T-05: gültiges UTF-8-JSON; 10 Kapitel fortlaufend; 48 Erkenntnisse; eindeutige IDs; Pflichtfelder; Kurz- kürzer als Langtext; fakt/fiktion; Themen (Farben 0..1, Monument, Säulenform); Positionen (auch automatische) innerhalb der Halle, ohne Säulen-, Monument- und Portalkollision, ≥ 400 cm Abstand; Platzhalteranzahl aller UI-Texte; Titel/Epochen nur Latin-1 (3D-Schrift); Abspann vorhanden; alle 62 im Code verwendeten UI-Schlüssel vorhanden | ✅ bestanden |
| T-07 | 21.11.2026 | Prüfwerkzeug erkennt Fehler | Drei absichtlich beschädigte Kopien (UI-Schlüssel, Säulenkollision, Umlaut + Klammern im C++) | ✅ alle erkannt |
| T-08 | 22.11.2026 | Fachliche Prüfung der Texte (Kapitel 1–9) | Abgleich der Jahreszahlen und Fakten mit Fachliteratur und Referenzwerken; 4 Formulierungen korrigiert (Gutenberg-Bibel, Ausdehnung Roms, Hebräische Bibel, erste Universitäten) | ✅ redaktionell geprüft; **keine** unabhängige Expertenprüfung |
| T-09 | 22.11.2026 | Windows-Skripte: Format | `file`: ASCII, CRLF-Zeilenenden; keine Variablen mit Pfaden innerhalb von Klammerblöcken | ✅ · **Ausführung nicht getestet** (kein Windows) |

**Wichtig:** T-05 ersetzt **keine** Kompilierung. Ob der Code mit Unreal Build Tool fehlerfrei kompiliert, ist **noch nicht getestet**.

## B. Noch nicht durchgeführte Tests (benötigen Windows + Unreal Engine 5.4+)

| ID | Test | Erwartetes Ergebnis | Status |
|---|---|---|---|
| T-10 | `1_Editor_starten.bat` / Kompilieren *Development Editor Win64* | Keine Fehler, Editor startet | ⬜ |
| T-11 | Play im Editor | Hauptmenü über der Halle; Log „Inhalte geladen: 10 Kapitel, 48 Erkenntnisse“ und „Halle erzeugt: Kapitel 1“ | ⬜ |
| T-12 | Hauptmenü | „Fortsetzen“ ohne Spielstand deaktiviert; alle Knöpfe reagieren | ⬜ |
| T-13 | Umgebung | Boden, Wände, Säulen, Feuerstelle, Himmel, Licht sichtbar; Figur fällt nicht durch den Boden | ⬜ |
| T-14 | Steuerung | WASD/Pfeile, Maus (hoch = nach oben sehen), Shift, Leertaste; im Menü bewegt die Maus die Kamera nicht | ⬜ |
| T-15 | Informationspunkt | Hinweis erscheint in der Nähe; E öffnet Fenster; Licht wechselt gold → blau | ⬜ |
| T-16 | Textansicht | Kurzfassung als Standard; Umschalten; Scrollen; Umlaute und Sonderzeichen (Ç, ş, „“) korrekt | ⬜ |
| T-17 | Tor gesperrt | Vor Abschluss rot; Hinweis „(x von y)“; E zeigt Meldung | ⬜ |
| T-18 | Tor offen, Kapitelwechsel | Nach letzter Erkenntnis Meldung „Tor ist offen“; Tor blau; E → Halle Kapitel 2 mit anderen Farben, Spieler am Eingang | ⬜ |
| T-19 | Kapitelübersicht | Tab öffnet; Fortschritt stimmt; entdeckte Erkenntnisse anklickbar und schließen zurück zur Übersicht; „Halle betreten“ wechselt | ⬜ |
| T-20 | Optionen | Schieberegler wirken sofort; Werte bleiben nach Neustart erhalten | ⬜ |
| T-21 | „Alle Kapitel freischalten“ | Alle Hallen in der Übersicht betretbar; Tor offen | ⬜ |
| T-22 | Speichern | F5, Menü und automatisch: `TLH_Spielstand_1.sav` entsteht; Meldung erscheint | ⬜ |
| T-23 | Laden | Nach Neustart „Fortsetzen“: richtige Halle, Position, Blickrichtung, entdeckte Punkte | ⬜ |
| T-24 | Abspann | Kapitel 10 abschließen → letztes Tor → Abspann mit Statistik; beide Knöpfe funktionieren | ⬜ |
| T-25 | 3D-Schrift | Titel über Sockeln, Inschrift an der Stirnwand und Torbeschriftung lesbar (nicht gespiegelt) | ⬜ |
| T-26 | Alle 10 Hallen | Jede Halle baut sich auf, keine Erkenntnis steckt in Wand, Säule oder Monument | ⬜ |
| T-27 | `2_Windows_Spiel_erstellen.bat` | Erzeugt `Build\Windows\Windows\TheLastHumanity.exe` | ⬜ |
| T-28 | Gepackte Version | .exe startet; Texte werden geladen; Grundformen sichtbar | ⬜ |
| T-29 | Gepackte Version auf zweitem PC | Ordner kopiert, startet ohne installierte Engine | ⬜ |
| T-30 | Durchspielen | Kapitel 1–10 bis zum Abspann ohne Absturz | ⬜ |
