# Gears Clash (`gears-clash-game`)

Framework-agnostisches HTML5-Slot-Game (**TypeScript**, **Vite**, **PixiJS**). Social-/Fun-Coins — **keine** Echtgeld-Logik im Client. Finale Spins, Gewinne und Bonus-Ergebnisse kommen vom **Host-Backend** (oder vom **`MockGameApiAdapter`** nur für Demo/Entwicklung).

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
  NetworkError,
} from 'gears-clash-game';
import 'gears-clash-game/style.css';
```

Typdefinitionen: `package.json` → `"types": "./dist/index.d.ts"`.

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

Response:

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
  "bonus": null
}
```

`reelStops` ist **5 Spalten × 5 Zeilen** (Symbol-IDs als String). Bonus-Payloads sind später als Union (`gears_clash` | `heist_run` | `deadlock_mode`) typisiert.

### Filament / Datenbank

`GameConfig` ist **JSON-serialisierbar**. Sie können sie in einer **JSON-Spalte** speichern und in Filament bearbeiten — Validierung z. B. mit [`gameConfig.schema.json`](src/config/gameConfig.schema.json) (nach Build unter `dist/gameConfig.schema.json`, Export `./gameConfig.schema.json`).

## Fehlerklassen (`HttpGameApiAdapter`)

- `NetworkError` — Transport (offline, CORS, Abruch).
- `InvalidResponseError` — kein gültiges JSON / kein `SpinResult`.
- `InsufficientBalanceError` — optional über `HttpGameApiAdapterOptions.insufficientBalance` (HTTP-Status oder `body.code`).

Das Spiel leitet Fehler an **`game.on('error', …)`** und **`hostAdapter.onError`** weiter.

## Events

- `ready`, `spin:start`, `spin:end`, `bonus:start`, `bonus:end`, `balance:update`, `error`

## Lizenz

`UNLICENSED` — beim Release eigene Lizenz setzen.
