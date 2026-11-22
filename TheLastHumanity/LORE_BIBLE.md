# Lore Bible – THE LAST HUMANITY

> **Status: Entwurf.** Der ursprüngliche Projektauftrag lag nicht vor. Die Rahmenhandlung ist ein Vorschlag und kann vollständig ersetzt werden. Historische Inhalte (Abschnitt 4) folgen dem Forschungsstand und sind unabhängig von der Rahmenhandlung.

## 1. Grundregel: Fakt und Fiktion

| Ebene | Inhalt | Kennzeichnung im Spiel |
|---|---|---|
| Historische Ebene | Tatsächliche Menschheitsgeschichte nach heutigem Forschungsstand | „Historischer Befund“ (`kind: "fakt"`) |
| Rahmenhandlung | Das Archiv MNEMOSYNE, die Hüterin/der Hüter, das „letzte Kapitel“ | „Rahmenhandlung (Fiktion)“ (`kind: "fiktion"`) |

Die Rahmenhandlung darf historische Fakten **nie verändern oder erfinden**.

## 2a. Rahmenhandlung der Browser-Version 2 (Science-Fiction)

- **MNEMOSYNE** ist eine Raumstation im Orbit des Gasriesen **Tethys**, die letzte bekannte Arche der Menschheit. Eine Ringstadt mit Türmen dreht sich um eine zentrale Megastruktur, Kreuzer und Shuttles fliegen Patrouille.
- **Das Archiv** speichert die Geschichte der Menschheit in 10 Sektoren. Vor drei Wochen ist es verstummt. Nur die **Hüter** sind mit ihm verbunden. Die Spielfigur (Name frei wählbar) ist die letzte Hüterin oder der letzte Hüter und erwacht aus dem Kälteschlaf.
- **Personen:** Kommandantin Aris Velan (Leitung), Technikerin Mara Okoye (Energie), Archivar Jonas Reth (Datenkerne), Pilot Ilan Sato (Hangar), das Stationskind Lio. Alle Figuren sind frei erfunden.
- **Datenkristalle** erzählen in kurzen Logbuch-Einträgen die Geschichte der Station (Jahr 1 bis Jahr 77).
- **Ende:** Alle Sektoren leuchten wieder, das Archiv lebt. Der Abspann „Solange sich jemand erinnert“ bleibt offen und hoffnungsvoll.
- Alle Texte dazu stehen in `Content/Data/story_de.json`.

## 2. Universum (Rahmenhandlung, ursprüngliche Archiv-Version)

- **Das Archiv MNEMOSYNE**, benannt nach der griechischen Göttin der Erinnerung: ein Bauwerk unbekannter Zeit und Lage, in dem die Erinnerung der Menschheit in Hallen geordnet ist, eine Halle pro Epoche.
- **Die Hüterin / der Hüter** (Spielfigur, Geschlecht wählbar bzw. offen): erwacht ohne Erinnerung an die eigene Herkunft. Ob sie oder er tatsächlich der letzte Mensch ist, bleibt zunächst offen. Das ist die zentrale Frage des Spiels.
- **Draußen** ist es still geworden. Was mit der Menschheit geschehen ist, wird erst im „letzten Kapitel“ aufgelöst. Es soll kein Untergang als Spektakel sein, sondern eine Frage danach, was von einer Zivilisation bleibt und weitergegeben wird.
- **Lichtsymbolik:** goldenes Licht = noch nicht erweckte Erinnerung, blaues Licht = archivierte Erinnerung.

## 3. Chronologie der Rahmenhandlung (Entwurf)

| Abschnitt | Ereignis |
|---|---|
| Prolog | Erwachen in der Halle der Ursprünge (Kapitel 1). Erster Informationspunkt „Das letzte Archiv“. |
| Kapitel 1–9 | Wiedererwecken der Epochen; jedes Tor öffnet sich erst, wenn eine Halle vollständig erinnert ist. |
| Kapitel 10 | Die Halle der Namen: frühere Hüterinnen und Hüter (`kap10_huetende`), die letzte Nachricht (`kap10_warum`), der Blick nach draußen und das ferne Licht (`kap10_stille`), die Entscheidung (`kap10_entscheidung`). |
| Abspann | „Solange sich jemand erinnert“: Das letzte Tor führt ins Morgenlicht. Offen bleibt, ob draußen andere Menschen leben; das ferne Feuer deutet einen Neubeginn an. |

## 4. Historische Chronologie – Kapitel 1 „Die Ursprünge“

Alle Angaben sind ungefähre Werte nach aktuellem Forschungsstand. Datierungen können sich durch neue Funde ändern.

