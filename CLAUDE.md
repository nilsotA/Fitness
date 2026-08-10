# Arbeitsanweisungen für Claude

Trainings- und Ernährungstracker für Sprint, Kraft und Ausdauer. Nutzer ist
**Nils** – Sprint-Hintergrund, will Kraft aufbauen und alte Kraft
zurückgewinnen (Muscle-Up, Liegestütze), Ausrichtung zwischen Sprint und
Ausdauer bewusst offen halten.

## Konventionen

Diese sind aus dem Schwesterprojekt `Spieleabende` übernommen und gelten strikt:

- **Null Abhängigkeiten.** Kein npm-Paket, kein Build-Schritt, kein Framework.
  Wer eine Bibliothek einführen will, hat vorher einen sehr guten Grund.
- **Deutsch.** Bezeichner, Kommentare, Oberfläche, Commit-Messages. Englische
  Fachbegriffe nur, wo es keine gute Entsprechung gibt (`RPE`, `Hip Thrust`).
- **Kommentare erklären das Warum**, nicht das Was. Besonders dort, wo eine
  Entscheidung überraschend aussieht.
- Alles, was rechnet, bleibt frei von Netzwerk und Dateizugriff – siehe unten.
- `node --test test/*.test.js` muss grün bleiben. Aktuell **409 Tests**.

## Aufbau

Der Tracker läuft **ohne Server**. Er liegt als Web-App auf GitHub Pages, wird
zum Startbildschirm hinzugefügt und funktioniert offline; die Daten stehen in
der IndexedDB des Geräts.

```
index.html            Einstieg (Wurzelverzeichnis, damit Pages es ausliefert)
manifest.webmanifest  macht die App installierbar
sw.js                 Service Worker – hält alle Dateien offline vorrätig

kern/                 Reines Rechnen. Läuft im Browser wie in Node.
  wissen.js           Evidenzbasis: ALLE Konstanten mit Quelle. Einzige Stelle
                      für Zahlen. Enthält auch UEBUNGEN, MUSKELGRUPPEN,
                      SCHUTZZIELE, VOLUMEN.
  profil.js           Körperdaten, Ausrichtungsregler, Muscle-Up-Weg
  plan.js             Wochenplaner
  leistung.js         Einer-Maxima, Arbeitsgewichte, Progression, Muskel-
                      volumen, Schutzabdeckung, Risikoprofil
  ernaehrung.js       Kalorien, Makros, Energieverfügbarkeit
  belastung.js        sRPE, ACWR, Bereitschaft, Ruhepuls-Grundlinie
  sprint.js           Sprintzeiten, Abbruchregel, Bestzeiten und Verlauf
  ausdauer.js         Strecke, Tempo, Grauzone, Pulszonen
  aktivitaet.js       GPX/TCX aus fremden Apps einlesen
  regeln.js           Datum in Ortszeit + was im Browser live gebraucht wird
  zustand.js          Der Gesamtzustand der Oberfläche
  aendern.js          Alles, was Daten verändert – samt Eingabeprüfung
  lebensmittel.json   Nährwerttabelle

app/                  Oberfläche, eine Datei je Ansicht
  speicher.js         IndexedDB
  daten.js            Verbindet Oberfläche, Kern und Ablage

server/index.js       Nur ein Dateiserver zum Entwickeln (ES-Module gehen nicht
                      über file://). Keine API, keine Datenhaltung.
```

**Die Regel, an der alles hängt:** `kern/` kennt weder Netzwerk noch
Dateisystem. Jede Funktion bekommt den Datenbestand übergeben und gibt zurück,
was anzuzeigen ist. Das war ursprünglich nur eine Testbarkeitsentscheidung –
sie hat später den Umbau auf eine serverlose App fast geschenkt gemacht. Bitte
so lassen: Wer in `kern/` einen `fetch` oder ein `readFile` einbaut, nimmt der
App den Offline-Betrieb.

Deshalb steht die Eingabeprüfung in `kern/aendern.js` und nicht in der
Oberfläche: einmal im Code statt einmal im Browser und einmal im Server.

## Fachliche Regeln, die nicht verhandelbar sind

Sie stehen mit Quelle in `wissen.js`. Wer sie ändert, ändert die Trainingslehre
und nicht nur Code:

- Sprint höchstens 3×/Woche, ≥48 h Abstand, am gemeinsamen Tag **vor** Kraft.
- Sprintstrecken bleiben bei ~30 m. Mehr Umfang kommt über Sätze, **nie** über
  längere Läufe – das wäre Tempohärte statt Schnelligkeit.
- Ausdauer polarisiert: die Mehrheit locker. Nie alle Einheiten hart.
- Nordic Hamstring, Copenhagen Adduction und Wadenarbeit stehen in **jeder**
  Krafteinheit – vier Minuten Aufwand. Copenhagen ist durch eine randomisierte
  Studie belegt (−41 %); beim Nordic ist die viel zitierte Halbierung des
  Risikos **umstritten**, eine Nachrechnung derselben Studien fand den Effekt
  nicht wieder (`impellizzeri2021`). Die Übung bleibt trotzdem – billig und
  plausibel –, aber die Zahl trägt überall den Vorbehalt.
- Jede vierte Woche Entlastung.
- Gelenkschonende Varianten sind Standard (Frontkniebeuge, Sechskantstange),
  im Profil abschaltbar.

## Fallen, die schon einmal zugeschnappt haben

Alle waren echte Fehler im Betrieb, nicht theoretisch:

1. **`slice(-0)` gibt das ganze Array zurück**, weil `-0 === 0`. Hat dafür
   gesorgt, dass „null harte Ausdauereinheiten" zu „alle hart" wurde – das
   exakte Gegenteil. Bei jeder `slice(-n)`-Konstruktion die Null ausdrücklich
   prüfen.
2. **Last muss zur Wiederholungszahl passen.** Wiederholungsbereich und Prozent
   waren unabhängig vorgegeben und ergaben „6–7 Wiederholungen bei 85–92 % 1RM"
   – nicht ausführbar. Die Last wird jetzt über `prozentBereich()` aus den
   Wiederholungen abgeleitet, plus Reserve.
3. **Körpergewichtsübungen rechnen mit der Gesamtlast** (Körper + Zusatz).
   Prozente auf die reine Zusatzlast sind biomechanisch falsch.
4. **Testarten sind nicht gleich Übungen.** „Klimmzüge max. = 9" zählt
   Wiederholungen, nicht Kilogramm. Deshalb `lastTest` und `wdhTest` im
   Übungsregister.
5. **MET-Werte sind Durchschnitte über die ganze Einheit**, nicht Werte während
   der Belastung. Eine Sprinteinheit ist zu neun Zehnteln Stehen und Gehen. Mit
   dem MET des Sprintens gerechnet kam ein Trainingstag auf 4800 kcal statt
   4200. Ebenso: Die Alltagsfaktoren schließen Sport **aus** und müssen deshalb
   unter den geläufigen PAL-Werten liegen, sonst wird Training doppelt gezählt.

6. **Eine Bewertung braucht Grenzen in beide Richtungen.** Die Verteilung prüfte
   nur die Grauzone und einen Mindestanteil hart. „42 % locker, 58 % hart" kam
   damit als *„entspricht der polarisierten Verteilung"* heraus – bei genau
   umgekehrtem Verhältnis. Aufgefallen erst mit echten Pulsdaten, weil ein
   geschätzter Maximalpuls viele lockere Einheiten über die harte Grenze
   schiebt. Bei jeder Schwellenprüfung fragen, ob es auch ein „zu viel" gibt.

