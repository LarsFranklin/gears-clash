import { Container, Graphics } from 'pixi.js';
import type { HeistRunStickyWild } from '../config/types';
import type { GcFxQuality } from '../util/layoutMode';
import { ROW_GAP } from './ReelColumn';

const MAX_SPEED_LINES_CAP = 6;
const MAX_PARTICLES_ULTRA = 120;

interface SpeedLine {
  x: number;
  y: number;
  length: number;
  alpha: number;
  speed: number;
}

interface ReelFlash {
  reelIndex: number;
  x: number;
  width: number;
  height: number;
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

/**
 * Effects layer for spin animations: speed-lines, reel-lock flashes, etc.
 */
export class EffectsLayer {
  readonly view = new Container();

  private speedLinesG = new Graphics();
  private scatterGlowG = new Graphics();
  private flashG = new Graphics();
  private bonusMarksG = new Graphics();
  private particlesG = new Graphics();

  private speedLines: Map<number, SpeedLine[]> = new Map();
  private reelFlashes: ReelFlash[] = [];
  private particles: Particle[] = [];
  /** Walzen mit noch nicht eingerolltem Scatter-Potenzial („2 gleiche schon gelandet"). */
  private scatterAnticipationReels = new Set<number>();

  private scatterPhaseMs = 0;
  private scatterSparkAccMs = 0;

  /** Full-Reel-Wild nach Gears-Clash-Sieger (nur Anzeige). */
  private fullReelWild: { reel: number; multiplier?: number } | null = null;
  /** Sticky-Wild-Markierungen während Heist Run. */
  private stickyWilds: HeistRunStickyWild[] = [];
  private bonusPulseMs = 0;

  private particleCap = 80;
  private speedLineCap = 4;
  private scatterBurstChance = 0.45;

  private gridW = 400;
  private gridH = 400;
  private cellSize = 76;
  private gap = 8;
  private reelCount = 5;
  private reducedMotion = false;

