import { Application, Container, Graphics } from 'pixi.js';
import type { GameConfig } from '../config/types';
import { SymbolRegistry } from '../core/SymbolRegistry';
import { AnimationController } from './AnimationController';
import { bounceOffset, easeOutQuart } from './easing';
import { ReelColumn } from './ReelColumn';

export interface PixiSlotRendererHooks {
  onSound?: (id: string) => void;
  /** Leichtes Shake am Host (CSS-Klasse). */
  onShake?: (kind: 'light' | 'medium') => void;
}

/**
 * 5 unabhängige Reels, Masken-Strip, Easing + Bounce, prozedurale Symbole.
 */
export class PixiSlotRenderer {
  private app: Application | null = null;
  private root: Container | null = null;
  private reels: ReelColumn[] = [];
  private dividers: Graphics | null = null;
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

  constructor(private readonly config: GameConfig) {
    this.registry = new SymbolRegistry(config);
    this.anim = new AnimationController(config);
  }

  async init(parent: HTMLElement): Promise<void> {
    this.parentEl = parent;
    this.lastStops = this.defaultStops();

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
    root.position.set(layout.offsetX, layout.offsetY);
    app.stage.addChild(root);
    this.root = root;

    this.buildReels(layout);
    this.syncAllColumnsFromStops(this.lastStops);

    this.tickerFn = () => {
      const dt =
        this.app?.ticker.deltaMS ??
        (typeof this.app?.ticker.deltaTime === 'number'
          ? this.app.ticker.deltaTime * (1000 / 60)
          : 16);
      this.animClock += dt / 1000;
      this.tickVisuals();
    };
    app.ticker.add(this.tickerFn);

    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(parent);
  }

  destroy(): void {
    this.spinToken++;
    if (this.app && this.tickerFn) {
      this.app.ticker.remove(this.tickerFn);
    }
    this.tickerFn = null;
    if (this.resizeObserver && this.parentEl) {
      this.resizeObserver.unobserve(this.parentEl);
    }
    this.resizeObserver = null;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = null;
    this.parentEl = null;
    this.app?.destroy(true);
    this.app = null;
    this.root = null;
    this.reels = [];
    this.dividers = null;
    this.lastStops = null;
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    this.tickVisuals();
  }

  setGridFromStops(reelStops: string[][]): void {
    this.lastStops = reelStops.map((col) => [...col]);
    this.syncAllColumnsFromStops(this.lastStops);
  }

  async playSpinAnimation(
    reelStops: string[][],
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    const token = ++this.spinToken;
    const params = this.anim.getParams();
    if (params.turbo) {
      await this.playSpinTurbo(reelStops, hooks, token, params);
    } else {
      await this.playSpinSequential(reelStops, hooks, token, params);
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
    const pitch = this.cellSize + 3;
    const extraRows = params.reelApproachExtraRows;

    const prep: {
      y0: number;
      y1: number;
      focusEnd: number;
      tStop: number;
    }[] = [];

    for (let c = 0; c < reelsN; c++) {
      const col = reelStops[c] ?? reelStops[0]!;
      const p = this.reels[c]!.prepareSpinTargets(col, { turbo: true });
      const y0 = Math.min(p.y0, p.y1 - extraRows * pitch);
      prep.push({
        y0,
        y1: p.y1,
        focusEnd: p.focusEnd,
        tStop: baseStop + c * params.reelStopStaggerMs,
      });
    }

    const maxStop = Math.max(...prep.map((p) => p.tStop));
    const bounceWindow = 380;
    const t0 = performance.now();
    const stopped = new Array(reelsN).fill(false);

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.spinToken) {
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
          } else {
            if (!stopped[c]) {
              stopped[c] = true;
              hooks?.onSound?.('reel_stop');
            }
            const after = T - p.tStop;
            const bounce = bounceOffset(after, this.cellSize * 0.09, 0.11, 0.006);
            col.setStripY(p.y1 + bounce);
          }
        }
        if (T >= maxStop + bounceWindow) {
          for (let c = 0; c < reelsN; c++) {
            const p = prep[c]!;
            this.reels[c]!.setStripY(p.y1);
            this.reels[c]!.commitFocus(p.focusEnd);
          }
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
    const pitch = this.cellSize + 3;
    const tStop = params.reelSequentialDurationMs;
    const bounceWindow = 360;
    const extraRows = params.reelApproachExtraRows;
    const idleRowsPerSec = params.reelIdleScrollRowsPerSec;

    for (let i = 0; i < reelsN; i++) {
      this.reels[i]!.resetIdleScrollBeforePrepare();
    }

    for (let c = 0; c < reelsN; c++) {
      if (token !== this.spinToken) return;
      const colStops = reelStops[c] ?? reelStops[0]!;
      this.reels[c]!.resetIdleScrollBeforePrepare();
      const p = this.reels[c]!.prepareSpinTargets(colStops, { turbo: false });
      let y0 = p.y0;
      const y1 = p.y1;
      y0 = Math.min(y0, y1 - extraRows * pitch);
      await this.springOneReel(
        c,
        y0,
        y1,
        p.focusEnd,
        tStop,
        bounceWindow,
        token,
        hooks,
        0.11,
        reelsN,
        idleRowsPerSec,
      );
    }
    this.setGridFromStops(reelStops);
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
  ): Promise<void> {
    const col = this.reels[c]!;
    col.setStripY(y0);
    let reelStopped = false;
    const t0 = performance.now();
    let prev = t0;

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.spinToken) {
          resolve();
          return;
        }
        const now = performance.now();
        const dt = Math.min(64, Math.max(0, now - prev));
        prev = now;

