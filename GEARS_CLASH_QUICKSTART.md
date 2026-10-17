# Gears Clash Quick Start

## 🚀 Vollständiger Entwicklungsstack

Alles was du brauchst um Gears Clash mit echtem Server zu testen.

### 1. Server + Client parallel starten

```bash
npm run dev:full
```

Das startet:
- **Vite Dev Server** (Client) auf `http://localhost:5173`
- **Express API Server** auf `http://localhost:3001`

### 2. Im Browser

#### Mock-Modus (nur Client, keine Server-Verbindung):
```
http://localhost:5173
```

#### HTTP-Modus (mit echtem Server):
```
http://localhost:5173?http=1
```

### 3. Was funktioniert jetzt?

✅ **VS-Symbol (`gears_vs`) im Grid**
- Wird mit Gewicht 1.5 generiert
- Kann überall auf dem 5×5 Grid landen

✅ **Server-Logik** (`server/spin-engine.ts`):
- Erkennt VS-Symbole nach dem Spin
- Prüft ob das Symbol in einer Win-Line liegt
- Wenn ja: Battle zwischen zwei zufälligen Multipliern
- Niedrigerer Multiplier gewinnt mit 70% Wahrscheinlichkeit
- Gesamte Walze wird zu Wild mit gewonnenem Multiplier
- Gewinne werden neu berechnet und mit Multiplier gewichtet

✅ **Payload-Struktur**:
```typescript
{
  type: 'gears_clash',
  payload: {
    gearA: { multiplier: 3 },
    gearB: { multiplier: 5 },
    winnerReel: 2,
    winnerMultiplier: 3
  }
}
```

✅ **Client-Animation** (`src/renderer/GearsClashAnimation.ts`, eingebunden über
`PixiSlotRenderer.playGearsClashAnimationAsync()`):
- Battle-Animation (VS-Box mit zwei Gears)
- Funkeffekte während des Kampfs
- Winner-Reveal mit Multiplier-Badge
- Full-Reel-Wild-Expansion

### 4. Was fehlt noch?

- Mehrere VS-Symbole pro Spin: ausgewertet wird aktuell nur das erste.
- Eigene Sound-Assets für `gears_clash_intro`, `gears_clash_battle`,
  `gears_clash_expand` — die Hooks feuern bereits.

### 5. Demo-Szenarien

Im Mock-Modus gibt es einen Button "VS Gears Symbole (Feature-Trigger)" der mehrere VS-Symbole platziert.

Im HTTP-Modus werden VS-Symbole zufällig generiert basierend auf `symbolWeights.gears_vs: 1.5`.

### 6. Debugging

**Server-Logs:**
```bash
npm run dev:server
```

**Browser Console:**
- Zeigt welcher Adapter aktiv ist (Mock vs HTTP)
- `SpinResult` mit `gearsClashTriggered: true` wenn Feature ausgelöst

### 7. Nächste Schritte

1. **Sound-Assets liefern**: `gears_clash_intro`, `gears_clash_battle`, `gears_clash_expand`
2. **Mehrere VS-Symbole**: Aktuell wird nur das erste VS-Symbol ausgewertet
3. **Testing**: Automatisierte Tests für die Server-Logik

## Dateistruktur

```
server/
├── index.ts           # Express Server
├── spin-engine.ts     # Gears Clash Logik
└── README.md

src/renderer/
└── GearsClashAnimation.ts  # Battle-Animation (Pixi.js)

src/demo/
└── main.ts            # Adapter-Switch (Mock vs HTTP)
```

## Troubleshooting

**Server startet nicht:**
```bash
npm install  # Dependencies neu installieren
```

**CORS-Fehler:**
Server nutzt bereits `cors()` Middleware. Bei Problemen Port prüfen.

**Balance wird nicht aktualisiert:**
Server nutzt In-Memory Balance (startet bei 10000). Bei Server-Restart wird zurückgesetzt.
