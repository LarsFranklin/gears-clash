import {
  isDemoSpinScenarioId,
  type DemoSpinScenarioId,
} from './config/demoSpinPresets';
import { mergeGameConfig } from './config/mergeGameConfig';
import { validateRuntimeConfig } from './config/validateRuntimeConfig';
import {
  defaultAssetManifest,
  resolveManifestPaths,
  type AssetManifest,
} from './config/assetManifest';
import type {
  BonusId,
  BonusRetriggerEvent,
  BonusSessionMeta,
  BonusSessionPayload,
  BonusSummaryEvent,
  GameConfig,
  GameEventName,
  GearsClashPayload,
  HostAdapter,
  SpinResult,
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
import { ToastController } from './ui/ToastController';
import { InsufficientBalanceError, NetworkError } from './adapters/errors';
import { GameEmitter } from './util/GameEmitter';
import { getWinTier } from './util/winTier';
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
  /** Bedienleiste unter dem Spin-Button (Einsatz, Autoplay, Turbo, Sound, Info). */
  controls?: ControlsVisibilityOptions;
  /** Leertaste/Enter lösen einen Spin aus, solange der Slot fokussiert ist. Default: true. */
  keyboardControls?: boolean;
}

/** Welche Bedienelemente die Controls-Bar zeigt — alles einzeln abschaltbar. */
export interface ControlsVisibilityOptions {
  betStepper?: boolean;
  autoSpin?: boolean;
  turbo?: boolean;
  sound?: boolean;
  info?: boolean;
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
  private toast: ToastController | null = null;
  private layoutObserver: ResizeObserver | null = null;
  private lastSessionMeta: BonusSessionMeta | undefined;
  private shakeTimer: number | null = null;
  private currentFxQuality: GcFxQuality = 'medium';
  /** Kumulierte Spin-Gewinne (`winAmount` aus API) — nur für Desktop-Anzeige. */
  private sessionWinTotal = 0;
  private biggestWinSession = 0;
  private spinCount = 0;
  private mounted = false;
  private bet: number;
  /** Läuft eine Autoplay-Kette? Wird bei Bonus, Fehler oder zu wenig Guthaben beendet. */
  private autoSpinActive = false;
  private lastSpinTriggeredBonus = false;
  private keyboardAbort: AbortController | null = null;
  private orientationAbort: AbortController | null = null;
  /** Nächster Spin: zusätzliche `meta`-Felder (z. B. `demoSpinScenario` für Mock). */
  private spinMetaExtra: Record<string, unknown> | undefined;

  constructor(private readonly options: GearsClashGameOptions) {
    this.config = mergeGameConfig(options.config, options.turbo);
    validateRuntimeConfig(this.config);
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
    if (!isDemoSpinScenarioId(scenarioId) || !this.canAcceptSpinRequest()) return;
    this.spinMetaExtra = { demoSpinScenario: scenarioId };
    void this.runSpin();
  }

  /** Demo: normaler Zufalls-Mock-Spin ohne Preset-Meta. */
  requestRandomDemoSpin(): void {
    if (!this.canAcceptSpinRequest()) return;
    this.spinMetaExtra = undefined;
    void this.runSpin();
  }

  /**
   * Demo: nächster Spin erzwingt einen Bonus-Typ (Mock liest `meta.forceBonus`).
   * Zufälliges Raster — anders als feste Preset-Layouts in `requestVisualTestSpin`.
   */
  requestForcedBonusSpin(bonusId: BonusId): void {
    if (!this.canAcceptSpinRequest()) return;
    this.spinMetaExtra = { forceBonus: bonusId };
    void this.runSpin();
  }

  /** True, solange kein Spin und keine Bonus-Session läuft. */
  isBusy(): boolean {
    return !this.slotEngine.canSpin(this.options.hostAdapter?.disabled);
  }

  /** True, wenn gerade eine Bonus-Session (Free Spins, Collection …) läuft. */
  isBonusSessionActive(): boolean {
    return this.slotEngine.isBonusSessionActive();
  }

  /** Aktueller Einsatz pro Base-Spin. */
  getBet(): number {
    return this.bet;
  }

