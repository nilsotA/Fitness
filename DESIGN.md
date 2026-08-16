# Gestaltungsübergabe

Dieses Dokument ist für eine Design-Runde **außerhalb** dieses Repos gedacht:
alles, was man braucht, um am Aussehen der App weiterzuarbeiten, ohne den Code
zu kennen – und alles, woran ein Entwurf hier scheitert.

Es beschreibt den **Ist-Stand**, gemessen am 11.08.2026, nicht einen Wunsch.
Wer etwas ändert, pflegt es hier mit; sonst veraltet das Dokument und wird
schlimmer als nichts (dieselbe Regel wie für den Übergabeabschnitt in
`CLAUDE.md`).

---

## 1. Was die App ist

Ein Trainings- und Ernährungstracker für **einen** Nutzer (Nils: Sprint-
Hintergrund, will Kraft aufbauen). Serverlose Web-App auf GitHub Pages, wird
zum iPhone-Startbildschirm hinzugefügt und läuft offline. Die Daten liegen in
der IndexedDB des Geräts.

**Bedient wird sie zwischen zwei Sätzen im Kraftraum**, mit klammen oder
nassen Fingern, oft einhändig. Das ist die wichtigste Gestaltungsvorgabe
überhaupt und der Grund für fast alle Entscheidungen unten.

Die Oberfläche ist durchweg **deutsch** – Beschriftungen, Fehlermeldungen,
erzeugte Sätze. Englische Fachbegriffe nur, wo es keine gute Entsprechung
gibt (`RPE`, `Hip Thrust`).

---

## 2. Harte Randbedingungen

Diese sind nicht Geschmack, sondern Bedingungen. Ein Entwurf, der eine davon
verletzt, lässt sich hier nicht bauen:

| Bedingung | Warum |
| --- | --- |
| **Null Abhängigkeiten** | Kein npm-Paket, kein Framework, kein Build-Schritt, kein Tailwind, keine Icon-Bibliothek, keine Webfonts. Gepusht ist veröffentlicht. |
| **Kein CSS-Präprozessor** | `app/style.css` ist eine Datei, handgeschrieben, mit Custom Properties als Skala. |
| **Offline** | Keine externen Ressourcen. Alles, was geladen wird, steht in der Dateiliste von `sw.js`. Ein Font von einem CDN würde die App am Berg unbenutzbar machen. |
| **Systemschriften** | `--font` ist ein Stack aus Systemschriften. Eine eingebundene Schriftdatei wäre eine Abhängigkeit und Ladezeit. |
| **Symbole als Inline-SVG** | Keine Icon-Fonts, keine Unicode-Glyphen. In den Reitern standen einmal `◉ ▤ ◍` – die fallen je nach Gerät anders aus und werden auf iOS teils bunt gerendert. Ein Test besteht auf `<svg>` mit `currentColor`. |
| **44 px Tippfläche** | Alles Antippbare hat `min-height: var(--tipp)`, auch Eingabefelder und Regler. |
| **320 und 390 px** | Geprüft wird bei beiden Breiten. 320 ist die schmalste iPhone-Breite. Nichts darf waagerecht überlaufen. |
| **Sicherer Bereich** | `viewport-fit=cover` ist gesetzt. Kopf, Reiter und Inhalt rechnen mit `max(var(--s-4), env(safe-area-inset-…))`. Im Headless-Browser sieht man davon nichts – am Gerät liegt die Kopfzeile sonst unter der Statusleiste. |
| **Dunkel** | Es gibt keinen hellen Modus und keinen Umschalter. |
| **Zwei klebende Leisten** | Kopfzeile und Reiter bleiben beim Scrollen stehen. Die Leiste sitzt auf `top: var(--kopf-hoch)`, das `app.js` misst und per `ResizeObserver` nachzieht – beide auf `top: 0` überlagern sich, und von der Leiste bleiben 6 von 58 px. Zusammen rund 111 px dauerhafte Fläche bei 390 px; wer daran spart, muss den sicheren Bereich mitnehmen, der heute an der Kopfzeile hängt. |

### Was die Prüfwerkzeuge einem Entwurf verbieten

Drei automatische Prüfungen laufen vor jedem Commit und schlagen bei
bestimmten Gestaltungsideen an – nicht aus Prinzip, sondern weil sie den
Befund dann nicht mehr von einem echten Fehler unterscheiden können:

