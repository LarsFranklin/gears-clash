import { Application, Assets, Container, Graphics, Text, Texture } from 'pixi.js';
import type {
  BonusId,
  GameConfig,
  GearsClashPayload,
  SpinDisplayWinLine,
} from '../config/types';
import type { GcFxQuality, GcLayoutMode } from '../util/layoutMode';
import { SymbolRegistry } from '../core/SymbolRegistry';
import { AnimationController } from './AnimationController';
import { AtmosphereLayer } from './AtmosphereLayer';
import { BigWinLayer } from './BigWinLayer';
import { EffectsLayer } from './EffectsLayer';
import { GearsClashAnimation } from './GearsClashAnimation';
import type { LoadedSymbolTextures } from './loadSymbolTextures';
import { ReelColumn, ROW_GAP } from './ReelColumn';
import type { PixiSlotRendererHooks, RendererStage } from './rendererStage';
import { SpinChoreographer } from './SpinChoreographer';
import { SlotCabinet } from './SlotCabinet';
import { WinPresentation } from './WinPresentation';
import { cabinetOpening, fitCabinetToBox } from './cabinetLayout';
import { SLOT_GRID_SYMBOL_SCALE } from './slotFrameSkin';

const EMPTY_ROW_HIGHLIGHTS = new Set<number>();

export type { PixiSlotRendererHooks } from './rendererStage';

/**
 * Renderer-Kern: Pixi-Anwendung, Layout, Walzen und Layer.
 *
 * Die Bewegung der Walzen liegt in `SpinChoreographer`, die Gewinn-Darstellung in
 * `WinPresentation`; beide arbeiten über die `RendererStage`-Sicht auf diesen Kern.
 */
export class PixiSlotRenderer {
  private app: Application | null = null;
  private root: Container | null = null;
  private reels: ReelColumn[] = [];
  private registry: SymbolRegistry;
  private anim: AnimationController;
  private spinToken = 0;
  private parentEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private cellSize = 76;
  private rowPitch = 78;
  private gap = 8;
  private pad = 20;
  private lastStops: string[][] | null = null;
  private tickerFn: ((t: { deltaMS: number }) => void) | null = null;
  private animClock = 0;
  private frozen = false;
  private winPulse = 0;
  private highlightRowsByReel: Map<number, Set<number>> = new Map();
  /** Kurz vor Bonus-Overlay: nur diese Zellen mit vollem Bonus-Glanz. */
  private bonusRevealRowsByReel: Map<number, Set<number>> = new Map();
  private winlineLayer: Container | null = null;
  private winlinePath: Graphics | null = null;
  private winlineLabel: Text | null = null;
  private atmosphereLayer: AtmosphereLayer | null = null;
  private effectsLayer: EffectsLayer | null = null;
  private bigWinLayer: BigWinLayer | null = null;
  private gearsClashAnim: GearsClashAnimation | null = null;
  private currentBet = 10;
  private isAnimating = false;
  private pendingResize = false;
  private destroyed = false;
  private lastDtSec = 0;
  private lastDtMs = 16;
  private presentation: { layoutMode: GcLayoutMode; fxQuality: GcFxQuality } = {
    layoutMode: 'standard',
    fxQuality: 'medium',
  };
  private symbolTextureMap: ReadonlyMap<string, Texture> | null = null;
  private symbolTextureUnloadUrls: string[] = [];
  private readonly stage: RendererStage;
  private readonly choreographer: SpinChoreographer;
  private readonly winPresentation: WinPresentation;
  /** Zusammengesetzter Bild-Rahmen. `null`, wenn die Teile nicht laden. */
  private cabinet: SlotCabinet | null = null;

  constructor(private readonly config: GameConfig) {
    this.registry = new SymbolRegistry(config);
    this.anim = new AnimationController(config);
    this.stage = this.createStage();
    this.choreographer = new SpinChoreographer(this.stage);
    this.winPresentation = new WinPresentation(this.stage);
  }

