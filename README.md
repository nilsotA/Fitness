# Trainingstracker

Trainings- und Ernährungsplanung für Sprint, Kraft und Ausdauer – auf
sportwissenschaftlicher Grundlage, mit offengelegten Quellen.

Keine Abhängigkeiten, kein Build, kein Konto, **kein Server**. Eine Web-App, die
du zum Startbildschirm hinzufügst und die offline funktioniert. Alle Daten
bleiben auf deinem Gerät.

---

## Losgehen

Die App liegt unter der GitHub-Pages-Adresse des Projekts. Im Handy-Browser
öffnen und **zum Startbildschirm hinzufügen** – danach startet sie wie eine
App, ohne Browserleiste, und funktioniert ohne Netz.

Warum das wichtig ist: Trainiert wird auf der Bahn, im Keller, in der Halle.
Eine App, die dort eine Fehlerseite zeigt, ist genau im entscheidenden Moment
nutzlos. Deshalb lädt sie zuerst aus ihrem eigenen Vorrat und erneuert sich
nebenher – auch bei einem Balken Empfang ist sie sofort da. Eine neue Fassung
wird dadurch erst beim übernächsten Öffnen sichtbar; die App sagt Bescheid,
wenn eine bereitliegt.

**Erster Schritt nach dem Installieren:** Unter *Profil* Geburtsjahr, Größe und
Gewicht eintragen. Ohne diese Angaben kann der Ernährungsteil nichts rechnen.
Der Körperfettanteil ist freiwillig, macht den Grundumsatz aber deutlich
treffsicherer und schaltet die Prüfung der Energieverfügbarkeit frei.

### Lokal weiterentwickeln

```bash
node server/index.js       # oder: npm start
```

Das ist ein reiner Dateiserver – der Browser lädt ES-Module nicht über
`file://`, deshalb braucht es beim Entwickeln irgendetwas, das Dateien über HTTP
ausliefert. Er rechnet nichts und speichert nichts.

Anderer Port: `PORT=8080 node server/index.js`

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
| Gelenkschonende Varianten als Standard | Frontkniebeuge und Sechskantstange bringen vergleichbaren Reiz bei deutlich geringerer Wirbelsäulenbelastung |
| Nordic, Copenhagen und Wadenarbeit in jedem Krafttag | Senkt Leistenprobleme um 41 %; die Halbierung des Hamstring-Risikos ist umstritten. Vier Minuten Aufwand |
| Neuromuskuläres Aufwärmen vor jedem Sprint | Balance- und Landeübungen senken Sprunggelenksverletzungen um ein Drittel |
| Jede vierte Woche Entlastung | Die Anpassung entsteht dort, nicht in den drei Wochen davor |

### Verletzungsschutz

Krafttraining allein senkt akute Sportverletzungen auf **unter ein Drittel** und
Überlastungsschäden um fast die Hälfte (Lauersen 2014, 25 Studien, 26 610
Teilnehmer). Dehnen zeigte in derselben Analyse keinen Effekt.

Darüber hinaus deckt der Plan vier Bereiche ab, für die es eigene, gezielt
untersuchte Programme gibt:

| Bereich | Übung | Wirkung |
|---|---|---|
| Hamstrings | Nordic Hamstring | −51 % Hamstring-Verletzungen – **umstritten**, siehe *Belege* |
| Leiste und Adduktoren | Copenhagen Adduction | −41 % Leistenprobleme |
| Achillessehne | Wadenheben, volle Amplitude | Sehnen passen sich langsamer an als Muskeln |
| Sprunggelenk | Einbeinstand mit Störreiz | −33 % Sprunggelenksverletzungen |

Unter *Fortschritt → Verletzungsschutz* siehst du, welche davon diese Woche
tatsächlich absolviert wurden. Nordic Hamstring ersetzt dabei kein
Hamstring-Volumen und umgekehrt: Die Schutzwirkung hängt an der spezifischen
Übung, nicht an der Muskelgruppe.