- **Keine waagerechte Bewegung beim Einblenden.** `werkzeug/breite.mjs` misst
  gegen die Fensterbreite; was von rechts hereinfährt, ragt für ein paar
  Frames hinaus und wird als Überlauf gemeldet. Der Befund wäre echt, die
  Ursache die Animation.
- **Keine hochzählenden Zahlen.** `werkzeug/knoepfe.mjs` erkennt die Wirkung
  eines Knopfs daran, dass sich der Seitentext ändert – zählende Zahlen
  hießen: jeder Knopf wirkt. Und eine Zahl, die sich ändert, während man sie
  liest, ist keine Auskunft.
- **Tabellen scrollen in sich.** Sie gehören durch `tabelle()` aus
  `common.js`, sonst wachsen sie aus der Karte und die Breitenprüfung meldet
  Überlauf.

---

## 3. Die Skala

Aus `app/style.css`, `:root`. **Neue Regeln greifen auf diese Tokens zu,
statt eine achtzehnte Schriftgröße zu erfinden** – vorher standen dort
siebzehn Größen zwischen 0,72 und 1,35 rem nebeneinander, Unterschiede, die
niemand als Absicht liest, aber als Unruhe sieht.

**Gemessen am 11.08.2026 gilt das allerdings nur zur Hälfte**, und das gehört
zur Übergabe dazu: 33 Regeln nehmen eine Token-Schriftgröße, **21 stehen
weiter als roher Wert** da (0,68 · 0,72 · 0,74 · 0,75 · 0,76 · 0,79 · 0,83 ·
0,84 · 0,85 · 0,88 · 0,9 · 0,92 · 0,95 · 0,97 · 1,15 · 1,2 rem). Bei den
Abständen ist das Verhältnis ungünstiger: 36 Token-Verwendungen gegen **78
rohe rem-Werte** in `margin`, `padding` und `gap`. Die Skala ist also
eingeführt, aber nicht durchgesetzt – wer hier aufräumt, arbeitet an der
Ursache der Unruhe und nicht an ihren Symptomen.

### Farben

```css
--bg:          #070a11   /* Grund */
--panel:       #0e131d   /* Karte */
--panel-hoch:  #151c29   /* Karte im Vordergrund, Dialog */
--line:        rgba(120, 160, 220, 0.16)
--text:        #eaf0fa
--muted:       #8b98ad
--muted-hell:  #a9b6ca
```

Der Körper trägt zusätzlich einen festen Verlauf:
`radial-gradient(130% 80% at 50% -20%, #16203a 0%, #0a0e18 55%, #060810 100%)`.

**Die vier Trainingsfarben tragen Bedeutung** und sind nicht frei wählbar –
sie ordnen jede Einheit, jeden Balken und jede Zone einer Disziplin zu:

```css
--sprint:   #ff5a3c   /* Sprint, Protein */
--kraft:    #4d8dff   /* Kraft, Kohlenhydrate */
--ausdauer: #2fbe8a   /* Ausdauer, Kalorien */
--warn:     #f2b134   /* Fett, gelbe Ampel */
--gefahr:   #e8425e   /* rote Ampel, Löschen, Überschreitung */
--gefahr-schwach: rgba(232, 66, 94, 0.28)
```

### Schrift und Maß

```css
--t-xs: 0.75rem   --t-s: 0.82rem   --t-m: 0.9rem
--t-l:  1.02rem   --t-xl: 1.35rem  --t-zahl: 1.5rem

--s-1: 0.25rem  --s-2: 0.5rem  --s-3: 0.75rem  --s-4: 1rem  --s-5: 1.5rem

--tipp:   44px
--radius: 14px

--font:     'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif
--font-num: 'DIN Alternate', 'Segoe UI', system-ui, sans-serif
```

`--font-num` steht für Kennzahlen – die großen Ziffern, die man im Vorbeigehen
liest.

---

## 4. Die Bausteine

Gebaut wird ohne Templates: `el(tag, props, ...kinder)` in `app/common.js`
erzeugt DOM. Jeder Baustein unten ist eine Funktion dort. **Wer etwas
umgestaltet, ändert die Funktion – nicht die dreißig Aufrufstellen.**

