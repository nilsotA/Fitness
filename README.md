# Trainingstracker

Trainings- und Ernährungsplanung für Sprint, Kraft und Ausdauer – auf
sportwissenschaftlicher Grundlage, mit offengelegten Quellen.

Keine Datenbank, keine Abhängigkeiten, kein Build, kein Konto. Node installieren,
starten, loslegen. Alle Daten liegen als eine JSON-Datei auf deinem Rechner.

---

## Losgehen

```bash
node server/index.js       # oder: npm start
```

Der Server nennt beim Start alle Adressen:

```
Auf diesem Rechner:  http://localhost:3100
Im WLAN (Handy):     http://192.168.x.x:3100
```

Die Handy-Adresse ist die wichtigere: Der Tracker ist für die Bedienung am Gerät
gebaut, mit dem du auch trainierst.

Anderer Port: `PORT=8080 node server/index.js`

**Erster Schritt:** Unter *Profil* Geburtsjahr, Größe und Gewicht eintragen. Ohne
diese Angaben kann der Ernährungsteil nichts rechnen. Der Körperfettanteil ist
freiwillig, macht den Grundumsatz aber deutlich treffsicherer und schaltet die
Prüfung der Energieverfügbarkeit frei.

---

## Der Ausrichtungsregler

Das ist der Kern. Ein Schieberegler von **reinem Sprint (0)** bis **reiner
Ausdauer (100)** – und du musst dich nicht festlegen.

Der Regler bestimmt:

- wie viele Sprint-, Kraft- und Ausdauereinheiten die Woche hat
- welches Ausdauergerät empfohlen wird (dazu unten mehr)
- wie viele Kohlenhydrate der Ernährungsteil einplant
- ob das Krafttraining auf Maximalkraft oder Kraftausdauer zielt

Schiebst du ihn, zieht der Plan mit. Es gibt nichts neu aufzusetzen. Wer heute
sprintlastig trainiert und in vier Monaten mehr Richtung Ausdauer will, schiebt
den Regler und trainiert weiter.

Der Kraftanteil fällt dabei bewusst flacher ab als der Sprintanteil: Auch bei
voller Ausdauerausrichtung bleibt Krafttraining im Plan, weil es dort ebenfalls
gebraucht wird – nur anders dosiert.

---

## Was der Planer macht

Aus Regler, verfügbaren Tagen und Trainingswoche entsteht ein konkreter
Wochenplan mit Sätzen, Wiederholungen, Lasten, Sprintstrecken und Pausen.

Diese Regeln sind fest verdrahtet, weil sie aus der Literatur kommen und nicht
aus Geschmack:

| Regel | Warum |
|---|---|
| Sprint höchstens 3×/Woche, ≥48 h Abstand | Höchstgeschwindigkeit ist nur bei frischem Nervensystem trainierbar |
| Am gemeinsamen Tag Sprint **vor** Kraft | Umgekehrt wäre der Sprint durch Vorermüdung wertlos |
| Sprintstrecken bleiben bei ~30 m | Längere Läufe sind Tempohärte, nicht Schnelligkeit. Mehr Umfang kommt über Sätze |
| Ausdauer möglichst an anderen Tagen, sonst ≥6 h Abstand | Direkt nach Kraft frisst die Ausdauereinheit einen Teil der Kraftanpassung |
| 80 % der Ausdauer locker, 20 % hart | Polarisiertes Modell. Der Bereich dazwischen ermüdet, ohne zu entwickeln |
| Nordic Hamstring und Copenhagen Adduction in jedem Krafttag | Halbiert das Hamstring-Risiko; vier Minuten Aufwand |
| Jede vierte Woche Entlastung | Die Anpassung entsteht dort, nicht in den drei Wochen davor |

### Interferenz: warum das Rad empfohlen wird

Ausdauertraining stört die Kraftentwicklung – aber dosisabhängig und
modalitätsabhängig. **Laufen** stört Hypertrophie und Kraft deutlich,
**Radfahren** praktisch nicht; der Unterschied liegt im exzentrischen
Muskelschaden beim Laufen.

Deshalb: bei Sprintfokus Rad, bei Ausdauerfokus Laufen (dort zählt Spezifität
mehr als die Interferenz), dazwischen gemischt. Wählst du Laufen bei starkem
Sprintfokus, sagt der Plan dir, was dich das kostet – verbietet es aber nicht.

### Vom Protokoll zur nächsten Last

Der Plan sagt nicht „85–92 % 1RM" – am Gerät hilft das niemandem. Er sagt
**„105–115 kg"**, sobald er die Datenlage dafür hat.

Zwei Quellen speisen das: eingetragene Krafttests und protokollierte Sätze.
Das Protokoll gewinnt, weil es die Lasten enthält, die wirklich bewegt wurden.
Solange nichts vorliegt, bleibt die Prozentangabe stehen – eine erfundene Zahl
wäre schlechter als gar keine, weil sie am Gerät wie eine Vorgabe aussieht.