### Übungsauswahl: geringes Risiko als Standard

Jede Übung im Register trägt eine Risikoeinstufung mit Begründung. Wo eine
verträglichere Variante existiert, ist sie voreingestellt:

- **Frontkniebeuge** statt Nackenkniebeuge – selbstbegrenzend: Wer den
  Oberkörper nicht aufrecht hält, verliert die Stange nach vorn, bevor der
  Rücken überlastet wird.
- **Sechskantstange** statt gerader Stange beim Kreuzheben – die Last liegt in
  der Körperachse statt davor. Der kürzere Hebelarm senkt die Spitzenmomente an
  der Lendenwirbelsäule deutlich, bei vergleichbarer Kraftentwicklung
  (Swinton 2011).

Der Hüftzug wechselt mit der Phase: im Aufbau das rumänische Kreuzheben, weil
es die Hamstrings unter Dehnung belastet und damit selbst schützt – in den
schweren Blöcken die Sechskantstange, weil dort hohe Lasten gefragt sind.

Abschaltbar im Profil, falls du die klassischen Varianten willst. Protokollierst
du Übungen mit erhöhtem Risiko, weist der Tracker auf die verträglichere
Alternative hin – verbietet aber nichts.

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

### Sprintzeiten und die Abbruchregel

Die Zeit je Lauf ist das direkteste Qualitätssignal im Sprinttraining – direkter
als RPE, direkter als Herzfrequenz. Und sie beantwortet die einzige Frage, die
während der Einheit zählt: Ist das noch Sprinttraining oder schon Ermüdung?

Unter *Fortschritt* steht die **Bestzeit** je Distanz und Laufart an erster
Stelle, daneben die letzte Einheit und ihr Abstand dazu. Das ist der Maßstab,
der die Kurve erst lesbar macht: 1 % über der Bestzeit ist ein guter Tag, 6 %
sind ein müder – ohne diesen Bezug sieht jeder müde Tag nach Rückschritt aus.

Im Protokoll trägst du sie Lauf für Lauf ein und bekommst **sofort** die
Rückmeldung, nicht erst hinterher:

```
Lauf 1  4,10 s   Erster Lauf dieser Art – setzt die Tagesbestzeit.
Lauf 2  4,13 s   0,7 % über der Tagesbestzeit – voll im Qualitätsbereich.
Lauf 4  4,21 s   2,7 % darüber. Noch im Bereich, aber Pausen verlängern.
Lauf 5  4,30 s   4,9 % darüber. Die Qualität ist weg – hier aufhören.
```

Ab **3 % über der Tagesbestzeit** ist Schnelligkeitstraining zu Ende. Was danach
kommt, trainiert Ermüdungsresistenz statt Schnelligkeit – und erhöht das
Risiko, weil die Technik als Erstes leidet. Die Zahl ist Trainerkonsens, keine
Studienlage; sie folgt aber direkt aus der Forderung nach ≥95 % der
Maximalgeschwindigkeit.

Verglichen wird gegen die **Tagesbestzeit**, nicht gegen eine Saisonbestzeit: An
einem schlechten Tag ist man ohnehin langsamer, und darum geht es hier nicht.
Läufe unterschiedlicher Distanz oder Art werden getrennt betrachtet – eine
fliegende 30 und eine 30 aus dem Stand miteinander zu vergleichen ergäbe in
jeder gemischten Einheit einen Scheinabbruch.

Unter *Fortschritt → Sprintzeiten* stehen die Bestzeiten über die Wochen und die
Auswertung der letzten Einheit, inklusive einer Punktreihe, die zeigt, ab
welchem Lauf es kippte.

### Ausdauer: Strecke, Tempo und die Grauzone

Kilometer mitzuschreiben ist der einfache Teil. Der nützliche Teil ist die
Frage, an der Ausdauertraining in der Praxis fast immer scheitert: **Sind die
lockeren Einheiten wirklich locker?**