| Zeit (vor heute) | Ereignis | Informationspunkt |
|---|---|---|
| ca. 1 Mio. Jahre | Hinweise auf Feuernutzung in der Wonderwerk-Höhle (Südafrika), durch Vorfahren des Homo sapiens | `kap01_feuer` |
| ca. 780.000 Jahre | Kontrollierte Feuerstellen, Gesher Benot Ya'aqov (Israel) | `kap01_feuer` |
| ab ca. 400.000 Jahren | Regelmäßige Feuernutzung an vielen Orten | `kap01_feuer` |
| ca. 300.000 Jahre | Älteste dem Homo sapiens zugeordnete Fossilien, Jebel Irhoud (Marokko) | `kap01_homo_sapiens` |
| mind. ca. 230.000 Jahre | Omo-Kibish (Äthiopien) | `kap01_homo_sapiens` |
| > 100.000 Jahre | Frühe Gruppen des Homo sapiens in der Levante | `kap01_ausbreitung` |
| ca. 100.000–75.000 Jahre | Gravierte Ockerstücke, Blombos-Höhle (Südafrika) | `kap01_kunst` |
| ca. 70.000–50.000 Jahre | Große Ausbreitung aus Afrika | `kap01_ausbreitung` |
| mind. ca. 51.000 Jahre | Höhlenmalerei auf Sulawesi (Indonesien) | `kap01_kunst` |
| mind. ca. 50.000 Jahre | Besiedlung Australiens | `kap01_ausbreitung` |
| ca. 45.000 Jahre | Homo sapiens sicher in Europa nachgewiesen | `kap01_ausbreitung` |
| ca. 40.000 Jahre | Löwenmensch und Flöten, Schwäbische Alb | `kap01_kunst` |
| ca. 36.000 Jahre | Malereien der Chauvet-Höhle (Frankreich) | `kap01_kunst` |
| ca. 20.000 Jahre | Höhepunkt der letzten Eiszeit | `kap01_kunst` |
| ca. 17.000 Jahre | Malereien von Lascaux (Frankreich) | `kap01_kunst` |
| spätestens ca. 15.000 Jahre | Besiedlung Amerikas (möglicherweise früher) | `kap01_ausbreitung` |

### Quellen (Auswahl, zur Überprüfung der Texte)
- Hublin, J.-J. et al. (2017): *New fossils from Jebel Irhoud, Morocco …* Nature 546.
- Vidal, C. M. et al. (2022): *Age of the oldest known Homo sapiens from eastern Africa.* Nature 601.
- Berna, F. et al. (2012): *Microstratigraphic evidence of in situ fire in the Acheulean strata of Wonderwerk Cave …* PNAS 109.
- Goren-Inbar, N. et al. (2004): *Evidence of hominin control of fire at Gesher Benot Ya'aqov, Israel.* Science 304.
- Henshilwood, C. S. et al. (2009): *Engraved ochres from the Middle Stone Age levels at Blombos Cave …* Journal of Human Evolution 57.
- Oktaviana, A. A. et al. (2024): *Narrative cave art in Indonesia by 51,200 years ago.* Nature 631.
- UNESCO-Welterbe „Höhlen und Eiszeitkunst der Schwäbischen Alb“ (2017).

## 5. Historische Chronologie – Kapitel 2 bis 9 (Kurzfassung)