Die Last folgt dabei der Wiederholungszahl, nicht umgekehrt: Über die
umgekehrte Epley-Formel plus ein bis zwei Wiederholungen Reserve. Ohne diese
Ableitung driften Vorgabe und Gewicht auseinander, und es entstehen Vorgaben
wie „7 Wiederholungen bei 90 % 1RM", die schlicht nicht ausführbar sind.

**Progression** läuft nach doppelter Progression: Erst die Wiederholungen im
Zielbereich nach oben arbeiten, dann die Last erhöhen und im Bereich wieder
unten anfangen. Gesteigert wird nur, wenn im letzten Training *jeder* Satz oben
ankam. Steht die Last dreimal ohne Fortschritt, geht sie um 10 % zurück – gegen
dieselbe Wand zu laufen kostet nur Zeit.

Bei Klimmzügen und Dips wird mit der **Gesamtlast** gerechnet, also
Körpergewicht plus Zusatz. Sonst wären Prozentsätze sinnlos: 85 % einer
Zusatzlast von 20 kg wären 17 kg, die tatsächliche Belastung sänke dabei aber
nur von 98 auf 95 kg.

### Periodisierung

Zwölf Wochen in drei Blöcken, jeder mit eigenem Schwerpunkt:

1. **Aufbau** (3 Wochen) – Umfang sammeln, Hypertrophie, aerobe Basis, Beschleunigung
2. **Entlastung** (1 Woche)
3. **Intensivierung** (3 Wochen) – Lasten hoch, Umfang runter, Maximalkraft, fliegende Sprints
4. **Entlastung** (1 Woche)
5. **Realisierung** (3 Wochen) – wenig Umfang, viel Qualität, Explosivkraft
6. **Entlastung** (1 Woche)

Danach beginnt der Zyklus von vorn – mit dem Niveau, das du dir erarbeitet hast.

Der Sprintumfang sinkt dabei von Block zu Block, während die Intensität steigt:
etwa 960 m → 720 m → 420 m pro Woche. Das ist der Punkt der Periodisierung.

### Wiedereinstieg

Optional (Standard: an) laufen die ersten beiden Wochen mit 60 % und 80 % des
Umfangs. Nach jeder längeren Pause ziehen Sehnen und Bänder langsamer nach als
Muskeln und Motivation.

---

## Ernährung

Der Bedarf wird **pro Tag** gerechnet, nicht pauschal über die Woche: Ein Tag mit
Sprint plus Kraft braucht etwas anderes als ein Ruhetag. Genau darin liegt der
Nutzen gegenüber einer festen Tageszahl.

- **Grundumsatz** nach Cunningham (mit Körperfettanteil) oder Mifflin-St Jeor
- **Trainingsverbrauch** über MET-Werte je Einheitentyp und Dauer
- **Protein** 1,9 g/kg, im Defizit 2,2 g/kg
- **Fett** 1,0 g/kg als Untergrenze für den Hormonhaushalt
- **Kohlenhydrate** füllen den Rest – mit Korridor je Tagestyp (3–4 g/kg am
  Ruhetag bis 7–9 g/kg am langen Ausdauertag)

Reichen die Kalorien nicht für den Kohlenhydratkorridor, sagt der Tracker das,
statt still eine unrealistische Zahl auszugeben.

### Energieverfügbarkeit

Der aussagekräftigste Einzelwert für die Frage, ob du langfristig genug isst:
was nach dem Training je Kilo fettfreier Masse übrig bleibt. Unter 30 kcal/kg
gilt als kritisch, ~45 als solide.

Bewusst berechnet über **abgeschlossene Tage**, nie über den laufenden. Ein halb
protokollierter Vormittag ergäbe sonst jeden Tag eine Warnung „kritisch" – bis
die Warnung nichts mehr bedeutet.

---

## Belastungssteuerung

- **Session-RPE** (Anstrengung × Minuten) als interne Belastungszahl
- **Morgen-Check**: fünf Fragen, zwanzig Sekunden, Ampel plus konkrete Empfehlung
- **Akut-zu-chronisch-Verhältnis** als grobe Ampel für Belastungssprünge
- **Monotonie** nach Foster: unterscheiden sich harte und lockere Tage genug?

Zum ACWR sagt der Tracker ausdrücklich dazu, was es *nicht* kann: Es wird oft als
Verletzungsvorhersage verkauft, hält der methodischen Prüfung aber nicht stand.
Als Ampel für Belastungssprünge bleibt es brauchbar – mehr nicht.

---

## Trainingsprotokoll

Sätze mit Gewicht und Wiederholungen, vorbelegt mit der Last, die der Plan
vorschlägt. Im Normalfall genügt Antippen und Speichern – der Dialog ist für
die Situation gebaut, in der er benutzt wird: zwischen zwei Sätzen, mit dem
Handy in einer Hand.