Der Tracker teilt die Ausdauerzeit in drei Zonen. Der Normalweg ist die
gefühlte Anstrengung, weil die für jede Einheit vorliegt und kein Gerät
braucht:

| Zone | RPE | Ziel |
|---|---|---|
| Locker | bis 4 | ~80 % |
| **Grauzone** | 5–6 | möglichst leer |
| Hart | ab 7 | ~20 % |

Gezählt werden **Minuten, nicht Einheiten**. Eine 90-minütige lockere Runde und
ein 20-minütiges Intervall sind nicht dasselbe „eine Einheit" – genau diese
Verwechslung lässt Trainingspläne polarisiert aussehen, die es nicht sind.

Liegt mehr als ein Viertel der Zeit in der Grauzone, sagt der Tracker das. Dort
ist es zu schnell für Erholung und zu langsam für einen Reiz: Man sammelt
Ermüdung ohne Anpassung, und die fehlt dann am Sprinttag. Die Grenze gilt auch
nach oben: Eine leere Grauzone macht die Verteilung noch nicht polarisiert,
wenn mehr als ein Drittel der Zeit hart ist.

#### Einheiten aus einer Lauf-App übernehmen

**Automatisch geht das nicht.** Apple Health ist ausschließlich für native
iOS-Apps geöffnet (HealthKit) – eine Web-App kommt dort nicht heran, auch nicht
über einen Umweg. Adidas Running bietet Dritten ebenfalls keine Schnittstelle
mehr. Wer etwas anderes verspricht, verspricht zu viel.

**Exportieren können beide.** Unter *Heute → Aus Lauf-App übernehmen* liest der
Tracker **GPX** und **TCX** – die Formate, die praktisch jede Lauf-App und jede
Uhr beim Export anbietet. Daraus kommen Datum, Dauer, Strecke und
Durchschnittspuls fertig heraus; der Protokolldialog öffnet sich vorbelegt. Zu
tun bleibt das RPE, das ohnehin kein Gerät messen kann.

Die Sportart wird aus der Datei übernommen, wo sie drinsteht. Steht sie nicht
drin, bleibt das Feld auf der Voreinstellung statt zu raten: Ein als Laufen
einsortiertes Radtempo verdirbt die Tempokurve, und zwar unbemerkt.

Bei GPX wird die Strecke aus den GPS-Punkten gerechnet – und dabei steckt eine
Falle, die man nicht sieht: **GPS-Rauschen macht Strecken immer länger, nie
kürzer.** Bei einem Punkt pro Sekunde liegen die Messpunkte drei Meter
auseinander, das Rauschen verschiebt sie aber um ähnlich viel; jeder Zickzack
zählt voll mit. Nachgemessen an einer simulierten Spur mit bekannter Länge
ergab die rohe Summe aus 10 km glatte **18,4 km**. Deshalb wird die Spur vorher
geglättet, mit einem Fenster, das sich nach der Punktdichte richtet. Es bleiben
höchstens 2,6 % Abweichung, auf der Bahn wie auf der Straße.

TCX-Dateien sind davon nicht betroffen: Dort steht die Strecke als fertige Zahl
und stammt oft aus einem Fußsensor, ist also ohnehin genauer als GPS.

Enthält die Datei **mehrere** Aktivitäten, kommen sie alle – zur Auswahl, eine
nach der anderen. Nur die erste zu nehmen hieße, den Rest stillschweigend
wegzuwerfen, und das merkt man erst Wochen später an einer Lücke im Verlauf.

Steht an dem Tag schon eine Einheit im Tagebuch, sagt der Dialog es dazu. Eine
doppelt eingetragene Einheit verfälscht jede Belastungsrechnung – und den Grund
findet man später nicht mehr.

#### Herzfrequenz statt Gefühl – freiwillig

Wer eine Uhr trägt, kann pro Einheit den **Durchschnittspuls** eintragen. Dann
entscheidet der über die Zone statt das Gefühl, und die Oberfläche zeigt schon
während der Eingabe, in welcher Zone die Einheit landet. Bewusst der Schnitt
und nicht der Spitzenwert: Bei Intervallen liegt der Spitzenwert immer im harten
Bereich, auch wenn die Einheit überwiegend Trabpause war.

