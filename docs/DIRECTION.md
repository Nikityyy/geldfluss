# Geldfluss: Gestaltung

Nicht ausgeliefert (der Build kopiert nur `app/` und `landing/`). Vor jeder
Änderung am Aussehen lesen.

## Brief

Selbst verfasst aus Nikitas Antworten (Plattform, Eingabe, Zielgruppe,
Speicher, Sprache).

- **Was:** ein kostenloses Open-Source-Haushaltsbuch als PWA auf GitHub Pages.
  Wer zum Beispiel 2.900 € netto bekommt, sieht, wohin das Geld fließt:
  Einnahmen, Fixkosten, laufende Ausgaben, was übrig bleibt. Daten nur im
  Browser, kein Konto, kein Server.
- **Die Kernhandlung:** öffnen, sehen, wie viel diesen Monat noch frei ist und
  wohin der Rest ging, und in wenigen Sekunden eine Ausgabe eintragen.
- **Gefühl:** klar, lebendig, ehrlich. Referenzen außerhalb von Apps:
  Satellitenbilder von Flussdeltas (Lena, Okavango), Minards
  „Carte figurative“ von 1869, Pegellatten an der Donau.
- **Vorhanden:** nur der Name. Keine Fotos, keine Bildgenerierung.
- **Ergebnis:** eine fertige Web-App (Handy zuerst, auch am Desktop) und eine
  getrennte Landing Page wie bei Kalorat.

Abweichung vom App-Designer-Skill: Das Ergebnis ist eine Web-App, kein
SwiftUI. Die Systemschriften von Apple gibt es auf Android und Windows nicht,
deshalb wird eine eigene Schrift mitgeliefert. Die Bildschirme werden
direkt im Code gestaltet und als echte App gerendert und gescannt
(web-designer `shoot.mjs --app`), nicht als getrennte Mockups.

## Der Kategorie-Standard, den wir ablehnen

Die großen Haushaltsbuch-Apps (Finanzblick, MoneyControl, Money Manager,
Budget Flow) teilen sich: weißer Grund, grüne oder türkise Akzente für Geld,
ein Donut-Diagramm mit zehn Bonbonfarben, eine Kachel „Kontostand“, eine
Liste „Letzte Buchungen“, dazu ein runder Plus-Knopf in der Mitte der
Tab-Leiste. Fintech-Apps setzen darauf dunkles Navy mit Lime.

Wir verzichten auf: Grün als Geldfarbe, Donuts, Bonbonfarben pro Kategorie,
KPI-Kacheln, den mittigen Plus-Knopf und die „Paper Edition“ (Papier,
Serifenschrift, ein kursives farbiges Wort).

## Drei Konzepte

Gerendert in `explore.html` (Scratchpad), alle drei mit echten Zahlen.

- **A. Geldfluss ist ein Flussdelta aus der Luft** (Natur). Kobaltblaue
  Farbfläche als Wasser, das Einkommen ist ein Strom, der sich in Arme
  verzweigt. Bricolage Grotesque. Akzent Gelb. **Gewählt.**
- B. Geldfluss ist Minards Carte figurative (Gedrucktes). Heller Grund,
  Newsreader, ein ziegelrotes Band. Verworfen: Es ist genau die
  Paper Edition (Papier, Serife, ein kursives rotes Wort), nur gut gemacht.
- C. Geldfluss ist eine Pegellatte an der Donau (Objekt). Dunkler Grund, Mona
  Sans schmal, signalgelber Wasserstand. Verworfen: Der Pegel zeigt nur eine
  Zahl, und die Kategorien landen in einer gewöhnlichen Liste. Das Konzept
  erklärt nicht, wohin das Geld geht.

Aus B übernommen: der eine Satz, der den Monat in Worten sagt („Wohnen nimmt
das breiteste Stück“). Aus C: die Tagesrate als zweite Zahl.

Verlauf (history): `printed|object|place|media|nature|play` → nature,
Grund colour-field, Schrift grotesque, Akzent yellow, Reichtum shape.

## Tokens

Zwei Gründe, die etwas bedeuten:

- **Wasser** (`--water`): die Fläche, auf der der Fluss liegt. Monat,
  Fixkosten, Verlauf.
- **Ufer** (`--shore`): die Fläche, auf der man schreibt. Eingabe-Sheets,
  Dialoge, Einstellungen-Formulare.

| Rolle | Hell | Dunkel |
|---|---|---|
| water (Grund) | `#1F3FA6` | `#0C1846` |
| water-2 (leicht erhöht, Leisten) | `#2747B0` | `#13225C` |
| ink (auf Wasser) | `#F6F3EA` | `#ECEAE2` |
| ink-2 | `#C9D2F1` | `#AEB8DD` |
| ink-3 | `#97A7DD` | `#7E8BBE` |
| rule | `rgba(246,243,234,.20)` | `rgba(236,234,226,.14)` |
| shore (Sheets) | `#F3F1EA` | `#151E45` |
| shore-ink | `#132056` | `#ECEAE2` |
| shore-ink-2 | `#4B557F` | `#AEB8DD` |
| shore-rule | `#D8D5CA` | `#2A3566` |
| accent (frei verfügbar) | `#FFD24A` | `#F5C93F` |
| accent-ink (Akzent als Text auf Ufer) | `#7A5900` | `#F5C93F` |
| negative (überzogen) | `#FF9F8C` auf Wasser, `#B3261E` auf Ufer | `#FF9F8C` |

