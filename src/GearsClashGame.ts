import {
  isDemoSpinScenarioId,
  type DemoSpinScenarioId,
} from './config/demoSpinPresets';
import { mergeGameConfig } from './config/mergeGameConfig';
import {
  defaultAssetManifest,
  resolveManifestPaths,
  type AssetManifest,
} from './config/assetManifest';
import type {
  GameConfig,
  GameEventName,
  HostAdapter,
  SpinResult,
  BonusId,
} from './config/types';
import type { GameApiAdapter } from './adapters/GameApiAdapter';
import { BonusEngine } from './core/BonusEngine';
import { PayoutEngine } from './core/PayoutEngine';
import { ReelEngine } from './core/ReelEngine';
import { SlotEngine } from './core/SlotEngine';
import { AssetLoader } from './renderer/AssetLoader';
import { loadSymbolTexturesFromManifest } from './renderer/loadSymbolTextures';
import {
  PixiSlotRenderer,
  type PixiSlotRendererHooks,
} from './renderer/PixiSlotRenderer';
import { BonusOverlayController } from './ui/BonusOverlayController';
import { ControlsBar } from './ui/ControlsBar';
import { DeadlockModeSessionController } from './ui/DeadlockModeSessionController';
import { GearsClashSessionController } from './ui/GearsClashSessionController';
import { HeistRunSessionController } from './ui/HeistRunSessionController';
import { ButtonController } from './ui/ButtonController';
import { DesktopChromeController } from './ui/DesktopChromeController';
import { HudController } from './ui/HudController';
import { InfoModalController } from './ui/InfoModalController';
import { GameEmitter } from './util/GameEmitter';
import {
  defaultFxQualityForLayout,
  resolveGcLayoutMode,
  type GcFxQuality,
  type GcLayoutMode,
} from './util/layoutMode';

/** Sound-Hooks — später echte Audio-Engine anbinden (keine Assets im Package). */
export interface GameSoundAdapter {
  play: (id: string) => void;
}

export interface GearsClashGameOptions {
  container: HTMLElement;
  apiAdapter: GameApiAdapter;
  hostAdapter?: HostAdapter;
  config?: Partial<GameConfig>;
  assetManifest?: AssetManifest;
  spinButton?: HTMLButtonElement;
  /** Standard-Einsatz pro Spin (Social Coins). */
  defaultBet?: number;
  /** z. B. `spin`, `reel_stop`, `win`, `bonus_intro` — rein optional. */
  sound?: GameSoundAdapter;
  /** Kurzform für `config.animation.turbo` — parallele schnelle Reels. */
  turbo?: boolean;
  /** FX-Stufe erzwingen; sonst aus Layout + `prefers-reduced-motion` abgeleitet. */
  fxQuality?: GcFxQuality;
  /** Layout-Modus erzwingen (z. B. feste Kiosk-Auflösung); sonst aus Containerbreite. */
  layoutMode?: GcLayoutMode;
}

const SLOT_CLASS = 'gc-slot';
const CANVAS_WRAP_CLASS = 'gc-canvas-wrap';
const FRAME_CLASS = 'gc-frame';
const FRAME_INNER_CLASS = 'gc-frame__inner';
const SPIN_ROW_CLASS = 'gc-slot__spin-row';

