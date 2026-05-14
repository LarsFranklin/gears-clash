import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { columnPrefixTriggersScatterHuntVisual } from '../core/scatterAnticipation';
import type { GameConfig, GearsClashPayload, SpinDisplayWinLine } from '../config/types';
import type { GcFxQuality, GcLayoutMode } from '../util/layoutMode';
import { SymbolRegistry } from '../core/SymbolRegistry';
import { AnimationController } from './AnimationController';
import { AtmosphereLayer } from './AtmosphereLayer';
import { BigWinLayer, getWinTier, type WinTier } from './BigWinLayer';
import { EffectsLayer } from './EffectsLayer';
import { bounceOffset, easeOutQuart } from './easing';
import { GearsClashAnimation } from './GearsClashAnimation';
import type { LoadedSymbolTextures } from './loadSymbolTextures';
import { ReelColumn, ROW_GAP } from './ReelColumn';
import {
  SLOT_FRAME_GRID_NORM,
  SLOT_FRAME_GRID_NUDGE_NORM,
  SLOT_GRID_SYMBOL_SCALE,
} from './slotFrameSkin';

const EMPTY_ROW_HIGHLIGHTS = new Set<number>();

export interface PixiSlotRendererHooks {
  onSound?: (id: string) => void;
  /** Leichtes Shake am Host (CSS-Klasse). */
  onShake?: (kind: 'light' | 'medium') => void;
}