  /** Lesende Sicht auf den Kern für Choreografie und Gewinn-Darstellung. */
  private createStage(): RendererStage {
    const renderer = this;
    return {
      get config() {
        return renderer.config;
      },
      get reels() {
        return renderer.reels;
      },
      get effects() {
        return renderer.effectsLayer;
      },
      get bigWin() {
        return renderer.bigWinLayer;
      },
      get canvas() {
        return renderer.app?.canvas ?? null;
      },
      get winlinePath() {
        return renderer.winlinePath;
      },
      get winlineLabel() {
        return renderer.winlineLabel;
      },
      get highlightRowsByReel() {
        return renderer.highlightRowsByReel;
      },
      get bonusRevealRowsByReel() {
        return renderer.bonusRevealRowsByReel;
      },
      get cellSize() {
        return renderer.cellSize;
      },
      get rowPitch() {
        return renderer.rowPitch;
      },
      get gap() {
        return renderer.gap;
      },
      get currentBet() {
        return renderer.currentBet;
      },
      get spinToken() {
        return renderer.spinToken;
      },
      get destroyed() {
        return renderer.destroyed;
      },
      setWinPulse: (value) => {
        renderer.winPulse = value;
      },
      setAnimating: (value) => {
        renderer.isAnimating = value;
      },
      tickVisuals: () => renderer.tickVisuals(),
      flushPendingResize: () => renderer.flushPendingResize(),
      setGridFromStops: (stops) => renderer.setGridFromStops(stops),
      isBonusSymbol: (id) => renderer.registry.get(id)?.kind === 'bonus',
    };
  }

  /**
   * Nach `loadSymbolTexturesFromManifest` — vor `init()` setzen, damit die Walzen beim Aufbau Texturen nutzen.
   */
  setLoadedSymbolTextures(loaded: LoadedSymbolTextures): void {
    this.symbolTextureMap = loaded.map;
    this.symbolTextureUnloadUrls = [...loaded.sourceUrls];
  }

  async init(parent: HTMLElement): Promise<void> {
    if (this.app || this.destroyed) {
      console.warn(
        '[PixiSlotRenderer] init() ignoriert — Renderer ist bereits initialisiert oder zerstört.',
      );
      return;
    }
    this.parentEl = parent;
    this.lastStops = this.defaultStops();

    this.cabinet = await SlotCabinet.load();

    const layout = this.computeLayout();
    this.applyMetrics(layout);
    parent.style.aspectRatio = `${layout.totalW} / ${layout.totalH}`;

    const app = new Application();
    await app.init({
      width: layout.totalW,
      height: layout.totalH,
      background: 0x0a0a0e,
      antialias: true,
      resolution: Math.min(
        2,
        typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
      ),
      autoDensity: true,
    });
    this.app = app;
    app.canvas.classList.add('gc-pixi-canvas');
    parent.replaceChildren(app.canvas);

    const root = new Container();
    root.sortableChildren = true;
    root.position.set(0, 0);
    app.stage.addChild(root);
    this.root = root;

    this.buildReels(layout);
    this.syncAllColumnsFromStops(this.lastStops);

    this.gearsClashAnim = new GearsClashAnimation(this.root, this.config);
    this.gearsClashAnim.setLayout(
      layout.cellSize,
      layout.gap,
      layout.offsetX,
      layout.offsetY,
      layout.rowPitch,
    );

    this.tickerFn = () => {
      const dt =
        this.app?.ticker.deltaMS ??
        (typeof this.app?.ticker.deltaTime === 'number'
          ? this.app.ticker.deltaTime * (1000 / 60)
          : 16);
      this.lastDtMs = dt;
      this.lastDtSec = dt / 1000;
      this.animClock += this.lastDtSec;
      this.tickVisuals();
    };
    app.ticker.add(this.tickerFn);

    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(parent);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.spinToken++;
    this.winPresentation.disarmSkip();
    if (this.app && this.tickerFn) {
      this.app.ticker.remove(this.tickerFn);
    }
    this.tickerFn = null;
    if (this.gearsClashAnim) {
      this.gearsClashAnim.destroy();
      this.gearsClashAnim = null;
    }
    if (this.resizeObserver && this.parentEl) {
      this.resizeObserver.unobserve(this.parentEl);
    }
    this.resizeObserver = null;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = null;
    this.parentEl = null;
    this.atmosphereLayer?.destroy();
    this.atmosphereLayer = null;
    this.effectsLayer?.destroy();
    this.effectsLayer = null;
    this.bigWinLayer?.destroy();
    this.bigWinLayer = null;
    for (const url of this.symbolTextureUnloadUrls) {
      void Assets.unload(url);
    }
    this.symbolTextureUnloadUrls = [];
    this.symbolTextureMap = null;
    this.cabinet?.destroy();
    this.cabinet = null;
    this.app?.destroy(
      { removeView: true },
      { children: true, texture: true, textureSource: true },
    );
    this.app = null;
    this.root = null;
    this.reels = [];
    this.winlineLayer = null;
    this.winlinePath = null;
    this.winlineLabel = null;
    this.lastStops = null;
    this.isAnimating = false;
    this.pendingResize = false;
    this.highlightRowsByReel.clear();
    this.bonusRevealRowsByReel.clear();
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    this.tickVisuals();
  }

