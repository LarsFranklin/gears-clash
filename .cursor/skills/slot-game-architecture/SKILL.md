---
name: slot-game-architecture
description: Architektur-Leitfaden für Gears Clash — Trennung zwischen Engines (SlotEngine, ReelEngine, PayoutEngine, BonusEngine), Renderer (PixiSlotRenderer), Bonus-Features, UI (HUD/Buttons/Overlays) und Adaptern (GameApiAdapter, HostAdapter). Nutzen bei "neues Modul", "wo gehört das hin", "Spin-Flow", "Bonus", "Adapter", "Renderer", "Engine", "Feature".
---

# Gears Clash — Architektur

Gears Clash ist ein **framework-agnostisches** HTML5-Slot-Game als wiederverwendbares Package (`gears-clash-game`). Der Host (Laravel/React/Blade/IIFE) bleibt unangetastet — er liefert nur einen `container`, einen `GameApiAdapter` und optional einen `HostAdapter`.

## Grundprinzipien (UNVERHANDELBAR)

1. **Keine Echtgeld-Logik im Client.** Finale Spin-Ergebnisse, Gewinne und Bonus-Payloads kommen vom Host-Backend (`HttpGameApiAdapter`) oder vom Mock (`MockGameApiAdapter`). Siehe `client-no-final-outcomes.mdc`.
2. **Public API stabil.** Hosts importieren ausschließlich aus `gears-clash-game` (siehe `src/index.ts`). Niemals interne Pfade in Beispielen/Dokumentation/Hosts erwähnen. Siehe `adapter-contract-stability.mdc`.
3. **Framework-frei.** Kein React, Laravel, Filament, jQuery o. ä. im Package.
4. **Deterministische Engines, asynchrone Renderer.** Engines sind reine TypeScript-Klassen ohne DOM/PIXI-Imports. Der Renderer erhält `GameConfig` und animiert. Siehe `renderer-display-only.mdc`.
5. **Trennung Anzeige ↔ Wahrheit.** `SpinResult.winAmount` / `bonus` sind Anzeige-Daten — der Client rechnet **nichts** nach.

## Schichten-Modell

```
                ┌─────────────────────────────────────────────────┐
                │                  Host (Laravel/React/<script>)  │
                │  liefert container, GameApiAdapter, HostAdapter │
                └──────────────────────┬──────────────────────────┘
                                       │
                                ┌──────▼──────────────────────────────────┐
                                │ GearsClashGame (src/GearsClashGame.ts)  │
                                │ Orchestrator: mount / runSpin / destroy │
                                └─┬───────┬───────┬──────────┬─────┬──────┘
                                  │       │       │          │     │
              ┌───────────────────┘       │       │          │     └──────────────────┐
              │                           │       │          │                        │
        ┌─────▼─────┐  ┌─────────────┐ ┌──▼─────┐ ┌▼────┐ ┌──▼────────┐  ┌────────────▼──┐
        │ Engines   │  │ Features    │ │Renderer│ │ UI  │ │ Util/Cfg  │  │ Adapters      │
        │ (core/)   │  │ (features/) │ │(render-│ │(ui/)│ │(config/   │  │ (adapters/)   │
        │ Slot/Reel │  │ GearsClash  │ │ er/    │ │ HUD,│ │ util/)    │  │ Game / Host   │
        │ Payout/   │  │ HeistRun    │ │ Pixi…) │ │ Btn,│ │ types,    │  │ HTTP / Mock   │
        │ Bonus     │  │ Deadlock    │ │        │ │Over-│ │ emitter,  │  │ + errors      │
        │           │  │ Mode        │ │        │ │ lay │ │ random    │  │               │
        └───────────┘  └─────────────┘ └────────┘ └─────┘ └───────────┘  └───────────────┘
```

## Modul-Verantwortung