        for (let j = c + 1; j < reelsN; j++) {
          this.reels[j]!.advanceIdleScroll(dt, idleRowsPerSec);
        }

        const T = now - t0;
        if (T < tStop) {
          const u = easeInCubicEarly(T / tStop);
          col.setStripY(y0 + (y1 - y0) * easeOutQuart(u));
        } else {
          if (!reelStopped) {
            reelStopped = true;
            hooks?.onSound?.('reel_stop');
          }
          const bounce = bounceOffset(
            T - tStop,
            this.cellSize * bounceCellFactor,
            0.11,
            0.006,
          );
          col.setStripY(y1 + bounce);
        }
        if (T >= tStop + bounceWindow) {
          col.setStripY(y1);
          col.commitFocus(focusEnd);
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** Nur Darstellung — Highlights aus Server/Mock. */
  async showWinFeedback(
    highlights: { reel: number; row: number }[],
    winAmount: number,
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    if ((!highlights || highlights.length === 0) && winAmount <= 0) {
      return;
    }
    if (winAmount > 0) {
      hooks?.onSound?.('win');
    }
    this.highlightRowsByReel.clear();
    for (const h of highlights) {
      if (!this.highlightRowsByReel.has(h.reel)) {
        this.highlightRowsByReel.set(h.reel, new Set());
      }
      this.highlightRowsByReel.get(h.reel)!.add(h.row);
    }
    if (winAmount > 80) {
      hooks?.onShake?.('light');
    }
    const dur = 1400;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / dur);
        this.winPulse = u;
        this.tickVisuals();
        if (u >= 1) {
          this.highlightRowsByReel.clear();
          this.winPulse = 0;
          this.tickVisuals();
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private tickVisuals(): void {
    const t = this.animClock;
    for (let c = 0; c < this.reels.length; c++) {
      const rows = this.highlightRowsByReel.get(c) ?? new Set<number>();
      this.reels[c]!.paintAll(t, {
        highlightRows: rows,
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

  private handleResize(): void {
    if (!this.app || !this.root || !this.parentEl) return;
    const layout = this.computeLayout();
    const changed =
      layout.cellSize !== this.cellSize ||
      layout.totalW !== this.app.renderer.width ||
      layout.totalH !== this.app.renderer.height;

    if (!changed) return;

    this.applyMetrics(layout);
    this.app.renderer.resize(layout.totalW, layout.totalH);
    this.root.position.set(layout.offsetX, layout.offsetY);
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
  } {
    const parent = this.parentEl;
    const rawW = parent ? Math.max(260, Math.floor(parent.clientWidth)) : 360;
    const pad = Math.max(14, Math.floor(rawW * 0.04));
    const inner = Math.max(220, rawW - pad * 2);
    const { reels, rows } = this.config.grid;
    const gap = Math.max(5, Math.min(12, Math.floor(inner * 0.014)));
    const cell = Math.floor((inner - gap * (reels - 1)) / reels);
    const cellSize = Math.max(46, Math.min(cell, 118));
    const pitch = cellSize + 3;
    const gridW = reels * cellSize + gap * (reels - 1);
    const gridH = rows * pitch;
    const totalW = rawW;
    const totalH = Math.ceil(gridH + pad * 2);
    const offsetX = Math.floor((totalW - gridW) / 2);
    const offsetY = Math.floor((totalH - gridH) / 2);
    return { totalW, totalH, cellSize, gap, pad, offsetX, offsetY, visibleH: gridH };
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
    this.root.removeChildren();
    this.reels = [];
    const { reels, rows } = this.config.grid;
    const visibleH = layout.visibleH;
    for (let c = 0; c < reels; c++) {
      const col = new ReelColumn(this.config, this.registry);
      col.layout(c, layout.cellSize, layout.gap, visibleH);
      this.root.addChild(col.view);
      this.reels.push(col);
    }
    this.drawDividers(layout, reels, rows);
  }

  private drawDividers(
    layout: ReturnType<typeof this.computeLayout>,
    reels: number,
    rows: number,
  ): void {
    if (!this.root) return;
    const g = new Graphics();
    const pitch = layout.cellSize + 3;
    const h = rows * pitch;
    for (let c = 1; c < reels; c++) {
      const x = c * (layout.cellSize + layout.gap) - layout.gap * 0.45;
      g.moveTo(x, -2);
      g.lineTo(x, h + 2);
      g.stroke({ width: 2, color: 0x000000, alpha: 0.55 });
      g.moveTo(x + 1, -2);
      g.lineTo(x + 1, h + 2);
      g.stroke({ width: 1, color: 0x3a3530, alpha: 0.35 });
    }
    this.root.addChild(g);
    this.dividers = g;
  }

  private syncAllColumnsFromStops(reelStops: string[][]): void {
    for (let c = 0; c < this.reels.length; c++) {
      const col = reelStops[c];
      if (col) this.reels[c]!.syncVisibleColumn(col);
    }
    this.tickVisuals();
  }

  private defaultStops(): string[][] {
    const id = this.registry.get('bolt') ? 'bolt' : this.registry.allIds[0] ?? 'bolt';
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