Einen Satz nicht geschafft? Haken raus statt löschen. Einen mehr gemacht?
„+ Satz". Übungen ohne Zusatzlast wie Nordic Hamstring zeigen gar kein
Gewichtsfeld.

Über die Pfeile oben lässt sich tageweise zurückblättern. Wer abends müde nach
Hause kommt und erst am nächsten Tag protokolliert, trägt die Einheit trotzdem
auf den richtigen Tag ein.

## Fortschritt

- **Sätze diese Woche** je Übung, gegen die Marke von zehn harten Sätzen
  gemessen – die Zahl, an der sich Muskelaufbau entscheidet
- **Weg zum Muscle-Up** in zehn Stufen mit überprüfbaren Toren. Stufen lassen
  sich nicht überspringen: Ohne Zugkraft über die Stange hinaus gibt es keinen
  Übergang, ohne Dip-Kraft keinen Ausstoß.
- **Kraftmarken** relativ zur Körpermasse, gespeist aus Tests *und* Protokoll
- **Leistungstests** mit Verlaufskurven – Sprint, Sprung, Klimmzüge, Liegestütze,
  Cooper-Test
- **Gewichtsverlauf** mit Einordnung der Änderungsrate (mehr als ~0,5 % Aufbau
  pro Woche landet überwiegend als Fett)

Testen alle vier bis sechs Wochen, am besten am Ende einer Entlastungswoche –
dann misst du Leistung und nicht Ermüdung.

---

## Belege

Unter *Wissen* steht zu jeder Zahl im Tracker die Quelle, jeweils mit Bewertung
der Belegstärke:

- **stark** – Meta-Analysen oder Positionspapiere von Fachgesellschaften
- **solide** – einzelne kontrollierte Studien, konsistente Übersichtsarbeiten
- **praxis** – Trainerkonsens ohne harte Studienlage, ausdrücklich gekennzeichnet

Wo es keine belastbare Studienlage gibt, steht das dabei – etwa bei der Marke von
+25 % Zusatzlast auf dem Weg zum Muscle-Up.

Dort steht auch, was der Tracker **nicht** kann. Formeln sind Schätzungen: Wenn
die Waage über vier Wochen etwas anderes sagt als die Kalorienrechnung, hat die
Waage recht.

---

## Deine Daten

Alles liegt in `data/tagebuch.json` auf deinem Rechner. Kein Konto, keine Cloud,
niemand, der mitliest. Die Datei ist über `.gitignore` ausgenommen und landet
nicht versehentlich im Repository.

Geschrieben wird über eine temporäre Datei mit anschließendem Umbenennen – ein
abgebrochener Schreibvorgang kann das Tagebuch nicht beschädigen.

Unter *Profil → Daten* gibt es Export und Import. Vor jedem Import legt der
Server automatisch eine Sicherungskopie an. Ein Trainingstagebuch wird über
Jahre wertvoll: Sichere es regelmäßig.

---

## Tests

```bash
npm test        # oder: node --test test/*.test.js
```

115 Tests über die Rechenkerne und die HTTP-Schnittstelle. Sie prüfen unter
anderem, dass Sprinteinheiten nie zu dicht liegen, dass nie alle
Ausdauereinheiten hart werden, dass die Phasen sich im Umfang tatsächlich
unterscheiden, dass die vorgegebene Last zur vorgegebenen Wiederholungszahl
passt, dass ein Wiederholungstest nicht als Kilogramm gelesen wird und dass die
Nährwerte in der Lebensmitteldatenbank zu ihren Makros passen.

---

## Aufbau

```
server/
  wissen.js       Evidenzbasis: alle Konstanten mit ihren Quellen
  profil.js       Körperdaten, Ausrichtungsregler, Kraftmarken, Muscle-Up-Weg
  plan.js         Der Wochenplaner
  leistung.js     Einer-Maxima, Arbeitsgewichte, Progression
  ernaehrung.js   Kalorien, Makros, Energieverfügbarkeit
  belastung.js    Session-RPE, ACWR, Bereitschaft, Entlastungsbedarf
  store.js        Ablage in einer JSON-Datei
  index.js        HTTP-Server und API
public/           Oberfläche, eine Datei je Ansicht
data/             Lebensmitteldatenbank und dein Tagebuch
```

Die Rechenmodule sind frei von Netzwerk- und Dateizugriff. Wer eine Zahl ändern
will, findet sie in `wissen.js` – an genau einer Stelle, mit ihrer Quelle daneben.

---

## Kein Ersatz für eine Untersuchung

Der Tracker ersetzt keine ärztliche oder physiotherapeutische Einschätzung. Bei
Schmerzen, die über normalen Muskelkater hinausgehen, ist der richtige nächste
Schritt eine Untersuchung – kein Plan und keine Formel.