Die Zonengrenzen liegen bei 82 % und 87 % der Maximalfrequenz – näherungsweise
die beiden ventilatorischen Schwellen, an denen auch das polarisierte Modell
hängt. Der Maximalpuls kommt aus dem Profil: gemessen, wenn ein Wert eingetragen
ist, sonst geschätzt nach Tanaka 2001 (208 − 0,7 × Alter).

**Und genau da steht die Einschränkung im Tracker selbst:** Die Schätzung streut
um rund 7 Schläge, die Zonengrenzen liegen nur 5 Prozentpunkte auseinander. Mit
geschätztem Maximalpuls ist die Einteilung deshalb *kaum genauer als das
RPE-Gefühl* – das sagt die Oberfläche an jeder Stelle dazu, an der so eine Zone
auftaucht. Wirklich besser wird sie erst mit einem gemessenen Wert. Aus dem
gleichen Grund steht unter jeder Verteilung, welcher Anteil der Minuten über
Puls und welcher über RPE eingeordnet wurde: eine halb gemessene und eine
durchgemessene Verteilung sind nicht gleich belastbar.

Ohne Puls ändert sich nichts – die Verteilung bleibt über RPE vollständig.

Der Tempoverlauf steht getrennt nach Gerät **und Zone**. Das macht das Problem
sichtbar, wenn es auftritt – liegen die „lockeren" Läufe bei 5:03 min/km und die
harten bei 5:00, ist der Fall klar.

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
- **Trainingsverbrauch** über MET-Werte je Einheitentyp und Dauer. Das sind
  Durchschnitte über die *ganze* Einheit, nicht Werte während der Belastung:
  Eine Sprinteinheit dauert zwei Stunden, besteht aber überwiegend aus Stehen
  und Gehen. Zu hoch angesetzt wäre hier schlimmer als zu niedrig, weil der
  Wert direkt ins Kalorienziel geht
- **Protein** 1,9 g/kg, im Defizit 2,2 g/kg
- **Fett** 1,0 g/kg als Untergrenze für den Hormonhaushalt
- **Kohlenhydrate** füllen den Rest – mit Korridor je Tagestyp (3–4 g/kg am
  Ruhetag bis 7–9 g/kg am langen Ausdauertag)

Reichen die Kalorien nicht für den Kohlenhydratkorridor, sagt der Tracker das,
statt still eine unrealistische Zahl auszugeben.

### Eintragen soll schnell gehen

Vier bis fünf Einträge am Tag sind der häufigste Handgriff der ganzen App –
und wenn der mühsam ist, wird er nach zwei Wochen nicht mehr gemacht. Dann
steht die Ernährungsrechnung auf Lücken.

Deshalb zeigt die Suche bei leerem Feld **dein** Zeug zuerst: was du in den
letzten acht Wochen tatsächlich gegessen hast, das Häufigste oben, mit der
Menge vorbelegt, die du zuletzt genommen hast. Erst darunter kommt die
Nährwerttabelle. Eigene Lebensmittel von der Packung landen automatisch in
derselben Liste – einmal eintragen genügt.

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
- **Ruhepuls** im Verlauf, gegen die eigene Grundlinie

Zum ACWR sagt der Tracker ausdrücklich dazu, was es *nicht* kann: Es wird oft als
Verletzungsvorhersage verkauft, hält der methodischen Prüfung aber nicht stand.
Als Ampel für Belastungssprünge bleibt es brauchbar – mehr nicht.

### Ruhepuls

Im Morgen-Check optional einzutragen – morgens im Liegen, denn nur dann ist der
Wert vergleichbar. Und verglichen wird er ausschließlich mit **sich selbst**:
ein Schnitt der letzten drei Tage gegen eine Grundlinie aus den drei Wochen
davor. Ein Ruhepuls von 58 sagt für sich genommen nichts; ein Anstieg von 54 auf
63 schon eher.

