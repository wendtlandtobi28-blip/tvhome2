# Game Design – THE LAST HUMANITY

> **Neue Richtung (22.11.2026, Vorgabe des Projektinhabers):** Optik und Aufbau orientieren sich an einem vom Projektinhaber gezeigten Science-Fiction-Bild: Raumstation im Abendlicht, Gasriese am Himmel, Ringstadt, Spielfigur in Rüstung mit Umhang, Spiel in der dritten Person, HUD mit Porträt, Questanzeige, Kompass, Minikarte, Protokoll und Fähigkeitenleiste. Ziel für den fertigen Story-Modus: **etwa 60 Spielstunden**. Umgesetzt in der Browser-Version 2 (siehe Abschnitt 11). Die Abschnitte 1–10 beschreiben die ursprüngliche Archiv-Version.

> **Hinweis zum Status:** Der ursprüngliche Projektauftrag „THE LAST HUMANITY – DIE GESCHICHTE DER MENSCHHEIT“ lag bei der Erstellung dieses Dokuments nicht vor, nur der technische Arbeitszusatz. Dieses Konzept ist deshalb ein **Entwurf**, abgeleitet aus Titel und Prototyp-Anforderungen. Sobald der Auftrag vorliegt, wird das Dokument daran angepasst.

## 1. Kurzbeschreibung

THE LAST HUMANITY ist ein ruhiges Erkundungs- und Lernspiel in der Ego-Perspektive. Die Spielerin oder der Spieler erwacht als letzte Hüterin oder letzter Hüter im Archiv MNEMOSYNE. Dort ist die Geschichte der Menschheit in begehbaren Hallen bewahrt. Durch das Untersuchen von Informationspunkten werden Erinnerungen „wiedererweckt“. Am Ende soll die gesamte Menschheitsgeschichte von den Ursprüngen bis zur Gegenwart erlebbar sein, eingebettet in eine fiktive Rahmenhandlung über das Ende und das Weiterleben der Erinnerung.

## 2. Zielgruppe und Ton

- Jugendliche ab etwa 12 Jahren und Erwachsene; geeignet für Schule und Selbststudium
- Ton: ruhig, staunend, respektvoll; keine Gewaltdarstellung als Spielmechanik
- Sprache: Deutsch (weitere Sprachen später)

## 3. Kernprinzipien

1. **Wissen ist der Fortschritt.** Fortschritt entsteht durch Entdecken, nicht durch Kampf.
2. **Zwei Lesetiefen.** Jede Erkenntnis gibt es als Kurzfassung (2–3 Sätze) und als ausführliche Fassung.
3. **Fakt und Fiktion klar getrennt.** Historische Befunde sind als „Historischer Befund“ gekennzeichnet, die Rahmenhandlung als „Rahmenhandlung (Fiktion)“. Unsichere Datierungen werden als solche benannt („etwa“, „mindestens“, „umstritten“).
4. **Orte statt Textwüsten.** Jede Epoche bekommt eine eigene, gestaltete Halle; Informationen sind räumlich verortet.

## 4. Spielablauf (Kernschleife)

1. Halle betreten → Umgebung erkunden
2. Leuchtenden Informationspunkt finden (gold = neu, blau = bekannt)
3. Mit **E** untersuchen → Kurzfassung lesen → wahlweise ausführliche Fassung
4. Erkenntnis wird archiviert (Fortschritt + automatisches Speichern)
5. Alle Erkenntnisse einer Halle gefunden → das Tor am Hallenende öffnet sich → nächstes Kapitel
6. Nach Kapitel 10 führt das letzte Tor zum Abspann

## 5. Kapitelstruktur

| Nr. | Kapitel | Zeitraum | Status |
|---|---|---|---|
| 1 | Die Ursprünge | vor ca. 300.000 – 12.000 Jahren | **umgesetzt** |
| 2 | Sesshaftigkeit | ab ca. 10.000 v. Chr. | **umgesetzt** |
| 3 | Die ersten Hochkulturen | ca. 3500 – 1200 v. Chr. | **umgesetzt** |
| 4 | Die Antike | ca. 800 v. Chr. – 500 n. Chr. | **umgesetzt** |
| 5 | Das Mittelalter | ca. 500 – 1500 | **umgesetzt** |
| 6 | Aufbruch in die Neuzeit | ca. 1450 – 1800 | **umgesetzt** |
| 7 | Das industrielle Zeitalter | ca. 1760 – 1914 | **umgesetzt** |
| 8 | Das Zeitalter der Extreme | 1914 – 1991 | **umgesetzt** |
| 9 | Die vernetzte Welt | seit 1991 | **umgesetzt** |
| 10 | Das letzte Kapitel | Rahmenhandlung (Fiktion) | **umgesetzt** |

Die Epochengrenzen sind didaktische Vereinfachungen. Im Spiel werden sie als ungefähre Angaben ausgewiesen und, wo sinnvoll, mit außereuropäischen Perspektiven ergänzt.

## 6. Steuerung (Phase 1)

WASD/Pfeile gehen · Maus umsehen · Shift laufen · Leertaste springen · E untersuchen/schließen · Tab/K Kapitelübersicht · Esc/P Menü · F5 Schnellspeichern