- **Akzent hat eine Rolle: „frei verfügbar“.** Die Heldenzahl, der Arm
  „Übrig“, der Rest eines Budgets. Nicht für Knöpfe. Der Hauptknopf ist
  Ufer-Farbe auf Wasser (heller Knopf, dunkler Text).
- Kategorien haben keine eigenen Farben. Im Fluss tragen sie Position, Breite
  und Name. Sparen ist ein gestrichelter Arm, Übrig der helle gelbe Arm.
- Einnahmen sind Tinte, nicht grün.

**Schrift:** Bricolage Grotesque (OFL, mitgeliefert, eine Datei mit
Achsen für Gewicht, Breite und optische Größe). Begründung: eine Grotesk mit
leicht unregelmäßigen, handgeschnittenen Formen, die an Beschriftungen auf
Landkarten erinnert, mit echten Tabellenziffern. Die schmale Breite (78 %)
gibt der Heldenzahl Wucht, ohne dass sie auf 390 px umbricht. Eine Familie
für alles.

**Skala:** 76 (Heldenzahl, 800, schmal, −3,5 %) · 34 (Bildschirmtitel, 700,
−2 %) · 22 (Abschnitt, 700) · 17 (Text) · 15 (zweitrangig) · 13 (Meta) ·
11 (Tab-Beschriftung). Cents in der Heldenzahl auf 45 % der Größe.

**Raum:** Seitenrand 20. Abstände 4, 8, 12, 16, 24, 32, 48. Radien: 10
(Felder, Chips), 24 (Sheets), Kapsel (Knöpfe). Keine Karten auf dem Wasser:
Gruppen durch Abstand und Haarlinien.

## Der Reichtum

Eine Formensprache: **der Fluss**. Ein Strom links, so breit wie das
Einkommen, verzweigt sich mit weichen Kurven in Arme, deren Breite den
Euro entspricht. Die Arme sind halbtransparente Ufer-Farbe auf Kobalt, wie
Sedimentfahnen auf einem Satellitenbild. Übrig ist der einzige volle, gelbe
Arm. Dieselbe Form taucht im Verlauf (zwölf schmale Monatsströme), im Icon
und auf der Landing Page auf.

## Die Signatur

**Der Fluss verzweigt sich neu.** Wer eine Ausgabe speichert, sieht, wie
sie Wasser vom gelben Arm „Übrig“ abzweigt:

1. 0 ms: Das Sheet schließt nach unten (Feder, 350 ms).
2. 120 ms: Die Arme interpolieren zu den neuen Breiten (Feder ohne
   Überschwingen, 650 ms). Der Arm der Kategorie wird breiter, Übrig schmaler.
3. Gleichzeitig zählt die Heldenzahl auf den neuen Wert (Ziffern rollen).
4. Haptik: ein kurzer Impuls (`navigator.vibrate(12)`, wo verfügbar).

Reduzierte Bewegung: sofort der Endzustand, die Zahl wechselt ohne Zählen.

Beim Wechsel des Monats fließt der Fluss vom alten in den neuen Zustand
(dieselbe Interpolation).

## Inhalte

Beispieldaten (abschaltbar, klar markiert): Gehalt 2.900,00 €.
Oktober 2026, Stand 25.:

| Kategorie | Betrag |
|---|---|
| Wohnen (Miete 780,00 + Betriebskosten 110,00) | 890,00 |
| Lebensmittel | 347,82 |
| Sparen (ETF-Sparplan) | 300,00 |
| Essen gehen | 142,60 |
| Freizeit | 96,30 |
| Energie (Strom & Gas) | 96,00 |
| Versicherungen | 71,38 |
| Kleidung | 64,95 |
| Mobilität | 58,90 |
| Handy & Internet | 54,98 |
| Abos | 31,97 |

Übrig 745,10 €, 106,44 € pro Tag für 7 Tage.

**Texte (Auszug):**

- Monat: „Übrig im Oktober“, „106,44 € pro Tag bis zum 31.“,
  „Wohnen nimmt das größte Stück: 31 %.“, Abschnitte „Wohin es ging“,
  „Buchungen“.
- Leer: „Noch nichts eingetragen. Sag zuerst, wie viel jeden Monat
  reinkommt.“ Knopf „Einkommen eintragen“.
- Fixkosten: „Jeden Monat fix: 1.402,18 €. Frei bleiben 1.497,82 €.“
- Fehler beim Import: „Diese Datei ist keine Geldfluss-Sicherung.“
- Sicherung: „Deine Daten liegen nur in diesem Browser. Letzte Sicherung:
  nie.“

**Stimme:** ruhig, genau, in Sätzen. Du-Form. Keine Ausrufezeichen.

## Zustände

Leer (erster Start), leer im Filter, Monat in der Zukunft (geplant),
Monat überzogen (Heldenzahl negativ in `negative`, Arm „Fehlt“ links statt
„Übrig“ rechts), offline (funktioniert vollständig), neue Version verfügbar,
Speicher nicht dauerhaft (Hinweis zur Sicherung), Import-Fehler.