  /**
   * Einsatz umstellen. Während eines Spins oder einer Bonus-Session ignoriert,
   * damit der laufende Vertrag mit dem Server nicht mitten drin wechselt.
   */
  setBet(bet: number): boolean {
    if (!Number.isFinite(bet) || bet <= 0) return false;
    if (!this.canAcceptSpinRequest()) return false;
    this.bet = Math.round(bet);
    this.hud?.setBet(this.bet);
    this.renderer?.setBet(this.bet);
    this.controlsBar?.setBet(this.bet);
    return true;
  }

  /** Turbo zur Laufzeit umschalten (parallele Walzen statt Sequenz). */
  setTurbo(enabled: boolean): void {
    this.config.animation.turbo = enabled;
    this.renderer?.setTurbo(enabled);
  }

  /** Bricht eine laufende Autoplay-Kette nach der aktuellen Runde ab. */
  stopAutoSpin(): void {
    this.autoSpinActive = false;
    this.controlsBar?.cancelAutoSpin();
  }

  private canAcceptSpinRequest(): boolean {
    return this.slotEngine.canSpin(this.options.hostAdapter?.disabled);
  }

  /** Einzige Stelle, die den Spin-Button-Zustand setzt — leitet ihn aus der State Machine ab. */
  private syncSpinButtonDisabled(): void {
    const busy = !this.canAcceptSpinRequest();
    this.button?.setDisabled(busy);
    this.controlsBar?.setSpinning(busy);
    this.controlsBar?.setLocked(this.slotEngine.isBonusSessionActive());
    this.rootEl?.setAttribute('aria-busy', String(busy));
  }

  private createControlsBar(): ControlsBar {
    const c = this.options.controls ?? {};
    return new ControlsBar({
      betLevels: this.config.betLevels ?? [this.bet],
      initialBet: this.bet,
      soundEnabled: this.config.sound.enabled,
      showBetStepper: c.betStepper ?? true,
      showAutoSpin: c.autoSpin ?? true,
      showTurboToggle: c.turbo ?? true,
      showSoundToggle: c.sound ?? true,
      showInfoButton: c.info ?? true,
      onBetChange: (bet) => {
        this.bet = bet;
        this.hud?.setBet(bet);
        this.renderer?.setBet(bet);
      },
      onTurboChange: (enabled) => this.setTurbo(enabled),
      onSoundChange: (enabled) => {
        this.config.sound.enabled = enabled;
      },
      onAutoSpinChange: (count) => {
        if (count > 0) {
          void this.requestSpin();
        } else {
          this.autoSpinActive = false;
        }
      },
      onInfoClick: () => this.infoModal?.toggle(),
    });
  }