## 7. Benutzeroberfläche

- **Hauptmenü:** Neues Spiel, Fortsetzen (nur mit Spielstand), Kapitelübersicht, Optionen, Beenden, Steuerungshilfe
- **Pausenmenü:** Weiterspielen, Spiel speichern, Letzten Spielstand laden, Kapitelübersicht, Optionen, Zum Hauptmenü, Beenden
- **Optionen:** Mausempfindlichkeit, Sichtfeld, Y-Achse umkehren, Steuerungshinweis, alle Kapitel freischalten
- **Abspann:** Abschlusstext und Statistik, danach weiter erkunden oder Hauptmenü
- **HUD:** Fadenkreuz, Interaktionshinweis, Meldungen, Steuerungszeile
- **Informationsfenster:** Kapitel, Kennzeichnung (Befund/Fiktion), Titel, Kurz-/Langtext umschaltbar, scrollbar. Die gewählte Lesetiefe bleibt für weitere Punkte erhalten.
- **Kapitelübersicht:** alle Kapitel mit Zeitraum, Zusammenfassung, Status, Fortschritt; entdeckte Erkenntnisse erneut lesen; freigeschaltete Hallen direkt betreten

## 8. Speichern

Ein Spielstand-Slot (Phase 1). Automatische Speicherung bei jeder neuen Erkenntnis; manuelles Speichern im Pausenmenü und mit F5. „Neues Spiel“ setzt den Fortschritt im Speicher zurück; der gespeicherte Stand wird erst beim nächsten Speichern überschrieben.

## 9. Umfang Version 0.9.0

10 Hallen mit je eigener Farbgebung, Säulenform, Lichtstimmung und Monument (Feuerstelle, Steinpfeiler, Zikkurat, Bogen, Globus, Stahlturm); 48 Erkenntnisse (43 historische Befunde, 5 Texte der Rahmenhandlung); Tor-System mit Freischaltung; Kapitelübersicht mit erneutem Lesen und Direktwahl; Optionsmenü; Abspann.

## 10. Ausblick

- Erzählerstimme, Musik, Umgebungsklang
- Zeitleiste/Kodex mit allen gefundenen Erkenntnissen
- Optionen: Textgröße, Kontrast, Untertitel, Mausempfindlichkeit, Tastenbelegung
- Quellenangaben je Informationspunkt im Spiel

## 11. Browser-Version 2: Science-Fiction-Story-Modus

**Schauplatz:** Raumstation MNEMOSYNE im Orbit des Gasriesen Tethys, die letzte Arche der Menschheit (Fiktion). Die Geschichtsinhalte (48 Erinnerungen in 10 Kapiteln) liegen in den Archivsektoren der Station.

**Eigenes Design:** Emblem „Flamme der Erinnerung“ (offener Ring, Flamme, Stern). Es verwendet bewusst keine Totenköpfe, Adler oder anderen Motive bekannter Marken. Rot-goldene Banner, dunkle Rüstung mit goldenen Kanten und blauen Leuchtstreifen.

**Spielschleife:**
1. Auf der Station mit Personen sprechen und Quests annehmen
2. Orte erkunden, Datenkristalle sammeln
3. Durch das Archivtor einen Sektor betreten und alle Erinnerungen an den Datenterminals erwecken
4. Durch das Sektortor zurückkehren und der Kommandantin Bericht erstatten
5. Erfahrung und Stufen sammeln, Fähigkeit 6 schaltet sich ab Stufe 10 frei

**Systeme (umgesetzt):** Steuerung in der dritten Person mit Kamera, die nicht durch Wände greift · Ausdauer (Sprint) und Energie (Fähigkeiten) · 6 Fähigkeiten · Quest- und Dialogsystem · Kompass mit Questmarkierung · Minikarte und große Karte · Journal, Kodex, Fähigkeitenübersicht · Erfahrung und Stufen · Stationszeit mit Tageszähler · Speichern und Laden · Grafikstufen · prozeduraler Klang.

**Weg zu 60 Stunden (geplant, Reihenfolge nach Absprache):**

| Ausbaustufe | Inhalt | Geschätzte Spielzeit |
|---|---|---|
| Stand Version 2 | 10 Sektoren, 48 Erinnerungen, Station mit 5 Personen, 10 Kristalle | ca. 1–2 h |
| Kapitel vertiefen | 15 statt 5 Erinnerungen pro Sektor, Kapitel 2–10 mit eigener Rahmenszene | +8 h |
| Mehr Epochen | 20 statt 10 Sektoren (feinere Epochen, außereuropäische Schwerpunkte) | +10 h |
| Aufgaben und Rätsel | Zeitleisten ordnen, Fundstücke zusammensetzen, Karten zuordnen, Wissensprüfung an Sektortoren | +15 h |
| Station ausbauen | weitere Decks (Hangar, Gärten, Kommandozentrum innen), Nebenquests der Bewohner | +15 h |
| Gefahren | „Datenrauschen“ in beschädigten Sektoren, das mit Fähigkeiten beseitigt wird (ohne Waffen) | +10 h |
