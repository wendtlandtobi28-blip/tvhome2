# Offene Aufgaben – THE LAST HUMANITY

## Priorität 1: 45 Spielstunden (Entscheidung vom 22.11.2026, siehe GAME_DESIGN.md Abschnitt 12)

- [x] 20 Archivsektoren mit je 12–15 Erinnerungen (grober Entwurf, 246 Erinnerungen) – fachliche Prüfung offen
- [x] Wissensprüfung (3 Fragen) pro Sektor
- [x] 4 Artefakte pro Sektor
- [x] 2 Rauschstellen pro Sektor
- [x] 1 Zeitzeugen-Echo pro Sektor
- [x] 25 Nebenaufgaben auf der Station (grob)
- [ ] Story-Szenen zwischen den Kapiteln, weitere Stationsbereiche
- [ ] Sektoren abwechslungsreicher gestalten (Epochen-Ausstattung statt gleicher drei Kammern)
- [ ] Spielzeit des Entwurfs durch den Projektinhaber messen lassen und Umfang nachsteuern
- [ ] Ein Kapitel in Endqualität bauen und die echte Spielzeit messen
- [ ] Unreal Engine 5 auf dem PC des Projektinhabers einrichten (RTX 3080, 32 GB) und die Grafik dort ausbauen

## Browser-Version

- [ ] Eigenes Durchspielen durch den Projektinhaber am PC (Rückmeldung zu Steuerung, Darstellung, Texten)
- [ ] Optional: Ton (Musik, Geräusche), Gamepad- und Touch-Steuerung

## Blockiert: Voraussetzung bzw. Entscheidung durch den Projektinhaber

- [ ] (Nur für die Unreal-Version) **Windows-PC mit Unreal Engine 5.4+ und Visual Studio 2022** (Anleitung `README.md`). Ohne diesen Schritt kann das Spiel weder kompiliert noch als .exe erstellt werden.
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