  constructor() {
    this.view.eventMode = 'none';
    this.view.zIndex = 15;
    this.view.addChild(
      this.speedLinesG,
      this.scatterGlowG,
      this.flashG,
      this.bonusMarksG,
      this.particlesG,
    );

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  setFxQuality(q: GcFxQuality): void {
    const map = {
      low: { particles: 36, lines: 2, scatter: 0.22 },
      medium: { particles: 64, lines: 4, scatter: 0.38 },
      high: { particles: 96, lines: 5, scatter: 0.5 },
      ultra: { particles: MAX_PARTICLES_ULTRA, lines: MAX_SPEED_LINES_CAP, scatter: 0.58 },
    }[q];
    this.particleCap = map.particles;
    this.speedLineCap = map.lines;
    this.scatterBurstChance = map.scatter;
    if (this.particles.length > this.particleCap) {
      this.particles.length = this.particleCap;
    }
  }

  layout(
    cellSize: number,
    gap: number,
    reelCount: number,
    gridW: number,
    gridH: number,
  ): void {
    this.cellSize = cellSize;
    this.gap = gap;
    this.reelCount = reelCount;
    this.gridW = gridW;
    this.gridH = gridH;
  }

  startSpeedLines(reelIndex: number, intensity: number): void {
    if (intensity <= 0) {
      this.speedLines.delete(reelIndex);
      return;
    }

    const lines: SpeedLine[] = [];
    const reelX = reelIndex * (this.cellSize + this.gap);
    const lineCount = Math.min(
      this.speedLineCap,
      Math.floor(2 + intensity * Math.max(1, this.speedLineCap - 1)),
    );

    for (let i = 0; i < lineCount; i++) {
      lines.push({
        x: reelX + Math.random() * this.cellSize,
        y: Math.random() * this.gridH,
        length: 20 + Math.random() * 40 * intensity,
        alpha: 0.15 + Math.random() * 0.25 * intensity,
        speed: 800 + Math.random() * 600,
      });
    }
    this.speedLines.set(reelIndex, lines);
  }

  stopSpeedLines(reelIndex: number): void {
    this.speedLines.delete(reelIndex);
  }

  stopAllSpeedLines(): void {
    this.speedLines.clear();
  }

  /** Aktive Scatter-Jagd: goldene Frames + Funken auf noch rollenden Walzen. */
  setScatterAnticipationReels(indices: readonly number[]): void {
    this.scatterAnticipationReels = new Set(indices);
    if (this.scatterAnticipationReels.size === 0) {
      this.scatterGlowG.clear();
      this.scatterPhaseMs = 0;
      this.scatterSparkAccMs = 0;
    }
  }

  clearScatterAnticipation(): void {
    this.setScatterAnticipationReels([]);
  }

  scatterAnticipationActive(): boolean {
    return this.scatterAnticipationReels.size > 0;
  }

  triggerReelFlash(reelIndex: number): void {
    const reelX = reelIndex * (this.cellSize + this.gap);
    this.reelFlashes.push({
      reelIndex,
      x: reelX,
      width: this.cellSize,
      height: this.gridH,
      life: 180,
      maxLife: 180,
    });
  }

  /** Gears Clash: komplette Walze als Wild markieren (Server liefert Index + Multiplier). */
  setFullReelWild(reel: number, multiplier?: number): void {
    if (reel < 0 || reel >= this.reelCount) return;
    this.fullReelWild = { reel, ...(multiplier !== undefined ? { multiplier } : {}) };
    this.triggerReelFlash(reel);
  }

  clearFullReelWild(): void {
    this.fullReelWild = null;
  }

  /** Heist Run: Sticky-Wild-Positionen anzeigen. */
  setStickyWilds(positions: readonly HeistRunStickyWild[]): void {
    this.stickyWilds = positions.map((p) => ({ ...p }));
  }

  clearStickyWilds(): void {
    this.stickyWilds = [];
  }

  clearBonusMarks(): void {
    this.fullReelWild = null;
    this.stickyWilds = [];
    this.bonusMarksG.clear();
  }

  paint(dtMs: number): void {
    this.paintSpeedLines(dtMs);
    this.paintScatterAnticipation(dtMs);
    this.paintFlashes(dtMs);
    this.paintBonusMarks(dtMs);
    this.paintParticles(dtMs);
  }

  spawnBurst(cx: number, cy: number, count = 10, color = 0xffd860): void {
    if (this.reducedMotion) return;
    const available = this.particleCap - this.particles.length;
    const toSpawn = Math.min(count, available);

    for (let i = 0; i < toSpawn; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 400 + Math.random() * 300,
        maxLife: 400 + Math.random() * 300,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  spawnSymbolBurst(reelIndex: number, rowIndex: number, count = 8): void {
    const cx = reelIndex * (this.cellSize + this.gap) + this.cellSize / 2;
    const pitch = this.cellSize + ROW_GAP;
    const cy = rowIndex * pitch + pitch / 2;
    this.spawnBurst(cx, cy, count, 0xffd860);
  }

  private paintSpeedLines(dtMs: number): void {
    const g = this.speedLinesG;
    g.clear();

    const dtSec = dtMs / 1000;

    for (const [, lines] of this.speedLines) {
      for (const line of lines) {
        line.y += line.speed * dtSec;
        if (line.y > this.gridH + line.length) {
          line.y = -line.length;
          line.x =
            Math.floor(line.x / (this.cellSize + this.gap)) *
              (this.cellSize + this.gap) +
            Math.random() * this.cellSize;
        }

        g.moveTo(line.x, line.y);
        g.lineTo(line.x, line.y + line.length);
        g.stroke({ width: 2, color: 0xffffff, alpha: line.alpha * 0.3 });

        g.moveTo(line.x, line.y + line.length * 0.2);
        g.lineTo(line.x, line.y + line.length * 0.8);
        g.stroke({ width: 1, color: 0xf0e8c0, alpha: line.alpha });
      }
    }
  }

  private paintScatterAnticipation(dtMs: number): void {
    const g = this.scatterGlowG;
    g.clear();
    if (this.scatterAnticipationReels.size === 0) return;

    this.scatterPhaseMs += dtMs;
    const pulse =
      this.reducedMotion ? 1 : Math.sin(this.scatterPhaseMs * 0.006) * 0.5 + 0.55;

    for (const reelIdx of this.scatterAnticipationReels) {
      if (reelIdx < 0 || reelIdx >= this.reelCount) continue;
      const reelX = reelIdx * (this.cellSize + this.gap);
      const inset = Math.max(1, Math.floor(this.cellSize * 0.04));

      const hot = pulse * (this.reducedMotion ? 0.35 : 0.55);
      g.roundRect(reelX - 2, -3, this.cellSize + 4, this.gridH + 6, 7);
      g.fill({ color: 0xfff0a0, alpha: hot * 0.08 });

      g.roundRect(
        reelX + inset - 2,
        -2 + inset,
        this.cellSize - inset * 2 + 4,
        this.gridH - inset * 2 + 4,
        6,
      );
      g.stroke({
        width: 2 + (this.reducedMotion ? 0 : pulse * 1.8),
        color: 0xffd04a,
        alpha: hot * (this.reducedMotion ? 0.45 : 0.92),
      });

      g.roundRect(reelX + inset, inset, this.cellSize - inset * 2, this.gridH - inset * 2, 4);
      g.stroke({
        width: 1.2,
        color: 0xfff8dc,
        alpha: hot * 0.55,
      });
    }

    if (this.reducedMotion) return;

    this.scatterSparkAccMs += dtMs;
    const interval = 45;
    while (this.scatterSparkAccMs >= interval) {
      this.scatterSparkAccMs -= interval;
      for (const reelIdx of this.scatterAnticipationReels) {
        if (
          reelIdx < 0 ||
          reelIdx >= this.reelCount ||
          Math.random() > this.scatterBurstChance
        )
          continue;
        const reelX = reelIdx * (this.cellSize + this.gap);
        const cx =
          reelX + this.cellSize * (0.25 + Math.random() * 0.5);
        const cy = this.gridH - 8 - Math.random() * 26;
        this.spawnBurst(cx, cy, 2 + Math.floor(Math.random() * 3), 0xffea90);
      }
    }
  }

  private paintFlashes(dtMs: number): void {
    const g = this.flashG;
    g.clear();

    for (let i = this.reelFlashes.length - 1; i >= 0; i--) {
      const flash = this.reelFlashes[i]!;
      flash.life -= dtMs;

      if (flash.life <= 0) {
        this.reelFlashes.splice(i, 1);
        continue;
      }

      const u = flash.life / flash.maxLife;
      const alpha = u * 0.6;

      g.rect(flash.x - 2, -4, flash.width + 4, flash.height + 8);
      g.fill({ color: 0xffd860, alpha: alpha * 0.3 });

      g.rect(flash.x, 0, flash.width, flash.height);
      g.fill({ color: 0xfff0b0, alpha: alpha * 0.15 });

      g.moveTo(flash.x, 0);
      g.lineTo(flash.x + flash.width, 0);
      g.stroke({ width: 3, color: 0xfff8e0, alpha });

      g.moveTo(flash.x, flash.height);
      g.lineTo(flash.x + flash.width, flash.height);
      g.stroke({ width: 3, color: 0xfff8e0, alpha });
    }
  }

  private paintBonusMarks(dtMs: number): void {
    const g = this.bonusMarksG;
    g.clear();
    if (!this.fullReelWild && this.stickyWilds.length === 0) return;

    this.bonusPulseMs += dtMs;
    const pulse = this.reducedMotion
      ? 1
      : Math.sin(this.bonusPulseMs * 0.005) * 0.35 + 0.75;
    const pitch = this.cellSize + ROW_GAP;

    if (this.fullReelWild) {
      const { reel, multiplier } = this.fullReelWild;
      if (reel >= 0 && reel < this.reelCount) {
        const reelX = reel * (this.cellSize + this.gap);
        g.roundRect(reelX - 3, -4, this.cellSize + 6, this.gridH + 8, 8);
        g.fill({ color: 0xffa020, alpha: 0.12 * pulse });
        g.roundRect(reelX, 0, this.cellSize, this.gridH, 6);
        g.stroke({ width: 3, color: 0xffd040, alpha: 0.85 * pulse });

        if (multiplier !== undefined) {
          const badgeW = Math.min(this.cellSize * 0.85, 52);
          const badgeH = 22;
          const bx = reelX + (this.cellSize - badgeW) / 2;
          g.roundRect(bx, -badgeH - 4, badgeW, badgeH, 6);
          g.fill({ color: 0x3a2008, alpha: 0.92 });
          g.stroke({ width: 1.5, color: 0xffe080, alpha: 0.9 });
        }
      }
    }

    for (const sw of this.stickyWilds) {
      if (sw.reel < 0 || sw.reel >= this.reelCount) continue;
      const reelX = sw.reel * (this.cellSize + this.gap);
      const row = Math.max(0, Math.min(sw.row, Math.floor(this.gridH / pitch) - 1));
      const cellY = row * pitch;
      g.roundRect(reelX + 2, cellY + 2, this.cellSize - 4, pitch - 4, 5);
      g.stroke({ width: 2.5, color: 0xffd860, alpha: 0.9 * pulse });
      g.roundRect(reelX + 5, cellY + 5, this.cellSize - 10, pitch - 10, 4);
      g.fill({ color: 0xffa020, alpha: 0.08 * pulse });

      if (sw.multiplier !== undefined) {
        const mw = 28;
        const mh = 16;
        g.roundRect(reelX + this.cellSize - mw - 4, cellY + 4, mw, mh, 4);
        g.fill({ color: 0x2a1808, alpha: 0.9 });
      }
    }
  }

  private paintParticles(dtMs: number): void {
    const g = this.particlesG;
    g.clear();

    const gravity = 300;
    const dtSec = dtMs / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dtMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.98;

      const u = p.life / p.maxLife;
      const alpha = u * 0.9;

      g.moveTo(p.x - p.vx * dtSec * 0.5, p.y - p.vy * dtSec * 0.5);
      g.lineTo(p.x, p.y);
      g.stroke({ width: p.size, color: p.color, alpha, cap: 'round' });

      g.circle(p.x, p.y, p.size * 0.6);
      g.fill({ color: 0xffffff, alpha: alpha * 0.5 });
    }
  }

  clearParticles(): void {
    this.particles = [];
    this.particlesG.clear();
  }

  clear(): void {
    this.speedLines.clear();
    this.reelFlashes = [];
    this.particles = [];
    this.scatterAnticipationReels.clear();
    this.scatterPhaseMs = 0;
    this.scatterSparkAccMs = 0;
    this.bonusPulseMs = 0;
    this.fullReelWild = null;
    this.stickyWilds = [];
    this.speedLinesG.clear();
    this.scatterGlowG.clear();
    this.flashG.clear();
    this.bonusMarksG.clear();
    this.particlesG.clear();
  }

  destroy(): void {
    this.clear();
    this.view.removeChildren();
    this.speedLinesG.destroy();
    this.scatterGlowG.destroy();
    this.flashG.destroy();
    this.bonusMarksG.destroy();
    this.particlesG.destroy();
  }
}
