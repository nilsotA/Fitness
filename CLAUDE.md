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
- `node --test test/*.test.js` muss grün bleiben. Aktuell **486 Tests**.

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
    **Und noch einmal nach Falle 52** (zwölf Wochen Daten, 390 px): heute
    4.159 · plan 1.743 · essen 973 · fortschritt 4.977 · profil 3.620 ·
    wissen 4.691 px. Nichts ist davongelaufen; die Messung kostet zehn
    Sekunden und gehört nach jeder Runde wiederholt.
    **Nach Falle 55**, also erstmals mit protokollierten Sätzen im Bestand:
    heute 3.895 · plan 2.308 · essen 973 · fortschritt 4.109 · profil 3.599 ·
    wissen 4.691 px. Der Plan wächst, weil die Übungszeilen jetzt echte Lasten
    tragen statt Prozentangaben; der Fortschritt schrumpft, weil die
    Kraft-Tabelle keine Strichzeilen mehr zeigt.
    **Nach Falle 57**, mit vollständigem Bestand (Sätze, Prophylaxe,
    Sprintzeiten, Gewicht, Testverlauf): heute 4.643 · plan 1.845 · essen 973 ·
    fortschritt **6.682** · profil 3.620 · wissen 4.691 px. Die
    Fortschrittsansicht ist die einzige über 5.000 px, und sie ist es, weil
    dort neun verschiedene Fragen beantwortet werden. Wer sie weiter kürzen
    will, findet die Karten nach Höhe sortiert in Falle 57.
    **Nach Falle 58**, mit Ernährungstagebuch und Körperfettangabe im Bestand:
    heute 4.905 · plan 1.857 · essen **1.596** · fortschritt 6.892 · profil
    3.703 · wissen 4.703 px. „Essen" war vorher 973 px – das war der
    Leerzustand, nicht die Ansicht.
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
    | `belastung.js` | 41 | 23 | 5 |
    | `leistung.js` | 32 | 15 | 10 |
    | `ausdauer.js` | 23 | 18 | 1 |
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

47. **Derselbe Fehler eine Etage tiefer: die Kraft kannte den Regler auch
    nicht.** Nach Falle 46 folgten Sprint und Ausdauer dem Regler – die
    Krafteinheit war über den **ganzen** Regler byte-gleich: dreizehn Sätze,
    fünf Übungen, derselbe Wiederholungsbereich, ob reiner Sprinter oder
    reiner Ausdauersportler. Die Beschriftung verspricht bei 0 „alles auf
    Schnelligkeit und Maximalkraft" und bei 100 „Krafttraining nur noch
    erhaltend"; der Plan lieferte beide Male dasselbe.
    Jetzt skaliert `AUSRICHTUNG_UMFANG.kraftSaetze` die Sätze: 18 je Einheit am
    Sprint-Anschlag, 13 bei Nils' Voreinstellung (unverändert), 10 am
    Ausdauer-Anschlag. Bewegt werden die **Sätze**, nicht die Zahl der Übungen –
    jede Übung steht für ein Bewegungsmuster, das auch ein Ausdauersportler
    braucht. Die Untergrenze von zwei Sätzen je Übung bleibt.
    **Der Wächter dazu war beim ersten Wurf zu schwach**, und das ist die
    eigentliche Lehre: Er verglich die **Wochensumme** an den beiden Enden –
    und die unterschied sich schon vorher, weil die Zahl der Einheiten fällt.
    Gegen die alte Fassung schlug er deshalb nicht an. Erst der Vergleich der
    **einzelnen Einheit** (18 gegen 10 Sätze) trifft die Stelle, um die es
    geht. Wer eine Kennzahl aggregiert, prüft am Ende die Aggregation und
    nicht das, was er meint.


48. **Der Umfang stimmte, die Tage nicht.** Nach den Fallen 46 und 47 folgte
    jede Größe dem Regler – nur lag sie falsch verteilt. Bei drei
    Trainingstagen und Regler 80 standen am Montag Sprint, Kraft **und** eine
    lockere Ausfahrt: **231 Minuten**, während der Mittwoch 106 und der Freitag
    67 hatte. Dazu die sechs Stunden Abstand, die derselbe Planer zwischen
    Kraft und Ausdauer fordert – ein Zehn-Stunden-Tag. Die Wissensansicht sagt
    es selbst: „Ein Plan, der nicht gemacht wird, ist wertlos."
    Gemessen: **26 von 84** Kombinationen aus Reglerstand und Tageszahl hatten
    einen Tag mit drei Einheiten, der längste 3 h 51 min. Zwei Ursachen:
    *Erstens lief die Ersatzsuche stur von vorn durch die Woche.* Weil Kraft
    ohnehin zuerst auf die Sprinttage geht, landete die dritte Ausdauereinheit
    regelmäßig auf dem Montag, der schon zwei trug – während am Wochenende eine
    Stunde allein stand. Sie geht jetzt auf den **am wenigsten belegten** Tag.
    *Zweitens passten schlicht mehr Einheiten in die Woche, als Tage da waren.*
    Die Zahl der lockeren Einheiten wird jetzt gedeckelt, sodass kein Tag eine
    dritte bekommt – und den Umfang holen die verbleibenden nach. Weniger
    Einheiten, gleiche Wochenminuten; dieselbe Mechanik wie beim geteilten Tag
    in Falle 46. **Ergebnis: null Dreier-Tage, längster Tag 3 h 36 min**, und
    Regler 80 bei drei Tagen liest sich jetzt 182 / 116 / 116 statt
    231 / 106 / 67.
    *Ein Rest bleibt und ist benannt:* Am letzten Reglerschritt (drei Tage,
    95 → 100) fällt die Ausdauersumme um sieben Minuten, weil dort eine lockere
    Einheit zur Intervalleinheit wird und deren Dauer der Zahl der Intervalle
    folgt statt dem Minutenbudget der lockeren. Der Monotonietest lässt genau
    an diesem einen Übergang fünf Prozent zu – benannt und begründet, nicht
    weggerundet.

