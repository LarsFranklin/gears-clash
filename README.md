# Gears Clash (`gears-clash-game`)

Framework-agnostisches HTML5-Slot-Game (**TypeScript**, **Vite**, **PixiJS**). Social-/Fun-Coins — **keine** Echtgeld-Logik im Client. Finale Spins, Gewinne und Bonus-Ergebnisse kommen vom **Host-Backend** (oder vom **`MockGameApiAdapter`** nur für Demo/Entwicklung).

## Trust Boundary — Client ist NICHT Source of Truth

Diese Regel ist nicht verhandelbar:

- **Der Client darf**: Reels animieren, `SpinResult.winAmount` / Highlights anzeigen, Mock-Daten für lokale Demo erzeugen, Bonus-Visuals abspielen.
- **Der Client darf NICHT**: finale Echtgeld-/Coin-Gewinne entscheiden, Produkt-RTP-Mathematik enthalten, Backend-Sicherheit ersetzen.
- **`MockGameApiAdapter`** ist **nur** für Entwicklung & Demos. Er erzeugt zufällige `winAmount`-Werte, die ausdrücklich keine Realauszahlungslogik darstellen.

Das gleiche Prinzip gilt für Bonus-Ergebnisse (`gears_clash`, `heist_run`, `deadlock_mode`): Der Server entscheidet final; der Client visualisiert nur die gelieferten Payloads.

## Distribution

Das Package kann ausgeliefert werden per:

- **npm** (öffentlich oder privat)
- **GitLab Package Registry** / anderes npm-kompatibles Registry
- **ZIP oder CI-Artefakt** (Ordner `dist/` + `README.md`)

Das Host-System stellt **`GameApiAdapter`** (HTTP/Mock) und optional **`HostAdapter`**-Callbacks bereit; das Spiel bleibt **ohne** Laravel, React, Filament oder PHP gebunden.

## Public API

**Nur** aus dem Package-Root importieren — keine internen Pfade:

```ts
import {
  GearsClashGame,
  MockGameApiAdapter,
  HttpGameApiAdapter,
  defaultGameConfig,
  defaultAssetManifest,
  resolveManifestPaths,
  NetworkError,
  InvalidResponseError,
  InsufficientBalanceError,
} from 'gears-clash-game';
import 'gears-clash-game/style.css';
```

Vollständige Exportliste siehe `src/index.ts`. Typdefinitionen: `package.json` → `"types": "./dist/index.d.ts"`.

## Builds in `dist/`

| Datei | Zweck |
|--------|--------|
| `gears-clash.es.js` | ESM für Bundler |
| `gears-clash.iife.js` | Browser ohne Bundler (`<script>`) |
| `style.css` | Nur `gc-*`-UI-Klassen |
| `index.d.ts` | TypeScript-Einstieg |
| `gameConfig.schema.json` | JSON Schema für `GameConfig` (Filament/Laravel) |

### IIFE / `<script>`-Tag

```html
<link rel="stylesheet" href="/path/to/gears-clash-game/dist/style.css" />
<script src="/path/to/gears-clash-game/dist/gears-clash.iife.js"></script>
<script>
  const game = new GearsClash.GearsClashGame({
    container: document.getElementById('game'),
    apiAdapter: new GearsClash.HttpGameApiAdapter({
      spinEndpoint: '/api/games/gears-clash/spin',
      balanceEndpoint: '/api/wallet/balance',
      timeoutMs: 15000,
    }),
    hostAdapter: {
      onReady: () => console.log('ready'),
      onError: (e) => console.error(e),
      onBalanceUpdate: (b) => console.log('balance', b),
      currency: 'COINS',
    },
    config: GearsClash.defaultGameConfig,
  });
  void game.mount();
</script>
```

Das IIFE-Bundle legt **`GearsClash.GearsClashGame`**, **`GearsClash.MockGameApiAdapter`** usw. am globalen Objekt **`GearsClash`** ab (siehe Ende von `gears-clash.iife.js`).

## Lokale Demo (nur Mock)

```bash
npm install
npm run dev
```

Die Demo (`index.html`) nutzt **ausschließlich** `MockGameApiAdapter` — **keine** Produkt-API.

## Tests & Build

```bash
npm test          # vitest run
npm run test:watch
npm run build     # vite build + tsc + copy-schema
```

CI (siehe `.gitlab-ci.yml`) führt Install, Tests, Build und SAST/Secret-Detection aus.

## Laravel / Blade (skizziert)

1. `npm install gears-clash-game` (oder lokaler Pfad / Registry).
2. Assets aus `node_modules/gears-clash-game/dist/` nach `public/vendor/gears-clash/` kopieren (oder Vite/Mix bündeln).
3. Blade:

```blade
<link rel="stylesheet" href="{{ asset('vendor/gears-clash/style.css') }}">
<div id="game"></div>
<script type="module">
  import { GearsClashGame, HttpGameApiAdapter, defaultGameConfig } from '/vendor/gears-clash/gears-clash.es.js';

  const game = new GearsClashGame({
    container: document.getElementById('game'),
    apiAdapter: new HttpGameApiAdapter({
      spinEndpoint: '/api/games/gears-clash/spin',
      balanceEndpoint: '/api/wallet/balance',
    }),
    config: defaultGameConfig,
  });
  await game.mount();
</script>
```

## React (skizziert)

```tsx
import { useEffect, useRef } from 'react';
import { GearsClashGame, MockGameApiAdapter } from 'gears-clash-game';
import 'gears-clash-game/style.css';

export function GearsClashEmbed() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game = new GearsClashGame({
      container: ref.current,
      apiAdapter: new MockGameApiAdapter(),
    });
    void game.mount();
    return () => void game.destroy();
  }, []);
  return <div ref={ref} />;
}
```

## Host-API (Beispiel)

**`POST /api/games/gears-clash/spin`**

Request:

```json
{
  "bet": 100,
  "currency": "COINS",
  "mode": "base"
}
```

Response (Basisspin, kein Bonus):

```json
{
  "spinId": "550e8400-e29b-41d4-a716-446655440000",
  "reelStops": [
    ["bolt", "nut", "gear", "wild_gear", "bonus_gears_clash"],
    ["coil", "piston", "wrench", "rivet", "plate"],
    ["cable", "valve", "bolt", "nut", "gear"],
    ["wild_gear", "coil", "piston", "wrench", "rivet"],
    ["plate", "cable", "valve", "bolt", "nut"]
  ],
  "winAmount": 250,
  "balanceAfter": 9850,
  "bonus": null,
  "displayHighlights": [
    { "reel": 0, "row": 2 },
    { "reel": 1, "row": 2 },
    { "reel": 2, "row": 2 }
  ],
  "displayWinLines": [
    {
      "id": "line_1",
      "amount": 250,
      "label": "3x Match",
      "points": [
        { "reel": 0, "row": 2 },
        { "reel": 1, "row": 2 },
        { "reel": 2, "row": 2 }
      ]
    }
  ]
}
```

`reelStops` ist **5 Spalten × 5 Zeilen** (Symbol-IDs als String). `displayHighlights` und `displayWinLines` sind **rein visuelle Hinweise** des Servers an den Renderer — der Client interpretiert sie nicht für Auszahlungslogik.

## Bonus-Payload-Beispiele

Alle drei Bonus-Modi haben **typisierte Payloads** (siehe `BonusSessionPayload` in `src/index.ts`):

### `gears_clash` — Multiplier-Battle

```json
{
  "bonus": {
    "type": "gears_clash",
    "payload": {
      "gearA": { "multiplier": 2 },
      "gearB": { "multiplier": 6 },
      "winnerReel": 2,
      "winnerMultiplier": 6
    }
  }
}
```

Zwei Gears tragen Multiplikatoren; der höhere wird auf eine komplette Reel als Full-Reel-Wild angewendet. Mehrere aktive Full-Reel-Wild-Multiplier addieren sich (Server-final).

### `heist_run` — Free Spins mit Sticky Wilds

```json
{
  "bonus": {
    "type": "heist_run",
    "payload": {
      "freeSpinsAwarded": 8,
      "currentSpin": 1,
      "stickyWilds": [
        { "reel": 0, "row": 1 },
        { "reel": 3, "row": 2, "multiplier": 5 }
      ]
    }
  }
}
```

Wilds, die während der Free Spins erscheinen, bleiben sticky bis zum Ende der Bonus-Runde. Sticky-Wilds können optional Multiplier tragen.

### `deadlock_mode` — Collection + Overdrive

```json
{
  "bonus": {
    "type": "deadlock_mode",
    "payload": {
      "phase": "collection",
      "lives": 3,
      "remainingSpins": 5,
      "collectedSymbols": [
        { "reel": 1, "row": 2, "symbolId": "wild_gear", "multiplier": 3 }
      ]
    }
  }
}
```

Phase 1 (Collection): leeres 5×5-Grid, 3 Lives, gesammelte Multiplier/Gear/Wild-Symbole landen im Overdrive-Storage. Mindestens ein Treffer pro Spin → Lives-Reset auf 3, sonst -1.

Phase 2 (Overdrive): gesammelte Symbole werden auf das Grid verteilt, dann läuft ein finaler Reveal-Spin. Multiplier werden auf Gewinne angewendet — die finale Auszahlung kommt vom Server.

