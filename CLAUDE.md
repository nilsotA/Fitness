# Arbeitsanweisungen für Claude

Trainings- und Ernährungstracker für Sprint, Kraft und Ausdauer. Nutzer ist
**Nils** – Sprint-Hintergrund, will Kraft aufbauen und alte Kraft
zurückgewinnen (Muscle-Up, Liegestütze), Ausrichtung zwischen Sprint und
Ausdauer bewusst offen halten.

## Konventionen

Diese sind aus dem Schwesterprojekt `Spieleabende` übernommen und gelten strikt:

- **Null Abhängigkeiten.** Kein npm-Paket, kein Build-Schritt. `node:http`
  reicht. Wer eine Bibliothek einführen will, hat vorher einen sehr guten Grund.
- **Deutsch.** Bezeichner, Kommentare, Oberfläche, Commit-Messages. Englische
  Fachbegriffe nur, wo es keine gute Entsprechung gibt (`RPE`, `Hip Thrust`).
- **Kommentare erklären das Warum**, nicht das Was. Besonders dort, wo eine
  Entscheidung überraschend aussieht.
- Atomares Schreiben (temporäre Datei + `rename`), Umgebungsvariablen zum
  Umlenken in Tests.
- `node --test test/*.test.js` muss grün bleiben. Aktuell **171 Tests**.

## Aufbau

```
server/wissen.js       Evidenzbasis: ALLE Konstanten mit Quelle. Einzige Stelle
                       für Zahlen. Enthält auch UEBUNGEN, MUSKELGRUPPEN,
                       SCHUTZZIELE.
server/profil.js       Körperdaten, Ausrichtungsregler, Muscle-Up-Weg
server/plan.js         Wochenplaner
server/leistung.js     Einer-Maxima, Arbeitsgewichte, Progression, Muskel-
                       volumen, Schutzabdeckung, Risikoprofil
server/ernaehrung.js   Kalorien, Makros, Energieverfügbarkeit
server/belastung.js    sRPE, ACWR, Bereitschaft
server/sprint.js       Sprintzeiten, Abbruchregel, Bestzeitverlauf
server/ausdauer.js     Strecke, Tempo, Intensitätsverteilung (Grauzone)
server/store.js        JSON-Ablage
server/index.js        HTTP-Server + API
public/                Oberfläche, eine Datei je Ansicht
public/regeln.js       Geteilt zwischen Server und Browser – siehe unten
```

`public/regeln.js` ist die einzige Datei, die **beide** Seiten importieren. Die
Sprint-Abbruchregel muss im Browser laufen (Rückmeldung zwischen zwei Läufen,
ein Netzwerkaufruf pro Tastendruck wäre unbrauchbar) und auf dem Server (für
die Auswertung); dasselbe gilt für die Tempoberechnung. Statt sie zu doppeln, liegt sie dort – bewusst **ohne jeden
Import**, damit der Browser sie direkt laden kann; `server/sprint.js` bindet
sie mit `../public/regeln.js` ein. Die Schwellenwerte kommen von außen herein,
damit die Evidenzbasis trotzdem allein in `wissen.js` steht.

Die Rechenmodule sind **frei von Netzwerk- und Dateizugriff** – deshalb sind sie
testbar. Bitte so lassen: `plan.js` bekommt den Leistungsstand übergeben, statt
ihn selbst zu holen.

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

Alle vier waren echte Fehler im Betrieb, nicht theoretisch:

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

Und ein Konstruktionsfehler derselben Art: Ein Schutzziel, das sich über die
Oberfläche **nicht erfüllen lässt**, ist schlimmer als keins – man gewöhnt sich
an, die Warnung zu übersehen. Das Sprunggelenk-Ziel stand deshalb dauerhaft auf
0/2, bis Blöcke im Sprint-Aufwärmen abhakbar wurden.

## Starten und prüfen

```bash
node server/index.js                       # Port 3100, PORT= zum Umlenken
node --test test/*.test.js                 # 171 Tests
PORT=3200 TRACKER_DATEI=/tmp/x.json node server/index.js   # isoliert
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

## Offene Punkte

- Muskelgruppen-Volumen zählt Hauptmuskeln voll, mitarbeitende zur Hälfte. Die
  Halbierung ist gängige Praxis, keine Messgröße – so auch in der Oberfläche
  gekennzeichnet.
- Die Ausdauerzonen laufen über RPE, nicht über Herzfrequenz. Wer eine Uhr
  trägt, könnte die Zone daraus ableiten – die Einteilung bliebe dieselbe.
- `data/tagebuch.json` ist per `.gitignore` ausgenommen und darf **nie**
  committet werden.

## Git

Branch: `claude/fitness-training-tracker-1qa11h`. Push mit
`git push -u origin <branch>`. Kein Pull Request, außer Nils fragt danach.