| Kapitel | Eckdaten (gerundet, „etwa“) | Erkenntnisse (IDs) |
|---|---|---|
| 2 Sesshaftigkeit | Göbekli Tepe ab ~9500 v. Chr.; Domestizierung im Fruchtbaren Halbmond ab ~9500 v. Chr.; Çatalhöyük ~7100–5950 v. Chr.; Kupferverhüttung ab 5. Jt. v. Chr.; Mann aus dem Eis ~3300 v. Chr., gefunden 1991 | `kap02_goebekli_tepe`, `kap02_ackerbau`, `kap02_catalhoeyuek`, `kap02_oetzi` |
| 3 Hochkulturen | Uruk, Proto-Keilschrift ~3300–3200 v. Chr.; Reichseinigung Ägypten ~3100 v. Chr.; Cheops-Pyramide ~2560 v. Chr.; Hammurabi ~1754 v. Chr.; Indus ~2600–1900 v. Chr.; Shang ~1600–1046 v. Chr., Orakelknochen ~1250 v. Chr. | `kap03_uruk_schrift`, `kap03_aegypten`, `kap03_hammurabi`, `kap03_indus`, `kap03_shang` |
| 4 Antike | Kleisthenes 508/507 v. Chr.; Sokrates † 399 v. Chr.; Eratosthenes ~240 v. Chr.; röm. Republik ~509 v. Chr., Augustus 27 v. Chr., größte Ausdehnung 117 n. Chr., Ende Westrom 476, Ostrom 1453; Konfuzius 551–479 v. Chr.; Buddha ~5. Jh. v. Chr.; Qin 221 v. Chr.; Han 206 v. Chr.–220 n. Chr. | `kap04_athen`, `kap04_philosophie`, `kap04_rom`, `kap04_denker_asiens`, `kap04_qin_han` |
| 5 Mittelalter | Tod Mohammeds 632; Bagdad 762; al-Chwarizmi ~820; Karl der Große 800; Pest 1347–1351; Mansa Musa 1324; Dschingis Khan 1206; Maya-Klassik ~250–900; Tenochtitlan ~1325; Inka 15. Jh. | `kap05_bagdad`, `kap05_europa`, `kap05_mali`, `kap05_mongolen`, `kap05_amerika` |
| 6 Neuzeit | Gutenberg-Bibel ~1454; Kolumbus 1492; da Gama 1498; Magellan/Elcano 1519–1522; Sklavenhandel 16.–19. Jh. (~12,5 Mio. verschleppt); Haiti 1791/1804; Luther 1517; Dreißigjähriger Krieg 1618–1648; Kopernikus 1543; Newton 1687; Kant 1784; 1776; 1789 | `kap06_buchdruck`, `kap06_entdeckungen`, `kap06_sklavenhandel`, `kap06_reformation`, `kap06_aufklaerung` |
| 7 Industrie | Watt ab 1769; Stockton–Darlington 1825; Nürnberg–Fürth 1835; Suezkanal 1869; Kommunistisches Manifest 1848; Sozialversicherung 1883/1884/1889; Abschaffung der Sklaverei 1833 (brit.), 1865 (USA), 1888 (Brasilien); Berliner Konferenz 1884/85; Völkermord an Herero und Nama ab 1904 | `kap07_dampf`, `kap07_eisenbahn`, `kap07_soziale_frage`, `kap07_abolition`, `kap07_imperialismus` |
| 8 Extreme | Erster Weltkrieg 1914–1918 (~17 Mio. Tote); 30.1.1933; 1.9.1939; 8.5.1945 (> 60 Mio. Tote); Holocaust (~6 Mio. ermordete Jüdinnen und Juden); 27.1.1945; UN 1945; AEMR 1948; Indien 1947; „Afrikanisches Jahr“ 1960; Mauerbau 13.8.1961; Kubakrise 1962; Mondlandung 20.7.1969; Mauerfall 9.11.1989; Einheit 3.10.1990; Ende der UdSSR 12/1991 | `kap08_erster_weltkrieg`, `kap08_zweiter_weltkrieg`, `kap08_holocaust`, `kap08_dekolonisation`, `kap08_kalter_krieg` |
| 9 Vernetzte Welt | WWW-Vorschlag 1989, öffentlich 1991, freigegeben 1993; WTO 1995; EU (Maastricht) 1993; Euro-Bargeld 2002; Finanzkrise 2008; 8 Milliarden Menschen 15.11.2022; IPCC 2021 (~1,1 °C, 2011–2020); Pariser Abkommen 2015; Pandemie ab 11.3.2020 | `kap09_internet`, `kap09_globalisierung`, `kap09_bevoelkerung`, `kap09_klima`, `kap09_pandemie` |

### Weitere Quellen (Auswahl, Kapitel 2–9)
- UNESCO World Heritage List: Göbekli Tepe (2018), Neolithic Site of Çatalhöyük (2012), Caves and Ice Age Art in the Swabian Jura (2017)
- Südtiroler Archäologiemuseum Bozen: Ötzi – Fakten
- Slave Voyages Database (Trans-Atlantic Slave Trade Database), Emory University
- United States Holocaust Memorial Museum (Holocaust Encyclopedia); Gedenkstätte Yad Vashem
- Vereinte Nationen: Charta (1945), Allgemeine Erklärung der Menschenrechte (1948), World Population Prospects (8 Milliarden, 2022)
- IPCC: Sixth Assessment Report, Working Group I (2021), Summary for Policymakers
- WHO: Global excess deaths associated with COVID-19 (2022)
- CERN: The birth of the Web
- Bundeszentrale für politische Bildung (bpb): Dossiers zu Kaiserreich, Weimarer Republik, Nationalsozialismus, Deutscher Teilung

## 6. Sensible Themen – redaktionelle Regeln

- Völkermorde (Holocaust, Herero und Nama), Sklaverei und Kolonialverbrechen werden sachlich, opferzentriert und ohne spielerische Verfremdung dargestellt; keine Interaktion außer Lesen.
- Täter, Taten und Zahlen werden klar benannt; Schätzungen werden als solche gekennzeichnet.
- Die Rahmenhandlung berührt diese Themen nicht.
