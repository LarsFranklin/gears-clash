---
name: pixi-slot-renderer
description: PixiJS-Patterns für den Reel-Renderer von Gears Clash — Stage/Application-Lebenszyklus, ReelColumn/Symbol-Caching, Spin-Animation, Win-Feedback, Shake-Hooks, Abort-Tokens. Nutzen bei "Pixi", "Renderer", "Animation", "Reel", "Symbol", "Frame", "Win-Feedback".
---

# PixiJS Slot Renderer

Dieser Skill beschreibt die **PixiJS**-spezifischen Patterns für `src/renderer/`. Alle Pixi-Imports gehören in dieses Verzeichnis — Engines (`src/core/`) und UI (`src/ui/`) bleiben Pixi-frei.

## Pixi-Version & Imports

- **PixiJS v8** (siehe `package.json`).
- Bevorzugt benannte Importe: `import { Application, Container, Graphics, Texture, Sprite, Ticker } from 'pixi.js';`.
- Keine deprecated v7-APIs (`PIXI.Loader`, `Graphics.beginFill/drawRect/endFill`-Pipeline → in v8 die neuen Builder-Methoden nutzen).
- `inlineDynamicImports: true` in `vite.config.ts` ist gewollt — keine zusätzlichen `import('pixi.js/...')`-Splits einbauen, sonst zerlegt Rollup das Host-Bundle.

## Lebenszyklus

```ts
// PixiSlotRenderer.init(canvasWrap)
async init(parent: HTMLElement): Promise<void> {
  if (this.app || this.destroyed) return;       // Guard gegen Doppel-Init
  const app = new Application();
  await app.init({
    width, height, background: 0x0a0a0e,
    antialias: true,
    resolution: Math.min(2, devicePixelRatio),
    autoDensity: true,
  });
  parent.replaceChildren(app.canvas);
  // ...
}

// destroy() — IMMER aufgerufen aus GearsClashGame.destroy()
destroy(): void {
  if (this.destroyed) return;
  this.destroyed = true;
  this.spinToken++;                              // bricht laufende rAF-Loops
  this.app?.destroy(
    { removeView: true },
    { children: true, texture: true, textureSource: true },
  );
}
```

**Pflicht:**

- `await app.init(...)` — niemals den `new Application(opts)`-Konstruktor mit Optionen (v7-API).
- Beim Unmount alle Container leeren, Tickers stoppen, Listener abräumen.
- `destroy()` nutzt das Pixi-v8 `DestroyOptions`-Objekt mit `children/texture/textureSource: true`. Anpassen, sobald geteilte Texturen über `AssetLoader` kommen (dann `texture: false`, damit andere Konsumenten sie behalten).
- **Doppel-`init`** wird durch Guard-Flag verhindert.

## Abort-Tokens für rAF-Loops

Alle `requestAnimationFrame`-Loops im Renderer (Spin-Animation, Win-Feedback, Win-Line-Sequenz) capturen am Anfang `this.spinToken` und brechen ab, sobald `token !== this.spinToken || this.destroyed`. So sind sie sauber abbruchbar bei:

- neuer Spin-Anfrage (überholt vorherige Animation)
- `destroy()` (verhindert Pixi-Zugriffe nach Cleanup)

Pattern:

```ts
const token = this.spinToken;
const step = () => {
  if (token !== this.spinToken || this.destroyed) {
    resolve();
    return;
  }
  // ... Frame-Arbeit
  if (done) { resolve(); return; }
  requestAnimationFrame(step);
};
requestAnimationFrame(step);
```

## Reels (ReelColumn)

Eine `ReelColumn` ist eine Spalte im Slot:

- Hält einen `Container` mit `STRIP_LEN` (=30) gestapelten `SymbolSlot`-Containern.
- `pitch = cellSize + ROW_GAP` (3 px Standard) — exportiert aus `ReelColumn` für Renderer-Layout-Konsistenz.
- `focusIndex` ist der Index des obersten **sichtbaren** Strip-Slots; `focusIndex … focusIndex+rows-1` ist die sichtbare Range.
- Bewegt den Strip nach oben (negative `strip.y`), neue Symbole erscheinen unten.
- Rastet auf `result.reelStops[reelIndex]` ein, sobald die Animation finalisiert.

### Strip-Filler-Invariante (kritisch!)

`prepareSpinTargets()` setzt:

1. **Ziel-Range** `[focusEnd, focusEnd+rows)` ← `column[r]` aus dem Server-Result.
2. **Reise-Range** und Pufferzonen ← Random-Symbole.
3. **Sichtbare Range** `[focusIndex, focusIndex+rows)` ← **NIEMALS überschreiben**, weil der Strip noch nicht gescrollt ist und der Nutzer das Pop-In sehen würde.

Wenn du dieses Verhalten anpasst, prüfe Snapshot-Tests in `src/__tests__/` und teste visuell mit `npm run dev` (Spin-Klick beobachten — keine plötzlichen Symbol-Änderungen vor dem Scroll).

### Symbol-Caching pro Slot

`SymbolSlot.paint()` cached `lastSymbolId` und `lastIconTimeBucket` (30 Hz Bucket). `Rim`/`Face`/`Icon`/Label werden **nur** neu gezeichnet, wenn die Symbol-ID wechselt oder der Time-Bucket vorrückt. `glow`/`winRing` werden pro Frame neu gezeichnet (cheap, weil keine Pfade gemerkt werden müssen).

Empfohlene Trennung:

| Aufgabe | Wer |
|---------|-----|
| Spin-Animation orchestrieren | `PixiSlotRenderer.playSpinAnimation(stops, hooks)` |
| Eine Spalte rollen lassen | `ReelColumn.prepareSpinTargets(...)` + `setStripY(...)` aus `playSpinTurbo`/`playSpinSequential` |
| Symbol-Sprite rendern | `symbolCard.ts` / `proceduralSymbol.ts` |
| Easing | `easing.ts` (`easeOutQuart`, `bounceOffset`) |

## Animation-Modi

Aus `AnimationConfig`:

- **Turbo** (`turbo: true`): alle Reels parallel mit kleinem Stagger (`reelStopStaggerMs`).
- **Sequenziell** (`turbo: false` / unset): Reels nacheinander (links→rechts) mit `reelSequentialDurationMs`, `reelApproachExtraRows`, `reelIdleScrollRowsPerSec`.

**Wichtig:** Beide Modi müssen am Ende exakt auf `reelStops` einrasten — kein „grob nahe dran". Renderer ist **Anzeige**, der Server hat die Wahrheit.

## Hooks (`PixiSlotRendererHooks`)

```ts
interface PixiSlotRendererHooks {
  onSound?: (id: string) => void;
  onShake?: (kind: 'light' | 'medium') => void;
}
```

- `onSound` an `GameSoundAdapter` weiterreichen (in `GearsClashGame`).
- `onShake` löst `gc-frame--shake` / `gc-frame--shake-medium` aus (CSS in `host-ui.css`). Nicht aus dem Renderer selbst die DOM-Klasse setzen — dafür gibt es den Hook.

## Win-Feedback

`showWinFeedback(highlights, amount, lines, hooks)`:

- `displayHighlights[]` → Glow auf den genannten `(reel, row)`-Zellen.
- `displayWinLines[]` → optional sequenzielle Anzeige (z. B. „3x Bolt" Linie für Linie).
- Highlights und Win-Line-Punkte werden über `clampHighlights` / `sanitizeWinLines` gegen `cfg.grid.reels`/`rows` validiert — out-of-bounds-Punkte vom Server werden verworfen, statt den Renderer zu crashen.
- `winAmount` ist **nur Anzeige** — niemals daraus eigene Logik („wenn > X dann …") ableiten; das gehört auf den Server. Siehe `client-no-final-outcomes.mdc`.

## Symbole

- Symbol-IDs (z. B. `bolt`, `wild_gear`, `bonus_gears_clash`) werden über `SymbolRegistry` aufgelöst. Der Renderer importiert `SymbolRegistry` aus `core/` für Lookup — das ist erlaubt.
- Texturen kommen aus `AssetLoader` (Manifest in `src/config/assetManifest.ts`).
- **Fallback:** Wenn ein Asset fehlt, `proceduralSymbol.ts` zeichnet ein vektorisiertes Platzhalter-Symbol mit `Graphics`. So bleibt das Spiel auch ohne Asset-Pack lauffähig.
- **Kein Base64.** Bilder kommen über URL/Pfad aus dem Manifest oder werden prozedural erzeugt. Siehe `assets-no-base64.mdc`.

## Performance

- **Symbol-Caching pro Slot** (siehe oben): keine Vollneuzeichnung pro Frame, wenn die Symbol-ID gleich bleibt.
- **`Ticker` für kontinuierliche Effekte**, **`requestAnimationFrame`** für Spin-/Win-/Win-Line-Loops mit Abort-Token. Niemals `setInterval` für Frame-Animation.
- **`setTimeout`** ist **nur** für nicht-Frame-Zwecke erlaubt (Resize-Debounce, kurze CSS-Cooldown-Resets — z. B. Shake-Klasse entfernen).
- **`cacheAsBitmap`** bzw. v8-Pendant nur für statische Subgraphen einsetzen, nicht für sich bewegende Reels.
- **Resize:** `ResizeObserver` mit ~80 ms Debounce. Während laufender Animation (`isAnimating`) wird der Resize **verzögert** (Flag `pendingResize`) und erst nach Animation-Ende ausgeführt — sonst würde `buildReels` mitten im Spin den Strip neu bauen und sichtbar flackern.

## Frame & Shake

- Der äußere Frame (DOM, `gc-frame`) wird in `GearsClashGame.triggerShake(kind)` per CSS-Klasse animiert.
- `setFrozen(true)` während Bonus-Overlay verhindert Symbol-Animationen während des Overlays.

## Fehlerverhalten

- Renderer wirft eigene Fehler nur bei **Initialisierung** (z. B. WebGL nicht verfügbar). Spin-Validierung gehört in `ReelEngine.validateStops`.
- Bei Pixi-Init-Fehler einen sprechenden `Error` werfen → wird über `emitter.emit('error', e)` und `hostAdapter.onError` weitergereicht.

## Don'ts

- Keine Pixi-Imports außerhalb von `src/renderer/`.
- Keine DOM-Manipulation am `document.body` aus dem Renderer.
- Keine eigenen Win-/Bonus-Berechnungen.
- Kein `setInterval` / `setTimeout` für Frame-Animation.
- Keine globalen Pixi-Singletons (`PIXI.shared`, …).
- Keine sichtbaren Strip-Slots überschreiben, bevor der Strip dort hingescrollt ist (siehe Strip-Filler-Invariante).

## Verwandte Skills

- `slot-game-architecture` — Schichten und Modul-Verantwortung
- `package-distribution` — wie der Renderer im ESM/IIFE-Bundle landet
- Rule `renderer-display-only` — Renderer trifft keine Logik-Entscheidungen
