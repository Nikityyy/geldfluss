# Geldfluss Landing: Gestaltung

Nicht ausgeliefert (der Build lässt diese Datei weg).

## Brief

- **Was:** die Landing Page von Geldfluss, getrennt von der App wie bei
  Kalorat. Statisch, GitHub Pages, kein Build-Schritt.
- **Die eine Aufgabe:** In zehn Sekunden sieht man die echte App, versteht
  „kostenlos, kein Konto, Daten bleiben bei mir“ und kann sie öffnen.
- **Gefühl (vom Besitzer):** einfach, modern, wie Apple. Dieselbe Sprache
  wie die App.

## Drei Entwürfe des ersten Bildschirms

- A. Produktseite: weißer Grund, große zentrierte Überschrift, drei echte
  Screens im Gerät. Am meisten Apple. **Hero gewählt.**
- B. Werkzeug zuerst: grauer Grund, links die Frage „2.900 € rein. Wohin
  fließen sie?“, rechts ein Fluss, den man mit dem eigenen Netto füttert.
  **Als zweiter Abschnitt übernommen**, weil es das Produkt am ehrlichsten
  zeigt: der echte Fluss-Code aus der App, live.
- C. Plakat: schwarzer Grund, die Zahl „906,75 €“ riesig in Orange.
  **Als dunkler Abschnitt übernommen**, für die Daten und den Dunkelmodus.

Zentrierter Hero: Das ist laut Slop-Katalog ein Merkmal von Vorlagen. Hier
bewusst, weil der Besitzer Apples Produktseiten als Maßstab nennt und der
Beweis (drei echte Screens) direkt darunter steht, nicht ein Pill-Badge.

## Grammatik

Scroll-Story mit fünf Abschnitten, jeder beantwortet die nächste Frage:

1. Was ist das? Überschrift, Satz, Knopf, drei Screens.
2. Wie sieht das bei mir aus? Netto eintippen, Fixkosten schieben, der Fluss
   rechnet mit.
3. Wie fühlt es sich im Alltag an? Eintragen, Fixkosten, Verlauf.
4. Wo liegen meine Daten? Schwarzer Abschnitt mit den ehrlichen Fakten,
   auch dem Nachteil (keine Synchronisierung).
5. Wie bekomme ich es? iPhone, Android, Computer, dann der Fuß.

## Tokens

Wie die App (`docs/DIRECTION.md`): `#FFFFFF` und `#F2F2F7`, Tinte
`#1D1D1F`, zweitrangig `#6E6E73`, Akzent Orange `#FF6A13` (Text
`#B93C0A`), dunkler Abschnitt `#000000` mit `#F5F5F7`. Systemschrift.
Überschriften 48 bis 96 px, −3,5 %.

## Signatur

Der Probier-Fluss: Jede Eingabe lässt die Arme mit derselben Feder wie in
der App neu verzweigen. Reduzierte Bewegung: sofort der Endzustand.

## Bilder

Echte Screens der App mit den Beispieldaten, hell und dunkel, gerendert
mit `screens.mjs` (Scratchpad). Statusleiste und Dynamic Island zeichnet
das Gerät in CSS.