/**
 * 5 unabhängige Reels, Masken-Strip, Easing + Bounce; Symbole prozedural oder aus Manifest-Texturen.
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
  /** Sanftes Hochfahren des Scatter-Jagd-Idle-Multiplikators (pro Spin). */
  private idleScrollMulSmoothed = 1;
  private winLineSkipAbort: AbortController | null = null;
  private winLineSkipRequested = false;
  /** Optionaler PNG-Rahmen über dem Grid (Symbole darunter); Test-Asset unter `/assets/slot_frame.png`. */
  private slotFrameSprite: Sprite | null = null;
  private slotFrameUnloadUrl: string | null = null;
  private slotFrameLoadFailed = false;
  /** Dunkle Slot-Hintergrundtextur unter Atmosphäre/Walzen (`/assets/slot_background.png`). */
  private slotBackgroundSprite: Sprite | null = null;
  private slotBackgroundUnloadUrl: string | null = null;
  private slotBackgroundLoadFailed = false;
  private slotFrameSourceTex: Texture | null = null;
  private slotFrameNatW = 0;
  private slotFrameNatH = 0;

  constructor(private readonly config: GameConfig) {
    this.registry = new SymbolRegistry(config);
    this.anim = new AnimationController(config);
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

    await this.loadSlotFrameTextureMeta();

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
    );

    await this.ensureSlotBackgroundOverlay(layout);

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
    this.disarmWinLineSkip();
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
    if (this.slotFrameSprite) {
      this.slotFrameSprite.destroy();
      this.slotFrameSprite = null;
    }
    this.slotFrameSourceTex = null;
    this.slotFrameNatW = 0;
    this.slotFrameNatH = 0;
    if (this.slotFrameUnloadUrl) {
      void Assets.unload(this.slotFrameUnloadUrl);
      this.slotFrameUnloadUrl = null;
    }
    this.slotFrameLoadFailed = false;
    if (this.slotBackgroundSprite) {
      this.slotBackgroundSprite.destroy();
      this.slotBackgroundSprite = null;
    }
    if (this.slotBackgroundUnloadUrl) {
      void Assets.unload(this.slotBackgroundUnloadUrl);
      this.slotBackgroundUnloadUrl = null;
    }
    this.slotBackgroundLoadFailed = false;
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
    this.effectsLayer?.setFxQuality(fxQuality);
  }

  setGridFromStops(reelStops: string[][]): void {
    this.lastStops = reelStops.map((col) => [...col]);
    this.syncAllColumnsFromStops(this.lastStops);
  }

  /**
   * Nach Walzenstillstand links→rechts: wenn mindestens 2 gleiche Scatter schon gelandet sind,
   * alle noch kommenden Walzen gold + Funken beschleunigen (nur Darstellung).
   */
  private syncScatterAnticipation(lastStoppedInclusive: number, reelStops: string[][]): void {
    const reelsN = this.config.grid.reels;
    if (lastStoppedInclusive >= reelsN - 1) {
      this.effectsLayer?.clearScatterAnticipation();
      return;
    }
    const pending: number[] = [];
    for (let j = lastStoppedInclusive + 1; j < reelsN; j++) {
      pending.push(j);
    }
    if (
      !columnPrefixTriggersScatterHuntVisual(
        reelStops,
        lastStoppedInclusive,
        this.config,
      )
    ) {
      this.effectsLayer?.clearScatterAnticipation();
      return;
    }
    this.effectsLayer?.setScatterAnticipationReels(pending);
  }

  async playSpinAnimation(
    reelStops: string[][],
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    if (this.destroyed) return;
    const token = ++this.spinToken;
    const params = this.anim.getParams();
    this.isAnimating = true;
    try {
      if (params.turbo) {
        await this.playSpinTurbo(reelStops, hooks, token, params);
      } else {
        await this.playSpinSequential(reelStops, hooks, token, params);
      }
    } finally {
      this.isAnimating = false;
      this.flushPendingResize();
    }
  }

  /** Alle Spalten parallel, gestaffeltes Stop — wie früher. */
  private async playSpinTurbo(
    reelStops: string[][],
    hooks: PixiSlotRendererHooks | undefined,
    token: number,
    params: {
      spinDurationMs: number;
      reelStopStaggerMs: number;
      reelApproachExtraRows: number;
    },
  ): Promise<void> {
    const reelsN = this.config.grid.reels;
    const baseStop = params.spinDurationMs * 0.55;
    const pitch = this.cellSize + ROW_GAP;
    const extraRows = params.reelApproachExtraRows;
    const anticipationMs = 80;
    const anticipationPx = 6;

    await this.playAnticipation(token, anticipationMs, anticipationPx);
    if (token !== this.spinToken) return;
    this.effectsLayer?.clearScatterAnticipation();

    const prep: {
      y0: number;
      y1: number;
      focusEnd: number;
      tStop: number;
    }[] = [];

    for (let c = 0; c < reelsN; c++) {
      const col = reelStops[c] ?? reelStops[0]!;
      const reel = this.reels[c]!;
      const p = reel.prepareSpinTargets(col, { turbo: true });
      const y0 = Math.max(reel.minStripY, Math.min(p.y0, p.y1 - extraRows * pitch));
      prep.push({
        y0,
        y1: p.y1,
        focusEnd: p.focusEnd,
        tStop: baseStop + c * params.reelStopStaggerMs,
      });
    }

    if (
      reelsN > 2 &&
      columnPrefixTriggersScatterHuntVisual(reelStops, 1, this.config)
    ) {
      const extraBase =
        this.config.animation.scatterAnticipationTurboExtraStopMs ?? 620;
      for (let c = 2; c < reelsN; c++) {
        prep[c]!.tStop += extraBase * (0.55 + (c - 2) * 0.28);
      }
    }

    const maxStop = Math.max(...prep.map((p) => p.tStop));
    const bounceWindow = 320;
    const squashMs = 140;
    const t0 = performance.now();
    const stopped = new Array<boolean>(reelsN).fill(false);
    const squashStart = new Array<number>(reelsN).fill(0);

    for (let c = 0; c < reelsN; c++) {
      this.effectsLayer?.startSpeedLines(c, 1.0);
    }

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.spinToken) {
          this.effectsLayer?.clearScatterAnticipation();
          this.effectsLayer?.stopAllSpeedLines();
          resolve();
          return;
        }
        const T = performance.now() - t0;
        for (let c = 0; c < reelsN; c++) {
          const p = prep[c]!;
          const col = this.reels[c]!;
          if (T < p.tStop) {
            const u = easeInCubicEarly(T / p.tStop);
            const y = p.y0 + (p.y1 - p.y0) * easeOutQuart(u);
            col.setStripY(y);

            const speedPhase = u < 0.55 ? 1.0 - u / 0.55 : 0;
            this.effectsLayer?.startSpeedLines(c, speedPhase);
          } else {
            if (!stopped[c]) {
              stopped[c] = true;
              squashStart[c] = T;
              hooks?.onSound?.('reel_stop');
              this.effectsLayer?.stopSpeedLines(c);
              this.effectsLayer?.triggerReelFlash(c);
              let lastContiguous = -1;
              for (let i = 0; i < reelsN; i++) {
                if (stopped[i]) lastContiguous = i;
                else break;
              }
              if (lastContiguous >= 0) {
                this.syncScatterAnticipation(lastContiguous, reelStops);
              }
            }
            const after = T - p.tStop;
            const bounce = bounceOffset(after, this.cellSize * 0.038, 0.017, 0.0055);
            col.setStripY(p.y1 + bounce);

            const squashT = T - squashStart[c]!;
            if (squashT < squashMs) {
              const sq = this.computeSquash(squashT, squashMs);
              col.view.scale.y = sq;
            } else {
              col.view.scale.y = 1;
            }
          }
        }
        if (T >= maxStop + bounceWindow) {
          for (let c = 0; c < reelsN; c++) {
            const p = prep[c]!;
            this.reels[c]!.setStripY(p.y1);
            this.reels[c]!.commitFocus(p.focusEnd);
            this.reels[c]!.view.scale.y = 1;
          }
          this.effectsLayer?.clearScatterAnticipation();
          this.effectsLayer?.stopAllSpeedLines();
          this.setGridFromStops(reelStops);
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** Spalten nacheinander, längere Fahrt + „von oben“ vor dem Einrasten. */
  private async playSpinSequential(
    reelStops: string[][],
    hooks: PixiSlotRendererHooks | undefined,
    token: number,
    params: {
      reelSequentialDurationMs: number;
      reelApproachExtraRows: number;
      reelIdleScrollRowsPerSec: number;
    },
  ): Promise<void> {
    const reelsN = this.config.grid.reels;
    const pitch = this.cellSize + ROW_GAP;
    const tStop = params.reelSequentialDurationMs;
    const bounceWindow = 300;
    const extraRows = params.reelApproachExtraRows;
    const idleRowsPerSec = params.reelIdleScrollRowsPerSec;
    const anticipationMs = 100;
    const anticipationPx = 8;
    const squashMs = 140;

    await this.playAnticipation(token, anticipationMs, anticipationPx);
    if (token !== this.spinToken) return;
    this.effectsLayer?.clearScatterAnticipation();
    this.idleScrollMulSmoothed = 1;

    for (let i = 0; i < reelsN; i++) {
      this.reels[i]!.resetIdleScrollBeforePrepare();
      this.effectsLayer?.startSpeedLines(i, 0.7);
    }

    for (let c = 0; c < reelsN; c++) {
      if (token !== this.spinToken) {
        this.effectsLayer?.clearScatterAnticipation();
        this.effectsLayer?.stopAllSpeedLines();
        return;
      }
      const colStops = reelStops[c] ?? reelStops[0]!;
      const reel = this.reels[c]!;
      const p = reel.prepareSpinTargets(colStops, { turbo: false });
      let y0 = reel.stripY;
      const y1 = p.y1;
      y0 = Math.max(reel.minStripY, Math.min(y0, y1 - extraRows * pitch));
      const scatterHuntHeavy =
        c >= 2 &&
        columnPrefixTriggersScatterHuntVisual(reelStops, c - 1, this.config);
      let reelStopDuration = c === 0 ? tStop * 1.22 : tStop;
      if (scatterHuntHeavy) {
        reelStopDuration *=
          this.config.animation.scatterAnticipationSequentialStopStretch ?? 1.18;
      }
      const terminalSlow =
        this.config.animation.scatterAnticipationTerminalSlowFraction ?? 0.2;
      await this.springOneReel(
        c,
        y0,
        y1,
        p.focusEnd,
        reelStopDuration,
        bounceWindow,
        token,
        hooks,
        0.042,
        reelsN,
        idleRowsPerSec,
        squashMs,
        scatterHuntHeavy,
        terminalSlow,
      );
      if (token !== this.spinToken) {
        this.effectsLayer?.clearScatterAnticipation();
        this.effectsLayer?.stopAllSpeedLines();
        return;
      }
      this.syncScatterAnticipation(c, reelStops);
    }
    this.effectsLayer?.clearScatterAnticipation();
    this.effectsLayer?.stopAllSpeedLines();
    this.setGridFromStops(reelStops);
  }

  private reelStripEase(
    u: number,
    huntHeavy: boolean,
    terminalSlow: number,
  ): number {
    const tf = Math.min(0.34, Math.max(0.1, terminalSlow));
    if (!huntHeavy) {
      return easeOutQuart(easeInCubicEarly(u));
    }
    const bodyMax = 0.86;
    if (u <= 1 - tf) {
      const v = u / (1 - tf);
      return bodyMax * easeOutQuart(easeInCubicEarly(v));
    }
    const v = (u - (1 - tf)) / tf;
    return bodyMax + (1 - bodyMax) * (v * v * (3 - 2 * v));
  }

  private async springOneReel(
    c: number,
    y0: number,
    y1: number,
    focusEnd: number,
    tStop: number,
    bounceWindow: number,
    token: number,
    hooks: PixiSlotRendererHooks | undefined,
    bounceCellFactor: number,
    reelsN: number,
    idleRowsPerSec: number,
    squashMs = 140,
    scatterHuntHeavy = false,
    terminalSlowFrac = 0.2,
  ): Promise<void> {
    const col = this.reels[c]!;
    col.setStripY(y0);
    let reelStopped = false;
    let squashStart = 0;
    const t0 = performance.now();
    let prev = t0;

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.spinToken) {
          col.view.scale.y = 1;
          this.effectsLayer?.clearScatterAnticipation();
          this.effectsLayer?.stopAllSpeedLines();
          resolve();
          return;
        }
        const now = performance.now();
        const dt = Math.min(64, Math.max(0, now - prev));
        prev = now;

        const huntMul =
          this.config.animation.scatterAnticipationPendingReelSpeedMul ?? 1.48;
        const targetIdleMul =
          this.effectsLayer?.scatterAnticipationActive() === true ? huntMul : 1;
        const rampMs = this.config.animation.scatterAnticipationIdleRampMs ?? 420;
        const k = 1 - Math.exp(-dt / Math.max(72, rampMs));
        this.idleScrollMulSmoothed +=
          (targetIdleMul - this.idleScrollMulSmoothed) * k;
        for (let j = c + 1; j < reelsN; j++) {
          this.reels[j]!.advanceIdleScroll(
            dt,
            idleRowsPerSec * this.idleScrollMulSmoothed,
          );
        }

        const T = now - t0;
        if (T < tStop) {
          const tu = Math.min(1, T / tStop);
          const pos = this.reelStripEase(tu, scatterHuntHeavy, terminalSlowFrac);
          col.setStripY(y0 + (y1 - y0) * pos);

          const speedPhase =
            tu < 0.6 ? 0.7 * (1 - tu / 0.6) * (scatterHuntHeavy ? 0.85 : 1) : 0;
          this.effectsLayer?.startSpeedLines(c, speedPhase);
        } else {
          if (!reelStopped) {
            reelStopped = true;
            squashStart = T;
            hooks?.onSound?.('reel_stop');
            this.effectsLayer?.stopSpeedLines(c);
            this.effectsLayer?.triggerReelFlash(c);
          }
          const bounce = bounceOffset(
            T - tStop,
            this.cellSize * bounceCellFactor,
            0.017,
            0.0055,
          );
          col.setStripY(y1 + bounce);

          const squashT = T - squashStart;
          if (squashT < squashMs) {
            col.view.scale.y = this.computeSquash(squashT, squashMs);
          } else {
            col.view.scale.y = 1;
          }
        }
        if (T >= tStop + bounceWindow) {
          col.setStripY(y1);
          col.commitFocus(focusEnd);
          col.view.scale.y = 1;
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private async playAnticipation(
    token: number,
    durationMs: number,
    pullPx: number,
  ): Promise<void> {
    const reelsN = this.config.grid.reels;
    const startY: number[] = [];
    for (let c = 0; c < reelsN; c++) {
      startY.push(this.reels[c]!.stripY);
    }
    const t0 = performance.now();

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.spinToken) {
          resolve();
          return;
        }
        const T = performance.now() - t0;
        const u = Math.min(1, T / durationMs);
        const ease = Math.sin(u * Math.PI * 0.5);
        for (let c = 0; c < reelsN; c++) {
          this.reels[c]!.setStripY(startY[c]! - pullPx * ease);
        }
        if (u >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private computeSquash(t: number, duration: number): number {
    const u = Math.min(1, t / duration);
    if (u < 0.3) {
      return 1 - 0.035 * (u / 0.3);
    } else if (u < 0.6) {
      const v = (u - 0.3) / 0.3;
      return 0.965 + 0.05 * v;
    } else {
      const v = (u - 0.6) / 0.4;
      return 1.015 - 0.015 * v;
    }
  }

  private armWinLineSkip(): void {
    this.disarmWinLineSkip();
    this.winLineSkipRequested = false;
    const canvas = this.app?.canvas;
    if (!canvas) return;
    this.winLineSkipAbort = new AbortController();
    canvas.addEventListener(
      'pointerdown',
      () => {
        this.winLineSkipRequested = true;
      },
      { signal: this.winLineSkipAbort.signal, passive: true },
    );
  }

  private disarmWinLineSkip(): void {
    this.winLineSkipAbort?.abort();
    this.winLineSkipAbort = null;
    this.winLineSkipRequested = false;
  }

  private applyWinLineUnionHighlights(lines: SpinDisplayWinLine[]): void {
    this.highlightRowsByReel.clear();
    for (const line of lines) {
      for (const point of this.clampHighlights(line.points)) {
        if (!this.highlightRowsByReel.has(point.reel)) {
          this.highlightRowsByReel.set(point.reel, new Set());
        }
        this.highlightRowsByReel.get(point.reel)!.add(point.row);
      }
    }
  }

  setBet(bet: number): void {
    this.currentBet = Math.max(1, bet);
  }

  /** Nur Darstellung — Highlights aus Server/Mock. */
  async showWinFeedback(
    highlights: { reel: number; row: number }[],
    winAmount: number,
    winLines: SpinDisplayWinLine[] = [],
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    if (this.destroyed) return;
    if ((!highlights || highlights.length === 0) && winAmount <= 0) {
      return;
    }

    const tier = getWinTier(winAmount, this.currentBet);
    if (winAmount > 0) {
      hooks?.onSound?.('win');
    }

    const token = this.spinToken;
    this.isAnimating = true;
    try {
      this.highlightRowsByReel.clear();
      const clampedHighlights = this.clampHighlights(highlights);
      for (const h of clampedHighlights) {
        if (!this.highlightRowsByReel.has(h.reel)) {
          this.highlightRowsByReel.set(h.reel, new Set());
        }
        this.highlightRowsByReel.get(h.reel)!.add(h.row);
      }

      this.triggerSymbolPops(clampedHighlights);
      this.spawnWinParticles(clampedHighlights, tier);

      const sortedWinLines = this.sanitizeWinLines(winLines);
      if (sortedWinLines.length > 0) {
        this.armWinLineSkip();
        try {
          await this.playWinLineSequence(sortedWinLines, token);
        } finally {
          this.disarmWinLineSkip();
        }
        if (token !== this.spinToken || this.destroyed) return;
      }

      if (tier === 'big' || tier === 'mega') {
        hooks?.onShake?.(tier === 'mega' ? 'medium' : 'light');
        await this.bigWinLayer?.showBigWin(tier, winAmount);
        if (token !== this.spinToken || this.destroyed) return;
      } else if (tier === 'medium') {
        hooks?.onShake?.('light');
        await this.bigWinLayer?.showWinToast('medium', winAmount);
        if (token !== this.spinToken || this.destroyed) return;
      }

      const dur = tier === 'small' ? 1000 : 1400;
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (token !== this.spinToken || this.destroyed) {
            resolve();
            return;
          }
          const u = Math.min(1, (performance.now() - t0) / dur);
          this.winPulse = u;
          this.tickVisuals();
          if (u >= 1) {
            this.highlightRowsByReel.clear();
            this.winPulse = 0;
            this.effectsLayer?.clearParticles();
            this.tickVisuals();
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    } finally {
      this.isAnimating = false;
      this.flushPendingResize();
    }
  }

  /** Kurze Reveal-Phase: Bonus-Symbole auf dem Raster voller Glanz, danach Overlay (`GearsClashGame`). */
  async flashBonusSymbolReveal(reelStops: string[][]): Promise<void> {
    if (this.destroyed) return;
    const { reels, rows } = this.config.grid;
    const token = this.spinToken;
    this.bonusRevealRowsByReel.clear();
    for (let c = 0; c < reels; c++) {
      for (let r = 0; r < rows; r++) {
        const id = reelStops[c]?.[r];
        if (!id) continue;
        const def = this.registry.get(id);
        if (def?.kind !== 'bonus') continue;
        if (!this.bonusRevealRowsByReel.has(c)) {
          this.bonusRevealRowsByReel.set(c, new Set());
        }
        this.bonusRevealRowsByReel.get(c)!.add(r);
      }
    }
    if (this.bonusRevealRowsByReel.size === 0) {
      return;
    }

    this.isAnimating = true;
    try {
      const durMs = 820;
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (token !== this.spinToken || this.destroyed) {
            this.bonusRevealRowsByReel.clear();
            this.winPulse = 0;
            this.tickVisuals();
            resolve();
            return;
          }
          const u = Math.min(1, (performance.now() - t0) / durMs);
          this.winPulse = u;
          this.tickVisuals();
          if (u >= 1) {
            this.bonusRevealRowsByReel.clear();
            this.winPulse = 0;
            this.tickVisuals();
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    } finally {
      this.isAnimating = false;
      this.flushPendingResize();
    }
  }

  private triggerSymbolPops(highlights: { reel: number; row: number }[]): void {
    for (const h of highlights) {
      const reel = this.reels[h.reel];
      if (reel) {
        reel.triggerSymbolPop(h.row);
      }
    }
  }

  private spawnWinParticles(
    highlights: { reel: number; row: number }[],
    tier: WinTier,
  ): void {
    const countPerSymbol = tier === 'mega' ? 12 : tier === 'big' ? 10 : tier === 'medium' ? 8 : 6;
    for (const h of highlights) {
      this.effectsLayer?.spawnSymbolBurst(h.reel, h.row, countPerSymbol);
    }
  }

  private clampHighlights(
    highlights: { reel: number; row: number }[],
  ): { reel: number; row: number }[] {
    const { reels, rows } = this.config.grid;
    return (highlights ?? []).filter(
      (h) => h.reel >= 0 && h.reel < reels && h.row >= 0 && h.row < rows,
    );
  }

  private sanitizeWinLines(lines: SpinDisplayWinLine[]): SpinDisplayWinLine[] {
    const { reels, rows } = this.config.grid;
    return [...lines]
      .filter(
        (line) =>
          Array.isArray(line.points) && line.points.length >= 2 && line.amount > 0,
      )
      .map((line) => ({
        ...line,
        points: line.points.filter(
          (p) => p.reel >= 0 && p.reel < reels && p.row >= 0 && p.row < rows,
        ),
      }))
      .filter((line) => line.points.length >= 2)
      .sort((a, b) => b.amount - a.amount);
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
    if (!this.gearsClashAnim || this.destroyed) return;
    const targetReel = payload.winnerReel ?? 0;
    this.gearsClashAnim.start(payload, targetReel, {
      onComplete: () => {
        // Animation abgeschlossen
      },
      onSound: hooks?.onSound,
    });
  }

  private tickVisuals(): void {
    const t = this.animClock;
    this.atmosphereLayer?.paint(t, this.lastDtSec, this.isAnimating);
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
    const { reels, rows } = this.config.grid;

    if (!this.slotFrameNatW || !this.slotFrameNatH || this.slotFrameLoadFailed) {
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
      const totalH = Math.ceil(gridH + pad * 2);
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
      };
    }

    const natW = this.slotFrameNatW;
    const natH = this.slotFrameNatH;
    const totalW = rawW;
    const totalH = Math.ceil((natH / natW) * totalW);

    const innerX = SLOT_FRAME_GRID_NORM.x * totalW;
    const innerY = SLOT_FRAME_GRID_NORM.y * totalH;
    const innerW = SLOT_FRAME_GRID_NORM.w * totalW;
    const innerH = SLOT_FRAME_GRID_NORM.h * totalH;

    const gap = Math.max(2, Math.min(6, Math.floor(innerW * 0.007)));
    const cellFromW = (innerW - gap * (reels - 1)) / reels;
    const cellFromH = innerH / rows - ROW_GAP;
    let cellSize = Math.floor(Math.min(cellFromW, cellFromH));
    cellSize = Math.max(40, Math.min(cellSize, 168));
    cellSize = Math.max(40, Math.floor(cellSize * SLOT_GRID_SYMBOL_SCALE));
    const pitch = cellSize + ROW_GAP;
    const actualGridW = reels * cellSize + (reels - 1) * gap;
    const actualGridH = rows * pitch;
    const offsetX =
      innerX +
      Math.floor((innerW - actualGridW) / 2) +
      SLOT_FRAME_GRID_NUDGE_NORM.dx * totalW;
    const offsetY =
      innerY +
      Math.floor((innerH - actualGridH) / 2) +
      SLOT_FRAME_GRID_NUDGE_NORM.dy * totalH;
    const gridMaskRadius = Math.max(3, Math.min(12, Math.floor(cellSize * 0.09)));

    return {
      totalW,
      totalH,
      cellSize,
      gap,
      pad: 0,
      offsetX,
      offsetY,
      visibleH: actualGridH,
      gridInnerX: innerX,
      gridInnerY: innerY,
      gridInnerW: innerW,
      gridInnerH: innerH,
      gridMaskRadius,
    };
  }

  private applyMetrics(layout: ReturnType<typeof this.computeLayout>): void {
    this.cellSize = layout.cellSize;
    this.gap = layout.gap;
    this.pad = layout.pad;
    if (this.parentEl) {
      this.parentEl.style.aspectRatio = `${layout.totalW} / ${layout.totalH}`;
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

    this.mountSlotBackgroundIfReady(layout);

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
      col.layout(c, layout.cellSize, layout.gap, visibleH);
      gridLayer.addChild(col.view);
      this.reels.push(col);
    }

    const effects = new EffectsLayer();
    effects.layout(layout.cellSize, layout.gap, reels, gridW, visibleH);
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

    this.applyPresentationToLayers();

    this.mountSlotFrameIfReady(layout);

    if (this.gearsClashAnim) {
      this.root.addChild(this.gearsClashAnim.getView());
      this.gearsClashAnim.setLayout(
        layout.cellSize,
        layout.gap,
        layout.offsetX,
        layout.offsetY,
      );
    }
  }

  private async loadSlotFrameTextureMeta(): Promise<void> {
    if (this.destroyed || this.slotFrameLoadFailed || this.slotFrameSourceTex) return;
    const url = '/assets/slot_frame.png';
    try {
      const tex = await Assets.load<Texture>(url);
      if (this.destroyed) {
        void Assets.unload(url);
        return;
      }
      this.slotFrameUnloadUrl = url;
      this.slotFrameSourceTex = tex;
      this.slotFrameNatW = Math.max(1, tex.width);
      this.slotFrameNatH = Math.max(1, tex.height);
      const sp = new Sprite(tex);
      sp.eventMode = 'none';
      sp.zIndex = 25;
      this.slotFrameSprite = sp;
    } catch {
      this.slotFrameLoadFailed = true;
      console.warn(
        '[PixiSlotRenderer] slot_frame.png nicht geladen — Layout ohne PNG-Rahmen.',
      );
    }
  }

  /**
   * Hintergrundtextur nur im Raster-Innenrechteck (hinter Symbolen, unter Atmosphäre).
   */
  private async ensureSlotBackgroundOverlay(
    layout: ReturnType<typeof this.computeLayout>,
  ): Promise<void> {
    if (this.destroyed || this.slotBackgroundLoadFailed) return;
    const url = '/assets/slot_background.png';
    if (!this.slotBackgroundSprite) {
      try {
        const tex = await Assets.load<Texture>(url);
        if (this.destroyed) {
          void Assets.unload(url);
          return;
        }
        this.slotBackgroundUnloadUrl = url;
        const sp = new Sprite(tex);
        sp.eventMode = 'none';
        sp.zIndex = -15;
        this.slotBackgroundSprite = sp;
      } catch {
        this.slotBackgroundLoadFailed = true;
        console.warn(
          '[PixiSlotRenderer] slot_background.png nicht geladen — Fallback-Hintergrundfarbe.',
        );
        return;
      }
    }
    this.mountSlotBackgroundIfReady(layout);
  }

  private mountSlotBackgroundIfReady(layout: ReturnType<typeof this.computeLayout>): void {
    if (!this.root || !this.slotBackgroundSprite) return;
    this.root.addChild(this.slotBackgroundSprite);
    this.layoutSlotBackground(layout);
  }

  private layoutSlotBackground(layout: ReturnType<typeof this.computeLayout>): void {
    const sp = this.slotBackgroundSprite;
    if (!sp?.texture?.width) return;
    const nw = sp.texture.width;
    const nh = sp.texture.height;
    const targetW = layout.gridInnerW;
    const targetH = layout.gridInnerH;
    const scale = Math.max(targetW / nw, targetH / nh);
    sp.scale.set(scale);
    const w = nw * scale;
    const h = nh * scale;
    sp.position.set(
      layout.gridInnerX + (targetW - w) * 0.5,
      layout.gridInnerY + (targetH - h) * 0.5,
    );
  }

  private mountSlotFrameIfReady(layout: ReturnType<typeof this.computeLayout>): void {
    if (!this.root || !this.slotFrameSprite) return;
    this.root.addChild(this.slotFrameSprite);
    this.layoutSlotFrame(layout);
  }

  private layoutSlotFrame(layout: ReturnType<typeof this.computeLayout>): void {
    const sp = this.slotFrameSprite;
    if (!sp?.texture?.width) return;
    const nw = sp.texture.width;
    const nh = sp.texture.height;
    const s = layout.totalW / nw;
    sp.scale.set(s);
    const h = nh * s;
    sp.position.set(0, Math.floor((layout.totalH - h) * 0.5));
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
    this.winlinePath?.clear();
    if (this.winlineLabel) {
      this.winlineLabel.visible = false;
      this.winlineLabel.text = '';
    }
  }

  private async playWinLineSequence(
    lines: SpinDisplayWinLine[],
    token: number,
  ): Promise<void> {
    for (const line of lines) {
      if (token !== this.spinToken || this.destroyed) return;
      if (this.winLineSkipRequested) {
        this.applyWinLineUnionHighlights(lines);
        break;
      }
      this.highlightRowsByReel.clear();
      for (const point of line.points) {
        if (!this.highlightRowsByReel.has(point.reel)) {
          this.highlightRowsByReel.set(point.reel, new Set());
        }
        this.highlightRowsByReel.get(point.reel)!.add(point.row);
      }
      this.triggerSymbolPops(this.clampHighlights(line.points));
      await this.animateSingleWinLine(line, token);
    }
    this.clearWinlineOverlay();
  }

  private async animateSingleWinLine(
    line: SpinDisplayWinLine,
    token: number,
  ): Promise<void> {
    const points = line.points
      .map((p) => this.toCellCenter(p.reel, p.row))
      .filter((p): p is { x: number; y: number } => p !== null);
    if (points.length < 2 || !this.winlinePath || !this.winlineLabel) return;

    const label = this.winlineLabel;
    const drawMs = 520;
    const holdMs = 420;
    const fadeMs = 220;
    const totalMs = drawMs + holdMs + fadeMs;
    const t0 = performance.now();
    label.visible = true;

    const amountText =
      Number.isInteger(line.amount) ? `${line.amount}` : line.amount.toFixed(2);
    label.text = line.label
      ? `${line.label}  +${amountText}`
      : `Line Win +${amountText}`;
    const center = polylineCenter(points);
    label.position.set(center.x, center.y - Math.max(16, this.cellSize * 0.45));

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.spinToken || this.destroyed) {
          resolve();
          return;
        }
        if (this.winLineSkipRequested) {
          this.winPulse = 1;
          this.tickVisuals();
          this.clearWinlineOverlay();
          resolve();
          return;
        }
        const t = performance.now() - t0;
        const drawU = Math.max(0, Math.min(1, t / drawMs));
        const alpha =
          t <= drawMs + holdMs
            ? 1
            : Math.max(0, 1 - (t - drawMs - holdMs) / fadeMs);
        this.winPulse = drawU;
        this.tickVisuals();
        this.drawWinlinePath(points, drawU, alpha);
        label.alpha = alpha;

        if (t >= totalMs) {
          this.clearWinlineOverlay();
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private drawWinlinePath(
    points: { x: number; y: number }[],
    progress: number,
    alpha: number,
  ): void {
    if (!this.winlinePath) return;
    const path = this.winlinePath;
    path.clear();
    if (points.length < 2 || progress <= 0 || alpha <= 0) return;
    const visible = slicePolyline(points, progress);
    if (visible.length < 2) return;

    path.moveTo(visible[0]!.x, visible[0]!.y);
    for (let i = 1; i < visible.length; i++) {
      path.lineTo(visible[i]!.x, visible[i]!.y);
    }
    path.stroke({
      width: Math.max(3, Math.floor(this.cellSize * 0.09)),
      color: 0xffcf4d,
      alpha: 0.28 * alpha,
      cap: 'round',
      join: 'round',
    });
    path.stroke({
      width: Math.max(2, Math.floor(this.cellSize * 0.045)),
      color: 0xfff2a6,
      alpha: 0.95 * alpha,
      cap: 'round',
      join: 'round',
    });
  }

  private toCellCenter(reel: number, row: number): { x: number; y: number } | null {
    if (reel < 0 || row < 0 || reel >= this.config.grid.reels || row >= this.config.grid.rows) {
      return null;
    }
    const pitch = this.cellSize + ROW_GAP;
    const x = reel * (this.cellSize + this.gap) + this.cellSize / 2;
    const y = row * pitch + pitch / 2;
    return { x, y };
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

/** Früh leicht beschleunigen, dann ausrollen. */
function easeInCubicEarly(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.12) return (u / 0.12) * 0.08;
  return 0.08 + (u - 0.12) * (0.92 / 0.88);
}

function polylineCenter(points: { x: number; y: number }[]): { x: number; y: number } {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function slicePolyline(
  points: { x: number; y: number }[],
  progress: number,
): { x: number; y: number }[] {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return [];
  if (p >= 1) return points.map((pt) => ({ ...pt }));
  const segments: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    const len = Math.hypot(dx, dy);
    segments.push(len);
    total += len;
  }
  if (total <= 0) return [points[0]!];
  let remaining = total * p;
  const out: { x: number; y: number }[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length; i++) {
    const seg = segments[i - 1]!;
    const prev = points[i - 1]!;
    const next = points[i]!;
    if (remaining >= seg) {
      out.push({ ...next });
      remaining -= seg;
      continue;
    }
    if (seg > 0) {
      const t = remaining / seg;
      out.push({
        x: prev.x + (next.x - prev.x) * t,
        y: prev.y + (next.y - prev.y) * t,
      });
    }
    break;
  }
  return out;
}