| Funktion | Was es ist | CSS-Klassen |
| --- | --- | --- |
| `karte(...)` | Der Grundbaustein. Fast alles steht in einer Karte. | `.karte`, `.karte-kopf` |
| `kennzahl(wert, titel, zusatz, farbe)` | Große Zahl mit Unterzeile, im Raster nebeneinander | `.kennzahl`, `.kennzahlen` |
| `ring(prozent, farbe, beschriftung)` | SVG-Ring, für die Bereitschaft | `.ring`, `.ring-spur`, `.ring-wert`, `.ring-mitte` |
| `balken(prozent, farbe)` | Fortschrittsbalken. **Kann über 100 %**: dann wächst der Maßstab mit und der Überschuss bekommt eine schraffierte Fläche | `.balken`, `.balken-fuellung`, `.balken-ueber` |
| `hinweis(text, art)` | Kasten mit farbigem Rand. `art`: `info` \| `warn` \| `gefahr` | `.hinweis` |
| `tabelle(...)` | Tabelle, die in sich scrollt | `.tabelle-rahmen` |
| `feld(beschriftung, eingabe, hilfe)` | Formularzeile mit Hilfetext | `.feld`, `.felder` |
| `dezimalFeld(props)` | Zahlenfeld, das **Komma** akzeptiert (deutsche Tastatur) | – |
| `dialog(inhalt)` | Modaler Dialog | `.dialog` |
| `toast(text, art)` | Kurzmeldung | `.toast`, `.toasts` |
| `linienDiagramm(werte, opt)` | Verlaufskurve als Inline-SVG | `.diagramm` |
| `sessionZusammenfassung(s)` | Eine Zeile Trainingsprotokoll | `.zeile`, `.zeile-titel`, `.zeile-meta` |

Weitere Klassengruppen im Stylesheet, jeweils mit eigenem Abschnitt:
`.kopf` · `.reiter` · `.einheit` (Trainingseinheit im Plan) · `.ampel` ·
`.regler` (Ausrichtungsregler) · `.stufe` (Muscle-Up-Weg) · `.satz-zeile`
(Satzprotokoll) · `.zonen-balken` (Intensitätsverteilung) · `.klapp`
(Auf- und Zuklapper) · `.quelle-karte` (Wissensansicht) · `.gericht`
(Gerichtevorschlag) · `.chips` (Auswahl in einer Karte).

### Zwei Sonderfälle, die man leicht kaputt macht

- **Der Balken über 100 %.** Er war einmal auf `Math.min(100, …)` gedeckelt –
  damit standen 108 % Fett und 197 % Protein als zwei identisch randvolle
  Balken untereinander. Über dem Ziel muss der Maßstab mitwachsen.
- **Auswahl in einer Karte läuft über `.chips`, nie über ein `<select>`.**
  Ein natives Auswahlfeld schluckt auf iOS die Wischbewegung, die auf ihm
  beginnt – volle Kartenbreite und 44 Pixel hoch war das ein toter Streifen
  mitten in einer scrollenden Ansicht. Aus demselben Grund bricht die
  Chipreihe um, statt waagerecht zu scrollen wie die Reiterleiste: eine
  zweite Scrollfläche in einer scrollenden Seite ist genau das Problem.
- **Auf- und Zuklapper sind `<details>/<summary>`**, kein JavaScript. Die
  Zusammenfassung trägt die Information, die man beim Überfliegen braucht
  (Tag, Einheiten, Dauer), sonst ist Zuklappen ein Verlust statt einer
  Ordnung. Das `+` dreht sich beim Öffnen ins `−`.

---

## 5. Die sechs Ansichten

Gemessen bei 390 px Breite mit zwölf Wochen Daten (`document.body.scrollHeight`):

| Ansicht | Höhe | Inhalt |
| --- | --- | --- |
| **heute** | 2.333 px | Bereitschaft (Ring), heutige Einheit mit Übungszettel, zuletzt trainiert, Ernährungsbilanz |
| **plan** | 1.857 px | Wochenplan, ein Zuklapper je Tag, Zyklusstreifen |
| **fortschritt** | 6.892 px | Neun Karten: Kraft, Muscle-Up-Weg, Sprint, Ausdauer, Belastung, Verletzungsschutz, Gewicht, Leistungstests, Intensitätsverteilung |
| **essen** | 2.530 px | Tagesbilanz mit Makrobalken, Gerichtevorschläge, ganzer Tagesplan, Tagesliste nach Mahlzeit, Suche |
| **profil** | 3.703 px | Körperdaten, Ausrichtungsregler, Einstellungen, Datensicherung |
| **wissen** | 4.703 px | Trainingslehre und 28 Quellen als Zuklapper |

