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
- `node --test test/*.test.js` muss grün bleiben. Aktuell **328 Tests**.

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
node --test test/*.test.js                 # 328 Tests
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
node werkzeug/schuss.mjs fortschritt "Intensitätsvert"
node werkzeug/saeen.mjs --leeren            # Leerzustand ansehen
```

`breite.mjs` und `konsole.mjs` geben einen Exitcode zurück und taugen damit als
letzte Prüfung vor dem Commit. `PORT`, `CDP_PORT` und `APP_PORT` lenken auf
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
node werkzeug/breite.mjs && node werkzeug/konsole.mjs
```

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

**Naheliegende nächste Runde:** `kern/ernaehrung.js` – der letzte große
Rechenkern ohne Verlaufssimulation. Falle 16 stammt von dort und war ein
Widerspruch zwischen zwei Herleitungen derselben Größe; ob Kalorien, Makros
und Energieverfügbarkeit über zwölf Wochen mit wechselnden Tagestypen
zusammenpassen, hat nie jemand nachgerechnet. Der Einstieg ist derselbe: Plan
säen, Trainingsumsatz je Tagestyp gegen die Makrovorgabe halten und fragen, ob
der Tracker seinem eigenen Vorschlag widerspricht.

Ein zweiter Faden, kleiner, aber lohnend: `grep` nach den Namen der übrigen
Kernfunktionen. `kraftEinordnung()` war tot und dabei in der Oberfläche
nachgebaut, `e1rmVerlaesslich()` tot und dabei eine echte Lücke – gefunden
nicht durch Hinsehen, sondern durch die Frage, wer sie eigentlich aufruft.