Vor sieben Messungen als Grundlinie sagt der Tracker gar nichts – wie beim ACWR
verglichen es sonst Rauschen mit Rauschen.

Was er ausdrücklich **nicht** behauptet: dass ein erhöhter Ruhepuls Übertraining
bedeutet. Er ist unspezifisch – Infekt, zu wenig Schlaf, Alkohol und Hitze
erzeugen dasselbe Bild, und die stehen in der Meldung auch vor der
Trainingsermüdung. Deshalb zählt er beim Entlastungsbedarf nur als *ein* Grund
neben anderen und löst allein nichts aus. Umgekehrt gilt er auch nicht als
Entwarnung: Bei ausgeprägter Ermüdung kann der Ruhepuls ebenfalls fallen
(Buchheit 2014).

### Der Morgen-Check ändert den Plan

Ein Check, der folgenlos bleibt, wird nach ein paar Tagen nicht mehr ausgefüllt –
zu Recht. Deshalb passt der Tracker die heutige Einheit tatsächlich an:

| Ampel | Was passiert |
|---|---|
| grün | nichts |
| gelb | Umfang um ein Drittel gekürzt, Lasten bleiben |
| rot | harte Einheit gestrichen, Kraft halbiert |

Gekürzt wird immer der **Umfang**, nie die Intensität. Die Last hält die
Anpassung aufrecht, das Volumen erzeugt die Ermüdung – wer stattdessen leichter
macht und trotzdem alle Sätze zieht, verliert beides.

Zwei Dinge bleiben dabei unangetastet: das **Aufwärmen** (bei schlechter
Tagesform der wichtigste Teil, nicht der entbehrlichste) und die
**Prophylaxe** (vier Minuten, kaum Ermüdung – und an schlechten Tagen ist das
Verletzungsrisiko am höchsten).

Nichts davon passiert stillschweigend: An jeder veränderten Einheit steht, was
gekürzt wurde und was ursprünglich geplant war. Der Wochenplan bleibt
unangetastet – für kommende Tage ist die Tagesform noch nicht bekannt.

Der Kalorienbedarf zieht mit: Eine gestrichene Sprinteinheit senkt ihn um
mehrere hundert Kilokalorien.

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

- **Sätze je Muskelgruppe**, gegen die Marke von zehn harten Sätzen gemessen.
  Gezählt wird pro Muskelgruppe, nicht pro Übung: Kniebeuge, Hip Thrust und
  Kreuzheben treffen alle das Gesäß, einzeln gezählt sähe jede nach zu wenig aus.
  Hauptmuskeln zählen voll, deutlich mitarbeitende zur Hälfte
- **Verletzungsschutz**: welche der vier Schutzbereiche diese Woche abgedeckt
  sind, plus Risikoprofil der protokollierten Sätze
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

Unter *Wissen* steht zu jeder Zahl im Tracker die Quelle – mit Art der Arbeit,
Umfang und Bewertung der Belegstärke:

- **stark** – Metaanalysen, Positionspapiere von Fachgesellschaften,
  Konsenspapiere, große randomisierte Studien
- **solide** – einzelne kontrollierte Studien, konsistente Übersichtsarbeiten
- **praxis** – Trainerkonsens ohne harte Studienlage, ausdrücklich gekennzeichnet

Die Bewertung ist keine Meinung: Jede Quelle trägt in `art`, was sie ist
(Metaanalyse, RCT, Übersichtsarbeit …), und ein Test rechnet die Belegstärke
daraus nach. Angezeigt wird beides, samt Umfang – „Metaanalyse · 49 Studien,
1.863 Teilnehmer" sagt mehr als ein grünes Abzeichen.

