# Geldfluss: Gestaltung

Nicht ausgeliefert (der Build kopiert nur `app/` und `landing/`). Vor jeder
Änderung am Aussehen lesen.

## Brief

Selbst verfasst aus Nikitas Antworten, dann von ihm korrigiert.

- **Was:** ein kostenloses Open-Source-Haushaltsbuch als PWA auf GitHub Pages.
  Wer zum Beispiel 2.900 € netto bekommt, sieht, wohin das Geld fließt:
  Einnahmen, Fixkosten, laufende Ausgaben, was übrig bleibt. Daten nur im
  Browser, kein Konto, kein Server.
- **Kernhandlung:** öffnen, sehen, wie viel diesen Monat noch frei ist und
  wohin der Rest ging, und in wenigen Sekunden eine Ausgabe eintragen.
- **Gefühl (vom Besitzer):** einfach, modern, wie von Apple. Fühlt sich auch
  als PWA wie eine native App an. Bis ins Detail poliert.
- **Ergebnis:** eine Web-App (Handy zuerst, auch am Desktop) und eine
  getrennte Landing Page wie bei Kalorat.

## Verlauf der Richtung

Runde 1 war „Flussdelta auf Kobalt“ (Farbfläche, Bricolage Grotesque, Gelb).
Der Besitzer hat sie abgelehnt: zu blau, nicht einfach genug, nicht
Apple-artig. Runde 2 ist **A. Native, sharpened** aus dem App-Designer-Skill.

Drei Varianten auf dem echten Monatsbildschirm, gleiche Struktur,
verschiedener Akzent für „Übrig“: Orange `#FF6A13`, Türkis `#14B8A6`,
Pink `#FF2D55`. **Orange gewählt.** Türkis lag zu nah am Fintech-Türkis,
Pink war die zweitbeste Wahl, wirkt aber eher wie Musik als wie Geld.

## Der Kategorie-Standard, den wir ablehnen

Haushaltsbuch-Apps teilen sich: Grün oder Türkis für Geld, ein Donut mit
zehn Bonbonfarben, eine Kachel „Kontostand“, „Letzte Buchungen“, ein runder
Plus-Knopf mitten in der Tab-Leiste, KPI-Kacheln. Fintech setzt dunkles
Navy mit Lime darauf. Nichts davon.

## Tokens

Systemflächen wie in iOS, eigene Tönung nur für das Übrige.

| Rolle | Hell | Dunkel |
|---|---|---|
| ground (gruppierter Grund) | `#F2F2F7` | `#000000` |
| raised (Listen, Karten) | `#FFFFFF` | `#1C1C1E` |
| fill (Felder, Chips, Segmente) | `rgba(118,118,128,.12)` | `rgba(118,118,128,.24)` |
| ink | `#000000` | `#FFFFFF` |
| ink-2 | `#6C6C70` | `#A1A1A8` |
| ink-3 | `#8E8E93` | `#6E6E73` |
| rule | `rgba(60,60,67,.16)` | `rgba(84,84,88,.55)` |
| stream (Arme im Fluss) | `rgba(60,60,67,.11)` | `rgba(235,235,245,.1)` |
| bar (Quelle und Mündungen) | `#3A3A3C` | `#D1D1D6` |
| accent (Übrig) | `#FF6A13` | `#FF7A2E` |
| accent-ink (Akzent als Text) | `#B93C0A` | `#FF8A47` |
| tint (Aktionen) | `#000000` | `#FFFFFF` |
| neg (überzogen) | `#E5241B` | `#FF5A50` |

- **Akzent, eine Rolle:** das Übrige. Der Arm „Übrig“, der gewählte Tab,
  Links. Aktionen sind Tinte (schwarzer Knopf, im Dunkeln weiß), wie in
  Apples eigenen Apps mit neutraler Tönung.
- Kategorien haben keine Farben. Sparen ist ein dunklerer grauer Arm.

**Schrift:** die Systemschrift. Auf Apple-Geräten SF Pro, Display für
Titel, SF Rounded (`ui-rounded`) für Beträge; auf Windows Segoe UI Variable,
auf Android Roboto. Keine mitgelieferte Schrift: so fühlt sich die App auf
jedem Gerät wie das Gerät an, und es lädt nichts nach.

**Skala:** 58 (Heldenzahl, rund, 700, −3 %; 72 am Desktop) · 34 (großer
Titel, 700) · 22 (Abschnitt, 700) · 17 (Text) · 15 · 13 · 11 (Tabs).

**Raum:** Seitenrand 16 (24 am Desktop). Radien: 22 Gruppen und Karten, 30
Sheets, 12 Felder, 18 Chips, Kapsel für Knöpfe.

## Native Verhalten

- Großer Titel, beim Scrollen eine Glasleiste mit Titel in der Mitte.
- Schwebende Glas-Tab-Leiste, daneben der runde Eintragen-Knopf (dort, wo
  iOS 26 die Suche hat). Nichts schwebt über dem Fluss.
- Sheets steigen mit Feder auf, lassen sich am Griff nach unten ziehen; die
  Seite dahinter tritt zurück (skaliert, abgedunkelt). Zurück-Taste und
  Escape schließen sie.
- Tabs wechseln mit Überblendung (View Transitions), die Leiste bleibt
  stehen.
- Haptik: Android über `vibrate`, iPhone über einen versteckten nativen
  Switch.
- Keine Textauswahl auf Bedienelementen, kein Doppeltipp-Zoom, kein
  Pull-to-Refresh.

## Die Signatur

**Der Fluss verzweigt sich neu.** Nach dem Speichern wachsen und schrumpfen
die Arme mit einer Feder (650 ms), der orange Arm „Übrig“ wird schmaler,
die Heldenzahl zählt mit. Reduzierte Bewegung: sofort der Endzustand.

## Inhalte

Beispieldaten: Gehalt 2.900,00 €, sechs Monate, Oktober bis zum 25.
Stimme: ruhig, genau, Du-Form, keine Ausrufezeichen.
