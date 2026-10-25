# Geldfluss

**Sieh, wohin dein Geld fließt.** Geldfluss zeigt jeden Monat als Fluss: was reinkommt, wohin es geht und was übrig bleibt. Kostenlos, ohne Konto, alles bleibt in deinem Browser.

- **App:** https://nikity.is-a.dev/geldfluss/app/
- **Landing Page:** https://nikity.is-a.dev/geldfluss/

## Was es kann

- **Der Monat als Fluss.** Das Einkommen verzweigt sich in Arme, so breit wie das Geld, das in jede Kategorie geht. Orange ist, was übrig bleibt, dazu der Betrag pro Tag bis Monatsende.
- **Fixkosten einmal eintragen.** Monatlich, alle 2 Monate, vierteljährlich, halbjährlich oder jährlich. Ein neuer Betrag gilt ab einem gewählten Monat, die Vergangenheit bleibt. Einzelne Monate lassen sich aussetzen oder ändern.
- **Ehrliches „Übrig“.** Fixkosten, die im Monat noch fällig werden, sind schon abgezogen.
- **Ausgaben in Sekunden**, mit Kategorie, Datum und Notiz. Zur Seite wischen löscht, „Rückgängig“ holt es zurück.
- **Budgets pro Kategorie**, **Verlauf** über bis zu zwölf Monate, Schnitt pro Kategorie und ein Satz, wenn etwas aus der Reihe fällt.
- **Sicherung als Datei** (JSON) zum Laden auf einem anderen Gerät, **Export als Tabelle** (CSV für Excel und Numbers).
- **Offline** nach dem ersten Besuch, als App installierbar auf iPhone, Android und Computer.
- Hell und dunkel, Tastatur (`N` neuer Eintrag, `←` `→` Monat), Screenreader, reduzierte Bewegung.

## Datenschutz

Es gibt keinen Server und kein Konto. Alle Daten liegen in IndexedDB in deinem Browser. Die App lädt nichts von anderen Diensten. Daher gibt es auch keinen Abgleich zwischen Geräten; dafür ist die Sicherungsdatei da.

## Aufbau

Kein Framework, kein Build-Schritt für den Code. Plain HTML, CSS und JavaScript-Module.

```
app/        die PWA (Monat, Fixkosten, Verlauf, Einstellungen)
  js/       model.js (Rechnungen, rein und getestet), flow.js (der Fluss),
            store.js (IndexedDB), views.js, sheets.js, settings.js, main.js
  sw.js     Service Worker (der Build trägt Cache-Name und Dateiliste ein)
landing/    die Landing Page und die 404-Seite
tests/      Tests für Geld, Datum und Datenmodell (node --test)
tools/      build.mjs (baut _site/), serve.mjs (lokaler Server)
docs/       Gestaltungsrichtung
```

## Lokal starten

```bash
npm test                 # Tests
npm run build            # baut _site/: Landing auf /, App unter /app/
npm run serve            # http://localhost:4173/geldfluss/
```

`?demo` lädt beim ersten Start Beispieldaten, `?nosw` schaltet den Service Worker auf localhost ab.

## Veröffentlichen

Jeder Push auf `main` testet, baut und veröffentlicht über GitHub Actions auf GitHub Pages (`.github/workflows/pages.yml`).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