**heute** und **essen** schwanken mit dem Wochentag – an einem Tag mit Sprint
*und* Kraft ist „heute" gut doppelt so hoch wie an einem lockeren Dienstag.

**Die Fortschrittsansicht ist die einzige über 5.000 px**, und sie ist es,
weil dort neun verschiedene Fragen beantwortet werden. Sie ist der
naheliegendste Ansatzpunkt für eine Gestaltungsrunde – aber Vorsicht: Ihre
Länge ist zweimal *gewachsen*, weil vorher Karten leer standen, deren Daten
das Prüfwerkzeug nie erzeugt hatte. Eine kurze Ansicht ist hier nicht
automatisch die bessere.

---

## 6. Bewegung: was die Animationen dürfen

Eigener Abschnitt in `app/style.css`. Vier Regeln:

1. **Nur `transform` und `opacity`** – Compositor statt Layout.
2. **Keine waagerechte Bewegung beim Einblenden** (siehe oben).
3. **Keine hochzählenden Zahlen** (siehe oben).
4. **Kurz** – alles unter 0,35 s; Balken 0,62 s.

Was sich heute bewegt: Karten steigen versetzt auf, Balken wachsen über
`scaleX`, der Bereitschaftsring zieht sich über `stroke-dashoffset` auf seinen
Wert, die Intensitätsverteilung wischt Zone für Zone über `clip-path` auf
(nicht `scaleX` – die Prozentzahl steht mitten im Abschnitt und würde
mitgequetscht), das Plus der Klappkarten dreht sich ins Minus, Dialoge und
Meldungen fahren auf, Knöpfe geben unter dem Daumen nach.

**Zwei Dinge ziehen dauerhaft den Blick**, und mehr sollen es nicht werden:
der rote Ampelpunkt atmet, die aktuelle Muscle-Up-Stufe gibt zweimal einen
Ring ab und ist dann still. Dauerhafte Bewegung nur dort, wo etwas zu
entscheiden ist.

**Jede Animation leitet ihren Endzustand von woanders ab** – der Ring aus dem
`stroke-dashoffset`-Attribut, der Balken aus seiner Breite. Die Keyframes
kennen nur den Anfang. Eine Animation, die den Zielwert selbst noch einmal
ausrechnet, wäre eine zweite Herleitung derselben Zahl.

`prefers-reduced-motion` schaltet alles ab.

---

## 7. Inhaltliche Regeln, die die Gestaltung binden

Das ist der Teil, den ein reiner Blick auf Screenshots übersieht. Der Tracker
gibt Empfehlungen zu Training und Ernährung, und daraus folgen Vorgaben an die
Darstellung:

- **Jede Zahl braucht eine Quelle.** Wo es keine belastbare Studienlage gibt,
  steht das ausdrücklich dabei – als Vorbehaltssatz *am Gerät*, nicht nur im
  Code. Ein Entwurf, der solche Sätze wegkürzt, bricht die Kernzusage des
  Projekts. Elf Konstanten haben so einen Satz, ein Test prüft, dass er
  ankommt.
- **Lieber „nicht berechenbar" als eine erfundene Zahl.** Eine Zahl sieht am
  Gerät wie eine Vorgabe aus.
- **Wo etwas fehlt, steht der Grund an der Stelle, an der es fehlt.** Ein
  Strich in einer Tabelle sieht sonst aus wie „noch keine Daten", obwohl der
  Wert verworfen wurde. Solche Begründungssätze sind lang und stehen deshalb
  oft an prominenter Stelle – das ist Absicht.
- **Der Tracker verbietet nichts.** Erhöhtes Risiko wird benannt und
  begründet, die Abwägung bleibt bei Nils. Es gibt keine gesperrten Knöpfe
  als Erziehungsmaßnahme.
- **Eine Bewertung braucht Grenzen in beide Richtungen.** Wo eine Ampel „zu
  wenig" anzeigt, muss sie auch „zu viel" können.

Praktisch heißt das: **Diese Oberfläche ist textlastig, und das ist kein
Versehen.** Wer Fließtext gegen Symbole tauscht, verliert Aussagen, auf die
das Projekt Wert legt. Der ergiebigere Weg ist Ordnung – Hierarchie,
Zuklapper, Gruppierung –, nicht Kürzung.

