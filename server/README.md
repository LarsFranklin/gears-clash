# Gears Clash Dev Server

Lokaler Node.js/Express Server für Entwicklung und Tests mit echter Gears-Clash-Logik.

## Features

- ✅ VS-Symbol Detection
- ✅ Win-Line Prüfung (würde Wild einen Gewinn erzeugen?)
- ✅ Battle-Entscheidung (niedrigerer Multiplier gewinnt häufiger - 70%)
- ✅ Full-Reel-Wild Expansion mit Multiplier
- ✅ Gewinnberechnung mit Multiplier-Anwendung

## Starten

```bash
# Nur Server
npm run dev:server

# Server + Client parallel
npm run dev:full
```

Server läuft auf: **http://localhost:3001**

## Endpoints

### POST /api/spin
Führt einen Spin aus mit Gears Clash Logic.

**Request:**
```json
{
  "bet": 100
}
```

**Response:**
```json
{
  "spinId": "spin_...",
  "reelStops": [["bolt", "nut", ...], ...],
  "winAmount": 250,
  "balanceAfter": 10150,
  "displayWinLines": [...],
  "displayHighlights": [...],
  "bonus": {
    "type": "gears_clash",
    "payload": {
      "gearA": { "multiplier": 3 },
      "gearB": { "multiplier": 5 },
      "winnerReel": 2,
      "winnerMultiplier": 3
    }
  },
  "meta": {
    "gearsClashTriggered": true,
    "vsSymbolCount": 1
  }
}
```

### GET /api/balance
Gibt die aktuelle Demo-Balance zurück.

## Client-Konfiguration

Im Client den `HttpGameApiAdapter` verwenden:

```typescript
import { GearsClashGame, HttpGameApiAdapter } from 'gears-clash-game';

const apiAdapter = new HttpGameApiAdapter({
  spinEndpoint: 'http://localhost:3001/api/spin',
  balanceEndpoint: 'http://localhost:3001/api/balance',
});

const game = new GearsClashGame({
  apiAdapter,
  // ... weitere Optionen
});
```

## Entwicklung

- `server/spin-engine.ts` - Kern-Logik für Gears Clash
- `server/index.ts` - Express Server Setup

## Todos

- [ ] Mehrere VS-Symbole in einem Spin unterstützen
- [ ] Session-Management (statt einzelner Balance-Variable)
- [ ] Bonus-Scatter (Heist/Deadlock) Trigger
- [ ] RTP-Simulation & Logging