  /**
   * Layout-Modus (Host-CSS) + FX-Stufe — steuert Partikel/Dampf, ohne Server-Mathematik.
   */
  setPresentationMode(opts: {
    layoutMode?: GcLayoutMode;
    fxQuality?: GcFxQuality;
  }): void {
    if (opts.layoutMode !== undefined) {
      this.presentation.layoutMode = opts.layoutMode;
    }
    if (opts.fxQuality !== undefined) {
      this.presentation.fxQuality = opts.fxQuality;
    }
    this.applyPresentationToLayers();
  }

  private applyPresentationToLayers(): void {
    const { fxQuality } = this.presentation;
    this.atmosphereLayer?.setFxQuality(fxQuality);
    this.cabinet?.setFxQuality(fxQuality);
    this.effectsLayer?.setFxQuality(fxQuality);
  }

  setGridFromStops(reelStops: string[][]): void {
    this.lastStops = reelStops.map((col) => [...col]);
    this.syncAllColumnsFromStops(this.lastStops);
  }

  async playSpinAnimation(
    reelStops: string[][],
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    if (this.destroyed) return;
    const token = ++this.spinToken;
    this.isAnimating = true;
    try {
      await this.choreographer.play(
        reelStops,
        this.anim.getParams(),
        token,
        hooks,
      );
    } finally {
      this.isAnimating = false;
      this.flushPendingResize();
    }
  }

  setBet(bet: number): void {
    this.currentBet = Math.max(1, bet);
  }

  /**
   * Turbo zur Laufzeit umschalten. `AnimationController.getParams()` liest die
   * Konfiguration bei jedem Spin neu, deshalb genügt das Setzen des Flags.
   */
  setTurbo(enabled: boolean): void {
    this.config.animation.turbo = enabled;
  }

  isTurbo(): boolean {
    return this.config.animation.turbo === true;
  }

  /** Nur Darstellung — Highlights aus Server/Mock. */
  async showWinFeedback(
    highlights: { reel: number; row: number }[],
    winAmount: number,
    winLines: SpinDisplayWinLine[] = [],
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    await this.winPresentation.showWinFeedback(
      highlights,
      winAmount,
      winLines,
      hooks,
    );
  }

  /** Kurze Reveal-Phase: Bonus-Symbole auf dem Raster voller Glanz, danach Overlay (`GearsClashGame`). */
  async flashBonusSymbolReveal(reelStops: string[][]): Promise<void> {
    await this.winPresentation.flashBonusSymbolReveal(reelStops);
  }

  /**
   * Startet die Gears Clash Battle-Animation für eine bestimmte Reel.
   * @param payload - Die Gears Clash Payload mit Multiplier-Daten
   * @param hooks - Optional: Callbacks für Sounds
   */
  playGearsClashAnimation(
    payload: GearsClashPayload,
    hooks?: PixiSlotRendererHooks,
  ): void {
    void this.playGearsClashAnimationAsync(payload, hooks);
  }

  playGearsClashAnimationAsync(
    payload: GearsClashPayload,
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    if (!this.gearsClashAnim || this.destroyed) return Promise.resolve();
    const targetReel = payload.winnerReel ?? 0;
    return new Promise((resolve) => {
      this.gearsClashAnim!.start(payload, targetReel, {
        onComplete: () => resolve(),
        onSound: hooks?.onSound,
      });
    });
  }

  /** Hintergrundstimmung auf einen Bonus-Modus umschalten (`null` = Basisspiel). */
  setBonusMood(bonusId: BonusId | null): void {
    this.atmosphereLayer?.setBonusMood(bonusId);
    this.cabinet?.setBonusMood(bonusId);
  }

