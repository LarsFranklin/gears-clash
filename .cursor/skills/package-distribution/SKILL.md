---
name: package-distribution
description: Build, Versionierung und Distribution des gears-clash-game-Packages (Vite Lib-Mode, ESM + IIFE, JSON-Schema, npm/GitLab Registry/ZIP). Nutzen bei "Build", "dist", "Version", "Bundle", "IIFE", "ESM", "npm publish", "Schema", "vite.config".
---

# Package Distribution

Gears Clash wird als **distributables Package** ausgeliefert: ESM für Bundler, IIFE für `<script>`-Hosts, plus ein JSON-Schema. Es ist **kein** Hosting-Projekt.

## Build-Pipeline

`npm run build` =

1. `vite build` — Vite Lib-Mode mit zwei Outputs (siehe `vite.config.ts`):
   - `dist/gears-clash.es.js` (ESM, für Bundler)
   - `dist/gears-clash.iife.js` (IIFE, exposes `window.GearsClash`)
   - `dist/style.css` (gebündeltes CSS, `cssCodeSplit: false`)
2. `tsc -p tsconfig.build.json` — Typdefinitionen → `dist/index.d.ts`
3. `node scripts/copy-schema.mjs` — Kopiert `src/config/gameConfig.schema.json` nach `dist/`

**Wichtig:** `inlineDynamicImports: true` ist gewollt — Pixi wird inline gebündelt, damit Hosts nur **eine** Datei pro Format laden. Keine `import('...')`-Splits einbauen.

## Public Entries (`package.json`)

```json
"main":    "./dist/gears-clash.es.js"
"module":  "./dist/gears-clash.es.js"
"types":   "./dist/index.d.ts"
"exports": {
  ".":           { "types": "./dist/index.d.ts", "import": "./dist/gears-clash.es.js", "default": "./dist/gears-clash.es.js" },
  "./style.css": "./dist/style.css",
  "./iife":      "./dist/gears-clash.iife.js",
  "./gameConfig.schema.json": "./dist/gameConfig.schema.json"
}
```

Beim Hinzufügen einer neuen Datei in `dist/`:

1. `package.json` → `files` und/oder `exports` aktualisieren.
2. README erwähnen.
3. Ggf. Build-Script anpassen.

## ESM vs. IIFE

| Format | Wer nutzt es | Wie |
|--------|--------------|-----|
| **ESM** | Vite/Webpack/esbuild-Hosts, React/Inertia, neuer Node | `import { GearsClashGame } from 'gears-clash-game'` |
| **IIFE** | Klassische Blade-/HTML-Hosts ohne Bundler | `<script src=".../gears-clash.iife.js">` → `window.GearsClash.GearsClashGame` |

**Globalname:** `GearsClash` (in `vite.config.ts` als `lib.name`). Beide Bundles enthalten identische Public-API; sie wird in `src/index.ts` für IIFE als `default`-Export am `GearsClash`-Objekt gespiegelt.

## JSON-Schema

`src/config/gameConfig.schema.json` ist das Schema für `GameConfig`. Wird beim Build nach `dist/` kopiert (`scripts/copy-schema.mjs`). Filament/Laravel-Hosts können damit `GameConfig`-JSON validieren oder Form-Generatoren ableiten.

**Beim Erweitern von `GameConfig`** (in `src/config/types.ts`):

1. `defaultGameConfig.ts` ergänzen.
2. Schema in `gameConfig.schema.json` aktualisieren.
3. `copy-schema.mjs` läuft automatisch — nichts in `dist/` direkt editieren.

## Asset-Manifest

`src/config/assetManifest.ts` definiert relative Asset-Pfade. Der Host kann beim `new GearsClashGame({ assetManifest: ... })` ein eigenes Manifest übergeben.

- `defaultAssetManifest` enthält nur Schlüssel/Pfade — **keine** echten Bilder im Package.
- `resolveManifestPaths(manifest, config)` löst `config.assets.basePath` davor auf.
- Symbole ohne Asset werden prozedural gerendert (siehe Skill `pixi-slot-renderer`).

## Versionierung

- SemVer in `package.json`.
- Pre-1.0: Breaking Changes via `0.x.0`-Bumps; Patches via `0.x.y`.
- Post-1.0: Public API in `src/index.ts` ist die Vertragsfläche. Breaking Change = Major-Bump.
- Tag-Schema: `vMAJOR.MINOR.PATCH` — exakt der Wert aus `package.json`.

## Distributionswege

| Weg | Wann | Wie |
|-----|------|-----|
| **npm public** | Wenn das Package öffentlich ist | `npm publish` (vorher `npm login`) |
| **GitLab Package Registry** | Privat, intern | `package.json` → `publishConfig.registry`, `npm publish` mit Token |
| **ZIP / CI-Artefakt** | One-Off-Auslieferung | `dist/` + `README.md` zippen, GitLab-Release-Asset |
| **Lokaler Pfad** | Monorepo / Vendor | `npm install /path/to/gears-clash-game` |

## CI (`.gitlab-ci.yml`)

Aktuell: SAST + Secret-Detection. Weitere Stages (Build, Pack, Publish) werden bei Bedarf ergänzt — nicht ohne Issue/Plan einbauen.

## Hosts integrieren — Cheat Sheet

### Blade / HTML (IIFE)

```html
<link rel="stylesheet" href="/vendor/gears-clash/style.css" />
<script src="/vendor/gears-clash/gears-clash.iife.js"></script>
<script>
  const game = new GearsClash.GearsClashGame({
    container: document.getElementById('game'),
    apiAdapter: new GearsClash.HttpGameApiAdapter({
      spinEndpoint:    '/api/games/gears-clash/spin',
      balanceEndpoint: '/api/wallet/balance',
    }),
    config: GearsClash.defaultGameConfig,
  });
  void game.mount();
</script>
```

### React / Bundler (ESM)

```tsx
import { GearsClashGame, MockGameApiAdapter } from 'gears-clash-game';
import 'gears-clash-game/style.css';
```

### Filament / DB

`GameConfig` ist JSON-serialisierbar — als JSON-Spalte speichern, mit `gameConfig.schema.json` validieren.

## Don'ts

- ❌ `dist/` von Hand editieren.
- ❌ Interne Pfade (`gears-clash-game/dist/...`) in Doku/Hosts erwähnen — nur die `exports`-Einträge.
- ❌ `npm publish` ohne Issue / Nutzer-Bestätigung.
- ❌ Pixi extern als Peer-Dependency erwarten — wir bündeln es bewusst inline.

## Verwandte Skills & Dateien

- `slot-game-architecture` — was die Public API enthält
- `gitlab-release` — Tag/Release auf GitLab
- `vite.config.ts`, `package.json`, `tsconfig.build.json`, `scripts/copy-schema.mjs`