| Ordner | Verantwortung | Darf importieren | Darf NICHT |
|--------|---------------|------------------|------------|
| `src/core/` | Reine Spiellogik (State Machine, Reel-Validierung, Payout-Format, Bonus-Routing) | `config/`, `util/`, `features/` | DOM, Pixi, Adapter, UI |
| `src/features/` | Bonus-Stubs (`describe`-Helfer pro Bonus-Modus) | `config/` | DOM, Pixi, Adapter, UI |
| `src/renderer/` | Pixi-basierte Darstellung der Reels, Symbole, Animationen | `config/`, `util/`, `core/SymbolRegistry` (für Lookup), Pixi | DOM-Manipulation außerhalb des Canvas-Hosts, Adapter, UI |
| `src/ui/` | DOM-Komponenten (HUD, Buttons, Overlays mit `gc-*`-CSS) | `config/`, `util/`, `styles/` | Pixi-Imports, Adapter, Engine-Interna |
| `src/adapters/` | Server-/Host-Schnittstellen + Fehlerklassen | `config/`, `util/` | Pixi, DOM, Engine-Interna |
| `src/config/` | Typen, Default-Config, Asset-Manifest, JSON-Schema | – | Pixi, DOM, Adapter |
| `src/util/` | `deepMerge`, `random` (mulberry32), `GameEmitter` | – | Pixi, DOM, Adapter |
| `src/demo/` | Lokale Vite-Vorschau (nur Mock!) | Public-API von außen | echte API-Calls |
| `src/styles/` | CSS für HUD/Frame mit `gc-*`-Prefix | – | – |
| `src/__tests__/` | Vitest-Smoke-Tests | beliebig | – |

**Faustregel:** Wenn du in `core/` einen Pixi- oder DOM-Import brauchst, ist die Aufteilung falsch. Der Renderer darf umgekehrt `SymbolRegistry` aus `core/` importieren, um Symbol-IDs in `SymbolDef` aufzulösen — das ist **Lookup**, keine Spielentscheidung.

## Spin-Lebenszyklus

```
runSpin():
  1. canSpin?  → State-Machine (SlotEngine.canSpin)
  2. beginSpin() → State 'spinning'
  3. emit('spin:start') + sound 'spin' + Button disabled
  4. apiAdapter.spin(request)               ← einzige Quelle der Wahrheit
  5. ReelEngine.validateStops(reelStops)    ← Grid-Konsistenz
  6. PixiSlotRenderer.playSpinAnimation()
  7. SlotEngine.enterResolving()
  8. PixiSlotRenderer.showWinFeedback(highlights, amount, lines, hooks)
  9. result.bonus?
     a. SlotEngine.enterBonus()             ← Guard: nur aus spinning|resolving
     b. emit('bonus:start', payload)
     c. setFrozen(true) + BonusOverlayController.show(type)
     d. setFrozen(false)
     e. emit('bonus:end', payload)
 10. SlotEngine.finishRound() → idle
 11. HUD updaten + emit('balance:update', 'spin:end', SpinResult)
 12. on error → SlotEngine.setError() + emit('error') + HostAdapter.onError
                Button bleibt disabled, bis game.resetError() aufgerufen wird.
```

## Public API (`src/index.ts`) — nicht ohne Grund ändern

Exportiert wird ausschließlich:

- **Game**: `GearsClashGame`, `GearsClashGameOptions`, `GameSoundAdapter`
- **Config**: `defaultGameConfig`, `GameConfig`, `SymbolDef`, `SymbolKind`, `GameEventName`
- **Bonus-Typen**: `BonusId`, `BonusSessionPayload`, `GearsClashPayload`, `HeistRunPayload`, `HeistRunStickyWild`, `DeadlockModePayload`, `DeadlockPhase`, `DeadlockCollectedSymbol`
- **Spin-Display**: `SpinRequest`, `SpinResult`, `SpinDisplayHighlight`, `SpinDisplayWinLine`
- **Host**: `HostAdapter` (aus `config/types`)
- **Assets**: `defaultAssetManifest`, `resolveManifestPaths`, `AssetManifest`
- **Adapter**: `GameApiAdapter`, `HttpGameApiAdapter`, `HttpGameApiAdapterOptions`, `MockGameApiAdapter`, `MockGameApiAdapterOptions`
- **Errors**: `NetworkError`, `InvalidResponseError`, `InsufficientBalanceError`

Beim Hinzufügen neuer Public-API-Symbole:

1. In `src/index.ts` exportieren.
2. README-Beispiele aktualisieren.
3. IIFE-Globalobjekt `GearsClash` erweitern (am Ende von `src/index.ts`).
4. Falls ein neuer Konfig-Typ entsteht: Schema (`gameConfig.schema.json`) und Filament-Hinweis im README pflegen.
5. Tests in `src/__tests__/` ergänzen.

## Events (`emitter.emit(...)`)

`ready`, `spin:start`, `spin:end` (`SpinResult`), `bonus:start`/`bonus:end` (`BonusSessionPayload`), `balance:update` (`number`), `error` (`unknown`).