Aktuell 28 Quellen, davon **9 Metaanalysen**, 3 Positionspapiere, 1
Konsenspapier und 1 randomisierte Studie. Die tragenden Regeln – Proteinmenge,
Satzvolumen, Verletzungsprophylaxe, Interferenz, Maximalpuls – stehen auf
Metaanalysen; ein Test hält das fest, damit keine davon unbemerkt auf eine
schwächere Quelle zurückfällt.

Wo es keine belastbare Studienlage gibt, steht das dabei – etwa bei der Marke von
+25 % Zusatzlast auf dem Weg zum Muscle-Up.

**Und wo die Studienlage strittig ist, steht auch das dabei.** Die meistzitierte
Zahl der Verletzungsprophylaxe – Nordic Hamstring halbiert das Risiko – ließ
sich in einer Nachrechnung derselben Studien mit strengerer Methodik nicht
bestätigen (Impellizzeri 2021). Die Übung bleibt im Plan: vier Minuten für etwas,
das vielleicht viel bringt und sicher wenig kostet. Aber die Zahl steht mit
„umstritten" dran, im Fortschritt wie im Wissensteil.

Dort steht auch, was der Tracker **nicht** kann. Formeln sind Schätzungen: Wenn
die Waage über vier Wochen etwas anderes sagt als die Kalorienrechnung, hat die
Waage recht.

---

## Deine Daten

Alles liegt in der Datenbank deines Geräts. Kein Konto, keine Cloud, kein
Server, niemand, der mitliest – die Daten verlassen das Gerät nie. Das Repository
ist öffentlich, deine Trainingsdaten sind es nicht: Dort liegt nur Programmcode.

Das ist zugleich der Haken, und er wird in der App auch so benannt: **Geht das
Gerät verloren, sind die Daten weg.** Deshalb:

- Unter *Profil → Daten* sicherst du den ganzen Bestand mit einem Tippen.
  Wo das Gerät den Teilen-Dialog kann, geht die Datei direkt darüber weg – auf
  dem iPhone steht AirDrop dort, die Sicherung ist mit zwei Tipps auf dem
  Laptop. Sonst als Download, den du ablegst, wo du ihn wiederfindest.
- Vor dem Einspielen stellt der Tracker beide Seiten nebeneinander: wie viele
  Einheiten, Mahlzeiten, Checks und Tests jeweils drinstehen und bis wann. Ist
  die Datei **älter** als der aktuelle Stand, steht das als Warnung darüber –
  wer zwischen zwei Geräten hin- und herschiebt, erwischt irgendwann die
  falsche, und dann wäre alles Neuere weg.
- Der bisherige Stand wird vor dem Ersetzen zusätzlich automatisch gesichert.
- Klemmt die Datenbank des Geräts, sagt die App es sofort und in jeder Ansicht.
  Ein stiller Schreibfehler wäre der schlimmste Fehler dieser App: Man trägt
  weiter ein, und nichts kommt an.
- Die App bittet den Browser, den Speicher dauerhaft zu behalten. Ob er zusagt,
  steht in derselben Karte. Am zuverlässigsten wird er, wenn die App zum
  Startbildschirm hinzugefügt ist.

Ein eingespieltes Tagebuch aus einer älteren Fassung wird automatisch auf die
aktuelle Form gebracht: Fehlende Felder werden ergänzt statt abzustürzen. Die
Daten sind das Wertvolle, der Code ist ersetzbar.

### Handy und Laptop

Beide Geräte haben ihren **eigenen** Datenstand – ohne Server gibt es nichts,
was sie abgleicht. Der Weg dazwischen ist die Sicherungsdatei: auf dem Handy
teilen (AirDrop), auf dem Laptop einspielen. Eintragen am besten konsequent auf
einem Gerät, damit die Frage „welcher Stand ist neuer" gar nicht erst aufkommt –
und falls doch, sagt es die Rückfrage vor dem Einspielen.

---

## Tests

```bash
npm test        # oder: node --test test/*.test.js
```