  setFullReelWild(reel: number, multiplier?: number): void {
    this.effectsLayer?.setFullReelWild(reel, multiplier);
  }

  clearFullReelWild(): void {
    this.effectsLayer?.clearFullReelWild();
  }

  setStickyWilds(
    positions: readonly { reel: number; row: number; multiplier?: number }[],
  ): void {
    this.effectsLayer?.setStickyWilds(positions);
  }

  clearStickyWilds(): void {
    this.effectsLayer?.clearStickyWilds();
  }

  private tickVisuals(): void {
    const t = this.animClock;
    this.atmosphereLayer?.paint(t, this.lastDtSec, this.isAnimating);
    this.cabinet?.tick(t, this.lastDtSec);
    this.effectsLayer?.paint(this.lastDtMs);
    if (this.gearsClashAnim) {
      this.gearsClashAnim.update(this.lastDtMs);
    }
    for (let c = 0; c < this.reels.length; c++) {
      const rows = this.highlightRowsByReel.get(c) ?? EMPTY_ROW_HIGHLIGHTS;
      const bonusRows =
        this.bonusRevealRowsByReel.get(c) ?? EMPTY_ROW_HIGHLIGHTS;
      this.reels[c]!.paintAll(t, {
        highlightRows: rows,
        bonusRevealRows: bonusRows,
        winPulse: this.winPulse,
        frozen: this.frozen,
      });
    }
  }

