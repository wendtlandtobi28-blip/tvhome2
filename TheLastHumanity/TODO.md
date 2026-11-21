# Offene Aufgaben – THE LAST HUMANITY

## Blockiert: Entscheidung bzw. Voraussetzung durch den Projektinhaber nötig

- [ ] **Windows-Entwicklungsrechner mit Unreal Engine 5.4+ und Visual Studio 2022** bereitstellen. Möglichkeiten:
  1. Eigener Windows-PC (empfohlen: aktuelle GPU, ≥ 32 GB RAM, ≥ 100 GB SSD frei). Mit der Claude-Desktop-App lässt sich der Projektordner über Remote Control freigeben; dann kann direkt dort kompiliert und getestet werden.
  2. Gemieteter Windows-Cloud-Rechner mit GPU. **Kostenpflichtig**, nur nach ausdrücklicher Zustimmung.
- [ ] Ursprünglichen Projektauftrag „THE LAST HUMANITY – DIE GESCHICHTE DER MENSCHHEIT“ bereitstellen, damit `GAME_DESIGN.md` und `LORE_BIBLE.md` daran angepasst werden.
- [ ] Entscheiden, ob THE LAST HUMANITY in ein **eigenes Repository** umziehen soll (derzeit im Ordner `TheLastHumanity/` im Repository `tvhome2`).

## Phase 1 abschließen (sobald Unreal verfügbar)

- [ ] T-10: Kompilieren, Fehler beheben
- [ ] T-11 bis T-21 durchführen und in `TESTS.md` eintragen
- [ ] Mausempfindlichkeit und Bewegungsgeschwindigkeit abstimmen
- [ ] Eigene Karte `/Game/Maps/L_Prototyp` anlegen, in `DefaultEngine.ini` als `GameDefaultMap` und `EditorStartupMap` setzen
- [ ] Erste gepackte Windows-Version erzeugen und archivieren

## Phase 2 (geplant)

- [ ] Umstellung auf Enhanced-Input-Assets (frei belegbare Tasten, Gamepad)
- [ ] Freischaltung von Kapitel 2, sobald alle Erkenntnisse aus Kapitel 1 gefunden sind
- [ ] Übergang zwischen Hallen (Tür/Portal, Level-Streaming)
- [ ] Kapitel 2 „Sesshaftigkeit“: Texte, Halle, 5–8 Informationspunkte
- [ ] Optionsmenü (Mausempfindlichkeit, Y-Achse umkehren, Textgröße, Grafikqualität, Lautstärke)
- [ ] Mehrere Speicherplätze, Anzeige von Datum/Uhrzeit des Spielstands
- [ ] Texte über String Tables lokalisierbar machen
- [ ] Quellenangabe je Informationspunkt im Spiel anzeigen

## Später

- [ ] Kapitel 3–10, Rahmenhandlung „Das letzte Kapitel“
- [ ] Gestaltete Umgebungen statt Grundformen (lizenzgeprüfte Assets, siehe `ASSET_LICENSES.md`)
- [ ] Ton: Musik, Umgebung, deutsche Erzählerstimme
- [ ] Umstellung der Oberfläche auf UMG/CommonUI
- [ ] Automatisierter Build (Skript mit `RunUAT BuildCookRun`, optional self-hosted Runner)
- [ ] Fachliche Prüfung aller Texte durch eine Historikerin oder einen Historiker
