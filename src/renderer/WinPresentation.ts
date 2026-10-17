import type { SpinDisplayWinLine } from '../config/types';
import { getWinTier, type WinTier } from './BigWinLayer';
import { ROW_GAP } from './ReelColumn';
import type { PixiSlotRendererHooks, RendererStage } from './rendererStage';

type Cell = { reel: number; row: number };
type Point = { x: number; y: number };

/**
 * Gewinn-Darstellung: Symbol-Highlights, Winline-Sequenz, Big-Win-Banner und
 * der Bonus-Symbol-Reveal vor dem Bonus-Overlay.
 *
 * Rechnet nichts aus — Beträge, Highlights und Linien kommen aus `SpinResult`.
 */
export class WinPresentation {
  private skipAbort: AbortController | null = null;
  private skipRequested = false;

  constructor(private readonly stage: RendererStage) {}

  async showWinFeedback(
    highlights: Cell[],
    winAmount: number,
    winLines: SpinDisplayWinLine[] = [],
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    const stage = this.stage;
    if (stage.destroyed) return;
    if ((!highlights || highlights.length === 0) && winAmount <= 0) return;

    const tier = getWinTier(winAmount, stage.currentBet);
    if (winAmount > 0) {
      hooks?.onSound?.('win');
    }

    const token = stage.spinToken;
    stage.setAnimating(true);
    try {
      const clamped = this.clampHighlights(highlights);
      this.setHighlights(clamped);
      this.triggerSymbolPops(clamped);
      this.spawnWinParticles(clamped, tier);

      const sortedWinLines = this.sanitizeWinLines(winLines);
      if (sortedWinLines.length > 0) {
        this.armSkip();
        try {
          await this.playWinLineSequence(sortedWinLines, token);
        } finally {
          this.disarmSkip();
        }
        if (token !== stage.spinToken || stage.destroyed) return;
      }

      if (tier === 'big' || tier === 'mega') {
        hooks?.onShake?.(tier === 'mega' ? 'medium' : 'light');
        await stage.bigWin?.showBigWin(tier, winAmount);
        if (token !== stage.spinToken || stage.destroyed) return;
      } else if (tier === 'medium') {
        hooks?.onShake?.('light');
        await stage.bigWin?.showWinToast('medium', winAmount);
        if (token !== stage.spinToken || stage.destroyed) return;
      }

      await this.pulseHighlights(tier === 'small' ? 1000 : 1400, token);
    } finally {
      stage.setAnimating(false);
      stage.flushPendingResize();
    }
  }