Hosts können sich über `game.on(event, fn)` einklinken **oder** den `HostAdapter` mit Callbacks (`onReady`, `onError`, `onBalanceUpdate`) nutzen.

## Adapter-Verträge

### `GameApiAdapter`

```ts
interface GameApiAdapter {
  spin(request: SpinRequest): Promise<SpinResult>;
  getBalance(): Promise<number>;
}
```

- `HttpGameApiAdapter` — fetch-basiert, mit konfigurierbarem `timeoutMs` (Default 15 s) und `AbortController`. Wirft `NetworkError` (`kind: 'transport' | 'timeout'`), `InvalidResponseError`, optional `InsufficientBalanceError`.
- `MockGameApiAdapter` — deterministisch per `seed` über `mulberry32`. **Nur** für Demo/Tests. Erzeugt strukturierte Bonus-Payloads (z. B. `gears_clash` mit `gearA`/`gearB`/`winnerMultiplier`), die als Visualisierungs-Fixture dienen — niemals als Produktlogik.

### `HostAdapter`

Optionale Callbacks + Kontext (Currency, Locale, `userMeta`, `disabled`-Flag, `limits`). **Nie** Server-Logik in den HostAdapter packen — er ist UI-Kontext, kein Backend. Definition in `src/config/types.ts`.

## Error-State Recovery

Tritt im `runSpin` ein Fehler auf:

1. `SlotEngine.setError()` setzt State auf `error`.
2. `emit('error', e)` und `hostAdapter.onError?.(e)` werden gefeuert.
3. Spin-Button bleibt **disabled**.
4. Der Host muss `game.resetError()` aufrufen, sobald der Nutzer den Fehler bestätigt hat. Erst danach wird der Button wieder freigeschaltet.

So bleibt der Error-State beobachtbar — wichtig für UI-Feedback und Logs.

## Konventionen

- **Symbol-IDs**: snake_case, identisch in API/Mock/Renderer (z. B. `bolt`, `wild_gear`, `bonus_gears_clash`).
- **Bonus-IDs**: `gears_clash` | `heist_run` | `deadlock_mode` (Union in `BonusId`).
- **CSS-Prefix**: alle Klassen `gc-*`, definiert in `src/styles/host-ui.css`. Siehe `ui-css-isolation.mdc`.
- **Grid**: 5 Reels × 5 Rows. Engine validiert via `ReelEngine.validateStops`.
- **Default-Bet**: `100` (Social Coins). Über `GearsClashGameOptions.defaultBet` überschreibbar.
- **Asset-Pfade**: Manifest-basiert (`AssetManifest`), kein Base64. Siehe `assets-no-base64.mdc`.
- **Bonus-Inhalt**: Kommt vom Server, nicht vom Client. Siehe `bonus-payload-contract.mdc`.

## Wann was machen

| Anforderung | Wo arbeiten |
|-------------|-------------|
| Neues Symbol | `defaultGameConfig.symbols`, Renderer-Asset im `assetManifest`, evtl. `proceduralSymbol.ts`-Fallback |
| Neuer Bonus-Typ | `BonusId`, neue Payload-Interface in `config/types.ts`, `BonusSessionPayload`-Union, `BonusEngine`, neue `Feature`-Klasse, `BonusOverlayController.TITLES`, Schema-`enum` |
| Neuer State | `SlotEngine` (State Machine) |
| Neue Animation | `PixiSlotRenderer` + ggf. `easing.ts` |
| Neuer HUD-Wert | `HudController` |
| Neuer Server-Endpoint | `HttpGameApiAdapter` + Doku im README |
| Konfig-Erweiterung | `config/types.ts`, `defaultGameConfig.ts`, `gameConfig.schema.json`, `scripts/copy-schema.mjs` |
| Test | `src/__tests__/*.test.ts`, `npm test` |

## Verwandte Skills & Rules

- `pixi-slot-renderer` — konkrete Pixi-/Reel-/Animation-Patterns
- `package-distribution` — Build, Vite-Lib, IIFE/ESM, Schema-Export, Versionierung
- `gitlab-integration` — Issues für Architektur-Themen anlegen
- `module-review` — Review-Ablauf
- Cursor-Rules: `client-no-final-outcomes`, `renderer-display-only`, `adapter-contract-stability`, `bonus-payload-contract`, `ui-css-isolation`, `assets-no-base64`, `naming-no-third-party-slots`
