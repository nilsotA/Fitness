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
- `node --test test/*.test.js` muss grün bleiben. Aktuell **228 Tests**.

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
  sprint.js           Sprintzeiten, Abbruchregel, Bestzeitverlauf
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
  Krafteinheit. Belegte Schutzwirkung, vier Minuten Aufwand.
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
8. **Zwei verschiedene Zahlen sind noch keine richtige Beschriftung.** Die
   Nachkommastellen wuchsen nur, solange Anfangs- und Endwert *gleich*
   aussahen. 9,75 → 9,43 km/h stand deshalb als „10" → „9" da: aus 3 % wurden
   optisch 10 %. Maßstab ist die Veränderung, nicht die Unterscheidbarkeit –
   siehe `beschriftungsStellen()`.

Und drei Konstruktionsfehler derselben Art:

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
- Der Morgen-Check setzte beim Öffnen jeden Regler wieder auf 3. Wer über
  „Ändern" eine einzelne Antwort korrigieren wollte, überschrieb damit
  stillschweigend alle anderen mit „okay" – und verfälschte die Bereitschaft
  genau an dem Tag, an dem er hinsah. Dialoge, die bestehende Daten bearbeiten,
  müssen sie vorbelegen.

## Starten und prüfen

```bash
node server/index.js                       # Port 3100, PORT= zum Umlenken
node --test test/*.test.js                 # 228 Tests
PORT=3200 node server/index.js             # zweite Instanz
```

**Nicht** `pkill -f "node server/index.js"` benutzen: Das Muster steht in der
eigenen Kommandozeile und die Shell bringt sich selbst um. Lieber einen neuen
Port nehmen.

### Oberfläche im Browser prüfen

Chromium liegt unter `/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
Playwright ist **nicht** installiert (soll auch nicht – null Abhängigkeiten).
Stattdessen direkt über das DevTools-Protokoll; Node 22 hat `WebSocket`
eingebaut:

```bash
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9555 --user-data-dir=/tmp/chrome-profil about:blank &
```

Dann per CDP `Emulation.setDeviceMetricsOverride` (390 × 1400, mobile) und
`Page.captureScreenshot`. Zwei Stolpersteine:

- **Navigation auf denselben Hash lädt die Seite nicht neu.** Nach Codeänderungen
  zusätzlich `Page.reload` mit `ignoreCache: true`, sonst prüft man alten Stand.
- `ruf()` liefert bereits `a.result`; das Ergebnis von `Runtime.evaluate` liegt
  also unter `treffer.result.value`, nicht eine Ebene tiefer.

Fertige Skripte lagen im Scratchpad (`schuss.mjs`, `dialog.mjs`, `speichern.mjs`)
– die sind sitzungsgebunden und müssen ggf. neu geschrieben werden.

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