282 Tests über die Rechenkerne und die App. Sie prüfen unter
anderem, dass Sprinteinheiten nie zu dicht liegen, dass nie alle
Ausdauereinheiten hart werden, dass die Phasen sich im Umfang tatsächlich
unterscheiden, dass die vorgegebene Last zur vorgegebenen Wiederholungszahl
passt, dass ein Wiederholungstest nicht als Kilogramm gelesen wird, dass jede
Krafteinheit die Schutzübungen enthält, dass bei schlechter Tagesform der Umfang
und nicht die Last gekürzt wird, dass ein vertippter Maximalpuls nicht die
Zonengrenzen bestimmt, dass eine leere Grauzone allein noch nicht als
polarisiert durchgeht, dass ein Ruhepuls ohne Grundlinie nicht gedeutet wird,
dass eine Achsenbeschriftung die Veränderung nicht verzerrt, dass der Tagesbedarf auch an großen Trainingstagen
plausibel bleibt und dass die Nährwerte in der Lebensmitteldatenbank zu ihren
Makros passen. Und dass jede Datei, die die App
offline vorhält, tatsächlich existiert – ein Tippfehler in dieser Liste fiele
sonst erst auf, wenn jemand ohne Empfang davorsteht.

Eine eigene Reihe prüft die Evidenzbasis selbst: dass jeder Quellenverweis auf
eine vorhandene Quelle zeigt, dass jede Quelle Titel und Jahr hat, dass
Praxiswerte als solche gekennzeichnet sind und dass die
Grundumsatzformeln die veröffentlichten Beispielwerte reproduzieren. Ein
Verweis ins Leere wäre schlimmer als gar keiner – in der Oberfläche stünde dann
eine Zahl, die belegt aussieht und es nicht ist.

---

## Aufbau

```
index.html            Einstieg
manifest.webmanifest  macht die App installierbar
sw.js                 Service Worker: hält die App offline vorrätig

kern/                 Rechnen – läuft im Browser wie in Node
  wissen.js           Evidenzbasis: alle Konstanten mit ihren Quellen
  profil.js           Körperdaten, Ausrichtungsregler, Kraftmarken, Muscle-Up
  plan.js             Der Wochenplaner
  leistung.js         Einer-Maxima, Arbeitsgewichte, Progression, Volumen
  ernaehrung.js       Kalorien, Makros, Energieverfügbarkeit
  belastung.js        Session-RPE, ACWR, Bereitschaft, Ruhepuls
  sprint.js           Sprintzeiten, Abbruchregel
  ausdauer.js         Strecke, Tempo, Grauzone, Pulszonen
  regeln.js           Datum und was der Browser während der Eingabe braucht
  zustand.js          Der Gesamtzustand der Oberfläche
  aendern.js          Alles, was Daten verändert – mit der Eingabeprüfung
  lebensmittel.json   Nährwerttabelle

app/                  Oberfläche, eine Datei je Ansicht
  speicher.js         Ablage in der Gerätedatenbank
  daten.js            Verbindet Oberfläche, Kern und Ablage

server/index.js       Dateiserver zum Entwickeln. Sonst nichts.
```

**Der Kern kennt weder Netzwerk noch Dateisystem.** Genau deshalb läuft er an
beiden Enden – und genau deshalb braucht der Tracker keinen Server, um zu
rechnen. Er bekommt den Datenbestand übergeben und gibt zurück, was anzuzeigen
ist; woher die Daten kommen, ist ihm gleich.

Die Eingabeprüfung steht damit **einmal** im Code statt einmal im Browser und
einmal im Server. Wer sie an zwei Stellen hätte, hätte sie über kurz oder lang
in zwei Fassungen.

Wer eine Zahl ändern will, findet sie in `wissen.js` – an genau einer Stelle,
mit ihrer Quelle daneben.

---

## Kein Ersatz für eine Untersuchung

Der Tracker ersetzt keine ärztliche oder physiotherapeutische Einschätzung. Bei
Schmerzen, die über normalen Muskelkater hinausgehen, ist der richtige nächste
Schritt eine Untersuchung – kein Plan und keine Formel.