export class GearsClashGame {
  private readonly config: GameConfig;
  private readonly emitter = new GameEmitter();
  private readonly slotEngine = new SlotEngine();
  private readonly reelEngine: ReelEngine;
  private readonly payoutEngine = new PayoutEngine();
  private readonly bonusEngine = new BonusEngine();
  private renderer: PixiSlotRenderer | null = null;
  private assetLoader: AssetLoader | null = null;
  private hud: HudController | null = null;
  private button: ButtonController | null = null;
  private rootEl: HTMLDivElement | null = null;
  private canvasWrap: HTMLDivElement | null = null;
  private frameInner: HTMLDivElement | null = null;
  private frameEl: HTMLDivElement | null = null;
  private bonusOverlay: BonusOverlayController | null = null;
  private controlsBar: ControlsBar | null = null;
  private deadlockSessionUi: DeadlockModeSessionController | null = null;
  private gearsClashSessionUi: GearsClashSessionController | null = null;
  private heistRunSessionUi: HeistRunSessionController | null = null;
  private desktopChrome: DesktopChromeController | null = null;
  private infoModal: InfoModalController | null = null;
  private layoutObserver: ResizeObserver | null = null;
  private currentFxQuality: GcFxQuality = 'medium';
  /** Kumulierte Spin-Gewinne (`winAmount` aus API) — nur für Desktop-Anzeige. */
  private sessionWinTotal = 0;
  private biggestWinSession = 0;
  private mounted = false;
  private readonly bet: number;
  /** Nächster Spin: zusätzliche `meta`-Felder (z. B. `demoSpinScenario` für Mock). */
  private spinMetaExtra: Record<string, unknown> | undefined;

  constructor(private readonly options: GearsClashGameOptions) {
    this.config = mergeGameConfig(options.config, options.turbo);
    this.reelEngine = new ReelEngine(this.config);
    this.bet = options.defaultBet ?? 100;
  }

  on(event: GameEventName, fn: (payload?: unknown) => void): void {
    this.emitter.on(event, fn);
  }

  off(event: GameEventName, fn: (payload?: unknown) => void): void {
    this.emitter.off(event, fn);
  }

  /**
   * Effektive Spielkonfiguration (Default + Host-Patch + Turbo) — dieselbe wie Renderer/ReelEngine.
   * Für Demo-Simulation / Mock-Parität: nicht mutieren; bei Bedarf kopieren.
   */
  getEffectiveConfig(): GameConfig {
    return structuredClone(this.config);
  }

  /** Öffnet das Spielinfo-Modal (Regeln, Auszahlungen, Winlines, Bonus-Erklärungen). */
  showInfoModal(): void {
    this.infoModal?.show();
  }

  /** Schließt das Spielinfo-Modal. */
  hideInfoModal(): void {
    this.infoModal?.hide();
  }

  /** Schaltet das Spielinfo-Modal um (öffnen/schließen). */
  toggleInfoModal(): void {
    this.infoModal?.toggle();
  }

  /**
   * Nur lokale Demo/Vorschau: triggert einen Spin mit Mock-Preset-Raster (`meta.demoSpinScenario`).
   * Produkt-Hosts sollten das nicht nutzen — `HttpGameApiAdapter` ignoriert unbekannte Meta-Felder meist.
   */
  requestVisualTestSpin(scenarioId: DemoSpinScenarioId): void {
    if (!isDemoSpinScenarioId(scenarioId)) return;
    this.spinMetaExtra = { demoSpinScenario: scenarioId };
    void this.runSpin();
  }

  /** Demo: normaler Zufalls-Mock-Spin ohne Preset-Meta. */
  requestRandomDemoSpin(): void {
    this.spinMetaExtra = undefined;
    void this.runSpin();
  }

  /**
   * Demo: nächster Spin erzwingt einen Bonus-Typ (Mock liest `meta.forceBonus`).
   * Zufälliges Raster — anders als feste Preset-Layouts in `requestVisualTestSpin`.
   */
  requestForcedBonusSpin(bonusId: BonusId): void {
    this.spinMetaExtra = { forceBonus: bonusId };
    void this.runSpin();
  }