49. **„5 Tage" im Profil, vier im Plan – und kein Wort dazu.** Der letzte
    offene Punkt aus der Übergabe, und die Auflösung war keine
    Trainingsentscheidung, sondern eine Auskunft. Der Planer belegt in **21 von
    84** Kombinationen aus Reglerstand und Tageszahl weniger Kalendertage als
    eingestellt. Das ist Absicht: Kraft geht zuerst auf die Sprinttage, damit
    die übrigen Tage wirklich locker bleiben, und das Volumen liegt dann auf
    weniger Tagen statt verloren zu gehen.
    Nur stand das nirgends. Wer im Profil fünf Tage wählt und im Wochenplan
    vier sieht, kann nicht wissen, ob das gewollt ist – dieselbe Familie wie
    Falle 22: Wo etwas fehlt, gehört der Grund an die Stelle, an der es fehlt.
    Der Plan sagt es jetzt, samt dem Hebel („wer mehr Kalendertage belegen
    will, schiebt den Regler Richtung Ausdauer").
    **Die Frage, was das Feld bedeuten soll**, bleibt trotzdem Nils' – nur ist
    sie jetzt keine stille Unklarheit mehr, sondern eine sichtbare Aussage, der
    man widersprechen kann. Ein Wächter verlangt den Hinweis in jedem
    unterbelegten Plan und verbietet ihn in jedem vollen; die Gegenprobe stellt
    sicher, dass der Fall überhaupt vorkommt.


50. **Ein toter Korridor wurde lebendig – und war sofort falsch.** CLAUDE.md
    führte `ERNAEHRUNG.kohlenhydrate.langeAusdauer` (7–9 g/kg) als „toten
    Korridor": Der Planer sah keine Einheit über 90 Minuten vor, also griff er
    nie. Nach Falle 46 sieht er sehr wohl welche – am Ausdauer-Anschlag
    **104 Minuten**. Nur zählte der Tag trotzdem als „mittel" mit 6 g/kg, also
    wie ein 75-Minuten-Mischtag.
    Die Ursache war der Schlüssel: `tagestyp()` fragte `e.typ ===
    'ausdauerLang'` – eine Einheitenart, die der Planer **nie** erzeugt, er
    schreibt `ausdauerLocker`. Eine Eigenschaft am internen Schlüssel
    festgemacht statt an der Sache selbst; Familie von Falle 4 („Testarten
    sind nicht gleich Übungen") und Falle 38 („ein interner Schlüssel als
    deutsche Überschrift"). Gezählt wird jetzt die **Länge** der einzelnen
    Einheit, und die Schwelle steht als `langeAusdauerAbMinuten` in
    `wissen.js` statt als nackte 90 im Code.
    Für einen Ausdauersportler sind das rund **130 g Kohlenhydrate mehr** an
    genau den Tagen, an denen die Glykogenversorgung die Einheit bestimmt.
    Ein Test hält beide Richtungen fest: `ausdauerLocker` und `ausdauerLang`
    zählen gleich, Intervalle sind hart und nicht lang, und zwei kürzere
    Blöcke am selben Tag ergeben keine lange Belastung – „ab anderthalb
    Stunden" meint eine Einheit, nicht einen Tag.
    **Die Lehre:** Wenn eine Fallenliste etwas als „tot" führt, ist das eine
    Aussage über den *heutigen* Planer, nicht über den Code. Ändert sich der
    Planer, gehört jede solche Notiz noch einmal angesehen.

51. **Die Regel stand in `wissen.js`, gerechnet wurde mit einer nackten Zahl.**
    Der Faden aus Falle 21 („wer ruft das eigentlich auf?") einmal andersherum
    gezogen – nicht über Funktionen, sondern über *Zahlen*. Vier Konstanten
    hatten keinen einzigen Leser, und bei dreien war das nicht Ballast, sondern
    eine Regel, die danebengerechnet wurde:
    `SPRINT.minStundenZwischenEinheiten` (48) gegen ein `tag - letzter >= 2` im
    Planer – wer die 48 auf 72 gesetzt hätte, hätte am Plan **nichts** geändert,
    ausgerechnet bei einer der Regeln, die dieses Dokument „nicht verhandelbar"
    nennt. `PROGRESSION.anteilFuerSteigerung` (1,0) gegen ein `every()`, mit
    `anteilOben` als dritter Fassung derselben Frage direkt daneben (Falle 13).
    `AUSDAUER.anteilNiedrigintensiv` (0,8) als Zwilling von
    `AUSDAUER_ZONEN.locker.ziel`. Und `BELASTUNG.maxWochensteigerungProzent`
    (10) nirgends umgesetzt – die Aufgabe erledigt das ACWR drei Zeilen
    darüber, weshalb die Zahl ersatzlos weg ist: Eine zweite Wachstumsregel
    daneben hätte irgendwann anders geantwortet als die erste.
    **Der schwerste Fall ist der, den ein Zähler nicht findet.**
    `anteilHochintensiv` *wurde* gelesen – vom **Planer** –, während die
    **Bewertung** in `ausdauer.js` `AUSDAUER_ZONEN.hart.ziel` nahm. Zwei
    Tabellen für eine Zahl, verteilt auf Vorschlag und Note; solange beide auf
    0,2 standen, sah alles stimmig aus. Genau die Konstellation aus Falle 17,
    nur eine Ebene tiefer.
    *Die Tarnung war ein Test.* `minStundenZwischenEinheiten` hatte einen, der
    ihren Wert abfragte – damit stand ihr Name im Projekt und der `grep` aus
    Falle 38 schwieg. Falle 21 sagt es schon: Findet sich nur der eigene Test,
    gibt es die Aufgabe entweder nicht mehr – oder zweimal.
    **Der Wächter zählt selbst** (Falle 41) und nimmt Tabellen aus, die als
    Ganzes durchlaufen werden – über eine *hergeleitete* Regel, nicht über eine
    getippte Liste. Gegen die alte Fassung meldet er alle vier. Was er nicht
    findet, steht in seinem Kommentar: Gesucht wird der Feldname, nicht der
    Pfad, weil die halbe Datei über einen lokalen Namen liest
    (`const u = ERNAEHRUNG.umDieEinheit`). Ein totes Feld mit einem
    Allerweltsnamen wie `obergrenze` rutscht deshalb durch – siehe Falle 52.
    Der Plan blieb über 384 geprüfte Wochen bitgleich.

52. **Eine Marke oberhalb der eigenen Quelle.** Genau das Loch aus Falle 51:
    `ERNAEHRUNG.protein` führte vier Felder, zwei davon las niemand – und
    `minimum` wie `obergrenze` sind so allgemeine Namen, dass der neue Wächter
    sie für gelesen hielt (die Wörter stehen bei `fett.minimum` und
    `acwr.obergrenze` im Text).
    Die beiden sind **nicht** derselbe Fall, und das ist die Lehre:
    `minimum: 1.6` ist der Plateaupunkt aus Morton 2018 – die *Begründung*
    dafür, dass das Ziel bei 1,9 liegt. Ohne ihn ist der Zielwert eine
    Hausnummer, also hat er jetzt einen Leser in der Oberfläche. Er hieß nur
    falsch: Eine Untergrenze war er nie, der Tracker prüft ihn nirgends
    (Falle 30). Er heißt jetzt `plateau`.
    `obergrenze: 2.5` dagegen hatte keinen Leser **und keinen Anker**: Das
    Konfidenzintervall der eigenen Quelle endet bei 2,20. Eine Marke oberhalb
    der belegten Spanne ist die erfundene Zahl, die dieser Tracker nicht führt –
    Falle 42, nur diesmal nicht zwischen zwei Marken, sondern jenseits der
    letzten. Entfernt; das Intervall steht dafür als
    `vertrauensbereich: [1.03, 2.2]` in der Tabelle, und ein Test verlangt,
    dass `ziel` und `imDefizit` darin bleiben.
    *Beim Formulieren selbst hineingetappt:* Der erste Satz in der Oberfläche
    lautete „mehr bringt nach heutiger Datenlage nichts mehr" – über einem
    Zielwert von 1,9, während die Quelle bis 2,2 reicht. Eine Überclaim direkt
    unter der Zahl, die sie belegen sollte. Und die 2,2 standen als nackte Zahl
    im Oberflächentext, also in der wiederkehrenden Aufräumaufgabe.
    *Der Fund daneben:* Das Fett gleicht aus, was der gedeckelte
    Kohlenhydratkorridor offen lässt – **nach oben ohne Grenze**. Über zwölf
    Wochen Plan, gerechnet für 55 bis 95 kg und jede Reglerstellung,
    verschreibt der Tracker an 7,5 % der Tage mehr als 2 g/kg Fett, im
    Höchstfall 3,3, und an 3,2 % der Tage kommt **mehr Energie aus Fett als aus
    Kohlenhydraten**. Bewusst *keine* erfundene Fettobergrenze: Die Energie muss
    irgendwohin, und eine Zahl dafür gäbe `wissen.js` nicht her. Stattdessen
    benennt die Karte den Fall – strukturell (Fett gegen Kohlenhydrate, keine
    Schwelle) und mit dem Hebel: Das Kalorienziel ist hoch für das, was an dem
    Tag trainiert wird. Der Test verlangt beide Richtungen: Bei Nils' eigenen
    Vorgaben darf der Satz an keinem der vier Tagestypen stehen, und auslösbar
    muss er trotzdem sein – ein Melder, der nie meldet, besteht sonst jede
    Prüfung (Falle 18 gegen Falle 24).


53. **Die Entlastungswoche war die schwerste des Zyklus.** `PHASEN.entlastung`
    hatte fest `kraftAbsicht: 'maximalkraft'`, während seine eigene
    Beschreibung „Lasten halten" sagt. Halten ging damit in genau **einem von
    drei** Fällen – nach dem Intensivierungsblock, der ohnehin Maximalkraft
    fährt. Nach dem Aufbau sprang die Lastvorgabe von 75–85 kg auf
    **90–100 kg** und der Wiederholungsbereich von 6–12 auf 2–5: in der Woche,
    die erholen soll, die schwersten Lasten des ganzen Zyklus. Die Einheit
    dauerte dabei sogar eine Minute *länger* als in der Aufbauwoche, weil
    Maximalkraft die volle Satzpause braucht – eine Entlastung, die mehr Zeit
    kostet als die Arbeitswoche.
    *Der Tracker widersprach sich dabei selbst.* In derselben Zeile stand der
    Progressionsvorschlag „Zuletzt 80 kg – das war ein anderer Block mit
    anderer Absicht" (Falle 23). Die Meldung war richtig, die Blockgrenze war
    es nicht: Die Entlastung gehört zum Block davor. Wer die Zahl las, machte
    aus seiner Erholungswoche eine Maximalkraftwoche.
    Die Absicht kommt jetzt aus `BLOCKFOLGE` – aus der Reihenfolge, die ohnehin
    dasteht, statt aus einer zweiten Angabe daneben (Falle 11). Gefunden wurde
    das mit der Methode aus Falle 35: für jede angezeigte Größe über alle zwölf
    Wochen eine Tabelle drucken und nachsehen, welche Spalte sich **falsch
    herum** bewegt.
    **Was der Fix sichtbar machte, bleibt stehen und ist benannt:** Im
    Realisierungsblock liegen die Sätze schon in den Arbeitswochen auf der
    Untergrenze von zwei je Übung – die Entlastungswoche ist dort im Kraftraum
    Satz für Satz dieselbe Einheit. Vorher war das durch den Absichtswechsel
    verdeckt. Es ist eine Dosisfrage und gehört Nils; der Plan sagt es jetzt
    aber dazu, statt es wie einen Fehler aussehen zu lassen (Falle 22).
    *Dabei umgezogen:* Die Grundsätze (3, bei Maximalkraft 4) und die
    Untergrenze 2 standen als nackte Zahlen in `plan.js`, obwohl an ihnen
    hängt, ob der Volumenfaktor der Entlastung überhaupt ankommt. Jetzt
    `KRAFT.saetzeProUebung`, als `praxis` gekennzeichnet – belegt ist die Dosis
    je Muskelgruppe und Woche, nicht ihre Aufteilung auf einzelne Übungen.

54. **Die gekürzte Ausdauereinheit behauptete ihre alte Dauer.** Falle 37 hatte
    das für den Sprint behoben – neu bauen statt herunterrechnen. Die Ausdauer
    blieb übrig und hatte denselben Fehler zweimal: Nach einem gelben
    Morgen-Check stand im Kopf der Karte „31 min" und im Block darunter
    **„47 min gleichmäßig locker"**; die Minutenzahl steckt in der Aufschrift,
    gekürzt wurde nur das Feld daneben. Und „4 × 3 min hart / 3 min locker" mit
    **16 Minuten** – zweieinhalb Intervalle. Wer die Einheit liest, macht vier.
    Dazu wurden Ein- und Ausfahren mitgekürzt (15 → 10, 10 → 7), obwohl der
    Planer im eigenen Kommentar sagt, dass sie stehen bleiben.
    Beide kommen jetzt aus einem Baustein, den Planer und Anpassung teilen:
    `lockereEinheit()` baut aus fertigen Minuten, `intervallEinheit()` aus der
    Zahl der Intervalle; gekürzt wird die Anzahl, die Dauer folgt ihr.
    **Warum der vorhandene Wächter das nicht fand:** Er prüft seit Falle 37,
    dass `minuten` die Summe der Blockminuten ist – und das stimmte
    durchgehend. Die Aufschrift war nie Teil der Prüfung. Wer eine Konsistenz
    absichert, sichert genau die eine ab, an die er gedacht hat; die Texte
    daneben laufen weiter frei mit.
    *Zweimal beim Prüfen selbst hineingetappt, beides Falle 34:*
    `angepassteEinheit()` tut ohne `vollstaendig: true` **gar nichts** – der
    erste Anlauf des Tests prüfte eine Einheit, die niemand angefasst hatte,
    und meldete brav „alles in Ordnung". Und `createProfil()` nimmt keine
    Überschreibungen entgegen: `createProfil({ trainingstage: 5 })` liefert das
    Standardprofil, das Feld heißt außerdem `trainingstageProWoche`. Dafür gibt
    es den Helfer `profil()` in `test/plan.test.js` – wer ein Profil braucht,
    nimmt den.

55. **Der Kraftstand stand still, während man protokollierte.** Falle 22 war
    für **Tests** gelöst; für **protokollierte Sätze** stand die Lücke offen,
    und sie ist die größere. Gemessen an zwölf Wochen, in denen genau das
    eingetragen wird, was der Plan vorgibt: **98 von 276 Sätzen** fließen nicht
    in den Kraftstand, alle aus dem Aufbaublock – der schreibt 6–12
    Wiederholungen vor, Epley trägt bis 10. Im Aufbaublock allein sind es
    **98 von 98**, also jeder einzelne. Wer der doppelten Progression folgt und
    am oberen Ende arbeitet, sieht die Zahl vier Wochen lang stehen, ohne dass
    irgendwo steht, warum.
    `nichtSchaetzbareSaetze()` nennt den Grund jetzt dort, wo der Wert fehlt
    oder alt ist – **aber nur, wenn er etwas erklärt**: Ein verworfener Satz,
    der älter ist als der angezeigte Wert, sagt über dessen Alter nichts.
    Ohne diese Bedingung hinge der Satz dauerhaft unter jeder Übung, und das
    wäre Falle 24.
    *Der Fund daneben, und er wiegt schwerer als die Falle selbst:*
    **`saeen.mjs` protokollierte gar keine Sätze.** Es schrieb nur die Einheit
    – Art, Minuten, RPE. Damit hatte die halbe App im Bild keine Grundlage:
    Einer-Maxima, Progression, Muskelvolumen und Kraftmarken zeigten in *jedem*
    Screenshot dieses Projekts „–", und niemandem ist es aufgefallen, weil ein
    Strich in einer Tabelle nach „noch keine Daten" aussieht. Der Kommentar in
    der Datei behauptet seit jeher, hier laufe Plan gegen Auswertung; für die
    Kraft stimmte das nie. Jetzt wird am oberen Ende des
    Wiederholungsbereichs protokolliert, und der Plan jeder Woche kennt, was
    bis dahin eingetragen wurde.
    **Die Lehre:** Ein Prüfwerkzeug, das eine Hälfte der Daten nicht erzeugt,
    macht die Karten dieser Hälfte unsichtbar – und zwar auf eine Weise, die
    wie ein legitimer Leerzustand aussieht. Bei jedem Werkzeug lohnt die Frage,
    welche Felder es *nicht* füllt.
    *Und ein eigener Fehler, den kein Test zeigen konnte:* `zustand.js` reicht
    die Felder von `leistungsstand()` einzeln weiter, und das neue fehlte. Der
    Kern rechnete richtig, die Kerntests waren grün, am Gerät stand nichts.
    Gefunden nur, weil der Screenshot danach angesehen wurde.

56. **„Zurück auf 0 kg" stand über dem Hauptziel.** Klimmzüge und Dips laufen
    am Körpergewicht ohne Zusatzlast – der Regelfall auf dem Muscle-Up-Weg.
    `naechsteLast()` rechnete trotzdem mit einer Zahl, und bei null ergab das
    in **allen drei** Zweigen Unsinn: „0 kg halten und die Wiederholungen bis
    12 ausbauen", „Letztes Mal alle Sätze … Last auf 2,5 kg erhöhen" (welche
    Last?) und „4 Einheiten auf 0 kg ohne Fortschritt. **Zurück auf 0 kg** und
    von dort neu aufbauen." Eine Rücknahme auf null ist keine Handlung, und
    `empfehlung: 0` stand als Lastvorschlag in der Zeile. Betroffen sind genau
    die beiden Übungen, an denen Nils' erklärtes Hauptziel hängt.
    Ohne Zusatzlast steht dort jetzt der Hebel, den es wirklich gibt. Weil
    dieser Zweig keine Zahl trägt, musste `mitLast()` mit – dieselbe Bedingung
    hat schon einmal eine Begründung verschluckt (Falle 23).
    **Die Gegenrichtung zu Falle 14, im selben Zug gefunden:** Der Kern baut
    Sätze, die unverändert am Gerät landen, und schrieb sie mit
    *Dezimalpunkt* – „Zurück auf 87.5 kg", „Körpergewicht bis + 7.5 kg" in
    einer sonst durchweg deutschen Oberfläche. Falle 14 hat das Einlesen
    deutscher Zahlen gelöst und die Ausgabe nie angesehen. `zahlText()` steht
    jetzt neben `zahlAusEingabe()` in `regeln.js`; die Oberfläche darf der
    Kern nicht importieren.
    **Wie es gefunden wurde, ist der eigentliche Punkt:** nicht durch einen
    Test und nicht durch Nachdenken, sondern weil nach der Gestaltungsrunde
    ein Screenshot der Heute-Ansicht angesehen wurde – und dort stand der Satz
    mitten im Übungszettel. Sichtbar war er erst, seit `saeen.mjs` Sätze
    protokolliert (Falle 55): Vorher gab es im Bild keine Progression, also
    auch keinen falschen Rat. Ein Prüfwerkzeug, das eine Hälfte der Daten
    nicht erzeugt, versteckt die Fehler dieser Hälfte – hier zum zweiten Mal
    in Folge.

57. **Ein Werkzeug versteckt genau die Hälfte, die es nicht erzeugt – dreimal
    hintereinander.** Falle 55 hat den Satz aufgeschrieben, diese Runde hat
    ihn zu Ende geführt: „Welche Felder füllt `saeen.mjs` *nicht*?" Antwort:
    drei weitere.
    *Prophylaxe und abhakbare Aufwärmblöcke.* Der Protokolldialog führt
    `uebungen` und `prophylaxe` zusammen und schreibt beides als `uebungen`
    weg; `schutzabdeckung()` zählt nur dort. Der Säer legte eine Liste von
    Schlüsseln an – die Karte „Verletzungsschutz" stand deshalb auf **4 offen**
    und jedes Ziel auf „0 von 2 Sätzen", obwohl der Plan Nordic, Copenhagen
    und Wadenarbeit in **jede** Krafteinheit schreibt. Zwei Minuten lang sah
    das nach einem Fehler in `schutzabdeckung()` aus (Falle 34).
    *Sprintzeiten.* Ohne sie stand dort „Noch keine Zeiten erfasst" – die
    Abbruchregel, das Herzstück des Sprintmoduls, war in keinem Screenshot je
    zu sehen. Jetzt kommen alle vier Stufen vor: 13 Läufe ergeben 11 in
    Qualität, Lauf 1 ist `anlauf` und die letzten beiden `abbruch`.
    *Gewichtsverlauf und wiederholte Tests.* „Noch zu wenig Verlauf" und „Ein
    Verlauf entsteht ab der zweiten Messung" – und der Muscle-Up-Weg, das
    erklärte Hauptziel, stand in **jedem** Screenshot dieses Projekts auf
    „Stufe 0 von 10".
    **Was danach sichtbar wurde:** Die Fortschrittsansicht ist mit Daten
    7.540 px hoch statt 4.109. Der Anstieg ist kein Rückschritt, sondern das
    Ende einer Täuschung. Die längste Karte ist ein Protokoll (Leistungstests,
    1.240 px), und Protokolle klappt man zu – Zusammenfassung „Kniebeuge ·
    105 kg · +10", Kurve und Einträge darunter. 6.555 px.
    **Die Lehre, diesmal als Verfahren:** Bei jedem Prüfwerkzeug einmal die
    Datenstruktur durchgehen, die es schreibt, und jedes Feld daneben halten,
    das die App liest. Was das Werkzeug nicht füllt, sieht am Gerät aus wie
    ein legitimer Leerzustand – und ein Leerzustand wirft keine Fragen auf.

58. **`Number(null)` ist 0 – und damit rechnete der Tracker mit 0 %
    Körperfett.** `fettfreieMasse()` prüfte
    `if (!kfa && kfa !== 0) return null;`, gedacht als „ohne Angabe nichts,
    aber die Null ist ein gültiger Wert". Die Null ist kein gültiger Wert –
    niemand hat 0 % Körperfett –, und `Number(null)` ist 0, genau wie
    `Number('')`. Die Prüfung liess damit **ausgerechnet die beiden Fälle
    durch, die sie abfangen sollte**: `createProfil()` legt das Feld als
    `null` an, `profilSpeichern()` normalisiert ein leeres Formularfeld
    ebenfalls auf `null`.
    Wer den Körperfettanteil nie eingetragen hat – der Normalfall, und Nils'
    Stand – bekam `FFM = Körpergewicht`. Der Grundumsatz lief über Cunningham
    statt Mifflin-St Jeor und lag bei 78,3 kg um **441 kcal zu hoch**; mit dem
    Alltagsfaktor rund 600 kcal am Tag, und jedes Makroziel hängt daran (das
    Fettziel fiel nach der Korrektur von 182 g auf 116 g). Dieselbe zu große
    FFM ging in die **Energieverfügbarkeit** – die Zahl, an der der Tracker
    vor Unterversorgung warnt. Sie war damit systematisch zu niedrig und
    warnte grundlos.
    Der Rückfallweg war die ganze Zeit da und richtig formuliert („Für die
    Energieverfügbarkeit fehlt der Körperfettanteil") – er wurde nur nie
    erreicht. Eine Verzweigung, die niemand nimmt, altert genauso still wie
    eine Zahl, die niemand liest.
    **Wie es gefunden wurde:** nicht durch Lesen und nicht durch einen Test –
    431 Tests liefen grün darüber –, sondern weil das Ernährungstagebuch zum
    ersten Mal gesät war und Plan gegen Auswertung lief: gegessen wie
    vorgegeben, und trotzdem eine Mangelwarnung. Genau die Konstellation aus
    Falle 17, nur im Essen.
    **Die allgemeine Lehre**, und die ist größer als dieser Fall: Bei jeder
    Prüfung auf „ist ein Wert angegeben?" gehört durchgerechnet, was
    `Number()` aus den Nichtangaben macht. `null`, `''` und `false` werden
    alle zu 0; `undefined` wird NaN. Wer 0 als gültigen Wert zulassen will,
    muss die Nichtangaben **vor** der Umwandlung abfangen – und zuerst
    fragen, ob 0 überhaupt vorkommen kann.
    *Der Durchgang „wo sonst noch?" dazu:* `hfMax()` macht es richtig – es
    prüft den gemessenen Puls gegen einen Bereich statt gegen Wahrheitswerte,
    und `Number(null) = 0` fällt damit von selbst heraus. Dieselbe Frage,
    zwei Antworten in derselben Codebasis; die gute steht in `ausdauer.js`.
    Die Gegenfrage – welche Rückfälle werden genommen und sagen nichts? –
    brachte die Monotonie: `monotonie()` gab in beiden nicht berechenbaren
    Fällen ein nacktes `{ belastbar: false }` zurück, und die Oberfläche zeigt
    dann **gar nichts**. Direkt darüber in derselben Karte begründet das ACWR
    sein Fehlen ausführlich. Zwei Zahlen nebeneinander, eine erklärt sich, die
    andere verschwindet – **die Asymmetrie in einer Karte ist das
    Erkennungszeichen für Falle 22.** Beide Fälle sind erreichbar: keine
    Einheit in sieben Tagen (Leerzustand, Urlaubswoche) und sieben exakt
    gleiche Tage (Fosters Quotient teilt durch die Streuung).

59. **Das Prüfwerkzeug löschte, was es noch prüfen wollte.**
    `werkzeug/knoepfe.mjs` fand mit vollem Bestand **43 Knöpfe, drückte aber
    35** – und meldete darunter trotzdem „0 ohne sichtbare Wirkung". Die acht
    Ausgelassenen verschwanden in einem nackten `if (!ergebnis.da) continue;`:
    kein Zeichen, keine Zählung, kein Exitcode. **Falle 18 im Melder selbst**,
    an der Stelle, die genau danach sucht. Ein Werkzeug, das schweigend
    auslässt, sieht gründlicher aus als es ist.
    Die Ursache war nicht die naheliegende. Über der Schleife steht seit jeher
    „frisch laden, damit jeder Knopf denselben Ausgangszustand vorfindet" – das
    galt für die **Seite**, nicht für die **Daten**. Ein Teil der Knöpfe löscht
    nämlich: das `×` an jedem Leistungstest und an jedem Essenseintrag. Wer sie
    der Reihe nach drückt, kürzt die Liste, aus der er selbst noch liest, und
    weil die Knöpfe über ihren **Index** gegriffen werden, fielen die letzten
    vier jeder löschenden Karte heraus – vier in „fortschritt", vier in
    „essen", reproduzierbar dieselben.
    *Ich habe zuerst falsch gedeutet.* „Acht Knöpfe fehlen am Ende
    nachladender Karten" las sich wie ein Rennen gegen `daten.tests()`, also
    habe ich die feste Wartezeit durch das Warten auf einen stabilen
    Knopfstand ersetzt. Der Lauf danach war **zeichengleich** – die Einträge
    waren wirklich weg, nicht bloß noch nicht da. Falle 34, wörtlich: erst den
    Zustand ausgeben lassen, dann deuten. (Das Warten auf den stabilen Stand
    ist trotzdem geblieben, es ist die bessere Konstruktion – es hat hier nur
    nichts geheilt.)
    Der Bestand wird jetzt **vor jedem Knopf** zurückgesetzt: Der ganze
    Datensatz steht unter einem einzigen Schlüssel, eine Sicherung ist also ein
    `put` und muss nicht über das Protokoll gereicht werden. Damit sind es 43
    von 43 – und der Hinweis „verändert den Datenbestand, hinterher neu säen"
    entfällt, weil am Ende wieder dasteht, was vorher dastand.
    **Gegengeprüft**, wie es nach Falle 18 sein muss: Mit einem von Hand
    entkernten `onclick` meldet das Werkzeug „bewirkt nichts Sichtbares" und
    gibt 1 zurück. Und nach dem Lauf steht in der IndexedDB genau der gesäte
    Bestand, mit `aktuell` als einzigem Schlüssel – die eigene Sicherung räumt
    es ab, wie `lesefehler.mjs` und `ablage.mjs` ihre eingeschleusten Skripte.
    **Die Lehre:** Bei jedem Prüfwerkzeug fragen, ob es die Grundlage
    verändert, auf der seine nächste Prüfung steht. Falle 55 und 57 haben
    gefragt, welche Felder ein Werkzeug **nicht füllt**; das hier ist die
    Gegenrichtung – welche es **wegnimmt**.

60. **Ein kaputter Eintrag löschte die Summe von drei heilen.** In den offenen
    Punkten stand seit Falle 27 die Notiz, ein Essenseintrag **ohne `mengeG`**
    zähle „mit 0 kcal" – unschön, aber harmlos. Nachgesehen hatte das niemand.
    Am Gerät sah es so aus: `Frühstück · – kcal`, darunter drei tadellose
    Zeilen mit 372, 228 und 116 kcal. Ein einziger Eintrag aus einer fremden
    Sicherung nahm der ganzen Mahlzeit ihre Zahl.
    Ursache war eine **zweite Herleitung** (Falle 13, Familie Falle 21):
    `app/essen.js` summierte die Mahlzeit mit `e.kcal * e.mengeG / 100` selbst,
    statt `tagesSumme()` aus dem Kern zu nehmen. Ohne Menge ist das `NaN`, und
    `zahl()` macht daraus pflichtgemäß einen Strich. Die Kopie rechnete also
    nicht nur doppelt, sondern **schlechter** als das Original – der Kern kam
    über `Number(e.mengeG) || 0` auf 0 und lieferte weiter eine Zahl. Genau
    deshalb widersprachen sich die beiden Stellen: Die Tagesbilanz zeigte
    2.299 kcal (die 716 waren drin), die Überschrift darüber einen Strich.
    Behoben an der Wurzel: Die Oberfläche liest die Summe aus dem Kern, und
    `tagesSumme()` gibt zusätzlich `ohneMenge` zurück – die Zahl der Einträge,
    die nichts beitragen können. Beide Stellen sagen das jetzt: die Zeile
    („Ohne Menge – zählt nicht in die Summe. Löschen und neu eintragen.") und
    die Bilanz darüber. Falle 22, wörtlich: Wo Daten verworfen werden, gehört
    der Grund an die Stelle, an der das Ergebnis fehlt.
    **Nicht** geändert wurde die Importprüfung – eine Ablehnung sperrt im
    Zweifel jemanden aus der eigenen Sicherung aus, das war schon bei Falle 27
    die richtige Abwägung. Der Fehler lag nie im Annehmen, sondern im
    Verschweigen.
    *Der Wächter dazu verbietet das Summieren, nicht das Umrechnen.* Die
    einzelne Zeile zeigt weiterhin ihre eigenen Gramm – dafür gibt es im Kern
    nichts, und ein Muster auf `mengeG / 100` hätte diese berechtigte Stelle
    mitgetroffen. Es lief im ersten Anlauf nur deshalb nicht an, weil eine
    Klammer dazwischenstand: ein Test, der die Schreibweise trifft statt die
    Absicht, und beim nächsten Umbau falschen Alarm gibt. Verboten ist jetzt
    `reduce(… mengeG …)`; gegen die alte Fassung schlägt er an.
    **Die Lehre:** Eine Notiz in „offene Punkte" ist eine *Vermutung* über das
    Verhalten, keine Messung. „Zählt mit 0 kcal" stand dort ein Jahr lang und
    war falsch – nachgesehen hat es erst, wer den Eintrag wirklich angelegt
    und die Ansicht geöffnet hat.

61. **Die Belegstelle tippte ihre Belege ab.** Die wiederkehrende
    Aufräumaufgabe steht seit jeher in diesem Dokument, samt Kommandozeile:
    `grep -n "[<>]=\? *[0-9]" app/*.js`. Sie findet nur Zahlen mit einem
    Vergleichsoperator davor. „mindestens 48 h Abstand" mitten in einem Satz
    fällt durch – und dort altert eine Zahl am unauffälligsten, weil kein Test
    sie liest.
    Ein Suchlauf über Zahlen **in Zeichenketten** fand **14** Stellen, sieben
    davon in der **Wissensansicht**. Das ist die schlechteste denkbare Stelle:
    Diese Ansicht existiert einzig für Nachprüfbarkeit. Eine Zahl, die dort
    anders steht als im Plan, widerlegt genau das, wofür es sie gibt.
    Abgeschrieben waren die 48 h (eine der nicht verhandelbaren Regeln, in
    Falle 51 schon einmal umgangen), ≥95 % und <70 %, 80/20, die 6 h
    Interferenzabstand, die zehn Sätze und die 41 % von Copenhagen – dazu
    +25 % Zusatzlast und noch einmal 95 % in der Fortschrittsansicht.
    *Zwei Zahlengruppen standen gar nicht erst in `wissen.js`:* die
    Prozentsätze für Auf- und Abbau (`ZIELANPASSUNG` in `ernaehrung.js`, an
    ihnen hängt jedes Makroziel) und die Wiedereinstiegsfaktoren
    (`woche === 1 ? 0.6 : 0.8` in `plan.js`) – beide zusätzlich als Fließtext
    im Profil, also je dreifach. Sie sind umgezogen und als `praxis`
    gekennzeichnet; **der Wächter aus Falle 41 hat das sofort eingefordert**
    und zwei Vorbehaltssätze am Gerät erzwungen. Genau dafür ist er da.
    *Der Fund daneben, gefunden nicht durch Suchen, sondern durch Hinsehen:*
    `schwerpunkte()` stand in `app/profilAnsicht.js` noch einmal, unter dem
    Kommentar „Spiegelt profil.js **auf dem Server**, damit der Regler ohne
    Rückfrage reagiert". Den Server gibt es seit dem Umbau auf die serverlose
    App nicht mehr – die Begründung war weg, die Kopie blieb, und sie war
    schon abgewichen (der Kern rundet auf drei Stellen). Familie von Falle 21,
    vierter Fall; der Wächter in `test/dateien.test.js` verbietet ihn jetzt
    namentlich und ist gegen die alte Fassung gegengeprüft.
    **Die Lehre:** Eine Aufräum-Kommandozeile in dieser Datei ist selbst eine
    Behauptung darüber, was sie findet. `grep` nach Vergleichsoperatoren
    findet Schwellen im Code und übersieht Zahlen in Sätzen – also gerade die,
    die der Nutzer wirklich liest. Der Durchlauf steckt jetzt als
    `werkzeug/zahlen.mjs` in der Werkzeugkiste, mit Exitcode und einer Liste
    angenommener Fundstellen samt Grund (die fünf „je 100 g" sind die
    Konvention der Nährwertangabe, keine Vorgabe des Trackers).

62. **Der Kern hält sich selbst nicht an die eigene Regel.** Falle 61 hatte
    die Oberfläche abgesucht. Der offene Rest stand in der eigenen
    Zusammenfassung: Eine fachliche Zahl, die im **Kern** außerhalb von
    `wissen.js` steht und nirgends abgetippt wurde, findet dieses Werkzeug
    nicht – beide Funde aus Falle 61 waren nur aufgefallen, weil ihre
    Oberflächen-Kopie sie verraten hat.
    Ein Durchlauf über alle Zahlenliterale in `kern/` (ohne `wissen.js`)
    ergab 118 Kandidaten, die meisten davon Indexrechnung und
    Plausibilitätsgrenzen. Drei waren echte Trainingslehre:
    *`ALLTAGSFAKTOR` stand in `profil.js`* – die Faktoren 1,15 bis 1,5, mit
    denen der Grundumsatz multipliziert wird. Sie gehen in das Kalorienziel
    **und** in die Energieverfügbarkeit, also in genau die beiden Zahlen,
    deren Zusammenspiel in Falle 24 eine unbestehbare Note ergab. Und sie
    sind ausdrücklich **keine** Literaturwerte: Die PAL-Systematik ist
    etabliert, der Abschlag darunter ist die eigene Anpassung des Trackers,
    weil das Training separat dazukommt (Falle 5). Jetzt in `wissen.js`, als
    `praxis` – woraufhin der Wächter aus Falle 41 prompt den Vorbehalt am
    Gerät einforderte.
    *Der Epley-Nenner stand als nackte 30 in `profil.js`.* `EPLEY` in
    `wissen.js` führte die Grenze (10 Wiederholungen) und die Quelle – aber
    nicht die Zahl, die die Formel überhaupt ausmacht. `GRUNDUMSATZ` hält
    seine Koeffizienten dort sehr wohl; das war schlicht inkonsequent.
    *`AUSRICHTUNG.marken` stand wörtlich als `MARKEN` in der Profilansicht* –
    fünf Einträge mit identischen Namen und Beschreibungen, dazu die
    Auswahlschleife als zweite Fassung von `ausrichtungName()`. Tabelle plus
    eigene Einordnung daneben: dasselbe Paar wie bei `KRAFTMARKEN` in
    Falle 21, nur eine Ansicht weiter. Der Zustand trägt die Marke zwar schon,
    aber nur für den *gespeicherten* Stand – der Regler beschriftet sich beim
    Ziehen live. Genau dafür gibt es die Kernfunktion.
    *Zweimal war die Prüfung wieder der Fehler, beide Male Falle 34.* Ich
    hielt `ausrichtungName()` erst für tot – gegrept hatte ich nach
    `ausrichtungsMarke` und `marke(`, also nach Namen, die es nicht gibt; der
    dokumentierte Suchlauf meldet die Funktion völlig zu Recht nicht. Und die
    erste Gegenprobe zum neuen Wächter war wertlos, weil `git stash` den
    neuen Test gleich mit weggeräumt hat: Da lief alte Oberfläche gegen alte
    Tests und meldete brav grün.
    **Die Lehre:** „Jede Zahl braucht eine Quelle in `wissen.js`" ist eine
    Regel über den **Kern**, geprüft wurde bisher nur die Oberfläche. Der
    Unterschied ist nicht akademisch: Ein Faktor, der das Kalorienziel um
    Hunderte Kilokalorien verschiebt, lag zwei Jahre lang in derselben Datei
    wie die Körperdaten – und trug seinen Vorbehalt nirgends.

63. **Ein Anschlag, dessen Wirkung ich weggerechnet hatte.** Nach den Fallen
    61 und 62 stand die Frage an, ob die eigenen Änderungen neuen ungeprüften
    Code hinterlassen haben (Falle 31). Der Mutationslauf sagt: nein – aber er
    zeigte in `profil.js` und `ernaehrung.js` neun Altlasten, und eine davon
    war teuer.
    `makros()` rechnet `Math.max(0, (kcalNachProtein - fettZielG * 9) / 4)`
    und klammert das Ergebnis in der Zeile darauf in den
    Kohlenhydratkorridor. Ich hatte hergeleitet, der Nullanschlag sei damit
    wirkungslos: Was er auf 0 zieht, hebt die Korridoruntergrenze ohnehin
    wieder an. **Über 270 durchgerechnete Kombinationen unterscheiden sich
    140.** Der Denkfehler ist klein und lehrreich – die Untergrenze holt den
    *Boden* zurück, nicht den gerechneten Wert. Verfälscht bekommt man an
    jedem Tag die Mindestmenge des Korridors statt einer Menge, die der
    Energie folgt, und seit Falle 16 sind die Kohlenhydrate genau die Größe,
    an der der Korridor bindet. Kein Test hatte das gemerkt.
    **Dritter Fall in derselben Sitzung**, in dem Messen das Herleiten
    schlägt: erst die Prosa-Zahlen (die ich für vollständig gegrept hielt),
    dann die Behauptung, `ausrichtungName()` sei tot, jetzt dieser Anschlag.
    Die Regel aus Falle 44 – „Gleichwertigkeit gehört gemessen, nicht
    begründet" – gilt offenbar auch für die Gegenrichtung: Wer eine Stelle
    für *wirksam* oder *unwirksam* hält, rechnet es besser nach.
    *Vier weitere Lücken derselben Läufe:* die beiden Reglermarken der
    **Geräteempfehlung** (`a <= 35`, `a >= 65` – bei Schrittweite 5 exakt
    erreichbar, und dahinter steht ein Rat), die **nächste Kraftmarke**
    genau auf einer Marke (mit `<=` stünde dort das Ziel, das man gerade
    erreicht hat – Familie von Falle 10) und `bestwert()`, das mit
    `Math.min` den *schwächsten* je eingetragenen Versuch zur Grundlage des
    ganzen Muscle-Up-Wegs gemacht hätte. Letzteres ist wörtlich der Fund aus
    Falle 44, dort beim Kraftverlauf.
    *Und einer, der keine Lücke war, sondern eine fehlende Begründung:* Die
    Liste der häufigen Lebensmittel sortierte bei Gleichstand mit `-1` statt
    `0` und drehte damit gleichrangige Einträge um – zwei gleich häufige
    Lebensmittel vom selben Tag standen in der Reihenfolge, in der sie
    eingefügt wurden. Ein Test hätte hier einen Zufall festgeschrieben.
    Stattdessen entscheidet jetzt der Name; das ist prüfbar, weil es eine
    Aussage ist.
    **Ergebnis:** `profil.js` 14 von 14, `ernaehrung.js` 24 von 24. Beide
    Dateien sind damit vollständig abgedeckt.

64. **Die Messung mutierte etwas anderes als das Werkzeug.** In `plan.js`
    blieben 14 von 48 Verfälschungen unbemerkt, davon neun nachgewiesen
    gleichwertig. Die restlichen fünf waren nie aufgeschlüsselt worden.
    Drei davon sahen nach echten Lücken aus, und um das zu prüfen, habe ich
    eine Vergleichsmessung gebaut: Verfälschung einsetzen, alle 1.008
    Kombinationen aus Reglerstand, Tageszahl und Woche durchrechnen, Pläne
    vergleichen. Sie meldete für den Ausdauer-Deckel **419 Unterschiede**.
    Die Gegenprobe danach warf drei Tests um – *aber das Werkzeug meldete
    die Stelle weiter als Überlebende.* Einer von beiden musste lügen.
    Es war meine Messung. `s.replace(alt, neu)` ersetzt die **erste**
    Fundstelle – und
    `if (ausdauertage.length >= verteilung.ausdauer) break;` steht **zweimal**
    in `plan.js` (Zeile 224 und die Ersatzsuche aus Falle 48 in Zeile 257).
    Python ersetzt sogar alle. Gemessen und gegengeprüft habe ich also die
    Wirkung *beider* Stellen zusammen, gemeint war eine. Zeilengenau
    nachgerechnet: Zeile 224 allein ändert 419 Fälle, Zeile 257 allein 972 –
    und Letztere wird von den bestehenden Tests längst erwischt.
    **Die Lehre:** Wer die Ergebnisse eines Mutationswerkzeugs nachmisst, muss
    dieselbe Stelle verfälschen wie das Werkzeug – also über Zeile und Spalte,
    nicht über den Text. Sonst misst man ein anderes Experiment und hält das
    Werkzeug für kaputt. Familie von Falle 34, aber eine Ebene höher: nicht
    die Prüfung der App war falsch, sondern die Prüfung der Prüfung.
    *Die drei Stellen selbst, jetzt sauber gemessen:*
    Der **Deckel auf den Ausdauertagen** (Zeile 224) ändert 419 von 1.008
    Plänen – mit `>` bekommt die Woche einen Ausdauertag mehr, als der Regler
    vorsieht. Sichtbar erst ab **fünf** Trainingstagen: Bei vieren reichen die
    freien Tage ohnehin nicht. Mein erster Test prüfte genau diese vier und
    war deshalb grün, bevor er etwas berührte – fünftes Mal in dieser Datei.
    Der **Ausgleich** (Zeile 302) ändert 149 Fälle, im Hybridbereich um rund
    ein Drittel: 194 → 130 Minuten. Auch hier lag ich mit der Begründung
    daneben und prüfte auf einen „geteilten Tag" – bei Regler 55 teilt sich
    gar keiner; der Ausgleich wirkt schon, wenn eine lockere Einheit zur
    Intervalleinheit wird.
    `freie > 0` (Zeile 304) ändert **0 von 1.008** – nachgerechnet
    gleichwertig, `freie === 0` kommt in keiner Konfiguration vor.

65. **„Gleichwertig" war eine Behauptung, keine Messung.** Falle 64 hatte
    gezeigt, dass eine Nachmessung dieselbe Stelle treffen muss wie das
    Werkzeug. Damit standen die zehn als gleichwertig geführten Verfälschungen
    in `belastung.js` und `regeln.js` auf wackligem Grund: Sie waren
    *begründet* worden, nicht zeilengenau nachgerechnet.
    Vier der fünf in `belastung.js` halten – über 74 Auswertungen mit
    realistischen und entarteten Daten kein einziger Unterschied: das
    Monotonie-Maximum bei sieben Trainingstagen, die beiden
    Bereitschaftsschwellen auf ihrem 4-%-Raster und der Sortiervergleich in
    `entlastungFaellig()`.
    **Der fünfte hielt nicht.** Die Sortierung in `ruhepulsVerlauf()` ist nur
    „bei eindeutigen Daten" gleichwertig – und genau das war nicht
    garantiert. `checkSpeichern()` setzt beim Schreiben durch: „Ein Tag, ein
    Check – der neue ersetzt den alten." Der **Leser** kannte diese Regel
    nicht. Eine eingespielte Sicherung darf Doppelte enthalten (Falle 27
    lehnt sie bewusst nicht ab), und dann zeichnete die Kurve zwei Punkte auf
    denselben Tag: eine senkrechte Kante, die wie eine Messung aussieht.
    `ruhepulsVerlauf()` hält jetzt dieselbe Regel wie das Schreiben. Damit ist
    die Sortierung nicht mehr *hoffentlich* gleichwertig, sondern **von
    Bauart**: Die Schlüssel sind eindeutig, weil die Funktion es sicherstellt.
    *Und die Korrektur brachte prompt ihre eigene Lücke mit (Falle 31).* Die
    Prüfung `ruhepuls > 0` war abgedeckt – bis die Entdopplung dazukam, denn
    ein Null-Puls, der sich einen Tag mit einem gültigen Wert teilt, fällt
    seither ohnehin heraus. Ein Test mit eigenem Tag macht sie wieder scharf.
    Die fünf Plausibilitätsgrenzen in `regeln.js` sind geschlossen, obwohl
    dahinter keine Trainingsempfehlung steht: Was hier herausfällt,
    verschwindet stillschweigend – aus der Sprintserie, aus der Tempokurve
    oder aus der Pulszone. Genau das ist in diesem Projekt teuer (Falle 22).
    Festgehalten ist jetzt, welcher Wert noch durchgeht: eine halbe Sekunde
    nicht, 119,9 s ja, 300 km ja, 300,001 km nein, 5 bis 120 Jahre.
    **Ergebnis:** `regeln.js` 16 von 16, `belastung.js` fünf Reste – alle
    gemessen. Der Kern steht auf 37 von 242.

66. **Vier Module nachgemessen, vier echte Lücken darunter.** Die Fortsetzung
    von Falle 65 über `leistung.js`, `zustand.js`, `sprint.js`, `ausdauer.js`
    und `aendern.js`. Von vierzehn als gleichwertig geführten Verfälschungen
    hielten zehn der Nachrechnung stand; vier nicht:
    *`zustand.js`, Kopfzeile.* `Boolean(profil.startdatum) && woche < 1` – mit
    `<=` stünde in der **ersten echten Trainingswoche** „Der Plan startet erst
    noch", mit `||` auch dann, wenn gar kein Startdatum gesetzt ist. Eine
    Aussage, die jeder in der Kopfzeile sieht, und beide Ränder erreichbar.
    *`zustand.js`, Satzprüfung.* `Math.max(0, …)` und der Filter
    `wiederholungen > 0` in `uebungenPruefen()` – die Stelle, an der die App
    ihre eigene Regel durchsetzt. Ohne sie landet ein Satz mit null
    Wiederholungen im Tagebuch, und `letzteLeistung()` verlässt sich darauf.
    *`leistung.js`, Gleichstand.* `wert > stand.e1rm` – bei gleichem
    geschätzten Maximum bleibt das **frühere** Datum stehen. Mit `>=` wandert
    es auf den späteren Test, obwohl sich nichts verbessert hat; in der
    Kraft-Tabelle beantwortet dieses Datum „seit wann kannst du das". Der Rand
    ist nur mit einem echten Gleichstand zu treffen: 120 kg × 6 und
    123,4 kg × 5 ergeben beide 144,0 kg.
    *`leistung.js`, Nullsatz.* Dieselbe Familie wie oben, eine Ebene später.
    *Was hielt, hielt gemessen:* der Gleichstand bei Sprint-Bestzeiten
    (dieselbe Zahl wird gespeichert), die Reihenfolge in `letzteLeistung()`
    auch bei zwei Einheiten am selben Tag, `String(datum) >`-Vergleiche und
    die Gewichtssortierung – Letztere ist gleichwertig **von Bauart**, weil
    `gewichtSpeichern()` einen Tag nur einmal zulässt.
    *Eine Änderung ohne Verhaltensänderung, und das gehört dazugesagt:* Die
    Sortiervergleiche in `sprint.js` und `ausdauer.js` gaben bei Gleichstand
    `-1` zurück statt `0` – nach Falle 63 die Form, die gleichrangige Einträge
    umdreht. Zwei Ausfahrten an einem Tag sind hier **keine** Doppelung,
    sondern zwei echte Einheiten. Nachgemessen macht der Unterschied
    allerdings nichts: V8 ruft den Vergleich so auf, dass auch `1` die
    Reihenfolge erhält, bei drei wie bei fünf gleichen Einträgen. Der
    Vergleich sagt jetzt trotzdem, was er meint; zwei Tests halten die Folge
    fest. Der Mutationszähler steigt dadurch um zwei Stellen, die
    nachgewiesen gleichwertig sind – ein Zähler ist kein Ziel.
    **Die Lehre:** Zehn von vierzehn Begründungen waren richtig. Das ist eine
    gute Quote und trotzdem kein Argument fürs Begründen: Die vier falschen
    steckten allesamt hinter Sätzen, die plausibel klangen.

67. **Der Rauschtest hat den Rand des Rauschens nie berührt.** Das letzte
    nie zeilengenau nachgemessene Modul war `aktivitaet.js` – ausgerechnet
    das mit dem GPX-Import, an dem Falle 9 hängt („GPS-Rauschen macht
    Strecken länger, nie kürzer").
    Zwei der sechs Überlebenden sind echte Lücken, und es ist zweimal
    dieselbe Zeile: `if (fenster < 3) return punkte;`. Das Glättungsfenster
    ergibt sich aus `30 m / Punktabstand`. Bei rund **10 m je Punkt** wird es
    genau 3 – eine Radaufzeichnung im Sekundentakt bei 36 km/h, also nichts
    Ausgefallenes. Genau dort entscheidet die Schranke, ob überhaupt
    geglättet wird: Verfälscht kommt dieselbe 10-km-Spur auf **10 952 m
    statt 10 086** – fast 10 % zu lang, und damit ist auch das Tempo falsch
    und mit ihm die Zoneneinordnung.
    **Warum die vorhandenen Rauschtests das nicht fanden:** Sie erzeugen
    10 km in 3.000 Sekunden, also 2,8 m je Punkt. Damit steht das Fenster bei
    11 und die Schranke ist weit weg. Zwei sehr gute Tests – sie prüfen die
    Mitte des Bereichs und haben seinen Rand nie berührt. Dieselbe Lehre wie
    in Falle 44, nur diesmal bei einem Test, der genau für diesen Zweck
    gebaut wurde.
    Die übrigen vier Stellen sind gemessen gleichwertig: die
    Fünf-Punkte-Untergrenze, die Verzweigung „mehrere Aktivitäten" in TCX
    und GPX (bei genau einer liefert der Sammelpfad dasselbe) und der
    Sortiervergleich.
    **Damit ist jedes Modul außer `plan.js` zeilengenau nachgerechnet.** Die
    neun als gleichwertig geführten Reste dort sind der letzte Posten, der
    noch auf einer Begründung statt auf einer Messung steht.

68. **„Die Grenze bindet nie" ist keine Aussage darüber, ob man sie umdrehen
    darf.** Der letzte Posten waren die neun als gleichwertig geführten
    Verfälschungen in `plan.js`. Drei davon hielten nicht – und zwar aus
    einem Denkfehler, der in der Begründung selbst steckte.
    CLAUDE.md führte die Untergrenzen der Kürzung so: „Die drei
    Fünf-Minuten-Untergrenzen und die Intervall-Untergrenze greifen über
    6.300 tatsächlich gekürzte Blöcke kein einziges Mal." Das **stimmt** –
    und trägt trotzdem nichts. `Math.max(5, x)` ist `x`, solange die Grenze
    nicht bindet; `Math.min(5, x)` ist dann **5**. Ob eine Untergrenze bindet,
    sagt nichts darüber, ob ihr Gegenteil dasselbe Ergebnis liefert.
    Zeilengenau nachgemessen ändern die drei Stellen **1.636, 535 und 5.032**
    von 14.834 Ausgaben. Dahinter steht, was Nils an einem schlechten Tag
    tatsächlich macht: Aus 51 Minuten locker würden 5, aus fünf Intervallen
    eines, aus acht Minuten Plyometrie fünf.
    *Der Nebenfund kam aus derselben Messung:* Die gestrichene Einheit trug
    weiter `intervalle: 7` mit sich. `meter`, `uebungen` und `prophylaxe`
    werden ausdrücklich geleert – `intervalle` wurde schlicht vergessen.
    Gelesen hat es bisher niemand (ein `grep` durch `app/` findet keinen
    Leser), es ist also ein Fehler mit Verfallsdatum und keiner mit Wirkung.
    Ein Feld, das dem Objekt widerspricht, bleibt trotzdem genau die Sorte
    Rest, aus der später eine falsche Anzeige wird (Falle 30).
    **Die sechs übrigen in `plan.js` sind gemessen gleichwertig** – die
    600-Minuten-Schwelle, `Math.max(6, repMin)` beim rumänischen Kreuzheben,
    `gewicht?.bis > 0` und `gewicht.von > 0`, `einheiten.length > 1`, die
    Blockindex-Schranke und der Loop-Bound der Blocksuche, dazu `freie > 0`
    aus Falle 64 und die vierte Kürzungsgrenze im Sammelzweig.
    **Damit ist der Mutationsfaden zu Ende geführt:** 26 von 244 Stellen
    überleben, und **jede einzelne ist zeilengenau nachgerechnet**. Keine
    steht mehr auf einer plausiblen Begründung.
    **Die Lehre, und sie gilt über das Werkzeug hinaus:** Eine Begründung
    kann wahr sein und die Frage trotzdem verfehlen. „Greift nie" beantwortet
    „ist die Grenze nötig?", nicht „ist die Verfälschung gleichwertig?". Bei
    jeder Behauptung prüfen, ob sie überhaupt die gestellte Frage beantwortet.

69. **Der gekürzte Sprint wurde zweimal gekürzt – und ein Block wurde dabei
    unausführbar.** Falle 37 hat die Sprintkürzung auf „neu bauen statt
    herunterrechnen" umgestellt: `sprinteinheit()` wird mit den gekürzten
    Metern erneut aufgerufen. Direkt danach stand aber weiter ein `map`, das
    den Faktor auf jeden Block anwandte, der weder Aufwärmen noch der
    Laufblock war – auf genau einen: die **Plyometrie**. Die alte Rechnung,
    an einer Stelle übersehen.
    Die doppelte Dosis ist das kleinere Übel. Der Blocktext nennt eine feste
    Vorgabe – „3 × 5 Standweitsprünge, 3 × 5 Sprünge im Wechselschritt.
    Zwischen den Sätzen 2 min." –, die Minuten fielen von 12 auf 8. Sechs
    Sätze mit fünf Pausen à zwei Minuten sind allein **zehn Minuten Pause**.
    Die Vorgabe war rechnerisch nicht mehr ausführbar; das ist Falle 54,
    wörtlich, an der Stelle, die damals nicht mitgezogen wurde. Betroffen war
    jede einzelne gekürzte Sprinteinheit.
    *Zweiter Fund an derselben Funktion:* Der Begründungstext behauptete für
    alles ohne Sätze einen Bruchteil („Umfang halbiert" / „um ein Drittel
    gekürzt"). Falle 35 hatte den für die **Kraft** entfernt, weil die
    Satz-Untergrenze ihn nicht hergab – beim Sprint hält die Untergrenze von
    vier Läufen genauso dagegen: In **96 von 1.340** gekürzten
    Sprinteinheiten bleibt der Umfang Meter für Meter derselbe, und darüber
    stand „Umfang um ein Drittel gekürzt". Derselbe Satz sprach zudem von
    „Lasten bleiben" und „alle Sätze ziehen" – über einer Radausfahrt, die
    weder Lasten noch Sätze hat (Falle 38). Der Text nennt jetzt, was sich
    tatsächlich geändert hat, und sagt es ausdrücklich, wenn nichts fiel.
    *Und der Kürzungsfaktor stand als nackte Zahl in `plan.js`* –
    `rot ? 0.5 : 0.67`, außerhalb der einzigen Stelle für Zahlen. Über die
    Minuten der Einheit geht er in den Kalorienbedarf, gemessen bis zu rund
    1.100 kcal Unterschied an einem Tag. Jetzt `BEREITSCHAFT.kuerzung`, als
    `praxis` – der Wächter aus Falle 41 forderte den Vorbehalt prompt ein.
    **Wie es gefunden wurde, und was daran schiefging:** Fünf Prüfagenten mit
    verschiedenen Blickwinkeln haben den Anpassungspfad abgesucht und 28
    Befunde gemeldet; drei Skeptiker je Befund sollten sie widerlegen. Die
    Widerlegung fiel komplett aus (Sitzungslimit), und **mein Skript wertete
    „kein Prüfer hat sich gemeldet" als „widerlegt"** – Endstand „alle
    Befunde widerlegt", obwohl nichts geprüft worden war. Falle 18 in der
    eigenen Prüfmechanik, und die teuerste Sorte: ein Melder, der Vollzug
    meldet. Nachgemessen habe ich die folgenreichsten dann von Hand; von
    vieren stimmten alle vier, zwei davon standen aber bereits als bekannt in
    dieser Liste (Falle 35 nennt die identische Gelb/Rot-Kraftdosis
    ausdrücklich). **Wer eine Prüfung fan-out verteilt, muss den Ausfall
    eines Prüfers vom Urteil „unbedenklich" unterscheiden können.**

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
node --test test/*.test.js                 # 486 Tests
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
node werkzeug/zahlen.mjs                    # fachliche Zahlen als Text in app/?
node werkzeug/lesefehler.mjs                # überlebt der Bestand einen Lesefehler?
node werkzeug/ablage.mjs                    # sind die Notfallräte ausführbar?
node werkzeug/schuss.mjs fortschritt "Intensitätsvert"
node werkzeug/saeen.mjs --leeren            # Leerzustand ansehen
```

`breite.mjs`, `konsole.mjs`, `dialoge.mjs`, `lesefehler.mjs`, `ablage.mjs`,
`knoepfe.mjs` und `zahlen.mjs` geben einen Exitcode zurück und taugen damit als letzte Prüfung
vor dem Commit.
Die letzten beiden stören die IndexedDB absichtlich (`get` bzw. `put`
scheitern lassen) und prüfen, was die App dann tut – dort saß Falle 39. **Sie
räumen ihre eingeschleusten Skripte selbst wieder ab**; wer daran etwas ändert,
muss das mitziehen, sonst scheitern die Schreibvorgänge des nächsten
Werkzeugs. `dialoge.mjs` bedient die
Eingabedialoge und sieht in der IndexedDB nach, was ankommt – Überlauf und
Konsolenfehler sagen darüber nichts, und genau dort sitzen die teuersten Fehler
dieses Projekts (Falle 14, das gebündelte Schreiben). Es **verändert den
Bestand**; hinterher gegebenenfalls neu säen. `knoepfe.mjs` tat das früher auch
– es setzt den Bestand jetzt vor jedem Knopf zurück und stellt ihn am Ende
wieder her, weil es sich sonst die eigenen Löschknöpfe wegdrückte (Falle 59).
`PORT`, `CDP_PORT` und `APP_PORT` lenken auf
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

### Bewegung: was die Animationen dürfen

`app/style.css` hat einen eigenen Abschnitt dafür. Vier Regeln, drei davon
projektspezifisch und deshalb hier noch einmal:

- **Nur `transform` und `opacity`** – Compositor statt Layout.
- **Keine waagerechte Bewegung beim Einblenden.** `werkzeug/breite.mjs` misst
  gegen die Fensterbreite; was von rechts hereinfährt, ragt für ein paar
  Frames hinaus und wird als Überlauf gemeldet. Der Befund wäre echt, die
  Ursache die Animation.
- **Keine hochzählenden Zahlen.** `werkzeug/knoepfe.mjs` erkennt Wirkung
  daran, dass sich der Seitentext ändert – zählende Zahlen hießen: jeder Knopf
  wirkt. Und eine Zahl, die sich ändert, während man sie liest, ist keine
  Auskunft.
- **Kurz**, alles unter 0,35 s; Balken 0,62 s.

Was sich bewegt: Karten steigen versetzt auf, Balken wachsen über `scaleX`,
der Bereitschaftsring zieht sich über `stroke-dashoffset` auf seinen Wert, die
Intensitätsverteilung wischt Zone für Zone über `clip-path` auf (nicht
`scaleX` – die Prozentzahl steht mitten im Abschnitt und würde mitgequetscht),
das Plus der Klappkarten dreht sich ins Minus, Dialoge und Meldungen fahren
auf, Knöpfe geben unter dem Daumen nach. Zwei Dinge ziehen den Blick: der rote
Ampelpunkt atmet dauerhaft, die aktuelle Muscle-Up-Stufe gibt zweimal einen
Ring ab und ist dann still. Dauerhaft nur dort, wo etwas zu entscheiden ist.

**Jede dieser Animationen leitet ihren Endzustand von woanders ab** – der Ring
aus dem `stroke-dashoffset`-Attribut, der Balken aus seiner Breite. Die
Keyframes kennen nur den Anfang. Eine Animation, die den Zielwert selbst noch
einmal ausrechnet, wäre Falle 13 in Bewegung.

`prefers-reduced-motion` schaltet alles ab. Nachprüfbar ist das über
`Emulation.setEmulatedMedia` mit `features: [{ name: 'prefers-reduced-motion',
value: 'reduce' }]` – dann stehen alle Animationsdauern auf 0,01 ms. Eine
Standaufnahme zeigt keine Bewegung; wer hier etwas ändert, misst die
berechneten Werte statt hinzusehen. Für Übergänge an Pseudoelementen braucht
`getComputedStyle` das zweite Argument (`'::after'`), sonst meldet es „keine
Animation" und man sucht den Fehler im Stylesheet.

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

**Dieser `grep` findet nur die halbe Miete**, siehe Falle 61: Zahlen *in
Sätzen* („mindestens 48 h Abstand") haben keinen Vergleichsoperator davor und
fallen durch – dabei sind es genau die, die der Nutzer liest. Dafür gibt es
`node werkzeug/zahlen.mjs`; es gibt einen Exitcode zurück und führt die
angenommenen Fundstellen mit Grund.

**Und die Regel gilt für den Kern, nicht für die Oberfläche** – siehe
Falle 62. Dort steht kein Werkzeug, weil zwischen einer Trainingszahl und
einem Array-Index kein Muster unterscheidet; es bleibt Lesearbeit:

```bash
grep -nP '(?<![\w.$])\d+(\.\d+)?(?![\w.])' kern/*.js | grep -v wissen.js
```

Bei jedem Treffer die Frage: Ändert sich damit die Trainingslehre? Dann
gehört er nach `wissen.js`, samt `guete`, wenn keine Quelle dahintersteht.

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

- **Der Planer belegt weniger Tage, als im Profil stehen** – nach Falle 48 in
  21 von 84 Kombinationen, bei drei eingestellten Tagen gar nicht mehr.
  Ursache ist kein Fehler, sondern Absicht: Kraft geht zuerst auf die
  Sprinttage („so bleiben die übrigen wirklich locker"). **Seit Falle 49 sagt
  der Plan das auch**, samt Hebel. Offen bleibt allein die Trainingsfrage, was
  das Feld bedeuten soll – verfügbare Tage (dann ist es jetzt richtig) oder
  geplante Tage (dann müsste der Planer auffüllen). Das ist keine Codefrage,
  deshalb liegt sie bei Nils.
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
  **Seit Falle 55 sagt der Tracker es wenigstens** – der Code-Teil ist damit
  erledigt, die Trainingsentscheidung steht weiter aus.
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
node werkzeug/knoepfe.mjs        # 43 Knöpfe; setzt den Bestand selbst zurück
node werkzeug/zahlen.mjs         # braucht keinen Browser
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
`tagestyp()` trifft alle fünf Korridore. `langeAusdauer` war lange tot, weil
der Planer keine Einheit über 90 Minuten vorsah – seit Falle 46 tut er das,
und seit Falle 50 zählt die Länge statt des Schlüssels.

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
  Der Rest davon – ein Essenseintrag **ohne `mengeG`** – ist am 11.08.2026
  erledigt, und er war schlimmer als notiert (siehe Falle 60). An der
  Entscheidung selbst ändert sich nichts: Abgelehnt wird so ein Eintrag
  weiterhin nicht, weil das im Zweifel jemanden aus der eigenen Sicherung
  sperrt. Er wird jetzt nur **genannt** statt verschwiegen.
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

**Die Zahlen selbst sind am 10.08.2026 nach Lesern durchsucht worden** –
die Umkehrung des Funktions-`grep` aus Falle 38, angewandt auf Konstanten statt
auf Funktionen. Ergebnis sind die Fallen 51 und 52. Der Wächter dazu steht in
`test/wissen.test.js` („Jede Zahl in wissen.js hat einen Leser"); er läuft in
jeder Suite mit, hat aber eine bekannte Lücke bei allgemeinen Feldnamen, die in
seinem Kommentar steht. Wer dort weitersucht, tut das am besten an den
Tabellen mit mehreren gleichnamigen Feldern (`minimum`, `ziel`, `obergrenze`).

**Die Ernährung ist am selben Tag gegen den Planer durchgerechnet worden** –
jeder Tag aus zwölf Wochen, für vier Körpergewichte mit passender Größe, alle
Reglerstellungen, Tageszahlen, Kalorienziele und Alltagsfaktoren (60.480 Tage).
Geprüft und in Ordnung: Die Makrosumme trifft das Kalorienziel auf höchstens
4 kcal genau, der Hinweis „Kohlenhydrate unter dem Korridor" erscheint nur bei
echtem Defizit, und das Fett fällt nie unter seine Untergrenze. Herausgekommen
ist der Fettrest ohne Obergrenze (Falle 52).

**Was jetzt noch offen ist**, ist wenig und meist nicht am Rechner zu klären:

- Die zwei Trainingslehre-Entscheidungen oben (Trainingstage im Planer,
  Wiederholungsbereich gegen Epley-Grenze).
- **Neu, aus Falle 36:** Die Entlastungswoche plant 225 Sprintmeter – bei zwei
  Sprinttagen sind das vier Läufe je Einheit und damit genau die Untergrenze,
  die der Planer nicht unterschreitet. Sie liegt also auf dem Anschlag. Ob das
  so gewollt ist oder ob die Entlastung beim Sprint zu tief greift, ist eine
  Trainingsfrage, keine Codefrage.
- **Neu, gemessen nach Falle 53: Weniger Wochenumfang, aber die längere
  Einheit.** Der Planer verteilt die Sprintmeter auf die *kleinste* Zahl von
  Tagen, bei der keine Einheit über die Qualitätsgrenze läuft – so steht es im
  Kommentar und so rechnet er auch. Der Nebeneffekt: Sinkt der Wochenumfang
  unter das, was ein einzelner Tag trägt, wird die Einheit **länger** statt
  kürzer. Bei Nils (4 Tage, Regler 30) fällt der Umfang von 540 m in der
  Intensivierung auf 330 m in der Realisierung – aus 2 × 9 Läufen werden
  **1 × 11**. Ausgerechnet der Block „Wenig Umfang, viel Qualität" bekommt
  damit die längste Sprinteinheit der zweiten Zyklushälfte, in einzelnen
  Reglerstellungen bis auf die Qualitätsgrenze von 12 Läufen. Gemessen in
  **48 von 84** Kombinationen aus Reglerstand und Tageszahl.
  Das ist kein Widerspruch zwischen Code und Absicht – beide sagen dasselbe.
  Es ist die Frage, ob eine Obergrenze als Voreinstellung taugen soll: Dieselbe
  Datei sagt an anderer Stelle, der Wochenwert aus der Literatur sei „eine
  Obergrenze, kein Soll" (Falle 36). Die Gegenrichtung – so viele Tage wie
  möglich – ist genauso wenig richtig: Bei Nils würde der Aufbaublock dann auf
  drei Sprinttage gehen, und jede Einheit kostet 32 Minuten Aufwärmen. Die
  saubere Lösung wäre eine *Zielgröße* für Läufe je Einheit zwischen den
  bestehenden Grenzen 4 und 12 – und die gäbe `wissen.js` nicht her, sie wäre
  eine erfundene Zahl. Deshalb steht hier nur die Messung; die Abwägung
  zwischen „eine lange" und „zwei kurze" Einheiten ist Trainingslehre und
  gehört Nils.
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
- ~~Ein Essenseintrag ohne `mengeG` zählt mit 0 kcal~~ – erledigt, Falle 60.

**`plan.js` ist am 10.08.2026 erneut mutiert worden**, nach den Fallen 53 und
54: **10 Überlebende** statt 12. Zwei echte Lücken sind geschlossen (die
Wiederholungsuntergrenze beim Hip Thrust – im Maximalkraftblock stünden sonst 2
statt 6 – und das obere Ende beim rumänischen Kreuzheben). Drei weitere sind
nachweislich **gleichwertig** und brauchen keinen Test; das ist selbst ein
Ergebnis, damit es niemand ein zweites Mal prüft: Die Schwelle „viel Training"
(600 min) wird in 1.008 geprüften Wochen nie exakt getroffen, `gewicht.bis === 0`
kommt nicht vor, und die Fünf-Minuten-Untergrenze der Kürzung greift bei 6.300
tatsächlich gekürzten Blöcken kein einziges Mal.

**`ausdauer.js` und `belastung.js` sind am 10.08.2026 abgearbeitet** – die
beiden Dateien, die in Falle 44 als lohnendste offene Posten standen:

| Datei | Stellen | vorher | jetzt | davon gleichwertig |
| --- | --- | --- | --- | --- |
| `ausdauer.js` | 23 | 13 | **1** | 1 |
| `belastung.js` | 41 | 12 | **5** | 5 |

**Damit ist dort nichts mehr zu holen, und das ist selbst das Ergebnis.** Alle
sechs Übriggebliebenen sind nachweislich gleichwertig, jede mit Begründung,
damit sie niemand ein zweites Mal aufrollt:

- Zwei **Sortiervergleiche** (`a.datum < b.datum ? -1 : 1`) – bei eindeutigen
  Daten verhalten sich `<` und `<=` identisch. Der dritte war es **nicht**:
  Bei doppelten Datumsangaben aus einer eingespielten Sicherung wich er ab;
  `ruhepulsVerlauf()` entdoppelt jetzt selbst, siehe Falle 65.
- Die beiden **Bereitschaftsschwellen** 45 und 65: Fünf Antworten zu je 1–5
  ergeben nur Vielfache von 4 %, die Marken liegen zwischen den Rasterpunkten
  (steht seit Falle 44 auch bei den Konstanten).
- Das **Monotonie-Maximum** bei sieben Trainingstagen. `trainingstage < 7`
  sieht nach einem offenen Rand aus, weil `sqrt(7/0)` Infinity wäre – gelesen
  wird `maximum` aber nur im Zweig `!bewertbar`, und der gilt nur unter sechs
  Trainingstagen. Der Fall ist nicht erreichbar.

**Die Lehre aus dieser Runde, und sie ist teuer bezahlt:** Ein Randtest, der
den Rand nicht erreicht, ist grün und wertlos. Dreimal hintereinander
passiert:
1. Die ACWR-Marken – der chronische Schnitt enthält die akute Woche mit, es
   gilt `wert = 4·akut / (akut + 3·alt)`. Wer 1.300 gegen 1.000 setzt, bekommt
   1,21 statt 1,30.
2. Die Fenstergrenzen – Tage *jenseits* der Grenze unterscheiden `>` und `>=`
   gar nicht. Nur der Tag **auf** der Kante tut es.
3. Der Vorbehalt zum geschätzten Maximalpuls – er hängt im Zweig „zu viel
   hart", und der wird erst ab rund 1.200 Minuten im Fenster erreicht.

Jedes Mal war der Test grün, bevor er etwas prüfte. Nach jedem Randtest
gehört deshalb die Gegenprobe: Verfälschung von Hand einsetzen und sehen, ob
der Test wirklich fällt.

**Auch `plan.js`, `leistung.js` und `aktivitaet.js` sind durch** (10.08.2026):

| Datei | Stellen | vorher | jetzt |
| --- | --- | --- | --- |
| `plan.js` | 47 | 16 | **9** |
| `leistung.js` | 36 | 11 | **4** |
| `aktivitaet.js` | 22 | 10 | **6** |

Geschlossen wurden die Stellen, hinter denen eine Aussage steht: die
**48-Stunden-Regel** (eine der nicht verhandelbaren), die **Epley-Grenze** bei
genau zehn Wiederholungen, das **Satzfenster** von `saetzeProWoche` in beide
Richtungen – die Funktion trägt Muskelvolumen *und* Schutzabdeckung –, der
**Nullsatz** (ein Satz ohne Wiederholung ist kein harter Satz), der **gleiche
Tag** bei `nichtSchaetzbareSaetze`, die **Unter- und Obergrenze des
Aktivitätsimports** (eine Minute, 300 km) und der **Starttag**, an dem sonst
„Woche 0" in der Kopfzeile stünde.

Von den Übriggebliebenen sind in `plan.js` sechs nachgewiesen gleichwertig und
brauchen keinen Test – nachgerechnet, nicht vermutet:

- ~~Die **drei Fünf-Minuten-Untergrenzen** der Kürzung und die
  **Intervall-Untergrenze**: greifen über 6.300 tatsächlich gekürzte Blöcke
  kein einziges Mal.~~ **Diese Begründung war falsch gestellt** – dass eine
  Grenze nie bindet, sagt nichts darüber, ob ihr Gegenteil dasselbe liefert.
  Drei der vier ändern zeilengenau gemessen Tausende Ergebnisse und sind seit
  Falle 68 durch Tests gedeckt.
- Die **600-Minuten-Schwelle**: wird in 1.008 geprüften Wochen nie exakt
  getroffen.
- **`Math.max(6, repMin)`** beim rumänischen Kreuzheben: Die Übung steht nur
  im Hypertrophieblock, und dort *ist* `repMin` gleich 6.
- **`gewicht?.bis > 0`**: kommt in keiner geprüften Woche mit 0 vor.
- **`einheiten.length > 1`**: Eine einzelne Einheit kann nicht gleichzeitig
  Kraft und Ausdauer sein, die innere Bedingung greift also nie.

In `leistung.js` und `aktivitaet.js` sind die Reste Sortiervergleiche,
Gleichstände (`wert > stand.e1rm` behält bei Gleichheit denselben Wert) und
die Fensterbreiten der GPX-Glättung, deren Ergebnis sich um einzelne Meter
verschiebt – dort gibt es keine Schwelle mit einer Empfehlung dahinter.

**Und die letzten sechs Module** (10.08.2026) – damit ist der ganze Kern
einmal durch:

| Datei | Stellen | zu Beginn | jetzt |
| --- | --- | --- | --- |
| `ausdauer.js` | 24 | 18 | **1** |
| `belastung.js` | 41 | 23 | **5** |
| `plan.js` | 47 | 16 | **9** |
| `leistung.js` | 36 | 11 | **4** |
| `aktivitaet.js` | 22 | 12 | **4** |
| `ernaehrung.js` | 24 | 15 | **0** |
| `sprint.js` | 9 | 6 | **2** |
| `zustand.js` | 8 | 11 | **0** |
| `profil.js` | 14 | 6 | **0** |
| `regeln.js` | 16 | 7 | **0** |
| `aendern.js` | 2 | 2 | **1** |

Zusammen **26 von 243** – von 131 zu Beginn, 94 vor jener Runde und 53
danach. `profil.js`, `ernaehrung.js`, `regeln.js` und `zustand.js` stehen
seit dem 11.08.2026 auf null (Fallen 63, 65 bis 67), `plan.js` auf 9
(Fallen 64 und 68). **Jeder verbliebene Rest im ganzen Kern ist zeilengenau
nachgemessen**, keiner steht mehr auf einer Begründung. Der
größte Einzelfund war dabei keine Randfrage: Die **Abbruchregel** hing an zwei
Prozentmarken (2 % Warnung, 3 % „hier aufhören"), und beide waren ungeprüft,
obwohl Falle 25 genau an dieser Stelle sitzt.

**Zwei Erkenntnisse über das Verfahren, beide teuer:**

*Der `grep`-Suchlauf aus Falle 38 prüft nur eine Ebene.* `uebungsVerlauf()`
hatte einen Aufrufer und galt damit als lebendig – dass **dessen** Aufrufer
(`daten.leistung()`) keinen hatte, sieht er nicht. In der toten Funktion
steckte eine falsche Rechnung für Körpergewichtsübungen (Falle 3). Wer nach
toten Funktionen sucht, verfolgt die Kette bis zur Oberfläche.

*Gleichwertigkeit gehört gemessen, nicht begründet.* Beim Fett-Rand in
`makros()` hatte ich schlüssig hergeleitet, `<` und `<=` müssten dasselbe
ergeben – über 100.025 durchgerechnete Kombinationen unterscheiden sie sich an
**125** Stellen. Jede in dieser Datei als gleichwertig geführte Verfälschung
trägt deshalb eine nachgerechnete Begründung, keine plausible.

**Die Lehre dieser beiden Runden, viermal bezahlt:** Ein Randtest, der den
Rand nicht erreicht, ist grün und wertlos. Der chronische ACWR-Schnitt enthält
die akute Woche mit; Tage *jenseits* einer Fenstergrenze unterscheiden `>` und
`>=` gar nicht; ein Satz, der nur in einem Zweig steht, braucht dessen
Bedingungen; und `meter / 111320` trifft die Haversine-Strecke nicht – aus
300.000 angefragten Metern wurden 299.663. **Nach jedem Randtest gehört die
Gegenprobe: Verfälschung von Hand einsetzen, prüfen, dass der Test fällt,
Datei zurücklegen.** Ohne sie hätte ich viermal einen grünen Test gemeldet,
der nichts berührt.

**Der Mutationsfaden ist damit abgearbeitet** – alle elf Kernmodule sind
geprüft, und die Reste sind zum großen Teil nachgewiesen gleichwertig. Was
bleibt, ist die Frage nach dem Muster, nicht nach der Zeile.

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