## Asset-Manifest (Themes / Skins)

Symbol- und Sound-Pfade liegen im `AssetManifest`:

```ts
import {
  defaultAssetManifest,
  resolveManifestPaths,
  defaultGameConfig,
  GearsClashGame,
  MockGameApiAdapter,
} from 'gears-clash-game';

// Eigenes Theme — z. B. via CDN
const theme = {
  themeId: 'industrial-night',
  symbols: {
    bolt: 'symbols/bolt.png',
    // ... alle 14 IDs aus defaultGameConfig.symbols
  },
  sounds: {
    spin: 'sounds/spin.mp3',
  },
  fallback: { symbol: 'symbols/_missing.png' },
};

const game = new GearsClashGame({
  container: document.getElementById('game'),
  apiAdapter: new MockGameApiAdapter(),
  config: { ...defaultGameConfig, assets: { basePath: 'https://cdn.example/gc/v1' } },
  assetManifest: theme,
});
```

Pfade ohne führenden `/` oder `http(s)://` werden automatisch mit `config.assets.basePath` zusammengeführt.

## Fehlerklassen (`HttpGameApiAdapter`)

- `NetworkError` — Transport (offline, CORS, Abruch). Mit `kind: 'transport' | 'timeout'`.
- `InvalidResponseError` — kein gültiges JSON / kein `SpinResult`.
- `InsufficientBalanceError` — optional über `HttpGameApiAdapterOptions.insufficientBalance` (HTTP-Status oder `body.code`).

Das Spiel leitet Fehler an **`game.on('error', …)`** und **`hostAdapter.onError`** weiter.

### Timeout

Pro Request gilt ein Standard-Timeout von 15 Sekunden. Über `HttpGameApiAdapterOptions.timeoutMs` änderbar (`0` deaktiviert).

### Error-State Recovery

Tritt während eines Spins ein Fehler auf, geht das Spiel in den `error`-State und der Spin-Button bleibt **disabled**. Der Host muss explizit `game.resetError()` aufrufen — typischerweise nachdem der Spieler eine Fehlermeldung gesehen und bestätigt hat.

## Events

- `ready`, `spin:start`, `spin:end` (`SpinResult`)
- `bonus:start` / `bonus:end` (`BonusSessionPayload`)
- `balance:update` (`number`)
- `error` (`unknown`)

Hosts registrieren sich entweder via `game.on(event, fn)` **oder** über die `HostAdapter`-Callbacks (`onReady`, `onError`, `onBalanceUpdate`).

### Filament / Datenbank

`GameConfig` ist **JSON-serialisierbar**. Sie können sie in einer **JSON-Spalte** speichern und in Filament bearbeiten — Validierung z. B. mit [`gameConfig.schema.json`](src/config/gameConfig.schema.json) (nach Build unter `dist/gameConfig.schema.json`, Export `./gameConfig.schema.json`).

Das Schema validiert u. a.:

- Mindestens 14 Symbole (10 normal + 1 wild + 3 bonus)
- `kind: bonus` erfordert ein `bonusId` aus dem festen Enum
- `bonusId` darf nur bei `kind: bonus` gesetzt sein
- Bonus-IDs: `gears_clash` | `heist_run` | `deadlock_mode`

## Lizenz

`UNLICENSED` — beim Release eigene Lizenz setzen.

## Mitarbeit / Workflow

Issue-Tracking, Reviews und Releases laufen über GitLab (`franklin-slots/gears-clash`) — **ohne** dauerhaften Changelog im Repo. Stattdessen werden geschlossene Issues pro Milestone als Release-Notes verwendet.

- **Issue-Templates:** [.gitlab/issue_templates/](.gitlab/issue_templates) — Bug, Task, Issue, Epic, Incident
- **Issue-Konventionen & Labels:** [.gitlab/README.md](.gitlab/README.md)
- **Modul-Review:** [REVIEW.md](REVIEW.md), Trigger `/modul-review` oder `GC-REVIEW`
- **Cursor-Skills/Rules:** [.cursor/](.cursor) — siehe Skill-Index dort

Slash-Trigger im Cursor-Chat:

| Trigger | Wirkung |
|---------|---------|
| `/bugfix-request` | Roh-Bug-Beschreibung → strukturierte Bug-Issue(s) in GitLab |
| `/feature-request` | Roh-Feature-Idee → Epic/Feature/Tasks in GitLab |
| `/modul-review <Modul>` | Systematisches Review eines Moduls inkl. Issue-Erstellung |
| `/issue-work #<IID>` | Issue aktiv übernehmen (Assignee, Milestone, Dates, Time Tracking) |