7. **Nicht jede Kurve hat eine gute Richtung.** `linienDiagramm` schrieb
   standardmäßig „besser geworden", sobald der letzte Wert höher lag. Über einem
   steigenden Ruhepuls stand damit „besser geworden" – direkt über dem Text, der
   vor einem beginnenden Infekt warnt. Dasselbe bei Wochenlast und Gewicht.
   Beobachtungsgrößen bekommen `wertung: false`.
   *Nachtrag:* Auch die Richtung selbst war falsch bestimmt. Verglichen wurden
   erster und letzter Wert – ausgerechnet die beiden willkürlichsten Punkte
   einer Reihe. Die Tempokurve „Rad · Locker" sprang zwischen der 55- und der
   95-Minuten-Ausfahrt hin und her; weil zufällig die kurze zuletzt kam, stand
   „schlechter geworden" unter einer Reihe ganz ohne Trend. `verlaufsUrteil()`
   vergleicht jetzt erstes gegen letztes Drittel und schweigt („kein klarer
   Trend"), solange der Unterschied kleiner ist als das Zappeln von Punkt zu
   Punkt. Als Maß dafür der mittlere Abstand aufeinanderfolgender Werte, nicht
   die Standardabweichung – die treibt ein echter Trend selbst nach oben und
   verdeckt sich damit.
8. **Zwei verschiedene Zahlen sind noch keine richtige Beschriftung.** Die
   Nachkommastellen wuchsen nur, solange Anfangs- und Endwert *gleich*
   aussahen. 9,75 → 9,43 km/h stand deshalb als „10" → „9" da: aus 3 % wurden
   optisch 10 %. Maßstab ist die Veränderung, nicht die Unterscheidbarkeit –
   siehe `beschriftungsStellen()`.

9. **GPS-Rauschen macht Strecken länger, nie kürzer.** Die rohe Summe der
   Teilstrecken einer GPX-Spur ergab aus 10 km glatte 18,4 km – bei einem Punkt
   pro Sekunde und ±3 m Rauschen. Kein Rundungsfehler, das Doppelte. `kern/
   aktivitaet.js` glättet deshalb vorher. Wichtig dabei: Die Punktdichte darf
   **nicht** an den verrauschten Abständen gemessen werden, die sind selbst
   schon zu lang – erst grob vorglätten, dann die Dichte bestimmen. Geprüft
   wird das gegen simulierte Spuren mit bekannter Länge; bei einer echten Datei
   kennt niemand die Wahrheit.

10. **Ein gedeckelter Balken kann „drüber" nicht abstufen.** `balken()` schnitt
    bei `Math.min(100, …)` ab. Damit standen 108 % Fett und 197 % Protein als
    zwei identisch randvolle Balken untereinander – dieselbe Falle wie Nr. 6,
    nur grafisch. Über dem Ziel wächst der Maßstab jetzt mit und der Überschuss
    bekommt eine schraffierte Fläche; siehe `balkenBreiten()`. Und weil ein
    negativer Rest kein Rest ist, heißt es über der Vorgabe „1.200 kcal zu
    viel" statt „-1.200 kcal übrig". Gleiche Familie im Verletzungsschutz:
    „4 von 2 Sätzen" – „X von Y" setzt voraus, dass X in Y hineinpasst, sonst
    liest es sich wie ein Zählfehler. Erfüllt heißt „4 Sätze, 2 gefordert"
    (`saetzeStand()`). Bei jeder „X von Y"-Formulierung fragen, was oberhalb
    von Y dasteht.

11. **Eine nachgebaute Regel ist eine zweite Regel.** Der Zyklusstreifen im
    Wochenplan färbte nach „Woche ≤ 3 ist Aufbau, ≤ 7 Intensivierung" und
    „jede vierte ist Entlastung" – dieselbe Periodisierung wie `BLOCKFOLGE`,
    nur abgeschrieben. Er zeichnet sich jetzt aus `BLOCKFOLGE` selbst, samt
    Fließtext und Beschriftung. Dabei fiel auf, dass die Markierung an
    `nummer === plan.woche` hing: Ab Woche 13 leuchtete kein Balken mehr,
    obwohl der Zyklus nur von vorn beginnt.

12. **`toLowerCase()` ist keine Beugung.** „Korridor für einen leichter tag" –
    falscher Fall und kleingeschriebenes Substantiv in einem. Deutsche
    Aufschriften taugen nicht ohne Weiteres im Satzinneren; dafür gibt es
    `TAGESTYP_GEBEUGT` neben `TAGESTYP_NAMEN`. Beide Listen prüft ein Test
    gegen das, was `tagestyp()` tatsächlich zurückgibt.
    *Dieselbe Familie, größerer Fund:* Zahl plus Mehrzahlform ergibt bei eins
    „1 Sätze". Stand an fünf Stellen, darunter die Meldung nach jedem
    Training. Dafür gibt es `menge(n, einzahl, mehrzahl)` in `regeln.js`.
    **Wichtiger als die Grammatik:** Im Wochenplan war „aufgeteilt in 1 Sätze
    à 5" die sichtbare Spitze eines Rechenfehlers – die fünf passten gar nicht
    zu den vier Läufen der Überschrift (siehe Nr. 13). Wo erzeugter deutscher
    Text falsch gebeugt ist, lohnt der Blick auf die Zahl daneben.

13. **Zwei Zahlen für dieselbe Sache driften auseinander.** Der Sprintblock
    schrieb die Läufe in die Überschrift und rechnete im Text Sätze mal
    Satzgröße: „4 × 30 m … aufgeteilt in 1 Sätze à 5". Solange der Umfang
    glatt durch die Satzgröße ging, stimmten beide zufällig überein – in jeder
    Entlastungswoche ging er das nicht. `satzAufteilung()` rechnet die
    Verteilung einmal aus, der Text liest sie ab. Ein Test prüft für jeden
    Sprintblock jeder der zwölf Wochen, dass Überschrift und Text dieselbe
    Summe ergeben.

14. **`Number('78,3')` ist NaN – und `|| 0` macht daraus stillschweigend eine
    Null.** In einer deutschen App liegt das Komma auf der Tastatur. Im Kern
    stand an sechzehn Stellen `Number(x) || 0`: Aus „162,5 kcal" wurden **0
    kcal**, aus „62,5 min" eine Einheit ganz ohne Belastung, aus „102,5 kg" im
    Krafttest `null`. Kein Fehler, keine Meldung, nur ein falscher Eintrag im
    Tagebuch. `zahlAusEingabe()` in `regeln.js` liest jetzt deutsch (samt
    Tausenderpunkt: „1.200" ist 1200, nicht 1,2), und `zahlFeld()` in
    `aendern.js` unterscheidet „nichts eingetragen" von „unlesbar" – das Erste
    darf ein Vorgabewert sein, das Zweite wirft.
    *Dabei mitgefunden:* `profilSpeichern` rechnete das Profil sauber um,
    schrieb in den Gewichtsverlauf aber die **rohe** Eingabe. Bei einem Komma
    stand das Profilgewicht auf null und im Verlauf ein `NaN` – das überlebt
    das Speichern und verdirbt die Kurve dauerhaft. Wo eine Eingabe zweimal
    verarbeitet wird, muss die zweite Stelle vom geprüften Ergebnis lesen,
    nicht noch einmal vom Rohwert.


15. **Ein Zähler muss zählen, was sein Name behauptet.** `gleicheLast` hieß so,
    zählte auch genau das – gleiche Last – und wurde als *Stillstand* gelesen.
    Bei doppelter Progression hält man die Last aber absichtlich und arbeitet
    die Wiederholungen hoch; im Bereich 3–5 braucht das mindestens drei
    Einheiten. Die Rücknahme um 10 % feuerte damit zuverlässig dann, wenn der
    Plan planmäßig lief. Unter „105 kg × 4,4,3" gefolgt von „105 kg × 4,4,4"
    stand „3 Einheiten ohne Fortschritt" – obwohl eine Wiederholung
    dazugekommen war. Stillstand heißt jetzt: gleiche Last **und** keine
    zusätzliche Wiederholung.
    *Der Test hatte den Fehler festgeschrieben.* Er hieß „zählt wiederholte
    Lasten mit" und verlangte genau die falsche Zahl. Wenn ein Test bei einer
    Korrektur bricht, ist die erste Frage nicht, wie man ihn grün bekommt,
    sondern was er eigentlich behauptet – hier stand sein Name schon daneben.


16. **Wer eine Größe zweimal herleitet, bekommt zwei Antworten.** Die Makros
    setzten Protein *und* Fett je Kilogramm fest und ließen die Kohlenhydrate
    als Rest übrig – der dann gegen einen Korridor gehalten wurde, an den er
    nie gebunden war. Bei drei von fünf Tagestypen lag das Ergebnis außerhalb:
    am Ruhetag 4,6 g/kg bei einem Korridor von 3–4, an harten Tagen 7,8 statt
    6–7. Der Tracker warnte also vor seiner eigenen Vorgabe. Der Hinweistext
    nannte den Hebel sogar („entweder Fett etwas senken oder die Kalorien
    anheben"), nur zog ihn niemand. Jetzt bindet der Korridor die
    Kohlenhydrate und das Fett gleicht aus – so herum steht es auch im
    Positionspapier, auf das sich der Tracker beruft. Die Untergrenze fürs
    Fett bleibt hart; reicht die Energie dann nicht für den Korridor, weichen
    die Kohlenhydrate, und *dann* ist der Hinweis eine echte Aussage über den
    Tag statt über die Rechnung.
    *Auch hier hatte der Test den Fehler festgeschrieben* – er hieß „Protein
    und Fett zuerst, Kohlenhydrate füllen auf". Zweiter Fall in Folge: Wenn
    ein Test bei einer Korrektur bricht, lohnt der Blick auf seinen Namen.

17. **Ein Maßstab, den der eigene Plan nicht besteht, ist der falsche
    Maßstab.** Wer zwölf Wochen lang genau das eintrug, was der Wochenplaner
    vorschlug, bekam in **21 von 28** Kombinationen aus Reglerstand und
    Trainingstagen eine Warnung zur Intensitätsverteilung – bei Nils'
    Voreinstellung (Regler 30, vier Tage) ausgerechnet *„ohne harte Anteile
    fehlt der Reiz nach oben – rund ein Fünftel der Zeit darf wehtun"*, neben
    zwei Sprinteinheiten pro Woche bei RPE 8. Zwei Ursachen, beide in der
    Bewertung und nicht in den Zahlen:
    *Erstens sah `verteilung()` nur Einheiten mit `typ`-Präfix `ausdauer`.*
    Sprints sind kein Ausdauerumfang und gehören nicht in die Anteile – für
    die *Bewertung* sind sie aber genau der harte Reiz, dessen Fehlen
    beklagt wurde. Wer dem Rat folgte, legte harte Ausdauer neben das
    Sprinttraining und landete in der Interferenz, vor der derselbe Tracker
    an anderer Stelle warnt (Wilson 2012).
    *Zweitens ist 80/20 bei diesem Umfang gar nicht darstellbar.* Eine
    Intervalleinheit dauert rund eine Stunde; bei drei Ausdauereinheiten in
    der Woche ist sie zwangsläufig ein Drittel der Zeit. Es gibt keine
    Aufteilung, die auf 20 % käme – außer gar keiner harten Einheit. Der
    Planer rechnete zudem `round(einheiten × 0,2)` über **Einheiten**, während
    `ausdauer.js` in **Minuten** misst und in seinem eigenen Kommentar davor
    warnt, dass genau diese Verwechslung Pläne polarisiert aussehen lässt, die
    es nicht sind. Ergebnis: nie 20 %, sondern 0 % oder 23–44 %.
    Das Verhältnis wird jetzt erst ab `minMinutenProWocheFuerVerhaeltnis`
    benotet; darunter steht der Anteil da, aber ohne Note und mit Begründung.
    Die Grauzone dagegen wird bei jedem Umfang bewertet – sie ist der Teil,
    an dem Ausdauertraining tatsächlich scheitert. „Zu wenig hart" bleibt
    ebenfalls bei jedem Umfang eine Warnung, wenn *nirgends* ein harter Reiz
    steht: zu wenig ist keine Frage der Stückelung, zu viel schon.
    **Die eigentliche Lehre:** Beide Fehler wären mit jedem Einzeltest grün
    geblieben – der vorhandene Plan-Test verlangte nur `hart ≤ Einheiten / 2`.
    Aufgefallen sind sie erst, als Plan und Auswertung gegeneinander laufen
    durften. Wo ein Modul etwas vorschlägt und ein anderes dasselbe bewertet,
    gehört ein Test dazwischen, der das eine ins andere einspeist.

18. **Ein Melder, der nie meldet, besteht jeden Test.** Falle 17 hatte den
    Tracker beim Überwarnen erwischt. Dieselbe Simulation auf `belastung.js`
    angesetzt – zwölf Wochen Plan hinein, Belastungssteuerung heraus – zeigte
    das genaue Gegenteil: Bei 3-fachem Wochenumfang, fünf Morgen-Checks in
    Folge bei 40 % und einem Ruhepuls 10 Schläge über der Grundlinie stand da
    *„Keine Anzeichen für vorgezogene Entlastung."* Drei Ursachen, alle vom
    Bau „Schwelle ohne erreichbare Gegenseite":
    *Erstens war die Monotonie rechnerisch nicht auslösbar.* Fosters Quotient
    aus Wochenschnitt und Streuung läuft über sieben Tage **einschließlich der
    Ruhetage** – und die liefern die Streuung. Bei n Trainingstagen liegt das
    Maximum bei `wurzel(n / (7 - n))`: 1,15 bei vier Tagen gegen eine Schwelle
    von 2,0. Fosters Zahl stammt von faktisch täglich trainierenden Sportlern.
    Im Fortschritt stand deshalb dauerhaft grün „gut verteilt" – eine Prüfung,
    die niemand bestehen musste, weil sie niemand durchfallen konnte. Jetzt
    wird unter sechs Trainingstagen der Wert gezeigt und **nicht benotet**,
    samt Begründung – dasselbe Vorgehen wie beim Intensitätsverhältnis in
    Falle 17. Eine niedrigere Schwelle wäre eine erfundene Zahl gewesen.
    *Zweitens galt für die Morgen-Checks kein Stichtag.* `acwr`, `monotonie`
    und `ruhepulsTrend` bekamen `bis` übergeben, die Checks als Einzige nicht:
    In der Rückschau urteilte die Zukunft über die Vergangenheit, und drei
    Monate alte Checks galten weiter als „die letzten fünf". Wer sechs Wochen
    nichts eingetragen hat, hat keine schlechte Woche hinter sich – er hat
    keine Daten.
    *Drittens wurde ein einzelner Grund berechnet und weggeworfen.* Bei genau
    einem Grund stand im Text „Keine Anzeichen" – mit dem Grund daneben in der
    Liste –, und die Oberfläche zeigte die Karte gar nicht erst. Der Tracker
    verschwieg damit etwas, das er gesehen hatte; das Gegenteil dessen, was er
    sonst tut. Es gibt jetzt eine Stufe „beobachten", die den Grund nennt, ohne
    eine Entlastung zu fordern.
    **Die Lehre:** Ein „warnt nicht grundlos"-Test allein ist wertlos – ein
    Melder, der nie meldet, besteht ihn glänzend. Zu jeder solchen Prüfung
    gehört die Gegenprobe, dass die Warnung überhaupt auslösen *kann*. Und bei
    jeder übernommenen Schwelle die Frage, für welche Population sie
    bestimmt wurde: Fosters 2,0 ist für tägliches Training gedacht und sagt
    über eine Vier-Tage-Woche nichts.

19. **Eine Schranke darf nicht messen, was sie nicht meint.** `acwr()` gab
    unter zehn Trainingstagen in 28 Tagen „nicht belastbar" zurück, mit dem
    Hinweis, das Verhältnis werde „nach etwa vier Wochen regelmäßigem Logging"
    aussagekräftig. Gemeint waren vier Wochen Verlauf, gezählt wurde die
    Trainingshäufigkeit. Wer nach Plan an zwei Tagen der Woche trainiert –
    bei drei eingestellten Tagen und Regler 15 bis 35 tut der Planer genau
    das, **Nils' Voreinstellung liegt bei 30** – kommt in 28 Tagen auf
    höchstens acht. Die Schranke war damit nie zu nehmen: kein Anlaufproblem,
    sondern ein Dauerzustand, unter einem Hinweis, der Besserung durch Warten
    versprach. Das ist die Sackgasse aus dem Abschnitt darunter, nur mit
    Zeitangabe. Geprüft wird jetzt, ob in **jeder** der vier Wochen etwas
    steht – das ist „regelmäßiges Logging", wie der Hinweis es ohnehin sagte,
    und es hängt nicht daran, wie oft jemand trainiert.

20. **Ein Zähler weiß, wie oft – nicht wie.** Die Muscle-Up-Stufen 8
    („Muscle-Up mit Schwung") und 9 („Strikter Muscle-Up") hingen beide an
    `muscleups >= 1`. Gleiche Prüfung, gleiches Ziel: Der erste Muscle-Up mit
    Kip schaltete beide frei, `muscleupStand()` lief durch bis 9, und im
    Tracker stand „Strikter Muscle-Up – ohne Schwung aus dem Hang" über einer
    Leistung, die genau das nicht war. Stufe 8 war damit nie ein Stand,
    sondern immer nur eine Zwischenstation. Bei Nils' erklärtem Hauptziel
    ausgerechnet die Meilensteinmeldung falsch.
    Der Test „Muscle-Ups max." fragt Wiederholungen ab, seine Hilfe sagt „Am
    Stück, ohne Absetzen" – über den Stil steht dort nichts. Sauberkeit ist
    ein Urteil, keine Zahl; dafür gibt es `manuell`, wie bei den Stufen 4 bis 7
    („Stange berührt das Brustbein"). Stufe 9 und 10 sind jetzt manuell, Stufe
    8 bleibt zählbar – der erste Muscle-Up überhaupt, gleich in welchem Stil.
    *Der Unterschied zum Klimmzug ist lehrreich:* Stufe 1 und 2 fordern
    ebenfalls „ohne Schwung" und hängen trotzdem zu Recht am Zähler – weil
    schon die **Testdefinition** „Ohne Schwung, voll ausgestreckt starten"
    lautet. Ein Zähler trägt eine Qualität nur, wenn sie in der Messvorschrift
    steht. Familie von Falle 4.
    **Geprüft wird jetzt der ganze Weg**, nicht ein Punkt darauf: Ein Test
    erfüllt Tor für Tor der Reihe nach und verlangt, dass der Stand genau
    mitzieht. Und weil das die Eigenschaft dahinter ist, verbietet ein zweiter
    Test zwei Stufen mit identischer Prüfung und identischem Ziel – das sind
    keine zwei Stufen, das ist eine.

21. **Eine Datenform, die zum Abschreiben einlädt, wird abgeschrieben.** In
    `app/fortschritt.js` standen drei Kopien aus `wissen.js`: die komplette
    Kraftmarken-Tabelle als `MARKEN`, die Stufenliste als `STUFEN` und die
    Schwellenprüfung noch einmal als `einordnung()` – Letztere direkt unter
    einem Kommentar, der davor warnt, dass eine zweite eigene Rechnung
    irgendwann abweicht. `kraftEinordnung()` im Kern rief dafür **niemand**
    mehr auf; sie war tot, und ihr `naechsteMarke` hat nie jemand gesehen.
    Der Grund fürs Abschreiben stand in der Datenform: `quelle: 'suchomel2016'`
    lag auf derselben Ebene wie die Übungen, `Object.entries(KRAFTMARKEN)`
    lieferte also eine Zeile „quelle" mit. Statt das zu lösen, kopierte jemand
    die Tabelle. Die Übungen liegen jetzt unter `uebungen`, die Oberfläche
    importiert Marken, Stufen und Einordnung – und zeigt nebenbei die nächste
    Marke an („solide · bis 156,6 kg"), die vorher schon berechnet wurde.
    Gefunden hat das nicht der Blick in die Oberfläche, sondern die Frage, wer
    eine Kernfunktion eigentlich aufruft. **Bei jeder Funktion in `kern/` lohnt
    ein `grep` nach ihrem Namen:** Findet sich nur der eigene Test, gibt es die
    Aufgabe entweder nicht mehr – oder zweimal. Zwei Wächtertests halten die
    Kopien jetzt fern; beide sind gegen die alte Fassung gegengeprüft, sonst
    wären sie so wertlos wie der Melder aus Falle 18.

22. **Ein stillschweigend verworfener Eintrag ist schlimmer als eine
    Fehlermeldung.** Gefunden über genau den `grep` aus Falle 21:
    `e1rmVerlaesslich()` hatte ebenfalls keinen Aufrufer. Der Grund war diesmal
    nicht Verdopplung, sondern eine Lücke – `einerMaxima()` überspringt Tests
    über zehn Wiederholungen mit einem nackten `continue`. Fachlich richtig,
    die Epley-Schätzung wäre dort unbrauchbar. Nur stand in der Kraft-Tabelle
    danach ein „–", genau dasselbe wie bei jemandem, der nie etwas eingetragen
    hat. Wer „Kniebeuge 100 kg × 15" einträgt und einen Strich sieht, sucht den
    Fehler bei sich, nicht bei der Rechenvorschrift. Jetzt steht dort, warum
    nichts geschätzt werden kann und was hilft: „Test mit 15 Wiederholungen –
    über 10 nicht schätzbar. Schwerer testen."
    Die Regel dahinter: **Wo Daten verworfen werden, gehört der Grund an die
    Stelle, an der das Ergebnis fehlt.** Ein `continue` ohne Spur ist bei
    Nutzereingaben kein Filter, sondern ein Datenverlust mit Ansage – dieselbe
    Familie wie die Sackgassen unten und wie das stille `.catch(() => {})` beim
    Speichern.

23. **Doppelte Progression gilt nur innerhalb eines Blocks.** In der
    Planansicht stehen zwei Zahlen für dieselbe Übung in derselben Zeile: die
    Lastvorgabe aus dem Prozentsatz des Einer-Maximums und darunter der
    Progressionsvorschlag aus dem Protokoll. Im Realisierungsblock
    (Explosivkraft, 30–60 % 1RM) stand unter der Vorgabe **„35–75 kg"** der Rat
    **„Last auf 110 kg erhöhen"** – beim Kreuzheben sogar 170 kg unter einer
    Vorgabe von 50–105 kg. Eine Woche später, zurück im schweren Block, genau
    andersherum: Vorgabe 100–110 kg, Vorschlag 80 kg.
    Ursache: `naechsteLast()` vergleicht mit der letzten protokollierten
    Einheit, ohne zu wissen, aus welchem Block die stammte. Verschärft dadurch,
    dass Maximal- und Explosivkraft **denselben oberen Wiederholungswert (5)**
    haben – „alle Sätze am oberen Ende", die Bedingung fürs Steigern, war über
    die Blockgrenze hinweg also immer erfüllt.
    Besonders heikel, weil ein Kommentar in `plan.js` die Rangfolge festlegt:
    „Der Vorschlag aus dem Protokoll schlägt die Prozentrechnung." Wer die Zahl
    liest, nimmt sie *statt* der Vorgabe – und macht aus Schnellkraftarbeit
    eine Maximalkrafteinheit. `naechsteLast()` bekommt jetzt die Vorgabe
    übergeben und nennt keine Zahl, wenn die letzte Last erkennbar außerhalb
    liegt; stattdessen steht dort, warum. Spielraum ist genau ein
    Hantelschritt: Innerhalb eines Blocks landet die Steigerung auf dem oberen
    Ende oder einen Schritt darüber, erst danach zieht das Einer-Maximum nach.
    *Zwei Folgefunde derselben Prüfung:* Der Plantext behauptete, Ganzkörper
    bei dieser Frequenz „liegt damit über den 10 Sätzen, ab denen die
    Dosis-Wirkung deutlich wird" – die eigene Volumenbewertung zählt bei Nils'
    Voreinstellung 8 von 11 Muskelgruppen **darunter**, bei drei Trainingstagen
    alle elf. Und `mitLast()` reichte den Vorschlag nur weiter, wenn er eine
    Zahl enthielt (`vorschlag?.empfehlung ? … : null`) – die Begründung fürs
    Fehlen einer Zahl fiel damit weg, und der Sprung von 105 auf 35–75 kg stand
    kommentarlos da. Dieselbe Familie wie Nr. 18 und 22.
    **Der Test dazu schließt den Kreis:** zwölf Wochen Plan, jede Woche
    protokolliert, was der Plan vorgibt, und der nächste Plan aus diesen Daten
    gebaut. Er verlangt, dass Vorgabe und Vorschlag in **keiner** Woche weiter
    als einen Hantelschritt auseinanderliegen. Gegen die alte Fassung schlägt
    er zwanzigmal an.

24. **Zwei einzeln richtige Zahlen können zusammen eine unbestehbare Note
    ergeben.** Wer genau das isst, was der Tracker als Kalorienziel vorgibt,
    bekam bei „Gewicht halten" die orange Warnung *„Zwischen 30 und 40 kcal/kg
    FFM – für einige Wochen vertretbar, auf Dauer zu wenig"*, dazu den Rat
    „Mehr essen, nicht mehr trainieren". Jeden Tag, in jeder geprüften
    Konfiguration.
    Der Grund ist eine Kürzung: Bei Erhaltung steckt das Training in der
    Aufnahme *und* im Abzug, also ist
    `EV = Alltagsfaktor × Grundumsatz / FFM`. Mit Cunningham wird daraus
    `Alltagsfaktor × (500 / FFM + 22)`; selbst beim höchsten Alltagsfaktor
    (1,5) reicht das nur bis **FFM ≈ 62,5 kg** für die Zielmarke 45. Nils liegt
    bei 68,9 kg fettfreier Masse – für ihn ist „gut" bei „halten" nicht
    erreichbar, egal was er tut. Dieselbe Familie wie die Monotonie in Falle 18,
    nur entstand sie hier aus dem **Zusammenspiel** zweier korrekter
    Entscheidungen: Die Alltagsfaktoren liegen bewusst unter den PAL-Werten,
    weil das Training separat dazukommt (Falle 5), und die 45 stammen aus der
    RED-S-Leitlinie mit anderer Bezugsgruppe. Einzeln ist keine falsch.
    Der Wert wird deshalb zusätzlich gegen den **eigenen Erhaltungsbedarf**
    gehalten: Wer den deckt, bekommt die Stufe `erhaltung` samt Begründung
    statt einer Mangelmeldung. **Die Grenze `kritisch` bleibt absolut** – dort
    geht es nicht mehr um Rechenmodelle, und ein Test besteht darauf, dass sie
    auch dann greift, wenn der Erhaltungsbedarf gedeckt ist. Ein zweiter Test
    prüft die Gegenrichtung: 500 kcal unter Bedarf muss weiter „knapp" heißen.
    *Zwei Funde derselben Prüfung:* `makros()` gab `fettProKg` als festen
    Zielwert 1,0 zurück, während im selben Objekt 174 g standen – 2,2 g/kg.
    Ein Überbleibsel aus der Zeit vor Falle 16, als das Fett vorgegeben war und
    die Kohlenhydrate der Rest; die Herleitung wurde gedreht, dieses Feld
    beschrieb weiter die alte. Und der Hinweis „Kohlenhydrate stehen am oberen
    Ende des Korridors, die übrigen Kalorien liegen im Fett" erschien an **84
    von 84 Tagen** – seit der Korridor die Kohlenhydrate bindet, ist das der
    Regelfall und keine Meldung wert. Die Zahl steht jetzt als Tatsache in der
    Erklärzeile neben dem Korridor. Über alle Reglerstände und Kalorienziele
    fiel die Zahl der Warnungen damit von 1995 auf 72 – und die verbliebenen
    betreffen echte Unterdeckung.

25. **Ein Rückstand vor der Bestzeit ist kein Abfall, sondern Anlauf.** Die
    Abbruchregel misst jeden Lauf gegen die Tagesbestzeit – und zwar gegen die
    beste der *ganzen* Einheit, auch gegen später gelaufene. Wer den ersten
    Sprint noch nicht ganz warm absolviert, bekam damit sofort Rot: Bei 3 %
    Rückstand stand `ersterAbbruch` auf 0, `qualitaetslaeufe` auf 0, und die
    Oberfläche meldete **„0/8 Läufe in Qualität"** mit dem Rat, dort
    aufzuhören – also gar nicht erst zu sprinten. Ab 3 % Aufwärmrückstand
    passierte das in jeder geprüften Serie.
    Das Bittere: `wissen.js` sagt es im eigenen Kommentar neben
    `minLaeufeFuerBewertung` – „der erste Lauf ist erfahrungsgemäß noch nicht
    der schnellste". Die Konstante schützt vor einer verfrühten *Bewertung*,
    nicht vor dieser Deutung.
    Das Gegenargument ist zwingend: **War ein späterer Lauf schneller, kann
    der frühere nicht ermüdungsbedingt langsam gewesen sein.** Erst ab der
    Bestzeit ist ein Abfall ein Abfall. Läufe davor bekommen die Stufe
    `anlauf` und in der Reihe ein neutrales Grau statt Rot – die Farbe war der
    sichtbare Teil des Fehlers. Die Live-Bewertung in `regeln.js` hatte das
    Problem nie: Sie sieht die späteren Läufe noch nicht und misst gegen die
    Bestzeit *bisher*.
    *Zweiter Fund derselben Prüfung, Familie Falle 15:* `ueberschuss` zählt die
    Läufe **ab** dem ersten Abbruch, der Text behauptete aber, es seien die
    Läufe **über** der Schwelle: „5 von 8 Läufen lagen mehr als 3 % über deiner
    Tagesbestzeit", wo genau einer drüber lag. Beides ist eine sinnvolle Größe,
    nur waren es nicht dieselbe. Der Text sagt jetzt „N Läufe kamen nach dem
    ersten Abfall über 3 %".

26. **Ein gedeckelter Grund kann „schlimmer" nicht ausdrücken.** Die
    Bereitschaft steuerte zu `entlastungFaellig()` genau *einen* Grund bei –
    ob drei von fünf Checks knapp unter der Marke lagen oder alle fünf auf dem
    Minimum standen, machte keinen Unterschied. Da zwei Gründe gefordert sind
    und die übrigen (ACWR, Ruhepuls, Monotonie) gar nicht auf das Befinden
    reagieren, war die Entlastung über das Wohlbefinden **nie** auslösbar: In
    der Simulation standen 84 Tage in Folge mit allen fünf Antworten auf 1 –
    also täglich „harte Einheit streichen" – und der Tracker sagte durchgehend
    nur „ein Zeichen im Blick behalten". Familie von Falle 10.
    Das Zwei-Gründe-Prinzip stammt vom **Ruhepuls** und ist dort richtig: Ein
    Infekt erzeugt dasselbe Bild, also trägt er allein keine Entscheidung. Auf
    den Morgen-Check übertragen trägt es nicht. Drei rote Tage unter den
    letzten fünf lösen die Empfehlung jetzt allein aus – nicht als neue Zahl,
    sondern über die Ampelschwelle, die es ohnehin gab.
    *Dabei aufgeräumt:* Die Schwellen 45, 65 und 60 standen als nackte Zahlen
    in `belastung.js`, keine davon in `wissen.js` – drei Werte auf derselben
    Skala an zwei Stellen. Sie heißen jetzt `BEREITSCHAFT`.
    *Und ein Widerspruch, den erst die Korrektur sichtbar machte:* Sobald die
    Entlastung wirklich auslöst, tut sie das auch **in einer geplanten
    Entlastungswoche** – mit dem Text „Eine Entlastungswoche jetzt kostet eine
    Woche". Man ist schon in einer. Die Zeichen sind deshalb nicht weniger
    wert, im Gegenteil: Dass sie *trotz* Entlastung dastehen, ist die
    eigentliche Nachricht. `entlastungFaellig()` bekommt die Lage jetzt
    übergeben und sagt das auch.
    **Die Lehre:** Ein Fehler kann einen zweiten verdecken. Solange die
    Entlastung praktisch nie ansprang, konnte niemand merken, dass ihr Text in
    jeder vierten Woche unsinnig ist. Nach jeder Korrektur, die etwas
    *häufiger* auslösen lässt, gehört ein zweiter Durchlauf hinterher.

27. **Eine Sicherung, die die App unbedienbar macht.** `pruefeImport()` prüfte
    die Hülle – `sessions` ist ein Array, `profil` existiert – und liess den
    Inhalt durch. Zwei Fälle hatten es in sich: `essen` als Objekt statt Array
    liess `daten.essen.filter` beim Aufbau des Zustands werfen, ein einzelnes
    `null` in `sessions` ebenso. **Der alte Bestand war da schon ersetzt.** Die
    App warf beim Öffnen, ließ sich nicht mehr bedienen, und die eigenen Daten
    waren weg – der teuerste Fehler, den dieser Tracker machen kann, teurer als
    jede falsche Zahl.
    Geprüft wird jetzt die Form jeder Liste und jedes Eintrags, mit Angabe der
    Stelle („1 Eintrag in ‚Tagebuch' ist leer oder unlesbar") und dem Satz, auf
    den es beim Zurückspielen ankommt: *dein bisheriger Stand bleibt
    unangetastet*. Nicht geprüft wird jeder einzelne Wert – bei 5000 Einträgen
    wäre das ein eigenes Vorhaben und würde wegen einer krummen Zahl alles
    verwerfen. Die Frage hier ist nur: Kann die App mit dieser Datei starten?
    *Und der Fund, der daneben lag:* Alte Sicherungen enthalten `null` im
    Gewichtsverlauf – die Fassung vor Falle 14 schrieb bei Komma-Eingabe ein
    NaN hinein, und `JSON.stringify` macht daraus `null`. Die Gewichtskarte
    rechnet stumpf „letzter − erster" und schrieb daraus **„null kg → 78,3 kg
    · +78,3 kg"**. Der Verlauf lässt solche Punkte jetzt weg und sagt, wie
    viele – weglassen ohne Ansage wäre Falle 22.
    **Die Lehre:** Bei jeder Stelle, die Daten *ersetzt* statt ergänzt, ist die
    erste Frage nicht „ist das plausibel", sondern „kann die App danach noch
    starten". Und die Meldung muss sagen, ob der alte Stand noch da ist.

28. **Ein `guete: 'praxis'` in `wissen.js` nützt nichts, wenn es am Gerät nicht
    ankommt.** Die Kernzusage des Projekts lautet: Wo es keine belastbare
    Studienlage gibt, wird das ausdrücklich gekennzeichnet und nicht
    stillschweigend behauptet. Das Kennzeichen stand an elf Konstanten – ob
    der Vorbehalt in der Oberfläche auftaucht, prüfte nichts.
    Bei der **Bereitschaft** tat er es nicht: eine Prozentzahl, eine farbige
    Ampel und ein konkreter Rat („Umfang um etwa ein Drittel kürzen") – das
    liest sich wie eine Messung. Seit Falle 26 hängt an denselben Schwellen
    zusätzlich die Entlastungsempfehlung. Der Satz steht jetzt unter der Karte,
    samt dem, was tatsächlich belegt ist (die Leistungswirkung des Schlafs,
    `mah2011`).
    *Dabei einen eigenen Fehler korrigiert:* Beim Aufräumen der
    Energieverfügbarkeit hatte ich `guete: 'praxis'` an den **ganzen** Block
    geschrieben – damit wären auch 30, 40 und 45 als unbelegt ausgewiesen
    worden, obwohl sie aus der RED-S-Leitlinie stammen. Trainerpraxis ist nur
    die Toleranz fürs Protokollrauschen; die Kennzeichnung sitzt jetzt dort.
    **Zwei Tests halten das fest:** einer verlangt für jede `praxis`-Konstante
    ihren Vorbehaltssatz im ausgelieferten Text, der andere prüft die
    Gegenrichtung zum bestehenden Quellentest – eine Quelle **ohne** Verweis
    steht in der Wissensansicht und stützt nichts mehr. Beide sind
    gegengeprüft: Jeder Vorbehalt wird in genau einer Datei gefunden, keiner
    trifft zufällig.

29. **Eine gelöste Falle ist nur dort gelöst, wo jemand hingesehen hat.** Ein
    Durchgang durch diese Liste mit der Frage „wo *sonst* noch?" brachte drei
    Wiederholungen an neuer Stelle:
    *Falle 10 in derselben Zeile, in der sie schon gelöst war.* Die
    Ernährungskarte zeigt oben „1.200 kcal zu viel" – das ist die korrigierte
    Fassung. Der Zusatz darunter lautete „4.200 von 3.000". Die große Zahl war
    gerichtet, der Nebensatz nicht, und beide baut dieselbe Funktion. Dafür
    gibt es jetzt `standText()` neben `saetzeStand()`: unter dem Ziel „3.000
    von 4.353", darüber „4.200, Ziel 3.000".
    *Falle 7 an genau der Kurve, die dort als Beispiel steht.* Die Tempokurve
    „Rad · Locker" bekam weiterhin ein „besser geworden", wenn das Tempo
    stieg. Gelöst war bisher nur die *Richtungsbestimmung* (erstes gegen
    letztes Drittel), nicht die Frage, ob eine Richtung überhaupt gut sein
    kann: In der lockeren Zone heißt schneller eher, dass die Einheit nicht
    mehr locker war – wovor dieselbe Ansicht ein paar Zeilen höher warnt.
    Gewertet wird jetzt nur die harte Zone. Ein Test verlangt, dass **jede**
    Kurve sich ausdrücklich entscheidet (`wertung` oder `kleinerIstBesser`);
    gegen die alte Fassung schlägt er an.
    *Falle 22 in der Intensitätsverteilung.* Eine Einheit ohne Puls und ohne
    brauchbares RPE fiel heraus: 120 Minuten weniger im Nenner, unveränderte
    Prozentzahlen und darunter „Alle Einheiten über RPE eingeordnet". Über den
    Dialog ist das nicht erreichbar (der RPE-Regler beginnt bei 1), über eine
    eingespielte Sicherung schon. Die Minuten werden jetzt gezählt und genannt.
    **Die Lehre:** Wenn eine Falle behoben wird, ist die Korrektur an *einer*
    Stelle passiert. Das Muster steckt fast immer noch woanders – und am
    ehesten dort, wo dieselbe Karte, dieselbe Funktion oder dasselbe Beispiel
    schon einmal auffiel.

30. **Der falsche Name überlebt die Korrektur.** Falle 15 endet mit dem Satz
    „hier stand sein Name schon daneben" – und genau dieser Name stand danach
    noch zwei Jahre weiter da. `gleicheLast` zählte längst *Stillstand*
    (gleiche Last **und** keine zusätzliche Wiederholung), hieß aber weiter
    nach der alten, falschen Bedeutung. Die Rechnung war richtig, die
    Einladung zum selben Irrtum blieb. Der Zähler heißt jetzt
    `ohneFortschritt`; die Testnamen sagten das ohnehin schon
    („Echter Stillstand wird weiterhin gezählt").
    *Falle 13 an drei Stellen im Wochenplaner:*
    `sprintmeterZiel` stand als zweite Herleitung derselben Größe neben
    `sprintmeter` – und der Kommentar darüber sagt ausdrücklich, dass beide
    auseinanderliegen dürfen, weil die Qualitätsgrenze den Umfang deckelt.
    Gelesen hat sie niemand; wer sie irgendwann anzeigt, zeigt die falsche.
    Entfernt. `wochenminuten` wurde zweimal aus demselben Array gerechnet –
    einmal fürs Rückgabeobjekt, einmal in `wochenHinweise`. Jetzt einmal und
    weitergereicht. Und die Schwelle, ab der „das ist viel" dasteht, war eine
    nackte **600** mitten im Warntext: eine fachliche Zahl außerhalb der
    einzigen Stelle für Zahlen. Die wiederkehrende Aufräumaufgabe, diesmal im
    Kern statt in der Oberfläche – dort lohnt derselbe Blick also auch.
    **Die Lehre:** Beim Beheben einer Falle wird die Rechnung gerichtet und der
    Name vergessen. Der nächste Leser glaubt dem Namen. Wer eine Bedeutung
    ändert, muss die Benennung mitziehen – sonst ist die Falle nur zugedeckt.

31. **Die Korrektur zu einer Falle hat dieselbe Falle enthalten.** Beim
    Beheben von Falle 27 kam `gewichtVerworfen` dazu, gebildet als
    `alle.length - gezeichnet.length`. Das zählte aber auch die Punkte mit,
    die bloß außerhalb der letzten 90 liegen: Bei **200 sauberen Wiegungen** –
    nach gut einem halben Jahr regelmäßigen Wiegens der Normalfall – stand in
    der Gewichtskarte *„110 Einträge ohne lesbares Gewicht … vermutlich aus
    einer älteren Sicherung"*. Kein einziger davon war unlesbar. Ein Zähler,
    der etwas anderes zählt als sein Name sagt – Falle 15, in der Korrektur zu
    Falle 27, geschrieben von jemandem, der die Liste kannte.
    Derselbe Ausdruck stand zudem zweimal da, einmal je Rückgabefeld: Falle 13
    gleich mit. `gewichtsverlauf()` gibt jetzt Punkte **und** Zahl der
    Unbrauchbaren aus einem Durchlauf zurück.
    **Zwei Lehren.** Erstens: *Der Test war zu klein.* Er prüfte mit vier
    Einträgen – unterhalb jeder Fenstergrenze. Wer eine Zahl prüft, muss sie
    über die Grenzen prüfen, an denen sie sich ändert. Zweitens: Eine
    Korrektur ist neuer Code und verdient denselben Blick wie alter. Die
    Fallenliste zu kennen schützt nicht davor, sie anzuwenden zu vergessen.

32. **Ränder prüfen, nicht Beispiele.** Nach Falle 31 sind alle Korrekturen der
    letzten Runden noch einmal an ihren Rändern durchgerechnet worden – nicht
    an einem Beispiel, sondern dort, wo sich das Verhalten ändert. Zwei Funde:
    *Der Nenner enthielt Unbewertbares.* „3 der letzten 5 Morgen-Checks im
    roten Bereich" – waren zwei davon unvollständig ausgefüllt, sind es in
    Wahrheit 3 von 3, also **alle**. Der Satz sah nach 60 % aus. Bei einer
    Zahl, die seit Falle 26 eine Entlastungswoche auslöst, ist das keine
    Kosmetik: Das Y muss dieselbe Grundmenge meinen wie das X.
    *`strain` war die dritte tote Zwillingszahl* – berechnet, nie gelesen,
    neben `sprintmeterZiel` und `session.last`. Entfernt.
    **Offen und bewusst so gelassen:** Die Monotonie ist nach oben unbegrenzt,
    weil die Streuung im Nenner steht. Sieben Trainingstage mit 55–65 Minuten –
    ein plausibles Muster – ergeben **15,25**, fast identische Tage **122,11**,
    beides neben einer Schwelle von 2,0. Die *Note* stimmt in allen Fällen, und
    eine realistisch gemischte Woche liefert brauchbare 2,12. Ein Deckel wäre
    eine erfundene Zahl; deshalb steht hier nur, dass die Ziffer an diesem Ende
    keine Messung mehr ist, sondern ein Artefakt der kleinen Streuung.

33. **Was nicht falsch ist, kann trotzdem unbenutzbar sein.** Alle Prüfungen
    bisher fragten „stimmt die Zahl?". Die Ansichten `essen`, `wissen` und
    `profil` waren dabei nie **angesehen** worden – `breite.mjs` und
    `konsole.mjs` liefen zwar durch, aber die melden Überlauf und Fehler, nicht
    Unbrauchbarkeit.
    Die Wissensansicht war **9.582 px hoch – 11,4 iPhone-Bildschirme**, davon
    allein 6.649 px die Karte „Quellen": 28 Arbeiten ausgeschrieben, fünf
    Zeilen je Arbeit, in *einer* Karte ohne eine einzige Zwischenüberschrift.
    Sachlich alles richtig; zum Nachschlagen unbrauchbar, weil man daran
    vorbeiscrollt statt etwas zu finden. Der Screenshot ließ sich nicht einmal
    aufnehmen – `Page.captureScreenshot` kam bei der Höhe nicht zurück, und
    genau das war der erste Hinweis.
    Die Quellen sind jetzt einzeln zusammengeklappt (`<details>`, kein
    JavaScript, keine Abhängigkeit): sichtbar bleiben Kurzangabe und
    Güte-Abzeichen, also genau das, wonach man überfliegt. Die Ansicht kam
    damit auf 4.691 px. Die Zusammenfassung ist antippbar und hält die
    44 Pixel; ein Test hält beides fest.
    *Nebenbefund derselben Messung* – Höhe je Ansicht bei zwölf Wochen Daten,
    als Vergleichswert für später: heute 4.413 · plan 6.875 · essen 1.400 ·
    fortschritt 5.577 · profil 3.418 · wissen 4.691 px.
    **Nachgemessen am 10.08.2026**, nach Falle 40: heute 4.234 · plan **1.605**
    · essen 973 · fortschritt 4.793 · profil 3.418 · wissen 4.691 px. Die
    Planansicht war der letzte offene Punkt aus dieser Messung.
    **Die Lehre:** Ein Werkzeug, das Überlauf und Konsolenfehler prüft, sagt
    nichts über Benutzbarkeit. Die Seitenhöhe zu messen kostet zehn Sekunden
    und findet, was kein Test findet.

34. **Wer die Oberfläche prüft, muss sie ansehen – nicht raten.** Die
    Eingabedialoge waren nie im Browser bedient worden, obwohl dort die
    teuersten Fehler des Projekts sitzen (Falle 14, das gebündelte Schreiben).
    Ergebnis: **Sie tragen alle.** Ein Komma kommt über Gewicht, eigenes
    Lebensmittel und Morgen-Check korrekt in der Datenbank an, der Check
    überschreibt die übrigen Antworten nicht, und die Blöcke im Protokoll
    folgen der Auswahl im Dialog statt dem Plan.
    Bemerkenswert war der Weg dorthin: **Drei Fehlalarme in Folge, alle
    meine.** Ich hatte die Feldreihenfolge im Essensdialog geraten (sie ist
    Name, kcal, Protein, KH, Fett, Menge – nicht wie im Formular gelesen), den
    Eintrag vom vorigen Lauf gefunden statt des neuen, und im Protokolldialog
    das *erste* Auswahlfeld bedient – das gehört aber dem Sprintblock („aus dem
    Stand" / „fliegend"), der im DOM vor der Einheitenart steht. Jedes Mal sah
    es nach einem Fehler in der App aus.
    **Die Lehre:** Beim Prüfen über das DevTools-Protokoll ist die
    Fehlerquelle zuerst die Prüfung. Vor jeder Meldung „die App macht X
    falsch" den Dialoginhalt einmal ausgeben lassen und den Code der Stelle
    lesen – zwei Minuten, die drei falsche Befunde verhindern.
    Der Durchlauf steckt jetzt als `werkzeug/dialoge.mjs` in der Werkzeugkiste
    und gibt einen Exitcode zurück.

35. **Eine Dauer, die den Inhalt nicht kennt, ist eine Behauptung.** Die
    Krafteinheit dauerte `15 + Übungen × 9 + Prophylaxe × 4` – eine Formel ohne
    Sätze darin. Ergebnis: **76 Minuten in jeder einzelnen Woche**, in der
    Entlastungswoche mit 10 Sätzen genauso wie in der Spitzenwoche mit 13. Das
    wäre eine Beschriftungsfrage, wenn die Minuten nur dastünden; sie gehen aber
    über `einheitenAmTag()` in den **Kalorienbedarf** und über die Wochensumme
    in den Hinweis „viel Training". Der Tracker rechnete also für einen
    Entlastungstag das Essen einer Spitzenwoche.
    *Der zweite Teil war schlimmer.* `angepassteEinheit()` kürzt bei schlechter
    Bereitschaft die Sätze einzeln und lässt Aufwärmen und Prophylaxe
    ausdrücklich stehen – die Minuten multiplizierte sie aber pauschal mit dem
    Faktor. Bei roter Ampel stand deshalb „38 min" über einer Einheit, deren
    *ungekürzte* Teile allein schon 27 Minuten ergeben, plus acht Sätze. Die
    Dauer kommt jetzt aus `kraftMinuten()`, das beide Stellen benutzen, und die
    Zahlen dafür aus `KRAFT.dauer` (Praxis, mit Begründung: Maximalkraft
    braucht die volle Pause, Hypertrophie nicht).
    *Dabei aufgefallen:* Weil die Minuten pauschal fielen, sahen Gelb (51 min)
    und Rot (38 min) nach zwei verschiedenen Einheiten aus. Sie sind es nicht –
    bei zwei Sätzen je Übung ergeben „ein Drittel weniger" und „die Hälfte
    weniger" dieselbe Vorgabe, weil unter einem Satz nichts mehr geht. Der Text
    behauptet deshalb keinen Bruchteil mehr, sondern nennt die Sätze: „Umfang
    von 13 Sätzen auf 8 herunter". Wo eine Kürzung als Prozentsatz auftritt,
    lohnt die Frage, ob der Inhalt ihn überhaupt hergibt.

36. **Dieselbe Periodisierung an zwei Stellen wirkt zweimal.** Der
    Sprintumfang stand als `SPRINT.wochenumfangMeter` **je Phase** in
    `wissen.js` (1000 / 900 / 700 / 450 m) – und der Planer multiplizierte das
    noch einmal mit `PHASEN[…].volumenFaktor` (1,0 / 0,8 / 0,6 / 0,5). Geplant
    wurden also 1000 / 720 / 420 / **225** m. Die Entlastungswoche bekam nie
    ihre 450 m, sondern die Hälfte davon; die Realisierungsphase 420 statt 700.
    Ausgerechnet der Kommentar über der Tabelle wiegt diese Werte gegen
    Haugen 2019 ab („bewusst darunter") – gegen Zahlen, die der Plan nie
    verwendet hat. Familie von Falle 11 und 16.
    *Die Auflösung war nicht die naheliegende.* Einfach `× volumen` streichen
    hätte Intensivierung und Realisierung **gleich** gemacht: Beide liegen
    dann über der Qualitätsgrenze von 12 Läufen je Einheit, und die deckelt
    auf dieselben 720 m. Die Abstufung entstand also faktisch erst durch die
    Doppelrechnung. Geändert wurde deshalb die Tabelle auf das, was
    tatsächlich geplant wird, und die zweite Multiplikation entfernt – **der
    Plan bleibt Meter für Meter derselbe**, aber die Zahl, an der die Literatur
    gemessen wird, steht jetzt wirklich in `wissen.js`. Nur der
    Wiedereinstiegsfaktor multipliziert noch, denn der ist keine
    Periodisierung.
    *Was dadurch sichtbar wurde und Nils entscheiden muss:* 225 m sind bei zwei
    Sprinttagen vier Läufe je Einheit – genau die Untergrenze, die der Planer
    nicht unterschreitet. Die Entlastungswoche liegt auf dem Anschlag.
    **Und aus derselben Wurzel:** Der Hinweis „Entlastungswoche: Umfang
    halbiert" war schlicht falsch – die Minuten fallen um 30 %, die Sätze um
    23 %, weil Sätze eine Untergrenze haben und das Aufwärmen nicht gekürzt
    wird. Der Bruchteil ist raus, bei `PHASEN.entlastung.beschreibung`
    ebenfalls. Ein Faktor in einer Konstante ist noch keine Aussage darüber,
    was am Ende herauskommt.

37. **Ein Faktor, der nur die Zahl bewegt und nicht den Inhalt.** Falle 35
    hatte eine Dauer erwischt, die ihren Inhalt nicht kannte. Die Gegenfrage
    – „wo bewegt sich die Zahl, aber nicht das, was danebensteht?" – brachte
    zwei weitere Stellen, beide sichtbar auf dem Gerät:
    *Die Intervalleinheit* rechnete `minuten = 45 × volumen + 15`, während ihre
    Blöcke in **jeder** Woche „5 × 3 min hart / 3 min locker" beschrieben und
    zusammen konstant 55 Minuten ergaben. In der Entlastungswoche stand damit
    „38 min" über exakt derselben Einheit, die in der Spitzenwoche „60 min"
    hieß – dieselbe Arbeit, zwei Behauptungen, und die kleinere ging in den
    Kalorienbedarf. Die Zahl der Intervalle folgt jetzt dem Volumen (5 / 4 / 3),
    die Dauer folgt den Intervallen. Ein- und Ausfahren werden nicht gekürzt,
    aus demselben Grund wie das Aufwärmen beim Sprint.
    *Die gekürzte Sprinteinheit* war der schlimmere Fall: `angepassteEinheit()`
    multiplizierte `meter` und die Blockminuten mit dem Faktor, ließ die
    Überschrift aber stehen. Im Kopf stand **„322 m"**, im Block **„16 × 30 m,
    aufgeteilt in 4 Sätze à 4"** – also 480 m. Wer die Einheit liest, läuft die
    16; gezählt wurden 322. Und 322 sind nicht durch 30 teilbar: Eine
    Sprinteinheit besteht aus ganzen Läufen, eine krumme Meterzahl kann es gar
    nicht geben. Die gekürzte Fassung wird jetzt von `sprinteinheit()` neu
    gebaut statt danebengerechnet – 330 m und „11 × 30 m", aus einer Quelle.
    *Dabei mitgenommen:* `sprinteinheit(phase, meter, profil)` hatte einen
    dritten Parameter, den niemand liest (Falle 30). Er musste weg, damit die
    Anpassung die Funktion überhaupt aufrufen kann – ein toter Parameter ist
    nicht nur Ballast, er versperrt die Wiederverwendung.
    **Der Wächter dazu ist allgemein**, nicht auf diese zwei Fälle gemünzt:
    Für jede Einheit jeder Woche in fünf Ausrichtungen, in geplanter *und*
    angepasster Fassung, muss `minuten` die Summe der Blockminuten sein und
    `meter` das Produkt aus Läufen und Distanz, wie es in der Überschrift
    steht. Gegen die alte Fassung schlägt er in beiden Fällen an.
    *Und die Zahlen sind umgezogen:* `distanz = 30` stand als nackte Zahl in
    `plan.js` – ausgerechnet die Regel, an der die gesamte Sprintplanung hängt
    („Volumen über Sätze, nie über längere Läufe"). Jetzt `SPRINT.distanzMeter`,
    zusammen mit `laeufeProSatz` und `satzPauseMinuten`. Damit leiten alle drei
    Einheitenarten ihre Dauer aus `wissen.js` her und keine mehr aus sich selbst.

38. **Ein interner Schlüssel als deutsche Überschrift.** Der zweite Faden aus
    der Übergabe – „wer ruft diese Kernfunktion eigentlich auf?" – ist einmal
    über alle `kern/`-Module gezogen worden. Vier Funktionen hatten **keinen
    einzigen Aufrufer**, und wie in Falle 21 hieß das nicht „überflüssig",
    sondern „woanders nachgebaut":
    `gruppenName()` (kern/sprint.js) und `verlaufName()` (kern/ausdauer.js)
    standen als Kopie in `app/fortschritt.js`, die Sprintaufschrift sogar an
    drei Stellen, eine vierte in `app/protokoll.js`. **Und die Kopie war schon
    abgewichen:** Eine Ausdauereinheit ohne Puls und ohne brauchbares RPE
    bekommt den Schlüssel `rad-unbekannt`; da `AUSDAUER_ZONEN` dafür keinen
    Eintrag hat, stand als Überschrift wörtlich **„Rad · unbekannt"** – ein
    interner Schlüssel in einer sonst durchweg deutschen Oberfläche. Die
    Kernfunktion sagt „ohne Zone" und wurde nie aufgerufen.
    Dass so eine Einheit überhaupt vorkommt, ist derselbe Fall wie in Falle 29:
    über den Dialog nicht erzeugbar (der RPE-Regler beginnt bei 1), über eine
    eingespielte Sicherung schon. Unter der Kurve steht jetzt auch, **warum**
    keine Zone bestimmbar ist – Falle 22, dieselbe Familie.
    Die beiden anderen waren echte Zwillinge und sind entfernt:
    `phaseDerWoche()` rechnete dasselbe wie `phaseSchluessel()` und gab das
    Phasenobjekt zurück, `tagesLast()` dasselbe wie `lastProTag()` im Kleinen.
    Für `tagesLast()` gab es sogar einen Test – der prüft jetzt denselben
    Rechenweg an der Stelle, die der Kern wirklich benutzt.
    **Der Wächter** verbietet die vier Kopien namentlich; gegen die alte
    Fassung schlägt er an. Und der Suchlauf selbst ist eine Zeile Shell wert:
    für jede `export function` in `kern/` zählen, wie oft ihr Name außerhalb
    der eigenen Definition in `kern/`, `app/` und `werkzeug/` vorkommt. Steht
    da null, ist etwas zu klären. Nach dieser Runde steht überall mindestens
    eins.

39. **Die App tat selbst, wovor sie den Nutzer warnte.** `app/speicher.js` und
    `app/daten.js` waren die letzten nie durchgesehenen Dateien – und dort
    saßen die beiden teuersten Fehler des Projekts, beide in den Notfallwegen,
    die niemand je durchgespielt hatte.
    *Erstens: Ein Lesefehler löschte den Bestand.* Scheitert `laden()`, setzt
    es den Zwischenspeicher auf ein **leeres Tagebuch** und meldet das – und
    der nächste Eintrag schreibt genau dieses leere Tagebuch über die Daten.
    Ein Datensatz, der sich nicht lesen lässt, lässt sich sehr wohl
    überschreiben. Gemessen: 72 Einheiten und 48 Morgen-Checks wurden zu null,
    mit der Meldung **„Gewicht gespeichert."** darüber. Der Kommentar über
    `laden()` warnt wörtlich davor, dass in diesem Zustand niemand eine
    Sicherung darüberspielen darf – gegen den Nutzer war das abgesichert,
    gegen die App selbst nicht. Nach einem Lesefehler wird jetzt nicht mehr
    geschrieben; nur `ersetzen()` darf es, weil der Bestand dort vollständig
    aus der Datei des Nutzers kommt und nicht aus dem gescheiterten Lesen.
    *Zweitens: Bei einem Schreibfehler war der eigene Rat unausführbar.* Die
    Warnung lautet „Lade unter Profil sofort eine Sicherung herunter, solange
    die Daten noch geladen sind" – und `sicherungsDatei()` begann mit
    `jetztSchreiben()`. Das scheiterte, warf, und es entstand **keine Datei**.
    Genau die Sackgassen-Familie aus dem Abschnitt weiter unten, nur an der
    teuersten Stelle: Der einzige Rettungsweg war ausgerechnet dann gesperrt,
    wenn man ihn braucht. Das Wegschreiben ist dort nur ein zweites Netz –
    scheitert es, wird die Sicherung trotzdem gebaut.
    **Die Lehre:** Bei jeder Fehlerbehandlung nicht nur fragen „meldet sie
    das?", sondern „ist der Rat, den sie gibt, in diesem Zustand überhaupt
    ausführbar?" – und „was tut die App als Nächstes von selbst?". Beide
    Antworten waren hier falsch, und beide Wege standen in den Kommentaren
    ausführlich beschrieben.
    Nachstellbar sind sie über das DevTools-Protokoll, indem man
    `IDBObjectStore.prototype.get` bzw. `.put` scheitern lässt: als
    `werkzeug/lesefehler.mjs` und `werkzeug/ablage.mjs` in der Werkzeugkiste,
    beide mit Exitcode und beide gegen die alte Fassung gegengeprüft.
    *Beim Bauen selbst hineingetappt:* Ein über
    `Page.addScriptToEvaluateOnNewDocument` eingeschleustes Skript überlebt das
    Prüfskript. Der zurückgelassene Schreibfehler legte den nächsten Lauf von
    `saeen.mjs` lahm und erzeugte im zweiten Abschnitt einen Befund, den die
    Prüfung selbst verursacht hatte – Falle 34, wörtlich.

40. **Dieselbe Karte, zwei verschiedene Aufgaben.** Die Planansicht war
    6.834 px hoch, davon **4.856 in den beiden Tagen mit Sprint und Kraft** –
    man scrollte an Donnerstag vorbei, statt ihn zu finden. Ursache war keine
    Nachlässigkeit, sondern eine geteilte Funktion: `einheitKarte()` bedient
    „Heute" und den Wochenplan, und beide bekamen den vollen Übungszettel.
    Für „Heute" ist das richtig – dort steht man mit dem Handy zwischen zwei
    Sätzen. Im Wochenplan zählt die Form der Woche: welcher Tag, welche Art,
    wie lange, wie viel. Der Zettel dazu steht in „Heute" ohnehin schon.
    Die Tageskarten sind jetzt `<details>` – wie die Quellen in Falle 33,
    ohne Abhängigkeit und ohne JavaScript. Die Zusammenfassung trägt Tag,
    Einheiten und Dauer („Mo · Sprint · Kraft (Ganzkörper) · 3 h 21 min"), denn
    ohne die wäre Zuklappen ein Verlust statt einer Ordnung. **1.605 px**,
    die Woche passt auf einen Bildschirm.
    *Einmal falsch abgebogen und wieder zurück:* Zuerst stand der heutige Tag
    offen aufgeklappt – „wer den Plan an einem Trainingstag öffnet, sucht
    genau ihn". Das machte die Ansicht wieder 3.974 px hoch und widersprach
    der eigenen Begründung: Ausgerechnet den heutigen Tag zeigt „Heute"
    vollständig. Wenn eine Ausnahme die Begründung der Regel aushebelt, ist
    die Ausnahme falsch.
    **Die Lehre:** Wo zwei Ansichten sich einen Baustein teilen, lohnt die
    Frage, ob sie dieselbe Aufgabe haben. Hier hatten sie es nicht, und die
    Zahl dazu stand seit Falle 33 gemessen da – nur hatte niemand sie
    aufgegriffen.

41. **Der Wächter über das Kernversprechen war eine getippte Liste.** Das
    Versprechen dieses Trackers lautet: Wo es keine belastbare Studienlage
    gibt, steht das ausdrücklich dabei. Falle 28 hat dafür einen Test gebaut –
    und der zählte **sieben** Konstanten auf, von Hand eingetragen. In
    `wissen.js` stehen **fünfzehn**. Acht trugen ihren Vorbehalt nirgends am
    Gerät, und keine davon konnte den Test je durchfallen lassen: Was er nicht
    kennt, meldet er nicht (Falle 18, an der empfindlichsten Stelle des
    Projekts).
    Der Test zählt jetzt selbst und verlangt zu **jeder** `praxis`-Konstante
    eine Entscheidung, auch zu jeder, die morgen dazukommt. Die acht fehlenden
    Sätze stehen jetzt dort, wo die Zahl auftaucht:
    Interferenzfaktoren und die sechs Stunden Abstand („die Rangfolge ist
    belegt, die einzelnen Zahlen sind Erfahrungswerte"), die Prozentmarken der
    Grauzone, die drei Dauerberechnungen aus den Fallen 35 bis 37 – die in den
    **Kalorienbedarf** gehen –, die Schwelle für „viel Training", der
    Spielraum bei der Energieverfügbarkeit und der voreingestellte RPE-Wert.
    Der letzte ist der heikelste: RPE × Minuten *ist* die Belastungszahl, und
    ein vorbelegter Regler sieht aus, als wüsste der Tracker, wie hart es war.
    *Zwei Handwerksfunde dabei:* Zwei Kennzeichen heißen
    `protokollrauschenGuete` und `hinweisAbWochenminutenGuete`, weil sie nur
    für einen Teil ihres Blocks gelten – eine Suche nach dem Feldnamen `guete`
    übersieht sie, auch meine erste. Und der Test verglich gegen den
    **Quelltext**, in dem Sätze über `' + '` umbrechen; deshalb stand dort ein
    Muster wie `/gängige Praxis,\s*'?\s*\+?…/`, das beim nächsten Umbruch
    wieder gebrochen wäre. Zusammengesetzte Zeichenketten werden jetzt vor dem
    Vergleich zusammengefügt, und die Muster sind wieder lesbare Sätze.

42. **Eine erfundene Mitte zwischen zwei belegten Marken.**
    `KRAFT.saetzeProMuskelWoche` führte `{ minimum: 10, ziel: 14,
    obergrenze: 20 }` – dieselbe Größe wie `VOLUMEN` (10 / 20), nur mit anderen
    Feldnamen. Gelesen wurde davon einzig `minimum`; `ziel` und `obergrenze`
    rief niemand auf, und das ganze Objekt wurde obendrein an die Oberfläche
    geschickt, wo es ebenfalls niemand las.
    Der Zielwert 14 hatte zudem **keine Quelle**: Weder Schoenfeld 2017 noch
    Pelland 2025 nennen ihn – sie beschreiben einen Anstieg mit abnehmendem
    Grenzertrag. Eine erfundene Mitte zwischen zwei belegten Marken ist genau
    das, was dieser Tracker nicht tun soll. Entfernt, ein Test hält die zweite
    Tabelle fern.
    *Dabei die Begründung nachgezogen:* Der Plan behauptet im Fließtext, beim
    Schwerpunkt Kraft und Sprint zähle „die Last mehr als die Satzzahl" –
    richtig, aber unbelegt dastehend. Pelland 2025 (67 Studien) steht in
    `wissen.js` und sagt genau das: Der abnehmende Grenzertrag ist für
    Maximalkraft ausgeprägter als für Muskelmasse. Die Quelle steht jetzt im
    Satz. Wer eine Trainingsentscheidung begründet, soll sie nachschlagbar
    begründen.

43. **Das Hauptziel wurde angezeigt, aber nicht geplant.** `muscleupStand()`
    rechnet Stufe für Stufe aus, wo Nils auf dem Weg zum Muscle-Up steht, samt
    konkretem Tor („5 negative Muscle-Ups kontrolliert"). Der **Planer sah das
    nie**: Auf Stufe 1 stand dieselbe Klimmzugvorgabe wie auf Stufe 7 – 3 × 6–12
    ohne ein Wort dazu, worauf das hinarbeitet. Das erklärte Hauptziel des
    Trackers war damit eine Anzeige in der Fortschrittsansicht und sonst nichts.
    Der Stand steckt jetzt im Leistungsstand, den der Planer ohnehin bekommt,
    und die Zugübung nennt das nächste Tor. **Bewusst nur ein Satz und keine
    zusätzlichen Sätze:** Die Dosis ist eine Trainingsentscheidung und gehört
    Nils (siehe unten). Die Ausführung zu benennen ist keine – dieselben zwölf
    Wiederholungen mit Blick auf das nächste Tor sind mehr wert als zwölf ohne.
    *Zwei Funde auf dem Weg dahin.* Erstens wurde das Argumentobjekt für
    `muscleupStand()` an **drei** Stellen von Hand zusammengesetzt – in
    `zustand.js`, in `aendern.js` und beinahe ein viertes Mal von mir. Vier
    Felder, drei Fassungen: Familie von Falle 13, nur mit größerer Angriffsfläche.
    Es gibt jetzt `muscleupStandAus(daten)`, und `zustand.js` liest den Stand
    aus dem Leistungsstand statt ihn erneut herzuleiten.
    Zweitens stand der Satz nach dem ersten Wurf unter Klimmzügen **und** unter
    Dips – zweimal dasselbe in einer Einheit, und bei Stufe 5
    („Straight-Bar-Dips") auch noch unter der falschen der beiden. Die Stufen
    tragen jetzt ein Feld `uebung`; ein Test verlangt, dass jede Stufe an einer
    Übung des Plans hängt und der Satz genau einmal je Einheit vorkommt.

44. **376 Tests sagen nichts darüber, wie viel sie festhalten.** Alle
    Prüfungen dieses Projekts fragen „rechnet der Kern richtig?". Die
    Gegenfrage – „wenn ich ihn absichtlich kaputt mache, merkt es jemand?" –
    hatte nie jemand gestellt. `werkzeug/mutieren.mjs` stellt sie: Es
    vertauscht im Kern einen Vergleich (`>=` gegen `>`, `&&` gegen `||`,
    `Math.max` gegen `Math.min`), lässt die volle Suite laufen und schaut nach,
    ob etwas fällt.
    Ergebnis: **131 von 222 Verfälschungen blieben unbemerkt – 59 %.**

    | Datei | Stellen | unbemerkt (vorher) |
    | --- | --- | --- |
    | `belastung.js` | 41 | 23 |
    | `plan.js` | 32 | 16 |
    | `leistung.js` | 32 | 15 |
    | `ausdauer.js` | 23 | 18 |
    | `aktivitaet.js` | 22 | 12 |
    | `ernaehrung.js` | 20 | 15 |
    | `regeln.js` | 16 | 7 |
    | `zustand.js` | 15 | 11 |
    | `profil.js` | 12 | 6 |
    | `sprint.js` | 7 | 6 |
    | `aendern.js` | 2 | 2 |

    Die Überlebenden haben ein klares Muster: Es sind fast durchweg **Ränder**.
    Die vorhandenen Tests prüfen die Mitte eines Bereichs, nicht seine Kante –
    und acht der Fallen in dieser Liste (6, 10, 17, 18, 19, 24, 25, 31) sitzen
    genau auf einer Schwelle. Das ist keine Kleinigkeit: Hinter diesen Grenzen
    stehen farbige Urteile über zu wenig Essen, zu viel Grauzone, abgebrochene
    Sprintserien.
    `test/raender.test.js` schließt die Lücke dort, wo hinter der Schwelle eine
    *Empfehlung* steht – neunundzwanzig Tests, siebenunddreißig tote
    Verfälschungen, Stand jetzt **94 von 222**. Abgearbeitet sind Energieverfügbarkeit,
    Grauzone, Sprintbewertung, Kraftverlauf, Epley-Grenze, Profilgewicht,
    Ampel der Bereitschaft, Ruhepulsstufen, die Drei-rote-Checks-Regel aus
    Falle 26, die Satz-Untergrenzen im Plan, die Satzaufteilung im Sprint, die
    Benotungsschranke und die obere Marke „zu viel hart" aus Falle 6, die
    Fensterkante der Auswertung, die doppelte Progression samt Blockerkennung
    aus Falle 23, die Volumenmarken und die Plausibilitätsgrenzen des
    Dateiimports.

    | Datei | Stellen | vorher | jetzt |
    | --- | --- | --- | --- |
    | `belastung.js` | 41 | 23 | 12 |
    | `leistung.js` | 32 | 15 | 10 |
    | `ausdauer.js` | 23 | 18 | 13 |
    | `aktivitaet.js` | 22 | 12 | 10 |
    | `plan.js` | 32 | 16 | 12 |
    | `ernaehrung.js` | 20 | 15 | 11 |
    | `regeln.js` | 16 | 7 | 7 |
    | `zustand.js` | 15 | 11 | 7 |
    | `profil.js` | 12 | 6 | 6 |
    | `sprint.js` | 7 | 6 | 5 |
    | `aendern.js` | 2 | 2 | 1 | Nicht alle übrigen sind Lücken: `sort((a, b) => a.datum <
    b.datum ? -1 : 1)` verhält sich mit `<=` bei eindeutigen Daten identisch,
    das ist eine gleichwertige Verfälschung und kein ungeprüfter Rand. Wer
    weitermacht, sortiert die Liste am besten danach, ob hinter der Grenze eine
    Empfehlung steht.
    *Nicht jeder Überlebende ist eine Lücke, und der Grund ist lehrreich.* Die
    Bereitschaft kann nur Vielfache von 4 % annehmen (fünf Antworten zu je 1–5),
    die Schwellen stehen aber auf 45 und 65. **Diese Werte werden nie
    erreicht** – auf einem Raster ohne Punkt bei 45 sind `<` und `<=`
    ununterscheidbar, die Verfälschung ist gleichwertig. Wirksam ist die Grenze
    als „44 % rot, 48 % gelb". Das ist kein Fehler, aber eine Angabe, die
    genauer aussieht als sie ist; der Hinweis steht jetzt bei den Konstanten.
    Bei jeder überlebenden Verfälschung lohnt deshalb zuerst die Frage, ob der
    Wert am Rand überhaupt vorkommen *kann*.
    *Zwei Funde nebenbei, beide aus dem Werkzeug heraus:* Der Kraftverlauf
    nimmt `Math.max(...werte)` je Einheit – mit `Math.min` hätte die Kurve
    systematisch den schwächsten Satz gezeigt, und **kein Test hätte es
    gemerkt**. Und dass eine Wiegung von *heute* das Profilgewicht mitzieht,
    prüfte bis dahin nur `werkzeug/dialoge.mjs` im Browser; im Kern war der
    Rand offen.
    **Zwei eigene Fehler, beide behoben und beide lehrreich.** Ein
    abgebrochener Lauf ließ `kern/belastung.js` verfälscht im
    Arbeitsverzeichnis liegen – einen Commit davon entfernt, eine kaputte
    Bedingung ins Repository zu schreiben; das Werkzeug legt jetzt auch bei
    Abbruch zurück. Und ich hatte zwei Läufe gleichzeitig gestartet, die beide
    in `kern/` schrieben: Dann sieht die Suite zwei Verfälschungen auf einmal,
    und ein Test, der wegen der einen fällt, macht die andere fälschlich zur
    „bemerkten". **Die Zahlen aus dieser Phase waren zu gut** (ausdauer 12
    statt 18) und sind neu gemessen worden. Ein Messwerkzeug, das sich selbst
    stört, misst Unsinn und sagt es nicht – jetzt verhindert ein Schloss den
    zweiten Lauf.


45. **Ein Knopf, der nichts tut, ist schlimmer als keiner.** Auf Nils'
    Bildschirmfoto fiel es sofort auf: In der Muscle-Up-Karte hat jede Stufe
    einen Knopf „geschafft" – **außer 1, 2, 3 und 8**. Ein Loch mitten in einer
    Reihe gleicher Bedienelemente liest sich als Fehler, nicht als Regel. Die
    Regel gibt es zwar (jene Stufen zählt ein Test, siehe Falle 20), sie stand
    nur nirgends. Jetzt steht unter der Zeile, woher sie kommt: „Ergibt sich
    aus deinem Test „Klimmzüge max."".
    *Der zweite Fund war der schwerere.* Wer auf einer noch nicht erreichbaren
    Stufe „geschafft" tippte – etwa Stufe 9, während Stufe 1 offen ist –,
    bewirkte **gar nichts**. Die Bestätigung wurde gespeichert, der Stand
    konnte sich nicht bewegen, und die Oberfläche leitete ihre Häkchen allein
    aus dem Stand ab: Aufschrift blieb „geschafft", Karte unverändert. Beim
    zweiten Tippen wurde die Bestätigung stillschweigend wieder
    zurückgenommen. Am Gerät nachgestellt, bevor irgendetwas geändert wurde.
    `muscleupStand()` gibt jetzt zu jeder Stufe ihren Zustand zurück, samt
    `vorgemerkt` für „selbst bestätigt, aber von einer früheren Stufe
    aufgehalten". Die Zeile sagt das auch: „Von dir bestätigt – zählt, sobald
    die Stufen davor stehen."
    **Die Lehre:** Bei jedem Bedienelement fragen, was ein Tipp *sichtbar*
    verändert. Speichern allein genügt nicht – wo nichts passiert, hält man die
    App für kaputt oder sich für blind. Dieselbe Familie wie die Sackgassen
    unten, nur andersherum: nicht ein Rat ohne Weg, sondern ein Weg ohne
    Wirkung.
    *Nebenbei aufgeräumt:* Die Oberfläche leitete `erreicht` und `aktuell`
    selbst aus `m.erreicht` her und importierte `MUSCLEUP_STUFEN` dafür – die
    dritte Herleitung derselben Sache (Falle 21). Sie liest jetzt `m.stufen`.
    **Und die Frage ist jetzt ein Werkzeug.** `werkzeug/knoepfe.mjs` drückt
    jeden sichtbaren Knopf jeder Ansicht einmal, lädt vorher frisch und
    vergleicht Seitentext, Dialoginhalt und Meldung. Gegen die Fassung vor
    dieser Korrektur meldet es **sechs** tote Knöpfe – es waren also nicht
    einer, sondern alle sechs manuellen Stufen. Gegen die neue: keinen.
    *Zweimal war die Prüfung selbst der Fehler, beide Male Falle 34.* Zuerst
    erkannte sie einen offenen Dialog an `.dialog` – dieses Element steht aber
    **dauerhaft** im DOM, nur sein `open` wechselt; damit galten acht
    tadellose Dialogknöpfe als wirkungslos. Dann blieben zwei Knöpfe übrig, die
    die **Dateiauswahl des Systems** öffnen („Aus Lauf-App übernehmen",
    „Einspielen"): Die liegt außerhalb der Seite und hinterlässt im DOM keine
    Spur. Solche Knöpfe erkennt das Werkzeug jetzt und meldet sie als
    „nicht beurteilbar" statt als Fehler.
    **Beim Anwenden wichtig:** Im Leerzustand (`saeen.mjs --leeren`) sind mehr
    Bedienelemente inaktiv als mit Daten – dort ist der Lauf ergiebiger.


46. **Ein Regler, der über weite Strecken nichts tut.** Nils' Rückmeldung war
    „der Trainingsplan ist noch nicht so Bombe". Die Messung gab ihm recht:
    Über 21 Reglerstellungen erzeugte der Planer bei vier Trainingstagen nur
    **sieben verschiedene Wochen**, bei drei Tagen waren die Stände **40 bis 75
    wörtlich identisch** – acht Stufen, ein Plan. Wer den Regler schob, sah
    nichts passieren.
    *Und wo etwas passierte, ging es teils rückwärts.* Bei vier Tagen fielen
    zwischen Regler 35 und 40 die Sprintmeter von 960 auf 480 **und** die
    Ausdauerminuten von 110 auf 90. Mehr Ausdauerausrichtung, weniger Ausdauer.
    Drei Ursachen, alle vom selben Bau:
    *Erstens kannte der Umfang den Regler gar nicht.* Der Regler bewegte allein
    die **Zahl** der Einheiten – und die wird gerundet, also fallen ganze
    Bereiche zusammen. Die Sprintmeter ergaben sich aus der Zahl der Sprinttage
    mal der Qualitätsgrenze, die Ausdauerminuten waren fest. Jetzt skaliert
    `AUSRICHTUNG_UMFANG` auch den Umfang: Am Sprint-Anschlag steht der
    Literaturwert aus `SPRINT.wochenumfangMeter`, darunter weniger; die lockere
    Ausdauer wächst umgekehrt vom Erholungsmittel (rund 35 min) zur
    eigentlichen Arbeit (rund 90 min).
    *Zweitens waren Ursache und Wirkung vertauscht.* Die Zahl der Sprinttage
    kam aus dem Anteil, der Umfang aus der Zahl der Tage. Fiel die Zahl von
    zwei auf eins, halbierte die Qualitätsgrenze (16 Läufe je Einheit) die
    ganze Woche. Jetzt steht zuerst der Wochenumfang, und daraus folgt, auf wie
    viele Tage er sich verteilen **muss**. Mehr hochwertige Meter brauchen mehr
    Tage – nicht andersherum.
    *Drittens fiel die Ausdauersumme, wenn eine Einheit auf einen Kraft-Tag
    rutschte* und dort gekürzt wurde. Die Kürzung bleibt richtig; die fehlenden
    Minuten holen jetzt die freien Ausdauertage nach. Gibt es keinen freien,
    bleibt die Woche kürzer – dann ist nichts da, was ausgleichen könnte.
    *Zwei Kleinigkeiten aus derselben Prüfung:* Der Sprint fiel schon bei
    Regler 90 auf null, obwohl die Beschriftung dort noch „Ausdauer mit
    Spritzigkeit – Sprint und Kraft halten das Tempo oben" verspricht und erst
    bei 100 „Reine Ausdauer" steht; er bleibt jetzt bis zum Anschlag. Und zwei
    Kürzungen multiplizierten sich zu **23 Minuten** Ausdauer pro Woche –
    keine Einheit mehr, und der Tracker konnte die Verteilung seines eigenen
    Plans nicht mehr benoten. Dafür gibt es `AUSDAUER.dauer.mindestMinuten`.
    **Ergebnis:** In der Spitzenwoche ändert jeder einzelne Reglerschritt die
    Woche, bei drei bis sechs Trainingstagen, und keine Größe läuft mehr
    rückwärts. Drei Tests halten das fest: „jeder Schritt verändert etwas",
    „mehr Ausdauerausrichtung heißt nie weniger Ausdauer und nie mehr Sprint"
    und „der Sprint verschwindet erst am Anschlag".
    *Offen und bewusst so gelassen:* In der Entlastungswoche sitzt der Plan auf
    seinen Untergrenzen (`mindestMinuten`, vier Läufe je Einheit). Dort bleiben
    einzelne Reglerschritte wirkungslos, und an einer Stelle wackelt die
    Ausdauersumme um fünf Minuten nach unten. Das ist eine Eigenschaft der
    Untergrenzen, keine der Rechnung – die Tests prüfen deshalb die
    Spitzenwoche.
    **Für Nils ändert sich konkret** (Regler 30, vier Tage, Spitzenwoche):
    Sprint 960 → 780 m, Ausdauer 110 → 102 min. Weniger Sprintmeter als vorher,
    dafür entspricht der Umfang jetzt der Reglerstellung „Sprint mit Grundlage"
    statt dem Wert für „Reiner Sprint".


Und drei Konstruktionsfehler derselben Art:

- **Ein Hinweis ohne Weg ist eine Sackgasse.** „Im Profil fehlen noch Gewicht,
  Größe, Geburtsjahr" stand am ersten Tag ganz oben – und der Profil-Reiter war
  zu dem Zeitpunkt rechts aus der Reiterleiste herausgescrollt. Wer benennt,
  was fehlt, soll auch hinführen: `zuAnsicht()` aus `app.js`. Den Leerzustand
  bitte gelegentlich wirklich ansehen (IndexedDB leeren, Profil zurücksetzen) –
  er ist der einzige Zustand, den Nils garantiert erlebt hat.
- **Lauter Nullen sind kein Verlauf.** Die Wochenlast zeichnete am ersten Tag
  zwölf Nullen als flache Linie mit „0" links und „0" rechts. Keine Größe im
  Tracker wird echt null – ein Ruhepuls nicht, ein Gewicht nicht, und eine
  Woche ohne Training hat keine Belastung, sondern keinen Eintrag.
  `linienDiagramm` sagt dann „Noch keine Daten".
- Ein Schutzziel, das sich über die Oberfläche **nicht erfüllen lässt**, ist
  schlimmer als keins – man gewöhnt sich an, die Warnung zu übersehen. Das
  Sprunggelenk-Ziel stand deshalb dauerhaft auf 0/2, bis Blöcke im
  Sprint-Aufwärmen abhakbar wurden.
- Dieselbe Falle im Protokolldialog: Strecke, Puls und Sprintzeiten hingen an
  `einheit.typ` aus dem **Plan**. Beim freien Eintrag („Trotzdem etwas
  eintragen") ist der leer – die Felder fehlten also genau dann, wenn man eine
  ungeplante Einheit nachträgt. Jetzt entscheidet die Auswahl im Dialog, und
  ausgeblendete Blöcke geben nichts zurück, damit keine Sprintzeiten an einer
  Ausdauereinheit landen.
- **Englische Parsermeldungen sind keine Fehlermeldung.** Beim Zurückspielen
  einer Sicherung stand `Unexpected token '<', "<?xml vers"… is not valid JSON`
  – in einer sonst durchweg deutschen Oberfläche, und ohne zu sagen, was zu tun
  ist. Ausgerechnet der wahrscheinlichste Fehlgriff steckte dahinter:
  versehentlich eine GPX-Datei erwischt, die der Tracker an anderer Stelle ja
  wirklich einliest. `ausSicherungsText()` in `kern/aendern.js` unterscheidet
  jetzt leer / XML / abgeschnitten / kein Export, jeweils mit dem nächsten
  Schritt dabei. Ein Test verbietet, dass in einer dieser Meldungen wieder
  `Unexpected` oder `token` auftaucht.
  *Nebenbefund aus derselben Prüfung:* Die ganze Kette sichern → alles
  verlieren → zurückspielen ist einmal am Stück durchgespielt und liefert
  bitgleich zurück. Wer sie erneut prüft: `speicher.laden()` gibt eine
  **lebende Referenz**, der Vorher-Stand braucht ein `structuredClone`, sonst
  vergleicht man am Ende mit sich selbst.
- Gebündeltes Schreiben und eine Bestätigung „Gespeichert" vertragen sich
  nicht: Die Meldung erschien nach 150 ms Verzögerung, also bevor irgendetwas
  geschrieben war – und wer die App in dieser Zeit schloss, verlor den Eintrag.
  Beim Testen waren es 35 Einträge, null gespeichert. Ein beim Seitenschluss
  angestoßener Schreibvorgang läuft asynchron und wird nicht mehr fertig; das
  rettet nichts. Alle Schreibstellen hängen ohnehin an einer bewussten
  Handlung, also wird sofort geschrieben und der Aufrufer wartet darauf.
- Ein fehlgeschlagener Schreibvorgang war vollkommen still: `schreiben()`
  hing an einem `.catch(() => {})`. Man hätte weiter eingetragen, und nichts
  wäre angekommen. Ebenso lieferte ein Lesefehler stillschweigend ein leeres
  Tagebuch – was dazu verleitet, eine alte Sicherung über noch vorhandene Daten
  zu spielen. Beides meldet `app/speicher.js` jetzt über `ablage`, und die
  Ratschläge sind entgegengesetzt: bei Lesefehler **nichts** überschreiben, bei
  Schreibfehler sofort sichern.
- Der Morgen-Check setzte beim Öffnen jeden Regler wieder auf 3. Wer über
  „Ändern" eine einzelne Antwort korrigieren wollte, überschrieb damit
  stillschweigend alle anderen mit „okay" – und verfälschte die Bereitschaft
  genau an dem Tag, an dem er hinsah. Dialoge, die bestehende Daten bearbeiten,
  müssen sie vorbelegen.

## Starten und prüfen

```bash
node server/index.js                       # Port 3100, PORT= zum Umlenken
node --test test/*.test.js                 # 409 Tests
PORT=3200 node server/index.js             # zweite Instanz
```

**Nicht** `pkill -f "node server/index.js"` benutzen: Das Muster steht in der
eigenen Kommandozeile und die Shell bringt sich selbst um. Lieber einen neuen
Port nehmen.

### Oberfläche im Browser prüfen

Chromium liegt unter `/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
Playwright ist **nicht** installiert (soll auch nicht – null Abhängigkeiten).
Angesteuert wird direkt über das DevTools-Protokoll; Node 22 hat `WebSocket`
eingebaut. Die Werkzeuge dafür liegen in `werkzeug/` und werden **nicht**
ausgeliefert – sie stehen deshalb nicht in der Dateiliste von `sw.js`:

```bash
./werkzeug/starten.sh                       # Server + Chromium
node werkzeug/saeen.mjs 30 4 12             # 12 Wochen Plan als Tagebuch
node werkzeug/breite.mjs                    # Überlauf bei 320 und 390 px
node werkzeug/konsole.mjs                   # Konsolenfehler aller Ansichten
node werkzeug/dialoge.mjs                   # Eingabewege: was landet wirklich?
node werkzeug/mutieren.mjs leistung         # halten die Tests? (dateiweise)
node werkzeug/knoepfe.mjs                   # bewirkt jeder Knopf etwas Sichtbares?
node werkzeug/lesefehler.mjs                # überlebt der Bestand einen Lesefehler?
node werkzeug/ablage.mjs                    # sind die Notfallräte ausführbar?
node werkzeug/schuss.mjs fortschritt "Intensitätsvert"
node werkzeug/saeen.mjs --leeren            # Leerzustand ansehen
```

`breite.mjs`, `konsole.mjs`, `dialoge.mjs`, `lesefehler.mjs`, `ablage.mjs` und
`knoepfe.mjs` geben einen Exitcode zurück und taugen damit als letzte Prüfung
vor dem Commit.
Die letzten beiden stören die IndexedDB absichtlich (`get` bzw. `put`
scheitern lassen) und prüfen, was die App dann tut – dort saß Falle 39. **Sie
räumen ihre eingeschleusten Skripte selbst wieder ab**; wer daran etwas ändert,
muss das mitziehen, sonst scheitern die Schreibvorgänge des nächsten
Werkzeugs. `dialoge.mjs` bedient die
Eingabedialoge und sieht in der IndexedDB nach, was ankommt – Überlauf und
Konsolenfehler sagen darüber nichts, und genau dort sitzen die teuersten Fehler
dieses Projekts (Falle 14, das gebündelte Schreiben). Es **verändert den
Bestand**; hinterher gegebenenfalls neu säen. `PORT`, `CDP_PORT` und `APP_PORT` lenken auf
andere Ports um, falls schon etwas läuft.

Gesät wird bewusst genau das, was der Wochenplaner vorschlägt, mit dem RPE, den
er erwartet: So laufen Plan und Auswertung gegeneinander, und Widersprüche
zwischen beiden werden im Bild sichtbar – so ist Falle Nr. 17 aufgefallen.

Drei Stolpersteine, alle schon einmal zugeschnappt:

- **Navigation auf denselben Hash lädt die Seite nicht neu.** Nach Codeänderungen
  zusätzlich `Page.reload` mit `ignoreCache: true`, sonst prüft man alten Stand.
  `zurAnsicht(ruf, name, { neuLaden: true })` macht das mit; ohne das zeigt der
  Screenshot den Stand von vorhin und man sucht den Fehler an der falschen Stelle.
- **Der Service Worker bedient zuerst aus dem Vorrat.** Vor dem Prüfen einer
  Änderung `vorratLeeren(ruf)` – sonst sieht man die vorige Fassung.
- `ruf()` liefert bereits `a.result`; das Ergebnis von `Runtime.evaluate` liegt
  also unter `treffer.result.value`, nicht eine Ebene tiefer.

### Gestaltung: was als Skala festliegt

`app/style.css` hält Schriftgrößen (`--t-xs` bis `--t-zahl`), Abstände
(`--s-1` bis `--s-5`) und eine Mindest-Tippfläche (`--tipp: 44px`) als Tokens.
Vorher standen dort siebzehn Schriftgrößen zwischen 0,72 und 1,35 rem
nebeneinander – Unterschiede, die niemand als Absicht liest, aber als Unruhe
sieht. Neue Regeln greifen bitte auf die Tokens zu, statt eine achtzehnte Größe
zu erfinden.

Drei Dinge, die man leicht wieder herausbricht:

- **Sicherer Bereich.** `viewport-fit=cover` ist gesetzt, also muss die App die
  Ränder selbst berücksichtigen. Kopfzeile, Reiter und Inhalt tun das über
  `max(var(--s-4), env(safe-area-inset-…))`. Ohne das liegt am Startbildschirm
  die Kopfzeile unter der Statusleiste – im Simulator und im Headless-Browser
  sieht man davon nichts, weil dort kein sicherer Bereich existiert.
- **44 Pixel.** Alles Antippbare hat `min-height: var(--tipp)`, auch
  Eingabefelder und der RPE-Regler. Bedient wird zwischen zwei Sätzen.
- **Symbole sind SVG, keine Zeichen.** In den Reitern standen ◉ ▤ ◍ ◭ ◐ ◈ –
  Glyphen, die je nach Gerät anders ausfallen und auf iOS teils bunt gerendert
  werden. Ein Test in `test/dateien.test.js` besteht auf `<svg>` mit
  `currentColor`.

### Was sich nur im Browser prüfen lässt

Vier Dinge tragen die App und stehen in keinem Test, weil sie einen echten
Browser brauchen. Über das DevTools-Protokoll sind sie alle nachstellbar:

- **Offline.** `Network.emulateNetworkConditions` mit `offline: true`, dann
  neu laden. Erwartet: Reiter und Karten stehen, kein Ladezustand, und
  Eintragen funktioniert weiter. Geprüft am 09.08.2026 – trägt.
- **Aktualisierung.** `VORRAT` ändern, dreimal neu laden. Erwartet: Nach dem
  ersten Öffnen liegen beide Vorräte nebeneinander, nach dem zweiten nur noch
  der neue. So ist „erst beim übernächsten Öffnen" gemeint, und so verhält es
  sich auch. Die Meldung „Neue Fassung geladen" kommt zwei bis vier Sekunden
  nach dem Laden – wer sofort nachsieht, findet sie noch nicht.
- **Größe.** Drei Jahre Training (626 Einheiten, 4.384 Mahlzeiten, 1.096
  Checks) direkt in die IndexedDB schreiben. Öffnen dauert dann rund 200 ms,
  die Sicherungsdatei wiegt 1,7 MB und spielt bitgleich zurück.
- **Sicherung.** Siehe oben – und Vorsicht mit `speicher.laden()`, das eine
  lebende Referenz gibt.

### Breite prüfen, nicht nur hinsehen

Die Kraft-Tabelle schob auf 390 Pixeln ihre letzte Spalte aus der Karte – zu
lesen war „EINORDNUN". Sowas fällt im Screenshot nur auf, wenn man genau diese
Karte ansieht. Systematisch geht es über das DevTools-Protokoll: Gerätebreite
setzen, jede Ansicht laden und `getBoundingClientRect()` gegen
`document.documentElement.clientWidth` halten. Geprüft wird bei **320 und
390 Pixeln** – 320 ist die schmalste iPhone-Breite und deckt auf, was bei 390
gerade noch passt.

Tabellen gehören durch `tabelle()` aus `common.js`: Sie scrollen dann in sich,
statt aus der Karte zu wachsen. Elemente in `.tabelle-rahmen` sind bei der
Prüfung folglich auszunehmen.

## Wiederkehrende Aufräumaufgabe

Fachliche Zahlen wandern gern in die Oberfläche zurück – dort sind sie beim
Schreiben am nächsten. Ein Durchlauf mit

```bash
grep -n "[<>]=\? *[0-9]" app/*.js
```

fördert sie zutage. Bisher gefunden: die Volumenmarken (10 und 14 Sätze), die
Grenzen der Gewichtsentwicklung, die Schwelle für „Kalorien überschritten" und
die komplette Trainingsverpflegung – Letztere stand sogar zweimal im Code, im
Kern und in der Oberfläche, und war schon auseinandergelaufen.

## Arbeitsweise

- Der Tracker gibt Empfehlungen zu Training und Ernährung. **Jede Zahl braucht
  eine Quelle in `wissen.js`.** Wo es keine belastbare Studienlage gibt, wird das
  ausdrücklich als `praxis` gekennzeichnet – nicht stillschweigend behauptet.
- Lieber ehrlich „nicht berechenbar" ausgeben als eine erfundene Zahl. Eine
  Zahl sieht am Gerät wie eine Vorgabe aus.
- Der Tracker **verbietet nichts**. Erhöhtes Risiko wird benannt und begründet,
  die Abwägung bleibt bei Nils.
- Vor dem Commit die Oberfläche wirklich ansehen. Drei der vier oben genannten
  Fehler waren in den Tests grün und erst im Screenshot sichtbar.

## Was nicht geht, und warum

Apple Health lässt sich **nicht** auslesen. HealthKit ist ausschließlich für
native iOS-Apps geöffnet; es gibt keine Web-Schnittstelle und keinen Umweg.
Dasselbe gilt für Adidas Running, das Dritten keine Schnittstelle mehr anbietet.
Der Weg ist der Export: `kern/aktivitaet.js` liest GPX und TCX. Bitte hier
nichts versprechen, was die Plattform nicht hergibt.

Denkbar wäre noch der Gesamtexport aus Apple Health (ZIP mit `Export.xml`) –
das hieße ZIP-Entpacken über `DecompressionStream` und ein XML von mehreren
hundert Megabyte streamend zu lesen. Machbar, aber ein eigenes Vorhaben.

## Offene Punkte

- **Der Planer belegt weniger Tage, als im Profil stehen.** Bei 3 eingestellten
  Tagen und Regler 15–35 sind es 2, bei 4 Tagen und Regler 0–10 sind es 3 – in
  17 von 48 Kombinationen aus Reglerstand und Tagen. Ursache ist kein Fehler,
  sondern Absicht: Kraft geht zuerst auf die Sprinttage („so bleiben die
  übrigen wirklich locker"), Sprint und Kraft teilen sich also einen Tag. Das
  Trainingsvolumen geht dabei nicht verloren, es wird nur auf weniger
  Kalendertage gepackt. Trotzdem ist es die Familie von Falle 13: Im Profil
  wählt man „3 Tage" und im Wochenplan stehen 2. Zu entscheiden ist, was das
  Feld bedeuten soll – verfügbare Tage (dann darf der Planer darunter bleiben,
  sollte es aber sagen) oder geplante Tage (dann muss er auffüllen). Das ist
  eine Trainingsentscheidung, keine Codefrage, deshalb liegt sie bei Nils.
- **Der Aufbaublock schreibt bis zu 12 Wiederholungen vor, das Einer-Maximum
  zählt nur bis 10.** `KRAFT.wiederholungen.hypertrophie` ist `[6, 12]`,
  `EPLEY.maxWiederholungen` ist 10 – Sätze am oberen Ende des vorgeschriebenen
  Bereichs überspringt `einerMaxima()` also mit einem `continue`. Ausgerechnet
  die besten Sätze eines Aufbaublocks fließen damit nicht in den Kraftstand
  ein, und weil ein Satz mit 12 Wiederholungen rechnerisch das *höhere*
  Maximum ergäbe (Faktor 1,40 statt 1,33), unterschätzt der Stand danach
  systematisch. Beides ist für sich richtig: Epley ist über zehn
  Wiederholungen unbrauchbar, und 6–12 ist der richtige Hypertrophiebereich.
  Zu entscheiden ist, was daraus folgen soll – den Bereich bei 10 kappen (ändert
  die Trainingslehre), eine andere Formel für hohe Wiederholungszahlen nehmen
  (braucht eine Quelle), oder es dabei belassen und in der Oberfläche sagen.
  Falle 22 deckt bisher nur die **Tests** ab, nicht die protokollierten Sätze.
- **Die Ruhepuls-Grundlinie verdünnt sich selbst.** Verglichen wird ein
  3-Tage-Schnitt gegen eine Grundlinie aus den 21 Tagen davor. Eine Erhöhung
  hält aber selten nur drei Tage: Bei einer Woche mit +10 bpm liegen vier
  dieser Tage schon in der Grundlinie und heben sie um rund 2 an – gemessen
  werden dann +7,5 statt +10, und die Schwelle für „deutlich" steht bei 8. Der
  Docstring warnt genau vor diesem Mechanismus („sonst zieht der aktuelle Wert
  seine eigene Vergleichsgröße mit hoch"), schützt aber nur die drei Tage des
  Schnitts. Die Grundlinie müsste dort enden, wo die *Störung* beginnt, nicht
  wo der Schnitt beginnt – nur wie lang die ist, gibt die Studienlage nicht
  her. Hier steht bewusst keine erfundene Zahl.
- Muskelgruppen-Volumen zählt Hauptmuskeln voll, mitarbeitende zur Hälfte. Die
  Halbierung ist gängige Praxis, keine Messgröße – so auch in der Oberfläche
  gekennzeichnet.
- Die Pulszonen liegen bei 82 % und 87 % der Maximalfrequenz. Die Prozentsätze
  sind Näherungen an die ventilatorischen Schwellen (`praxis`), nicht gemessen.
  Mit einem **geschätzten** Maximalpuls ist die Einteilung kaum genauer als
  RPE – das steht an jeder Stelle dabei, an der eine Pulszone auftaucht, und
  muss dort auch stehen bleiben.
- Der Ruhepuls steht bewusst **nicht** im Profil, sondern je Tag im Morgen-Check:
  Ein fester Wert veraltet und hat nichts, womit er sich vergleichen ließe.
  Ausgewertet wird nur die Abweichung von der eigenen Grundlinie, und er zählt
  beim Entlastungsbedarf als *ein* Grund neben anderen – nie allein. Ein Infekt
  erzeugt dasselbe Bild.
- Die Trainingsdaten liegen in der IndexedDB des Geräts und dürfen dort auch
  bleiben – es gibt keine Datei mehr, die versehentlich im Repository landen
  könnte. `data/` steht trotzdem noch in der `.gitignore`, falls irgendwo noch
  eine alte Fassung mit Dateiablage läuft.

## Veröffentlichen

GitHub Pages, Quelle: Branch `claude/fitness-training-tracker-1qa11h`,
Verzeichnis `/` (Wurzel). Es gibt keinen Build-Schritt – gepusht ist
veröffentlicht.

Nach Änderungen an den ausgelieferten Dateien `VORRAT` in `sw.js` hochzählen.
Die Dateiliste selbst prüfen zwei Tests in **beide** Richtungen: dass jede
gelistete Datei existiert, und dass keine Datei aus `app/` oder `kern/` in der
Liste fehlt. Die zweite Richtung ist die wichtigere – ein vergessenes neues
Modul fällt sonst erst auf, wenn jemand ohne Empfang davorsteht.

`sw.js` bedient **erst aus dem Vorrat**, dann erneuert es nebenher. Andersherum
wäre naheliegender, ist hier aber falsch: Ein Netzaufruf scheitert nur *sofort*,
wenn gar keine Verbindung besteht – bei einem Balken Empfang hängt er
sekundenlang. Der Preis ist, dass eine Änderung erst beim übernächsten Öffnen
sichtbar wird; darauf weist die App per Meldung hin.

Die Symbole liegen als SVG **und** PNG vor. iOS nimmt fürs
Startbildschirm-Symbol ausschließlich PNG (`apple-touch-icon`) – ohne das landet
dort ein Bildschirmfoto der Seite. Neu erzeugen lassen sie sich aus
`app/symbol.svg` über Chromium, siehe Screenshot-Abschnitt.

## Git

Branch: `claude/fitness-training-tracker-1qa11h`. Push mit
`git push -u origin <branch>`. Kein Pull Request, außer Nils fragt danach.

## Stand und wo es weitergeht

Dieser Abschnitt ist die Übergabe an die nächste Sitzung – gerade dann, wenn
sie den bisherigen Gesprächsverlauf nicht kennt. Bitte beim Weiterarbeiten
mitpflegen, sonst veraltet er und wird schlimmer als nichts.

**Erste Schritte in einer frischen Sitzung**

```bash
node --test test/*.test.js       # muss grün sein, bevor irgendetwas beginnt
./werkzeug/starten.sh
node werkzeug/saeen.mjs 30 4 12  # Nils' Voreinstellung mit Daten
node werkzeug/breite.mjs && node werkzeug/konsole.mjs && node werkzeug/dialoge.mjs
node werkzeug/saeen.mjs 30 4 12 && node werkzeug/lesefehler.mjs && node werkzeug/ablage.mjs
node werkzeug/saeen.mjs --leeren && node werkzeug/knoepfe.mjs
```

**Laufzeit, gemessen am 10.08.2026** – die Frage „habe ich das über all die
Runden langsamer gemacht?" hatte niemand gestellt. Mit drei Jahren Daten (936
Einheiten, 4.368 Mahlzeiten, 1.092 Checks) braucht `zustand()` im Median
**8,8 ms**. Die dokumentierten „rund 200 ms" fürs Öffnen stecken also in
IndexedDB und Zeichnen, nicht in der Rechnung – dort ist Luft. Die teuersten
Einzelteile: `haeufigeLebensmittel()` 1,7 ms (läuft ohnehin nur im Suchdialog),
`evSchnitt()` und `leistungsstand()` je 0,7 ms, alles andere unter 0,4 ms.
Nachmessen mit einem Skript wie `werkzeug/saeen.mjs`, aber über 156 Wochen.

**Im Browser durchgeprüft und tragend** (jeweils mit Datum, weil die Aussage
ohne Datum nichts wert ist): Offline-Betrieb 09.08.2026 · Aktualisierungsweg
über zwei Ladevorgänge 09.08.2026 · drei Jahre Daten, 626 Einheiten, Öffnen in
rund 200 ms, Sicherung 1,7 MB und bitgleich zurück 09.08.2026 · GPX-Import
10,02 km aus einer verrauschten 10,00-km-Spur 09.08.2026 · Überlauf bei 320
und 390 px sowie Konsolenfehler 10.08.2026.

**Veröffentlicht seit 10.08.2026** unter `nilsota.github.io/Fitness/`, Quelle
Branch `claude/fitness-training-tracker-1qa11h`, Verzeichnis `/` (Wurzel). Am
selben Tag in Safari auf dem iPhone geöffnet: Reiter, Karten und Leerzustand
stehen, der Weg vom Profil-Hinweis zum Profil funktioniert.

**PubMed ist von hier aus nicht erreichbar** (der Proxy lehnt den Aufbau mit
403 ab, ebenso für andere externe Hosts). Die 28 Quellen sind deshalb **nie
gegen die Arbeiten selbst geprüft worden** – nur gegen sich: keine doppelten
Adressen, Jahr und Name im Schlüssel passen zur Kurzangabe, jede Güte folgt der
Studienart. Ob Titel, Kernaussage und Umfang stimmen, kann nur jemand mit
Netzzugang nachsehen; das ist Nils' Teil. Aufgefallen ist dabei zweierlei, das
auch ohne Netz feststeht: `fifa11plus` trägt als Kurzangabe „Metaanalyse 2025,
Sports (Basel)" – **ohne Autoren**, als einzige der 28, und ist damit nicht
über den Namen nachschlagbar. Und vier Metaanalysen haben kein `umfang`-Feld
(`wilson2012`, `fifa11plus`, `tanaka2001`, `impellizzeri2021`), obwohl die
Wissensansicht genau diese Angabe zeigt, um aus dem Abzeichen „stark" eine
nachprüfbare Aussage zu machen. Bei `tanaka2001` steht die Zahl sogar im
Fließtext daneben („351 Studien mit 18 712 Personen"), nur im falschen Feld.
Nachgetragen habe ich nichts: Zahlen aus dem Gedächtnis in die Evidenzbasis zu
schreiben wäre genau das, was dieser Tracker nicht tut.

Wichtig für jede Prüfung von hier aus: Die veröffentlichte Seite ist über den
Proxy dieser Umgebung **nicht erreichbar** (403 auf `github.io`). Geprüft wird
lokal über `werkzeug/`, und Aussagen über die Live-Seite kommen von Nils. Der
Entwicklungsserver liefert unter `/` aus, GitHub Pages unter `/Fitness/` –
absolute Pfade fielen hier also nie auf. Deshalb sind alle Pfade relativ
(`manifest.webmanifest` mit `start_url` und `scope` auf `./`, die
Service-Worker-Registrierung über `import.meta.url`); das bitte so lassen.

**Was hier grundsätzlich nicht prüfbar ist** – das braucht ein echtes iPhone
und ist deshalb Nils' Teil:

- Sicherer Bereich und Startbildschirm-Symbol. Im Headless-Browser existiert
  kein `env(safe-area-inset-*)`, dort sieht man den Fehler nie. **Erledigt
  10.08.2026:** Vom Startbildschirm gestartet liegt die Kopfzeile unter der
  Statusleiste, und das Symbol ist das PNG und kein Bildschirmfoto der Seite.
  Der untere Rand ist dabei nicht geprüft worden.
- Der Teilen-Knopf für die Sicherung (AirDrop). **Halb erledigt 10.08.2026:**
  Der Dialog öffnet sich mit der JSON-Datei, AirDrop steht bereit. Dass die
  Datei heil ankommt und sich wieder einspielen lässt, ist am Gerät noch nicht
  durchgespielt – und das ist der Teil, der im Ernstfall zählt.
- **Dauerhafter Speicher.** `navigator.storage.persist()` wird beim Start
  gefragt; ob der Browser zusagt, entscheidet er selbst. Der Stand steht im
  Profil unter „Daten". Ohne Zusage kann iOS die IndexedDB nach längerer
  Nichtnutzung räumen – bei einem Tagebuch, das über Jahre wachsen soll, ist
  das der teuerste denkbare Verlust. **Erledigt 10.08.2026:** zugesagt, vom
  Startbildschirm aus. Das ist genau der Grund, warum der Einbau-Hinweis so
  drängt – in Safari allein kommt die Zusage nicht zuverlässig.
- Offline am Gerät. **Noch offen.**
- GPX-Übergabe aus der Dateien-App. **Noch offen.**

**`kern/belastung.js` ist am 10.08.2026 durchsimuliert worden** – zwölf Wochen
Plan als Tagebuch, für jeden Reglerstand und jede Tageszahl, Tag für Tag
ausgewertet. Ergebnis sind die Fallen 18 und 19 sowie zwei offene Punkte oben
(Trainingstage im Planer, Ruhepuls-Grundlinie). Das Gegenteil von Falle 17:
Dort warnte der Tracker zu viel, hier zu wenig. Der Integrationstest dazu heißt
„Der Plan löst keine Entlastungswarnung aus – und die Warnung ist trotzdem
scharf" und prüft **beide** Richtungen; die zweite ist die wichtigere.

Geprüft und in Ordnung: `acwr` über den ganzen Verlauf, `bereitschaft` samt
Ampelstufen, `ruhepulsTrend` in beide Richtungen, `wochenverlauf`. Der
Ausrichtungsregler ist über `schwerpunkte()` in allen Ständen mitgelaufen –
Einheitenverteilung, 48-Stunden-Regel und Platzierung der Intervalleinheit
waren schon vorher geprüft, dort liegt der Fund also nicht.

**`kern/profil.js` ist am 10.08.2026 nachgezogen worden.** `muscleupStand()`
wurde Tor für Tor durchlaufen (Falle 20), `kraftEinordnung()` über den ganzen
Wertebereich samt Übergängen und oberhalb von „stark" – dort war nichts falsch,
die Funktion wurde nur nirgends aufgerufen (Falle 21). `schwerpunkte()`,
`ausdauerEmpfehlung()`, `e1rm()`, `fettfreieMasse()` und `pruefeProfil()` sind
mitgelaufen und unauffällig.

**`kern/leistung.js` ist am 10.08.2026 im geschlossenen Kreis durchgespielt
worden** – zwölf Wochen lang Plan bauen, protokollieren, was er vorgibt, und
den nächsten Plan aus genau diesen Daten. Ergebnis ist Falle 23 und ein offener
Punkt oben (Wiederholungsbereich gegen Epley-Grenze). Diese Rückkopplung ist
der Grund, warum der Fund nicht früher auffiel: Alle Einzeltests geben
`leistung.js` von Hand gebaute Daten, und von Hand baut niemand einen
Blockwechsel nach.

Geprüft und in Ordnung: `arbeitsgewicht()` samt Körpergewichtsübungen,
`prozentFuerWdh()`/`prozentBereich()`, `aufScheibe()`, `schutzabdeckung()`
(alle vier Ziele werden erfüllt, wenn Prophylaxe und Sprint-Aufwärmen
mitprotokolliert werden) und `risikoprofil()` (schweigt zum Planverlauf, weil
die gelenkschonende Auswahl greift).

**`kern/ernaehrung.js` ist am 10.08.2026 durchsimuliert worden** – jeder Tag
von zwölf Wochen, über alle Reglerstände, Tageszahlen und Kalorienziele.
Ergebnis ist Falle 24. Geprüft und in Ordnung: `tagesbedarf()`, die Makrosummen
gehen bis auf Rundung im Kalorienziel auf (größte Abweichung 4 kcal),
`tagestyp()` trifft vier der fünf Korridore – `langeAusdauer` erzeugt der
Planer nie, weil er keine Einheit über 90 Minuten vorsieht. Das ist kein
Fehler, nur toter Korridor; wer lange Ausfahrten aus GPX importiert, füllt ihn.

**`kern/sprint.js` und `kern/ausdauer.js` sind am 10.08.2026 durchsimuliert
worden.** Bei `sprint.js` kam Falle 25 heraus. `ausdauer.js` ist dabei
**sauber geblieben** – und das ist selbst ein Ergebnis, das hier stehen soll,
damit es niemand ein zweites Mal prüft: Der Pfad GPX-Datei → `aktivitaet.js` →
Einheit → Verteilung läuft am Stück (28 km Spur mit Pulsdaten kommen als
27,95 km und Puls 132 an), `zoneBestimmen()` bevorzugt den Puls und meldet
Abweichungen zum RPE, die Verteilung ist gegen RPE- und Pulsquelle identisch,
und `quelleText` benennt eine gemischte Erhebung („50 % der Minuten über Puls
eingeordnet, der Rest über RPE"). Auch die Naht zum Protokoll trägt: Der
Import liefert `meter`/`geraet` flach, `protokoll.js` baut daraus die
`strecke`.

**Damit sind alle Rechenkerne einmal gegen einen realistischen Verlauf
gelaufen.** Was jetzt noch lohnt, ist eine andere Art von Prüfung:

- **Mehrere Kerne gleichzeitig** ist am 10.08.2026 gemacht worden und steckt
  jetzt als `test/zustand.test.js` in der Suite: Er baut den kompletten
  Zustand – so, wie die Oberfläche ihn bekommt – für jeden Tag von zwölf
  Wochen in fünf Profilen und prüft ihn gegen eine Liste von Widersprüchen
  zwischen Karten. Ergebnis war Falle 26. Der letzte Test in der Datei besteht
  darauf, dass die geprüften Zustände in den Durchläufen **vorkommen** – ohne
  das wären es fünf Regeln, die auf einen Zustand warten, den es nie gibt.
  Neue Regeln gehören dort hinein, nicht in ein neues Skript.
- **Die zwei offenen Punkte oben** (Trainingstage im Planer,
  Wiederholungsbereich gegen Epley-Grenze) warten auf Nils' Entscheidung.
- **Am Gerät:** Offline und GPX-Übergabe aus der Dateien-App stehen weiter aus.
- **Der Importweg ist am 10.08.2026 mit beschädigten Sicherungen durchgespielt
  worden** (Falle 27); die Fälle stehen als Tests in `test/aendern.test.js`.
  Ein Rest bleibt bewusst offen: Ein Essenseintrag **ohne `mengeG`** wird
  akzeptiert und zählt dann mit 0 kcal – er steht in der Tagesliste, fehlt
  aber in der Summe. Die App selbst kann so einen Eintrag nicht erzeugen
  (`essenAnlegen` verlangt eine Menge), er käme also nur aus einer fremden
  oder von Hand bearbeiteten Datei. Eine Ablehnung wäre denkbar, sperrt aber
  im Zweifel jemanden aus der eigenen Sicherung aus – deshalb erst notiert und
  nicht eingebaut.
- **Der Leerzustand ist am 10.08.2026 angesehen worden** und trägt: Hinweise
  mit Weg zum Profil, keine kaputten Karten, keine `NaN`. `node
  werkzeug/saeen.mjs --leeren` dauert zehn Sekunden – bitte gelegentlich
  wiederholen, es ist der einzige Zustand, den Nils garantiert erlebt hat.
- **Die Ansichten `essen` und `wissen` sind am 10.08.2026 durchgesehen worden.**
  Ergebnis ist Falle 28. Sauber: `haeufigeLebensmittel()` (Fenster, Rangfolge,
  Nährwerte je 100 g – `je100()` fängt die Division durch null ab), die
  Trainingsverpflegung steht nur einmal im Code, und alle 28 Quellen sind
  referenziert.
  Eine Kleinigkeit vorsorglich gerichtet: Die Karte „Rund ums Training" las
  `einheiten[0]`. Über zwölf Wochen Plan geht dabei nachweislich kein Hinweis
  verloren – aber nur, weil der Planer die harte Einheit immer zuerst legt.
  Läge die lange Ausfahrt hinten, fehlte der Hinweis zur Verpflegung während
  der Belastung an genau dem Tag, an dem er zählt. Sie sammelt jetzt über alle
  Einheiten. **Nicht** über die Tagessumme: Zwei Einheiten mit Pause sind
  keine durchgehende Belastung, und „ab 90 min" meint eine Einheit.

**Der Durchgang „wo sonst noch?" ist am 10.08.2026 gemacht worden** und hat
Falle 29 ergeben – drei Wiederholungen an neuer Stelle. Damit ist die Methode
allerdings nicht erschöpft, sondern nur einmal angewandt; sie lohnt nach jeder
weiteren Korrektur erneut.

Abgesucht und sauber:

| Muster | Ergebnis |
| --- | --- |
| Falle 1, `slice(-n)` ohne Nullprüfung | überall abgesichert (`Math.max(1, …)` oder Konstante) |
| Falle 12, Zahl + feste Mehrzahl | alle Fundstellen sind Konstanten, die nie 1 werden; `aufteilungText()` fängt die Eins ab |
| Falle 14, `Number(x) \|\| 0` im Kern | lesen durchweg bereits geprüfte Daten |
| Falle 10, „X von Y" | bereinigt, siehe Falle 29 |
| Falle 7, Kurvenwertung | bereinigt und durch einen Test gesichert |

**Falle 13 und 15 sind am 10.08.2026 abgesucht worden** – Ergebnis ist Falle 30.
Der Einstieg, der funktioniert hat: nach Feldern suchen, die berechnet und
**nie gelesen** werden (`sprintmeterZiel`), nach identischen Ausdrücken an zwei
Stellen (`wochenminuten`), und bei jedem Zähler den Namen gegen seine
Berechnung halten.

Dabei mitgeprüft und in Ordnung: `session.last` wird gespeichert, aber
nirgends gelesen – `belastung.lastProTag()` rechnet immer neu aus RPE × Minuten.
Ein toter Zwilling, der heute nicht schaden kann; bleibt bewusst stehen, weil
das Feld in gespeicherten Daten liegt und drei Tests es festhalten. **Wer es
je liest, muss vorher prüfen, ob es nach einem Import noch stimmt.**

**Die Größen des Wochenplans sind am 10.08.2026 gegen ihren Inhalt gehalten
worden** – nicht „stimmt die Zahl?", sondern „folgt sie dem, was danebensteht?".
Ergebnis sind die Fallen 35 und 36. Der Einstieg, der funktioniert hat: für
jede angezeigte Größe über alle zwölf Wochen eine Tabelle drucken und nachsehen,
**welche Spalte sich nicht bewegt**. Die Kraftdauer stand zwölfmal auf 76.

Geprüft und in Ordnung: `wochenminuten` und die Tagesminuten gehen auf,
`satzAufteilung()` stimmt mit den Überschriften überein (Falle 13 hält) und
`sprintmeter` summiert das tatsächlich Geplante.

**Der Gegenlauf dazu am selben Tag** – „wo bewegt sich die Zahl, aber nicht der
Inhalt?" – hat Falle 37 ergeben: die Intervalleinheit und die an die Tagesform
gekürzte Sprinteinheit. Die Methode, die beide fand: für jede Einheit die
angezeigte Größe gegen die Summe ihrer Blöcke halten und die Überschrift gegen
den Text darunter. Das steckt jetzt als allgemeiner Wächter in
`test/plan.test.js` und gilt auch für die angepasste Fassung – die war bis
dahin von keinem Test auf Widerspruchsfreiheit geprüft worden, obwohl gerade
sie zwei Herleitungen nebeneinander hatte.

**Die Evidenzbasis ist am 10.08.2026 gegen die Oberfläche gehalten worden** –
nicht „stimmt die Zahl?", sondern „kommt der Vorbehalt an?". Ergebnis sind die
Fallen 41 und 42. Der Einstieg, der funktioniert hat: die `praxis`-Konstanten
**zählen** statt sie aufzuzählen, und dann jedes Feld der tragenden Tabellen
daraufhin ansehen, wer es liest.

Dabei mitgemessen und für Nils' Entscheidung notiert: Bei Voreinstellung
(Regler 30, vier Tage) liegen **8 von 11 Muskelgruppen unter den 10 Sätzen**,
die der Tracker selbst als Mindestdosis nennt – Schultern bei 2,5, Brust,
Trizeps und Bizeps bei 5,0. Bei drei Trainingstagen sind es alle elf. Das ist
kein Fehler: Der Plan sagt es im eigenen Text und begründet es jetzt auch mit
Quelle (Pelland 2025, abnehmender Grenzertrag bei Maximalkraft). Ob die Dosis
für Nils' Ziele passt, ist trotzdem eine Trainingsfrage – sie steht unten.

**Was jetzt noch offen ist**, ist wenig und meist nicht am Rechner zu klären:

- Die zwei Trainingslehre-Entscheidungen oben (Trainingstage im Planer,
  Wiederholungsbereich gegen Epley-Grenze).
- **Neu, aus Falle 36:** Die Entlastungswoche plant 225 Sprintmeter – bei zwei
  Sprinttagen sind das vier Läufe je Einheit und damit genau die Untergrenze,
  die der Planer nicht unterschreitet. Sie liegt also auf dem Anschlag. Ob das
  so gewollt ist oder ob die Entlastung beim Sprint zu tief greift, ist eine
  Trainingsfrage, keine Codefrage.
- **Ebenfalls neu:** Der Volumenfaktor der Phase erreicht die Kraftsätze kaum.
  `max(2, round(3 × volumen))` liefert für 0,5 wie für 0,8 zwei Sätze – die
  Entlastungswoche hat im Kraftraum denselben Umfang wie eine normale Woche,
  nur die Spitzenwoche mit Faktor 1,0 hebt sich ab. Wer die Entlastung dort
  wirken lassen will, braucht entweder mehr Grundsätze oder eine niedrigere
  Untergrenze; beides ändert die Dosis und gehört deshalb Nils.
- **Neu, aus der Dosismessung:** 8 von 11 Muskelgruppen liegen unter der
  Mindestdosis, die der Tracker selbst nennt – bei drei Trainingstagen alle
  elf. Für Maximalkraft und Sprint ist das begründet (Pelland 2025). Für den
  **Muscle-Up als erklärtes Hauptziel** ist die Frage eine andere: Klimmzüge
  und Dips stehen mit 4–6 Sätzen pro Woche im Plan, die Schultern insgesamt
  bei 2,5. Ob das reicht oder ob der Oberkörper mehr Umfang braucht, ist eine
  Dosisentscheidung und gehört Nils.
- **Für Nils mit Netzzugang:** Die 28 Quellen gegen die Arbeiten selbst
  prüfen (von hier aus gesperrt, siehe oben). Konkret offen: die Autoren von
  `fifa11plus` und die Umfangsangaben von vier Metaanalysen.
- Am Gerät: Offline-Betrieb und GPX-Übergabe aus der Dateien-App.
- Ein Essenseintrag ohne `mengeG` zählt mit 0 kcal (siehe oben).

**Der lohnendste offene Faden ist gemessen und beziffert** (Falle 44): 94 von
222 Verfälschungen im Kern bleiben unbemerkt – von 131 zu Beginn. `node werkzeug/mutieren.mjs
<datei>` liefert die Liste je Datei in zwei bis vier Minuten; ein voller Lauf
dauert eine Viertelstunde. Die Reihenfolge, in der es sich lohnt: `belastung.js`
(12), `ausdauer.js` (13), `plan.js` (12), `leistung.js` und `aktivitaet.js`
(je 10).

**Der Ertrag sinkt allerdings, und das ist keine Nachlässigkeit.** Ein wachsender
Teil der Übriggebliebenen ist *gleichwertig*, also gar nicht zu erlegen: In
`belastung.js` sind von den zwölf allein vier bekannt harmlos – zwei
Sortiervergleiche (`a.datum < b.datum` verhält sich mit `<=` bei eindeutigen
Daten identisch) und die beiden Ampelschwellen auf dem 4-Prozent-Raster. Wer
weitermacht, sollte zuerst prüfen, ob der Randwert überhaupt vorkommen kann,
und danach, ob dahinter eine Empfehlung steht. Steht beides, lohnt der Test;
sonst kostet er nur Zeit und täuscht Gründlichkeit vor. Sortiert werden sollte nach der Frage, ob hinter der Grenze eine
Empfehlung steht – gleichwertige Verfälschungen (Sortiervergleiche, Clamps an
nie erreichten Rändern) sind keine Lücke und kosten nur Zeit.

Wer weitersucht: Die ergiebigste Frage bleibt „wo *sonst* noch?" – nach jeder
Korrektur neu, weil jede Korrektur ein neues Muster in die Liste schreibt.

Ein zweiter Faden, kleiner, aber lohnend: `grep` nach den Namen der übrigen
Kernfunktionen. `kraftEinordnung()` war tot und dabei in der Oberfläche
nachgebaut, `e1rmVerlaesslich()` tot und dabei eine echte Lücke – gefunden
nicht durch Hinsehen, sondern durch die Frage, wer sie eigentlich aufruft.

**Dieser Faden ist am 10.08.2026 zu Ende gegangen** (Falle 38): vier tote
Kernfunktionen, zwei davon in der Oberfläche nachgebaut und dort schon
abgewichen, zwei echte Zwillinge. Der Suchlauf lohnt trotzdem nach jedem
neuen Modul:

```bash
for f in kern/*.js; do
  grep -oP '^export (async )?function \K\w+' "$f" | while read -r n; do
    ruf=$(grep -rn "\b$n\b" kern app werkzeug --include=*.js --include=*.mjs \
      | grep -v "^$f:.*export .*function $n" | wc -l)
    [ "$ruf" -eq 0 ] && echo "ohne Aufrufer: $n  $f"
  done
done
```

Heute meldet er nichts. Steht dort je wieder ein Name, ist die Frage nicht
„löschen?", sondern erst „gibt es die Aufgabe woanders noch einmal?".