  /** Kurze Reveal-Phase: Bonus-Symbole auf dem Raster voller Glanz, danach Overlay. */
  async flashBonusSymbolReveal(reelStops: string[][]): Promise<void> {
    const stage = this.stage;
    if (stage.destroyed) return;
    const { reels, rows } = stage.config.grid;
    const token = stage.spinToken;
    stage.bonusRevealRowsByReel.clear();
    for (let c = 0; c < reels; c++) {
      for (let r = 0; r < rows; r++) {
        const id = reelStops[c]?.[r];
        if (!id || !stage.isBonusSymbol(id)) continue;
        if (!stage.bonusRevealRowsByReel.has(c)) {
          stage.bonusRevealRowsByReel.set(c, new Set());
        }
        stage.bonusRevealRowsByReel.get(c)!.add(r);
      }
    }
    if (stage.bonusRevealRowsByReel.size === 0) return;

    stage.setAnimating(true);
    try {
      const durMs = 820;
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const finish = (): void => {
          stage.bonusRevealRowsByReel.clear();
          stage.setWinPulse(0);
          stage.tickVisuals();
          resolve();
        };
        const step = () => {
          if (token !== stage.spinToken || stage.destroyed) {
            finish();
            return;
          }
          const u = Math.min(1, (performance.now() - t0) / durMs);
          stage.setWinPulse(u);
          stage.tickVisuals();
          if (u >= 1) {
            finish();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    } finally {
      stage.setAnimating(false);
      stage.flushPendingResize();
    }
  }

  clearWinlineOverlay(): void {
    this.stage.winlinePath?.clear();
    const label = this.stage.winlineLabel;
    if (label) {
      label.visible = false;
      label.text = '';
    }
  }

  disarmSkip(): void {
    this.skipAbort?.abort();
    this.skipAbort = null;
    this.skipRequested = false;
  }

  // ------------------------------------------------------------------ intern

  private pulseHighlights(durationMs: number, token: number): Promise<void> {
    const stage = this.stage;
    const t0 = performance.now();
    return new Promise<void>((resolve) => {
      const step = () => {
        if (token !== stage.spinToken || stage.destroyed) {
          resolve();
          return;
        }
        const u = Math.min(1, (performance.now() - t0) / durationMs);
        stage.setWinPulse(u);
        stage.tickVisuals();
        if (u >= 1) {
          stage.highlightRowsByReel.clear();
          stage.setWinPulse(0);
          stage.effects?.clearParticles();
          stage.tickVisuals();
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private armSkip(): void {
    this.disarmSkip();
    const canvas = this.stage.canvas;
    if (!canvas) return;
    this.skipAbort = new AbortController();
    canvas.addEventListener(
      'pointerdown',
      () => {
        this.skipRequested = true;
      },
      { signal: this.skipAbort.signal, passive: true },
    );
  }

  private setHighlights(cells: Cell[]): void {
    const map = this.stage.highlightRowsByReel;
    map.clear();
    for (const cell of cells) {
      if (!map.has(cell.reel)) map.set(cell.reel, new Set());
      map.get(cell.reel)!.add(cell.row);
    }
  }

  private triggerSymbolPops(highlights: Cell[]): void {
    for (const h of highlights) {
      this.stage.reels[h.reel]?.triggerSymbolPop(h.row);
    }
  }

  private spawnWinParticles(highlights: Cell[], tier: WinTier): void {
    const countPerSymbol =
      tier === 'mega' ? 12 : tier === 'big' ? 10 : tier === 'medium' ? 8 : 6;
    for (const h of highlights) {
      this.stage.effects?.spawnSymbolBurst(h.reel, h.row, countPerSymbol);
    }
  }

  private clampHighlights(highlights: Cell[]): Cell[] {
    const { reels, rows } = this.stage.config.grid;
    return (highlights ?? []).filter(
      (h) => h.reel >= 0 && h.reel < reels && h.row >= 0 && h.row < rows,
    );
  }

  private sanitizeWinLines(lines: SpinDisplayWinLine[]): SpinDisplayWinLine[] {
    const { reels, rows } = this.stage.config.grid;
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

  private async playWinLineSequence(
    lines: SpinDisplayWinLine[],
    token: number,
  ): Promise<void> {
    for (const line of lines) {
      if (token !== this.stage.spinToken || this.stage.destroyed) return;
      if (this.skipRequested) {
        // Abkürzung: alle Linien gleichzeitig hervorheben statt weiter abzuspielen.
        this.setHighlights(lines.flatMap((l) => this.clampHighlights(l.points)));
        break;
      }
      this.setHighlights(line.points);
      this.triggerSymbolPops(this.clampHighlights(line.points));
      await this.animateSingleWinLine(line, token);
    }
    this.clearWinlineOverlay();
  }

  private async animateSingleWinLine(
    line: SpinDisplayWinLine,
    token: number,
  ): Promise<void> {
    const stage = this.stage;
    const points = line.points
      .map((p) => this.toCellCenter(p.reel, p.row))
      .filter((p): p is Point => p !== null);
    const path = stage.winlinePath;
    const label = stage.winlineLabel;
    if (points.length < 2 || !path || !label) return;

    const drawMs = 520;
    const holdMs = 420;
    const fadeMs = 220;
    const totalMs = drawMs + holdMs + fadeMs;
    const t0 = performance.now();
    label.visible = true;

    const amountText = Number.isInteger(line.amount)
      ? `${line.amount}`
      : line.amount.toFixed(2);
    label.text = line.label
      ? `${line.label}  +${amountText}`
      : `Line Win +${amountText}`;
    const center = polylineCenter(points);
    label.position.set(center.x, center.y - Math.max(16, stage.cellSize * 0.45));

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== stage.spinToken || stage.destroyed) {
          resolve();
          return;
        }
        if (this.skipRequested) {
          stage.setWinPulse(1);
          stage.tickVisuals();
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
        stage.setWinPulse(drawU);
        stage.tickVisuals();
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

  private drawWinlinePath(points: Point[], progress: number, alpha: number): void {
    const path = this.stage.winlinePath;
    if (!path) return;
    path.clear();
    if (points.length < 2 || progress <= 0 || alpha <= 0) return;
    const visible = slicePolyline(points, progress);
    if (visible.length < 2) return;

    path.moveTo(visible[0]!.x, visible[0]!.y);
    for (let i = 1; i < visible.length; i++) {
      path.lineTo(visible[i]!.x, visible[i]!.y);
    }
    path.stroke({
      width: Math.max(3, Math.floor(this.stage.cellSize * 0.09)),
      color: 0xffcf4d,
      alpha: 0.28 * alpha,
      cap: 'round',
      join: 'round',
    });
    path.stroke({
      width: Math.max(2, Math.floor(this.stage.cellSize * 0.045)),
      color: 0xfff2a6,
      alpha: 0.95 * alpha,
      cap: 'round',
      join: 'round',
    });
  }

  private toCellCenter(reel: number, row: number): Point | null {
    const { grid } = this.stage.config;
    if (reel < 0 || row < 0 || reel >= grid.reels || row >= grid.rows) return null;
    const pitch = this.stage.cellSize + ROW_GAP;
    return {
      x: reel * (this.stage.cellSize + this.stage.gap) + this.stage.cellSize / 2,
      y: row * pitch + pitch / 2,
    };
  }
}

function polylineCenter(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function slicePolyline(points: Point[], progress: number): Point[] {
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
  const out: Point[] = [{ ...points[0]! }];
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
