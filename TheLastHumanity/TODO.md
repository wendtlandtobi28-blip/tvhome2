# Offene Aufgaben – THE LAST HUMANITY

## Blockiert: Voraussetzung bzw. Entscheidung durch den Projektinhaber

- [ ] **Windows-PC mit Unreal Engine 5.4+ und Visual Studio 2022** (Anleitung `README.md`). Ohne diesen Schritt kann das Spiel weder kompiliert noch als .exe erstellt werden.
- [ ] **GitHub-Zugriff reparieren:** Das Hochladen auf den Branch scheitert mit Fehler 403. GitHub unter https://claude.ai/connect-github neu verbinden und die Claude-GitHub-App für `tvhome2` installieren.
- [ ] Ursprünglichen Projektauftrag bereitstellen (Abgleich von `GAME_DESIGN.md` und `LORE_BIBLE.md`).
- [ ] Entscheiden, ob das Projekt in ein eigenes Repository umziehen soll.

## Nach dem ersten Build auf Windows

- [ ] Kompilierfehler beheben (T-10)
- [ ] Tests T-11 bis T-30 durchführen und in `TESTS.md` eintragen
- [ ] Mausempfindlichkeit, Gehgeschwindigkeit und Lichtstärken abstimmen
- [ ] Eigene Karte `/Game/Maps/L_Archiv` anlegen und in `DefaultEngine.ini` eintragen (statt `/Engine/Maps/Entry`)
- [ ] Spiel-Symbol (Icon) für die .exe
- [ ] Shipping-Build statt Development (`-clientconfig=Shipping`)

## Verbesserungen (optional)

- [ ] Ton: Musik je Epoche, Umgebungsgeräusche, deutsche Sprecherstimme (lizenzgeprüft)
- [ ] Gestaltete Hallen mit lizenzgeprüften 3D-Modellen (z. B. Fab/Quixel) statt Grundformen
- [ ] Enhanced Input (frei belegbare Tasten, Gamepad)
- [ ] Mehrere Speicherplätze; Bestätigungsdialog bei „Neues Spiel“
- [ ] Textgröße und Kontrast in den Optionen
- [ ] Quellenangaben je Erkenntnis im Spiel
- [ ] Lokalisierung über String Tables (weitere Sprachen)
- [ ] Fachliche Prüfung aller Texte durch eine Historikerin oder einen Historiker
- [ ] Oberfläche auf UMG/CommonUI umstellen