  /**
   * Leertaste/Enter starten einen Spin, solange der Slot den Fokus hat und kein
   * Eingabefeld oder Dialog aktiv ist.
   */
  private bindKeyboardControls(): void {
    if (this.options.keyboardControls === false || !this.rootEl) return;
    this.rootEl.tabIndex = this.rootEl.tabIndex >= 0 ? this.rootEl.tabIndex : 0;
    this.keyboardAbort = new AbortController();
    this.rootEl.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== ' ' && e.key !== 'Spacebar' && e.key !== 'Enter') return;
        if (this.infoModal?.isVisible()) return;
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.closest('button, select, input, textarea, [role="dialog"]') !==
            null)
        ) {
          return;
        }
        e.preventDefault();
        void this.requestSpin();
      },
      { signal: this.keyboardAbort.signal },
    );
  }

  /**
   * Einstieg für Button, Tastatur und Autoplay.
   *
   * Die Autoplay-Kette bricht ab bei Bonus-Trigger, Fehler oder zu wenig Guthaben
   * — Letzteres nur als UI-Vorabprüfung, die Wahrheit bleibt beim Server.
   */
  private async requestSpin(): Promise<void> {
    if (!this.canAcceptSpinRequest()) return;

    const controls = this.controlsBar;
    this.autoSpinActive = (controls?.autoSpinsRemaining ?? 0) > 0;

    for (;;) {
      if (this.autoSpinActive) controls?.decrementAutoSpin();
      this.lastSpinTriggeredBonus = false;
      await this.runSpin();

      if (!this.autoSpinActive) break;
      if (this.lastSpinTriggeredBonus) break;
      if (!controls || controls.autoSpinsRemaining <= 0) break;
      if (!this.canAcceptSpinRequest()) break;
      if ((this.hud?.getBalance() ?? 0) < this.bet) {
        this.showInsufficientBalanceToast();
        break;
      }
      await this.delay(this.config.animation.turbo === true ? 220 : 420);
      if (!this.autoSpinActive || !this.canAcceptSpinRequest()) break;
    }

    if (this.autoSpinActive) {
      this.autoSpinActive = false;
      controls?.cancelAutoSpin();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private showInsufficientBalanceToast(): void {
    this.toast?.show('Zu wenig Guthaben für diesen Einsatz.', {
      kind: 'warning',
    });
  }

  /** Fehler in eine Kurzmeldung übersetzen — nie `alert()` (Projektregel). */
  private reportSpinError(error: unknown): void {
    if (error instanceof InsufficientBalanceError) {
      this.showInsufficientBalanceToast();
    } else if (error instanceof NetworkError) {
      this.toast?.show(
        error.kind === 'timeout'
          ? 'Zeitüberschreitung — bitte erneut versuchen.'
          : 'Verbindung unterbrochen — bitte erneut versuchen.',
        { kind: 'error' },
      );
    } else {
      this.toast?.show('Spin fehlgeschlagen — bitte erneut versuchen.', {
        kind: 'error',
      });
    }
  }

  async mount(): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;
    try {
      const { container } = this.options;

      this.rootEl = document.createElement('div');
      this.rootEl.className = `${SLOT_CLASS} gc-slot--machine`;

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
      frame.appendChild(frameInner);
      gameCenter.appendChild(frame);

      const deck = document.createElement('div');
      deck.className = 'gc-machine-deck';
      gameCenter.appendChild(deck);

      this.hud = new HudController();
      this.hud.mount(deck);
      this.hud.setBet(this.bet);
      this.hud.setWin(0);

      this.sessionWinTotal = 0;
      this.biggestWinSession = 0;
      this.spinCount = 0;
      this.desktopChrome?.resetPanels(this.options.hostAdapter?.locale);

      const spinRow = document.createElement('div');
      spinRow.className = SPIN_ROW_CLASS;
      deck.appendChild(spinRow);

      this.button = new ButtonController({
        externalButton: this.options.spinButton,
        label: 'Spin',
        spinStyle: !this.options.spinButton,
      });
      this.button.mount(spinRow);

      this.controlsBar = this.createControlsBar();
      this.controlsBar.mount(deck);

      this.infoModal = new InfoModalController(this.config);
      this.infoModal.mount(this.rootEl);

      this.toast = new ToastController();
      this.toast.mount(this.rootEl);

      /**
       * Session-Overlays hängen an der Slot-Wurzel, nicht am Frame — sonst bleiben
       * Spin-Button und Controls-Bar unterhalb des Rasters bedienbar.
       */
      this.deadlockSessionUi = new DeadlockModeSessionController({
        onPayloadRendered: (payload) => {
          this.bonusOverlay?.setDeadlockPhase(
            payload.phase === 'collection' ? 1 : 2,
          );
        },
      });
      this.deadlockSessionUi.mount(this.rootEl);
      this.gearsClashSessionUi = new GearsClashSessionController();
      this.gearsClashSessionUi.mount(this.rootEl);
      this.heistRunSessionUi = new HeistRunSessionController({
        onPayloadRendered: (payload) => {
          this.renderer?.setStickyWilds(payload.stickyWilds ?? []);
        },
      });
      this.heistRunSessionUi.mount(this.rootEl);

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

      /**
       * Ein fehlgeschlagener Balance-Abruf darf das Mounten nicht verhindern,
       * er muss aber sichtbar sein — sonst startet das HUD stillschweigend bei 0.
       */
      let bal = 0;
      try {
        bal = await this.options.apiAdapter.getBalance();
      } catch (e) {
        this.options.hostAdapter?.onError?.(e);
        this.emitter.emit('error', e);
      }
      this.hud.setBalance(bal);

      const onSpin = () => void this.requestSpin();
      this.button.onClick(onSpin);
      this.bindKeyboardControls();
      this.syncSpinButtonDisabled();

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
    if (!this.rootEl) return;
    if (typeof ResizeObserver !== 'undefined') {
      this.layoutObserver = new ResizeObserver(() => {
        this.syncLayoutPresentation();
      });
      this.layoutObserver.observe(this.rootEl);
    }
    /**
     * Ein Wechsel Portrait↔Landscape ändert die Container-Breite nicht immer —
     * deshalb zusätzlich am Viewport hören.
     */
    if (typeof window !== 'undefined') {
      this.orientationAbort = new AbortController();
      const opts = { signal: this.orientationAbort.signal };
      window.addEventListener('resize', () => this.syncLayoutPresentation(), opts);
      window.addEventListener(
        'orientationchange',
        () => this.syncLayoutPresentation(),
        opts,
      );
    }
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
    this.rootEl.dataset.gcOrientation = this.resolveOrientation();
    this.renderer?.setPresentationMode({ layoutMode: mode, fxQuality: fx });
  }

  /**
   * Portrait/Landscape steuert nur die DOM-Anordnung (Bottom-Sheet, HUD-Höhe).
   * Der Viewport zählt, nicht der Container — sonst liegt ein schmaler Host im
   * Querformat-Handy fälschlich auf „portrait“.
   */
  private resolveOrientation(): 'portrait' | 'landscape' {
    if (typeof window === 'undefined') return 'portrait';
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    if (w <= 0 || h <= 0) return 'portrait';
    return w > h ? 'landscape' : 'portrait';
  }

  private async tearDownAfterMountFailure(): Promise<void> {
    try {
      this.layoutObserver?.disconnect();
      this.layoutObserver = null;
      this.orientationAbort?.abort();
      this.orientationAbort = null;
      this.keyboardAbort?.abort();
      this.keyboardAbort = null;
      this.autoSpinActive = false;
      if (this.shakeTimer !== null) {
        window.clearTimeout(this.shakeTimer);
        this.shakeTimer = null;
      }
      this.button?.destroy();
      this.controlsBar?.destroy();
      this.hud?.destroy();
      this.bonusOverlay?.destroy();
      this.deadlockSessionUi?.destroy();
      this.gearsClashSessionUi?.destroy();
      this.heistRunSessionUi?.destroy();
      this.infoModal?.destroy();
      this.toast?.destroy();
      this.renderer?.destroy();
      this.desktopChrome?.destroy();
    } catch {
      // intentional: secondary destroy errors are swallowed; primary error wins.
    }
    this.toast = null;
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
    this.syncSpinButtonDisabled();
  }

  async destroy(): Promise<void> {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
    this.orientationAbort?.abort();
    this.orientationAbort = null;
    this.keyboardAbort?.abort();
    this.keyboardAbort = null;
    this.autoSpinActive = false;
    if (this.shakeTimer !== null) {
      window.clearTimeout(this.shakeTimer);
      this.shakeTimer = null;
    }
    this.button?.destroy();
    this.controlsBar?.destroy();
    this.hud?.destroy();
    this.bonusOverlay?.destroy();
    this.deadlockSessionUi?.destroy();
    this.gearsClashSessionUi?.destroy();
    this.heistRunSessionUi?.destroy();
    this.infoModal?.destroy();
    this.toast?.destroy();
    this.renderer?.destroy();
    this.desktopChrome?.destroy();
    this.toast = null;
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

  /** HUD, Desktop-Chrome und Balance-Event aus einem Spin-Ergebnis. */
  private pushHudFromResult(result: SpinResult): void {
    const host = this.options.hostAdapter;
    this.hud?.setBalanceAnimated(result.balanceAfter);
    this.hud?.setWinAnimated(
      result.winAmount,
      getWinTier(result.winAmount, this.bet),
    );
    const win = Math.max(0, Math.floor(result.winAmount));
    this.sessionWinTotal += win;
    this.biggestWinSession = Math.max(this.biggestWinSession, win);
    this.spinCount += 1;
    this.desktopChrome?.updateFromSpinResult(
      result,
      {
        sessionWinTotal: this.sessionWinTotal,
        biggestWinSession: this.biggestWinSession,
        spinCount: this.spinCount,
        bonusDescription: this.bonusEngine.describeBonus(result) || undefined,
      },
      host?.locale,
    );
    this.emitter.emit('balance:update', result.balanceAfter);
    host?.onBalanceUpdate?.(result.balanceAfter);
  }

  /**
   * Rundenabschluss für jeden Spin — auch für Bonus-Trigger-Spins und
   * Fortsetzungsrunden. `spin:end` ist damit für Hosts lückenlos.
   */
  private applySpinHudAndEmit(result: SpinResult): void {
    this.slotEngine.finishRound();
    this.pushHudFromResult(result);
    this.emitter.emit('spin:end', result);
  }

  /** Gemeinsamer Ablauf für alle Fortsetzungsrunden innerhalb einer Bonus-Session. */
  private async runBonusContinuationRound(
    mode: BonusId,
    metaFlag: string,
    hooks: PixiSlotRendererHooks,
  ): Promise<SpinResult> {
    const host = this.options.hostAdapter;
    if (!this.slotEngine.beginBonusRound()) {
      throw new Error(`${mode}: Fortsetzungsrunde außerhalb der Session.`);
    }
    this.emitter.emit('spin:start');
    this.options.sound?.play('spin');
    this.hud?.setWin(0);

    const hostMeta = host?.userMeta;
    const meta: Record<string, unknown> = {
      ...(hostMeta && typeof hostMeta === 'object' ? hostMeta : {}),
      [metaFlag]: true,
    };

    const result = await this.options.apiAdapter.spin({
      bet: this.bet,
      currency: host?.currency ?? 'COINS',
      mode,
      meta,
    });

    await this.presentSpinVisuals(result, hooks);
    this.applySpinHudAndEmit(result);
    this.emitter.emit('bonus:spin', result);

    const session = result.bonus?.session;
    if (result.bonus && session?.retriggerAwarded) {
      const event: BonusRetriggerEvent = {
        bonusId: result.bonus.type,
        awarded: session.retriggerAwarded,
        remaining: session.remainingSpins,
      };
      this.options.sound?.play('bonus_intro');
      this.emitter.emit('bonus:retrigger', event);
    }
    if (session) this.lastSessionMeta = session;
    return result;
  }

  private async runSpin(): Promise<void> {
    const host = this.options.hostAdapter;
    if (!this.slotEngine.canSpin(host?.disabled)) return;
    if (!this.slotEngine.beginSpin()) return;

    this.emitter.emit('spin:start');
    this.options.sound?.play('spin');
    this.hud?.setWin(0);
    this.syncSpinButtonDisabled();

    const hooks = this.getPixiHooks();
    try {
      const meta = this.consumeSpinMetaExtra();
      const result = await this.options.apiAdapter.spin({
        bet: this.bet,
        currency: host?.currency ?? 'COINS',
        mode: 'base',
        ...(Object.keys(meta ?? {}).length > 0 ? { meta } : {}),
      });

      await this.presentSpinVisuals(result, hooks);

      if (result.bonus) {
        this.lastSpinTriggeredBonus = true;
        await this.runBonusSession(result, result.bonus, hooks);
      } else {
        this.applySpinHudAndEmit(result);
      }
    } catch (e) {
      this.slotEngine.setError();
      this.autoSpinActive = false;
      this.controlsBar?.cancelAutoSpin();
      this.reportSpinError(e);
      this.emitter.emit('error', e);
      host?.onError?.(e);
    } finally {
      this.syncSpinButtonDisabled();
    }
  }

  /**
   * Bonus-Ablauf für alle drei Modi: Intro, Session-Schleife, Abschluss.
   * Die State Machine bleibt bis `endBonusSession()` gesperrt, damit während
   * der Session kein Base-Spin dazwischenfunkt.
   */
  private async runBonusSession(
    trigger: SpinResult,
    bonus: BonusSessionPayload,
    hooks: PixiSlotRendererHooks,
  ): Promise<void> {
    this.slotEngine.enterBonus();
    this.slotEngine.beginBonusSession();
    this.setBonusSessionChrome(bonus.type, true);
    this.renderer?.setBonusMood(bonus.type);
    this.lastSessionMeta = bonus.session;
    this.emitter.emit('bonus:start', bonus);
    this.options.sound?.play('bonus_intro');

    try {
      await this.renderer?.flashBonusSymbolReveal(trigger.reelStops);
      this.renderer?.setFrozen(true);
      await this.bonusOverlay?.show(bonus.type);
      this.renderer?.setFrozen(false);

      if (bonus.type === 'heist_run') {
        this.renderer?.setStickyWilds(bonus.payload.stickyWilds ?? []);
      }

      this.applySpinHudAndEmit(trigger);

      const lastPayload = await this.runBonusSessionLoop(trigger, bonus, hooks);
      this.emitBonusSummary(bonus.type);
      this.emitter.emit('bonus:end', lastPayload ?? bonus);
    } finally {
      this.renderer?.setFrozen(false);
      this.renderer?.clearStickyWilds();
      this.renderer?.clearFullReelWild();
      this.renderer?.setBonusMood(null);
      this.setBonusSessionChrome(bonus.type, false);
      this.lastSessionMeta = undefined;
      this.slotEngine.endBonusSession();
    }
  }

  private emitBonusSummary(bonusId: BonusId): void {
    const meta = this.lastSessionMeta;
    if (!meta) return;
    const event: BonusSummaryEvent = {
      bonusId,
      totalWin: meta.bankedWin,
      roundsPlayed: meta.roundsPlayed,
      balanceAfter: this.hud?.getBalance() ?? 0,
    };
    this.emitter.emit('bonus:summary', event);
  }

  private async runBonusSessionLoop(
    trigger: SpinResult,
    bonus: BonusSessionPayload,
    hooks: PixiSlotRendererHooks,
  ): Promise<BonusSessionPayload | undefined> {
    if (bonus.type === 'deadlock_mode') {
      return this.deadlockSessionUi?.runSession(trigger, () =>
        this.runBonusContinuationRound('deadlock_mode', 'deadlockSession', hooks),
      );
    }

    if (bonus.type === 'heist_run') {
      return this.heistRunSessionUi?.runSession(trigger, () =>
        this.runBonusContinuationRound('heist_run', 'heistSession', hooks),
      );
    }

    const battleHooks = {
      onBattle: async (payload: GearsClashPayload) => {
        this.options.sound?.play('gears_clash_intro');
        await this.renderer?.playGearsClashAnimationAsync(payload, hooks);
        if (payload.winnerReel !== undefined && payload.winnerMultiplier !== undefined) {
          this.renderer?.setFullReelWild(payload.winnerReel, payload.winnerMultiplier);
        }
      },
    };

    /** Ohne `session` ist es ein Einzelspin-Battle, kein Freispiel-Bonus (gears-clash.md §2 vs §3). */
    if (!bonus.session) {
      await (this.gearsClashSessionUi?.runBattle(bonus.payload, battleHooks) ??
        Promise.resolve());
      return bonus;
    }

    return this.gearsClashSessionUi?.runSession(
      trigger,
      () => this.runBonusContinuationRound('gears_clash', 'gearsSession', hooks),
      battleHooks,
    );
  }

  /** Markiert den Slot-Root während einer Session (Theming + Interaktions-Sperre per CSS). */
  private setBonusSessionChrome(bonusId: BonusId, active: boolean): void {
    if (!this.rootEl) return;
    if (active) {
      this.rootEl.dataset.gcBonus = bonusId;
      this.rootEl.classList.add('gc-slot--bonus-session');
    } else {
      delete this.rootEl.dataset.gcBonus;
      this.rootEl.classList.remove('gc-slot--bonus-session');
    }
    this.syncSpinButtonDisabled();
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
    if (this.shakeTimer !== null) {
      window.clearTimeout(this.shakeTimer);
    }
    this.shakeTimer = window.setTimeout(() => {
      this.shakeTimer = null;
      el.classList.remove('gc-frame--shake', 'gc-frame--shake-medium');
    }, 420);
  }
}