---

## 8. Womit man am Aussehen arbeiten kann

```bash
./werkzeug/starten.sh                  # Server + Chromium
node werkzeug/saeen.mjs 30 4 12        # zwölf Wochen realistische Daten
node werkzeug/saeen.mjs --leeren       # Leerzustand – den erlebt jeder Nutzer
node werkzeug/schuss.mjs fortschritt   # Screenshot einer Ansicht
node werkzeug/schuss.mjs heute "Bereitschaft"   # nur diese Karte
BREITE=320 node werkzeug/schuss.mjs plan
node werkzeug/breite.mjs               # läuft etwas über? (320 und 390)
node werkzeug/konsole.mjs              # Konsolenfehler aller Ansichten
node werkzeug/knoepfe.mjs              # bewirkt jeder Knopf etwas Sichtbares?

# Musterbogen: alle Bausteine auf einer Seite, ohne Daten
open http://localhost:3140/werkzeug/muster.html
```

Die letzten drei geben einen Exitcode zurück und gehören vor jeden Commit.

**Den Leerzustand bitte wirklich ansehen** – er ist der einzige Zustand, den
Nils garantiert erlebt hat, und dort sind mehr Bedienelemente inaktiv als mit
Daten.

Nach Änderungen an ausgelieferten Dateien `VORRAT` in `sw.js` hochzählen,
sonst bedient der Service Worker weiter die alte Fassung.

---

## 9. Offene Gestaltungsfragen

Keine davon ist entschieden; alle sind gemessen, nicht vermutet:

1. **Die Fortschrittsansicht ist 6.892 px hoch.** Neun Karten, neun Fragen.
   Die längste Einzelkarte ist das Protokoll der Leistungstests. Zuklappen hat
   dort schon einmal 1.000 px gespart – lohnt sich das für weitere Karten,
   oder wird die Ansicht dann zu einer Liste von Deckeln?
2. **Die Wissensansicht ist ein Nachschlagewerk in einer Trainings-App.**
   4.703 px, davon der größte Teil die 28 Quellen. Sie war einmal 9.582 px und
   ließ sich nicht einmal fotografieren. Gehört sie überhaupt in die
   Reiterleiste oder hinter die Stellen, an denen die Zahlen auftauchen?
3. **Die Reiterleiste scrollt waagerecht.** Sechs Reiter passen bei 320 px
   nicht nebeneinander; „Profil" war einmal aus dem Bild gescrollt, während
   ein Hinweis dorthin verwies.
4. **Der Übungszettel in „heute" ist die meistbenutzte Fläche der App** – dort
   steht man mit dem Handy zwischen zwei Sätzen. Er hat bisher am wenigsten
   eigene Gestaltung bekommen.
5. **Die vier Trainingsfarben tragen Bedeutung, aber keine Systematik.** Sie
   sind gegen den dunklen Grund gewählt worden, nicht gegeneinander abgestimmt
   (Kontrast untereinander, Farbfehlsichtigkeit, Balken direkt übereinander).
6. **Die Skala ist zur Hälfte durchgesetzt** – 21 rohe Schriftgrößen, 78 rohe
   Abstände (siehe Abschnitt 3). Das ist die undankbarste und zugleich
   wirksamste Aufgabe: Sie ändert kein einziges Bild sichtbar und macht jede
   spätere Gestaltungsentscheidung erst durchsetzbar.

---

## 10. Dateien, die man dafür braucht

| Datei | Wofür |
| --- | --- |
| `app/style.css` | Das gesamte Aussehen, eine Datei, 1.074 Zeilen |
| `app/common.js` | Die Bausteine – wer eine Karte umgestaltet, ändert sie hier |
| `app/heute.js`, `planAnsicht.js`, `fortschritt.js`, `essen.js`, `profilAnsicht.js`, `wissenAnsicht.js` | Je eine Ansicht |
| `index.html` | Kopf, Reiter, Einstiegspunkt |
| `werkzeug/muster.html` | Alle Bausteine auf einer Seite, gegen dasselbe Stylesheet – zum Ausprobieren, ohne Daten zu brauchen |

`werkzeug/` wird **nicht** ausgeliefert und steht deshalb nicht in `sw.js`.