  private scheduleResize(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.handleResize();
    }, 80);
  }

  private flushPendingResize(): void {
    if (!this.pendingResize) return;
    this.pendingResize = false;
    this.handleResize();
  }

  private handleResize(): void {
    if (!this.app || !this.root || !this.parentEl || this.destroyed) return;
    if (this.isAnimating) {
      this.pendingResize = true;
      return;
    }
    const layout = this.computeLayout();
    const changed =
      layout.cellSize !== this.cellSize ||
      layout.totalW !== this.app.renderer.width ||
      layout.totalH !== this.app.renderer.height;

    if (!changed) return;

    this.applyMetrics(layout);
    this.app.renderer.resize(layout.totalW, layout.totalH);
    this.root.position.set(0, 0);
    if (this.gearsClashAnim) {
      this.gearsClashAnim.setLayout(
        layout.cellSize,
        layout.gap,
        layout.offsetX,
        layout.offsetY,
        layout.rowPitch,
      );
    }
    this.buildReels(layout);
    if (this.lastStops) this.syncAllColumnsFromStops(this.lastStops);
    this.tickVisuals();
  }

  private computeLayout(): {
    totalW: number;
    totalH: number;
    cellSize: number;
    iconSize: number;
    rowPitch: number;
    gap: number;
    pad: number;
    offsetX: number;
    offsetY: number;
    visibleH: number;
    gridInnerX: number;
    gridInnerY: number;
    gridInnerW: number;
    gridInnerH: number;
    gridMaskRadius: number;
  } {
    const parent = this.parentEl;
    const rawW = parent ? Math.max(260, Math.floor(parent.clientWidth)) : 360;
    const rawH = parent && parent.clientHeight > 0 ? Math.floor(parent.clientHeight) : 0;
    const { reels, rows } = this.config.grid;

    if (!this.cabinet) {
      const pad = Math.max(14, Math.floor(rawW * 0.04));
      const inner = Math.max(220, rawW - pad * 2);
      const gap = Math.max(4, Math.min(10, Math.floor(inner * 0.011)));
      const cell = Math.floor((inner - gap * (reels - 1)) / reels);
      let cellSize = Math.max(46, Math.min(cell, 118));
      cellSize = Math.max(
        40,
        Math.floor(cellSize * SLOT_GRID_SYMBOL_SCALE),
      );
      const pitch = cellSize + ROW_GAP;
      const gridW = reels * cellSize + gap * (reels - 1);
      const gridH = rows * pitch;
      const totalW = rawW;
      const unclampedH = Math.ceil(gridH + pad * 2);
      const totalH = rawH > 0 ? Math.min(unclampedH, rawH) : unclampedH;
      const offsetX = Math.floor((totalW - gridW) / 2);
      const offsetY = Math.floor((totalH - gridH) / 2);
      return {
        totalW,
        totalH,
        cellSize,
        gap,
        pad,
        offsetX,
        offsetY,
        visibleH: gridH,
        gridInnerX: 0,
        gridInnerY: 0,
        gridInnerW: totalW,
        gridInnerH: totalH,
        gridMaskRadius: Math.max(6, Math.floor(cellSize * 0.1)),
        iconSize: cellSize,
        rowPitch: cellSize + ROW_GAP,
      };
    }

    const { totalW, totalH } = fitCabinetToBox(
      rawW,
      rawH > 0 ? rawH : Number.POSITIVE_INFINITY,
    );
    const opening = cabinetOpening(totalW, totalH);
    const innerX = opening.x;
    const innerY = opening.y;
    const innerW = opening.w;
    const innerH = opening.h;

    const gap = 4;
    const cellW = Math.max(40, Math.floor((innerW - gap * (reels - 1)) / reels));
    const rowPitch = Math.max(44, Math.floor(innerH / rows));
    const icon = Math.max(32, Math.min(cellW, rowPitch - ROW_GAP));
    const actualGridW = reels * cellW + (reels - 1) * gap;
    const actualGridH = rows * rowPitch;

    return {
      totalW,
      totalH,
      cellSize: cellW,
      iconSize: icon,
      rowPitch,
      gap,
      pad: 0,
      offsetX: innerX + Math.floor((innerW - actualGridW) / 2),
      offsetY: innerY + Math.floor((innerH - actualGridH) / 2),
      visibleH: actualGridH,
      gridInnerX: innerX,
      gridInnerY: innerY,
      gridInnerW: innerW,
      gridInnerH: innerH,
      gridMaskRadius: Math.max(3, Math.min(12, Math.floor(icon * 0.09))),
    };
  }

  private applyMetrics(layout: ReturnType<typeof this.computeLayout>): void {
    this.cellSize = layout.cellSize;
    this.rowPitch = layout.rowPitch;
    this.gap = layout.gap;
    this.pad = layout.pad;
    if (this.parentEl) {
      this.parentEl.style.aspectRatio = `${layout.totalW} / ${layout.totalH}`;
      this.parentEl.style.maxWidth = '100%';
      this.parentEl.style.maxHeight = '100%';
    }
  }

  private buildReels(layout: ReturnType<typeof this.computeLayout>): void {
    if (!this.root) return;

    for (const reel of this.reels) {
      reel.destroy();
    }
    this.reels = [];

    this.winlinePath?.destroy();
    this.winlinePath = null;
    this.winlineLabel?.destroy();
    this.winlineLabel = null;
    this.winlineLayer?.destroy({ children: true });
    this.winlineLayer = null;

    this.atmosphereLayer?.destroy();
    this.atmosphereLayer = null;
    this.effectsLayer?.destroy();
    this.effectsLayer = null;
    this.bigWinLayer?.destroy();
    this.bigWinLayer = null;

    this.root.removeChildren();

    if (this.cabinet) {
      this.cabinet.layout(
        layout.totalW,
        layout.totalH,
        {
          x: layout.gridInnerX,
          y: layout.gridInnerY,
          w: layout.gridInnerW,
          h: layout.gridInnerH,
        },
        {
          reels: this.config.grid.reels,
          rows: this.config.grid.rows,
          cellSize: layout.cellSize,
          gap: layout.gap,
          offsetX: layout.offsetX,
          offsetY: layout.offsetY,
          rowGap: ROW_GAP,
          rowPitch: layout.rowPitch,
        },
      );
      this.root.addChild(this.cabinet.back);
    }

    const atmo = new AtmosphereLayer();
    atmo.layout(layout.totalW, layout.totalH);
    atmo.view.position.set(0, 0);
    const innerMask = new Graphics();
    innerMask.roundRect(
      layout.gridInnerX,
      layout.gridInnerY,
      layout.gridInnerW,
      layout.gridInnerH,
      layout.gridMaskRadius,
    );
    innerMask.fill({ color: 0xffffff });
    atmo.view.addChild(innerMask);
    atmo.view.mask = innerMask;
    this.root.addChild(atmo.view);
    this.atmosphereLayer = atmo;

    const { reels } = this.config.grid;
    const visibleH = layout.visibleH;
    const gridW = reels * layout.cellSize + (reels - 1) * layout.gap;

    const gridLayer = new Container();
    gridLayer.sortableChildren = true;
    gridLayer.zIndex = 0;
    gridLayer.position.set(layout.offsetX, layout.offsetY);
    const gridMask = new Graphics();
    gridMask.roundRect(0, 0, gridW, visibleH, layout.gridMaskRadius);
    gridMask.fill({ color: 0xffffff });
    gridLayer.addChild(gridMask);
    gridLayer.mask = gridMask;

    for (let c = 0; c < reels; c++) {
      const col = new ReelColumn(this.config, this.registry);
      col.setSymbolTextures(this.symbolTextureMap);
      col.layout(c, layout.iconSize, layout.gap, visibleH, layout.cellSize, layout.rowPitch);
      gridLayer.addChild(col.view);
      this.reels.push(col);
    }

    const effects = new EffectsLayer();
    effects.layout(layout.cellSize, layout.gap, reels, gridW, visibleH, layout.rowPitch);
    effects.view.zIndex = 15;
    gridLayer.addChild(effects.view);
    this.effectsLayer = effects;

    this.setupWinlineLayer(layout, gridLayer);

    const bigWin = new BigWinLayer();
    bigWin.layout(gridW, visibleH);
    bigWin.view.zIndex = 30;
    gridLayer.addChild(bigWin.view);
    this.bigWinLayer = bigWin;

    this.root.addChild(gridLayer);

    if (this.cabinet) {
      this.root.addChild(this.cabinet.front);
    }

    this.applyPresentationToLayers();

    if (this.gearsClashAnim) {
      this.root.addChild(this.gearsClashAnim.getView());
      this.gearsClashAnim.setLayout(
        layout.cellSize,
        layout.gap,
        layout.offsetX,
        layout.offsetY,
        layout.rowPitch,
      );
    }
  }

  private syncAllColumnsFromStops(reelStops: string[][]): void {
    for (let c = 0; c < this.reels.length; c++) {
      const col = reelStops[c];
      if (col) this.reels[c]!.syncVisibleColumn(col);
    }
    this.tickVisuals();
  }

  private setupWinlineLayer(
    layout: ReturnType<typeof this.computeLayout>,
    parent: Container,
  ): void {
    const layer = new Container();
    layer.eventMode = 'none';
    layer.zIndex = 20;

    const path = new Graphics();
    layer.addChild(path);

    const label = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: Math.max(12, Math.floor(this.cellSize * 0.22)),
        fontWeight: '700',
        fill: 0xfff7d0,
        stroke: { color: 0x3b1f00, width: 4, join: 'round' },
        dropShadow: {
          color: 0x000000,
          blur: 2,
          alpha: 0.5,
          distance: 2,
          angle: Math.PI / 4,
        },
      },
    });
    label.anchor.set(0.5);
    label.visible = false;
    layer.addChild(label);

    parent.addChild(layer);
    this.winlineLayer = layer;
    this.winlinePath = path;
    this.winlineLabel = label;
    this.clearWinlineOverlay();
    this.resizeWinlineLabel(layout);
  }

  private resizeWinlineLabel(layout: ReturnType<typeof this.computeLayout>): void {
    if (!this.winlineLabel) return;
    this.winlineLabel.style.fontSize = Math.max(12, Math.floor(layout.cellSize * 0.22));
  }

  private clearWinlineOverlay(): void {
    this.winPresentation.clearWinlineOverlay();
  }

  /**
   * Leeres Raster: lieber ein klar rechteckiges Symbol (Alignment zum Rahmen prüfen),
   * Fallback-Reihenfolge wenn IDs in einer Host-Config fehlen.
   */
  private defaultStops(): string[][] {
    const preferred = [
      'overdrive_core',
      'quantum_chamber',
      'reactor_pipe',
      'fuel_canister',
      'bolt',
    ] as const;
    let id = this.registry.allIds[0] ?? 'bolt';
    for (const cand of preferred) {
      if (this.registry.get(cand)) {
        id = cand;
        break;
      }
    }
    const { reels, rows } = this.config.grid;
    return Array.from({ length: reels }, () =>
      Array.from({ length: rows }, () => id),
    );
  }
}