  async mount(): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;
    try {
      const { container } = this.options;

      this.rootEl = document.createElement('div');
      this.rootEl.className = SLOT_CLASS;

      this.hud = new HudController();
      this.hud.mount(this.rootEl);
      this.hud.setBet(this.bet);
      this.hud.setWin(0);

      this.desktopChrome = new DesktopChromeController();
      const gameCenter = this.desktopChrome.mount(this.rootEl);

      const frame = document.createElement('div');
      frame.className = FRAME_CLASS;
      this.frameEl = frame;
      const frameInner = document.createElement('div');
      frameInner.className = FRAME_INNER_CLASS;
      this.frameInner = frameInner;
      this.canvasWrap = document.createElement('div');
      this.canvasWrap.className = CANVAS_WRAP_CLASS;
      frameInner.appendChild(this.canvasWrap);
      this.bonusOverlay = new BonusOverlayController();
      this.bonusOverlay.mount(frameInner);
      this.deadlockSessionUi = new DeadlockModeSessionController(this.config, {
        onPayloadRendered: (payload) => {
          this.bonusOverlay?.setDeadlockPhase(
            payload.phase === 'collection' ? 1 : 2,
          );
        },
      });
      this.deadlockSessionUi.mount(frameInner);
      this.gearsClashSessionUi = new GearsClashSessionController();
      this.gearsClashSessionUi.mount(frameInner);
      this.heistRunSessionUi = new HeistRunSessionController(this.config, {
        onPayloadRendered: (payload) => {
          this.renderer?.setStickyWilds(payload.stickyWilds ?? []);
        },
      });
      this.heistRunSessionUi.mount(frameInner);
      frame.appendChild(frameInner);
      gameCenter.appendChild(frame);

      this.sessionWinTotal = 0;
      this.biggestWinSession = 0;
      this.desktopChrome?.resetPanels(this.options.hostAdapter?.locale);

      const spinRow = document.createElement('div');
      spinRow.className = SPIN_ROW_CLASS;
      this.rootEl.appendChild(spinRow);

      this.button = new ButtonController({
        externalButton: this.options.spinButton,
        label: 'Spin',
        spinStyle: !this.options.spinButton,
      });
      this.button.mount(spinRow);

      this.controlsBar = new ControlsBar({
        showInfoButton: true,
        onInfoClick: () => this.infoModal?.toggle(),
      });
      this.controlsBar.mount(this.rootEl);

      this.infoModal = new InfoModalController(this.config);
      this.infoModal.mount(document.body);

      container.appendChild(this.rootEl);

      const manifest = resolveManifestPaths(
        this.options.assetManifest ?? defaultAssetManifest,
        this.config,
      );
      this.assetLoader = new AssetLoader(manifest);

      const symbolTextures = await loadSymbolTexturesFromManifest(
        this.assetLoader,
        this.config.symbols.map((s) => s.id),
      );
      this.renderer = new PixiSlotRenderer(this.config);
      this.renderer.setLoadedSymbolTextures(symbolTextures);
      await this.renderer.init(this.canvasWrap);
      this.renderer.setBet(this.bet);
      this.bindLayoutObserver();
      this.syncLayoutPresentation();

      const bal = await this.options.apiAdapter.getBalance().catch(() => 0);
      this.hud.setBalance(bal);

      const onSpin = () => void this.runSpin();
      this.button.onClick(onSpin);

      this.options.hostAdapter?.onReady?.();
      this.emitter.emit('ready');
    } catch (e) {
      await this.tearDownAfterMountFailure();
      this.options.hostAdapter?.onError?.(e);
      this.emitter.emit('error', e);
      throw e;
    }
  }

  private bindLayoutObserver(): void {
    if (!this.rootEl || typeof ResizeObserver === 'undefined') return;
    this.layoutObserver = new ResizeObserver(() => {
      this.syncLayoutPresentation();
    });
    this.layoutObserver.observe(this.rootEl);
  }

  private syncLayoutPresentation(): void {
    if (!this.rootEl) return;
    const w = this.rootEl.getBoundingClientRect().width;
    const mode = this.options.layoutMode ?? resolveGcLayoutMode(w);
    let fx: GcFxQuality =
      this.options.fxQuality ?? defaultFxQualityForLayout(mode);
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      fx = 'low';
    }
    this.currentFxQuality = fx;
    this.rootEl.dataset.gcLayout = mode;
    this.rootEl.dataset.gcFxQuality = fx;
    this.renderer?.setPresentationMode({ layoutMode: mode, fxQuality: fx });
  }

  private async tearDownAfterMountFailure(): Promise<void> {
    try {
      this.layoutObserver?.disconnect();
      this.layoutObserver = null;
      this.button?.destroy();
      this.controlsBar?.destroy();
      this.hud?.destroy();
      this.bonusOverlay?.destroy();
      this.deadlockSessionUi?.destroy();
      this.gearsClashSessionUi?.destroy();
      this.heistRunSessionUi?.destroy();
      this.infoModal?.destroy();
      this.renderer?.destroy();
      this.desktopChrome?.destroy();
    } catch {
      // intentional: secondary destroy errors are swallowed; primary error wins.
    }
    this.controlsBar = null;
    this.desktopChrome = null;
    this.infoModal = null;
    this.assetLoader = null;
    this.rootEl?.remove();
    this.button = null;
    this.hud = null;
    this.bonusOverlay = null;
    this.deadlockSessionUi = null;
    this.gearsClashSessionUi = null;
    this.heistRunSessionUi = null;
    this.renderer = null;
    this.rootEl = null;
    this.canvasWrap = null;
    this.frameInner = null;
    this.frameEl = null;
    this.mounted = false;
  }

  /**
   * Nach Fehlerzustand zurück auf idle. Hosts müssen das **explizit** aufrufen,
   * sobald ein vorhergehender Spin via `on('error', ...)` gemeldet wurde.
   * Erst danach lässt sich der nächste Spin auslösen.
   */
  resetError(): void {
    this.slotEngine.resetError();
    this.button?.setDisabled(!!this.options.hostAdapter?.disabled);
  }

  async destroy(): Promise<void> {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    this.button?.destroy();
    this.controlsBar?.destroy();
    this.hud?.destroy();
    this.bonusOverlay?.destroy();
    this.deadlockSessionUi?.destroy();
    this.gearsClashSessionUi?.destroy();
    this.heistRunSessionUi?.destroy();
    this.infoModal?.destroy();
    this.renderer?.destroy();
    this.desktopChrome?.destroy();
    this.controlsBar = null;
    this.desktopChrome = null;
    this.infoModal = null;
    this.assetLoader = null;
    this.rootEl?.remove();
    this.button = null;
    this.hud = null;
    this.bonusOverlay = null;
    this.deadlockSessionUi = null;
    this.gearsClashSessionUi = null;
    this.heistRunSessionUi = null;
    this.renderer = null;
    this.rootEl = null;
    this.canvasWrap = null;
    this.frameInner = null;
    this.frameEl = null;
    this.mounted = false;
    this.emitter.removeAllListeners();
  }

  private getPixiHooks(): PixiSlotRendererHooks {
    return {
      onSound: (id) => this.options.sound?.play(id),
      onShake: (kind) => this.triggerShake(kind),
    };
  }

  private consumeSpinMetaExtra():
    | Record<string, unknown>
    | undefined {
    const host = this.options.hostAdapter;
    const extra = this.spinMetaExtra;
    this.spinMetaExtra = undefined;
    const hostMeta = host?.userMeta;
    if (extra === undefined) return hostMeta;
    return {
      ...(hostMeta && typeof hostMeta === 'object' ? { ...hostMeta } : {}),
      ...extra,
    };
  }

  private async presentSpinVisuals(
    result: SpinResult,
    hooks: PixiSlotRendererHooks,
  ): Promise<void> {
    if (!this.reelEngine.validateStops(result.reelStops)) {
      throw new Error('reelStops passen nicht zur konfigurierten Grid-Größe.');
    }
    await this.renderer?.playSpinAnimation(result.reelStops, hooks);
    
    this.slotEngine.enterResolving();
    await this.renderer?.showWinFeedback(
      result.displayHighlights ?? [],
      result.winAmount,
      result.displayWinLines ?? [],
      hooks,
    );
  }

  /** HUD + Balance-Event ohne `spin:end` (z. B. Deadlock-Trigger vor Session-Ende). */
  private pushHudFromResult(result: SpinResult): void {
    const host = this.options.hostAdapter;
    this.hud?.setBalanceAnimated(result.balanceAfter);
    this.hud?.setWinAnimated(result.winAmount);
    const win = Math.max(0, Math.floor(result.winAmount));
    this.sessionWinTotal += win;
    this.biggestWinSession = Math.max(this.biggestWinSession, win);
    this.desktopChrome?.updateFromSpinResult(
      result,
      {
        sessionWinTotal: this.sessionWinTotal,
        biggestWinSession: this.biggestWinSession,
      },
      host?.locale,
    );
    this.emitter.emit('balance:update', result.balanceAfter);
    host?.onBalanceUpdate?.(result.balanceAfter);
  }

  private applySpinHudAndEmit(result: SpinResult): void {
    const host = this.options.hostAdapter;
    this.slotEngine.finishRound();
    this.hud?.setBalanceAnimated(result.balanceAfter);
    this.hud?.setWinAnimated(result.winAmount);
    const win = Math.max(0, Math.floor(result.winAmount));
    this.sessionWinTotal += win;
    this.biggestWinSession = Math.max(this.biggestWinSession, win);
    this.desktopChrome?.updateFromSpinResult(
      result,
      {
        sessionWinTotal: this.sessionWinTotal,
        biggestWinSession: this.biggestWinSession,
      },
      host?.locale,
    );
    this.emitter.emit('balance:update', result.balanceAfter);
    host?.onBalanceUpdate?.(result.balanceAfter);
    this.emitter.emit('spin:end', result);
  }

  private async runHeistContinuationRound(
    hooks: PixiSlotRendererHooks,
  ): Promise<SpinResult> {
    const host = this.options.hostAdapter;
    if (!this.slotEngine.canSpin(host?.disabled)) {
      throw new Error('Heist-Fortsetzung: Slot nicht idle.');
    }
    if (!this.slotEngine.beginSpin()) {
      throw new Error('Heist-Fortsetzung: Spin blockiert.');
    }
    this.emitter.emit('spin:start');
    this.options.sound?.play('spin');
    this.hud?.setWin(0);
    this.button?.setDisabled(true);

    const hostMeta = host?.userMeta;
    const meta =
      hostMeta && typeof hostMeta === 'object'
        ? { ...hostMeta, heistSession: true }
        : { heistSession: true };

    const result = await this.options.apiAdapter.spin({
      bet: this.bet,
      currency: host?.currency ?? 'COINS',
      mode: 'heist_run',
      meta,
    });

    await this.presentSpinVisuals(result, hooks);
    this.applySpinHudAndEmit(result);
    this.button?.setDisabled(!!host?.disabled);
    return result;
  }

  private async runDeadlockContinuationRound(
    hooks: PixiSlotRendererHooks,
  ): Promise<SpinResult> {
    const host = this.options.hostAdapter;
    if (!this.slotEngine.canSpin(host?.disabled)) {
      throw new Error('Deadlock-Fortsetzung: Slot nicht idle.');
    }
    if (!this.slotEngine.beginSpin()) {
      throw new Error('Deadlock-Fortsetzung: Spin blockiert.');
    }
    this.emitter.emit('spin:start');
    this.options.sound?.play('spin');
    this.hud?.setWin(0);
    this.button?.setDisabled(true);

    const hostMeta = host?.userMeta;
    const meta =
      hostMeta && typeof hostMeta === 'object'
        ? { ...hostMeta, deadlockSession: true }
        : { deadlockSession: true };

    const result = await this.options.apiAdapter.spin({
      bet: this.bet,
      currency: host?.currency ?? 'COINS',
      mode: 'deadlock_mode',
      meta,
    });

    await this.presentSpinVisuals(result, hooks);
    this.applySpinHudAndEmit(result);
    this.button?.setDisabled(!!host?.disabled);
    return result;
  }

  private async runSpin(): Promise<void> {
    const host = this.options.hostAdapter;
    if (!this.slotEngine.canSpin(host?.disabled)) return;
    if (!this.slotEngine.beginSpin()) return;

    this.emitter.emit('spin:start');
    this.options.sound?.play('spin');
    this.hud?.setWin(0);
    this.button?.setDisabled(true);

    const hooks = this.getPixiHooks();
    let errored = false;
    try {
      const meta = this.consumeSpinMetaExtra();
      const result = await this.options.apiAdapter.spin({
        bet: this.bet,
        currency: host?.currency ?? 'COINS',
        mode: 'base',
        ...(Object.keys(meta ?? {}).length > 0 ? { meta } : {}),
      });

      await this.presentSpinVisuals(result, hooks);

      if (result.bonus?.type === 'deadlock_mode') {
        this.slotEngine.enterBonus();
        this.emitter.emit('bonus:start', result.bonus);
        this.options.sound?.play('bonus_intro');
        await this.renderer?.flashBonusSymbolReveal(result.reelStops);
        this.renderer?.setFrozen(true);
        await this.bonusOverlay?.show(result.bonus.type);
        this.renderer?.setFrozen(false);
        this.slotEngine.finishRound();
        this.pushHudFromResult(result);

        const lastPayload = await (this.deadlockSessionUi?.runSession(
          result,
          () => this.runDeadlockContinuationRound(hooks),
        ) ?? Promise.resolve(undefined));

        this.emitter.emit('bonus:end', lastPayload ?? result.bonus);
      } else if (result.bonus?.type === 'gears_clash') {
        this.slotEngine.enterBonus();
        this.emitter.emit('bonus:start', result.bonus);
        this.options.sound?.play('bonus_intro');
        await this.renderer?.flashBonusSymbolReveal(result.reelStops);
        this.renderer?.setFrozen(true);
        await this.bonusOverlay?.show(result.bonus.type);
        this.renderer?.setFrozen(false);
        this.slotEngine.finishRound();
        this.pushHudFromResult(result);

        await (this.gearsClashSessionUi?.runSession(result.bonus.payload, {
          onBattle: async (payload) => {
            this.options.sound?.play('gears_clash_intro');
            await this.renderer?.playGearsClashAnimationAsync(payload, hooks);
            const reel = payload.winnerReel ?? 0;
            const mul =
              payload.winnerMultiplier ??
              Math.max(payload.gearA.multiplier, payload.gearB.multiplier);
            this.renderer?.setFullReelWild(reel, mul);
          },
        }) ?? Promise.resolve());

        this.renderer?.clearFullReelWild();
        this.emitter.emit('bonus:end', result.bonus);
      } else if (result.bonus?.type === 'heist_run') {
        this.slotEngine.enterBonus();
        this.emitter.emit('bonus:start', result.bonus);
        this.options.sound?.play('bonus_intro');
        await this.renderer?.flashBonusSymbolReveal(result.reelStops);
        this.renderer?.setFrozen(true);
        await this.bonusOverlay?.show(result.bonus.type);
        this.renderer?.setFrozen(false);
        this.renderer?.setStickyWilds(result.bonus.payload.stickyWilds ?? []);
        this.slotEngine.finishRound();
        this.pushHudFromResult(result);

        const lastPayload = await (this.heistRunSessionUi?.runSession(
          result,
          () => this.runHeistContinuationRound(hooks),
        ) ?? Promise.resolve(undefined));

        this.renderer?.clearStickyWilds();
        this.emitter.emit('bonus:end', lastPayload ?? result.bonus);
      } else {
        this.applySpinHudAndEmit(result);
      }
    } catch (e) {
      errored = true;
      this.slotEngine.setError();
      this.emitter.emit('error', e);
      host?.onError?.(e);
    } finally {
      this.button?.setDisabled(errored ? true : !!host?.disabled);
    }
  }

  private triggerShake(kind: 'light' | 'medium'): void {
    const el = this.frameEl;
    if (!el) return;
    if (this.currentFxQuality === 'low') {
      kind = 'light';
    }
    el.classList.remove('gc-frame--shake', 'gc-frame--shake-medium');
    void el.offsetWidth;
    el.classList.add(
      kind === 'medium' ? 'gc-frame--shake-medium' : 'gc-frame--shake',
    );
    window.setTimeout(() => {
      el.classList.remove('gc-frame--shake', 'gc-frame--shake-medium');
    }, 420);
  }
}
