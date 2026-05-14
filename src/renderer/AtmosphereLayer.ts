import { Container, Graphics } from 'pixi.js';
import type { GcFxQuality } from '../util/layoutMode';

const STEAM_MAX_ULTRA = 12;
const GEAR_COUNT_ULTRA = 4;

interface SteamWisp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface IdleGear {
  x: number;
  y: number;
  radius: number;
  teeth: number;
  speed: number;
  rotation: number;
  alpha: number;
}

/**
 * Hintergrund-Atmosphäre: Vignette, langsam drehende Zahnräder, Steam-Wisps, Backlight-Pulse.
 * eventMode: 'none' — keine Interaktion.
 */
export class AtmosphereLayer {
  readonly view = new Container();

  private vignetteG = new Graphics();
  private backlightG = new Graphics();
  private gearsG = new Graphics();
  private steamG = new Graphics();

  private gears: IdleGear[] = [];
  private steamPool: SteamWisp[] = [];
  private steamSpawnTimer = 0;

  private w = 0;
  private h = 0;
  private reducedMotion = false;
  private steamCap = 6;
  private gearCap = 2;
  private steamSpawnEverySec = 0.42;

  constructor() {
    this.view.eventMode = 'none';
    this.view.zIndex = -10;
    this.view.addChild(this.backlightG, this.gearsG, this.steamG, this.vignetteG);

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  setFxQuality(q: GcFxQuality): void {
    const map = {
      low: { steam: 3, gears: 1, interval: 0.72 },
      medium: { steam: 5, gears: 2, interval: 0.52 },
      high: { steam: 8, gears: 3, interval: 0.4 },
      ultra: { steam: STEAM_MAX_ULTRA, gears: GEAR_COUNT_ULTRA, interval: 0.32 },
    }[q];
    this.steamCap = map.steam;
    this.gearCap = map.gears;
    this.steamSpawnEverySec = map.interval;
    while (this.steamPool.length > this.steamCap) {
      this.steamPool.pop();
    }
    this.initGears();
    this.drawVignette();
  }

  layout(width: number, height: number): void {
    this.w = width;
    this.h = height;
    this.initGears();
    this.drawVignette();
  }

  private initGears(): void {
    this.gears = [];
    const baseSize = Math.min(this.w, this.h) * 0.5;
    const positions: [number, number, number, number][] = [
      [-0.12, 0.15, 0.7, 0.06],
      [1.08, 0.75, 0.55, -0.04],
      [0.5, 1.1, 0.45, 0.08],
    ];

    const n = Math.min(this.gearCap, positions.length);
    for (let i = 0; i < n; i++) {
      const [px, py, sizeF, speed] = positions[i] ?? [0.5, 0.5, 0.4, 0.05];
      this.gears.push({
        x: this.w * px,
        y: this.h * py,
        radius: baseSize * sizeF,
        teeth: 12 + i * 2,
        speed: speed,
        rotation: Math.random() * Math.PI * 2,
        alpha: 0.08 + i * 0.03,
      });
    }
  }

  private drawVignette(): void {
    const g = this.vignetteG;
    g.clear();
    const cx = this.w / 2;
    const cy = this.h / 2;
    const maxR = Math.hypot(cx, cy);

    const steps = 12;
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const r = maxR * (0.55 + 0.45 * u);
      const alpha = (1 - u) * 0.55;
      g.circle(cx, cy, r);
      g.fill({ color: 0x000000, alpha });
    }
  }

  paint(timeSec: number, dtSec: number, isSpinning: boolean): void {
    this.paintBacklight(timeSec, isSpinning);
    if (!this.reducedMotion) {
      this.paintGears(dtSec);
      this.updateSteam(dtSec);
      this.paintSteam();
    } else {
      this.gearsG.clear();
      this.steamG.clear();
    }
  }

  private paintBacklight(timeSec: number, isSpinning: boolean): void {
    const g = this.backlightG;
    g.clear();
    const pulse = isSpinning
      ? 0.12 + 0.04 * Math.sin(timeSec * 8)
      : 0.06 + 0.03 * Math.sin(timeSec * 1.5);

    const cx = this.w / 2;
    const cy = this.h * 0.35;
    const r = Math.max(this.w, this.h) * 0.7;

    const steps = 8;
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const rr = r * u;
      const alpha = pulse * (1 - u * u);
      g.circle(cx, cy, rr);
      g.fill({ color: 0xd08020, alpha });
    }
  }

  private paintGears(dtSec: number): void {
    const g = this.gearsG;
    g.clear();

    for (const gear of this.gears) {
      gear.rotation += gear.speed * dtSec;
      this.drawGear(g, gear.x, gear.y, gear.radius, gear.teeth, gear.rotation, gear.alpha);
    }
  }

  private drawGear(
    g: Graphics,
    cx: number,
    cy: number,
    radius: number,
    teeth: number,
    rot: number,
    alpha: number,
  ): void {
    const pts: number[] = [];
    const inner = radius * 0.72;
    for (let i = 0; i < teeth * 2; i++) {
      const a = rot + (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? radius : inner;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.poly(pts, true);
    g.fill({ color: 0x3a3228, alpha });
    g.stroke({ width: 2, color: 0x5a4a38, alpha: alpha * 0.6 });

    g.circle(cx, cy, radius * 0.35);
    g.fill({ color: 0x2a2218, alpha: alpha * 0.8 });
    g.circle(cx, cy, radius * 0.12);
    g.fill({ color: 0x1a1410, alpha });
  }

  private updateSteam(dtSec: number): void {
    this.steamSpawnTimer += dtSec;
    if (
      this.steamSpawnTimer > this.steamSpawnEverySec &&
      this.steamPool.length < this.steamCap
    ) {
      this.steamSpawnTimer = 0;
      this.spawnSteamWisp();
    }

    for (let i = this.steamPool.length - 1; i >= 0; i--) {
      const w = this.steamPool[i]!;
      w.life -= dtSec;
      w.x += w.vx * dtSec;
      w.y += w.vy * dtSec;
      w.vx *= 0.98;
      if (w.life <= 0) {
        this.steamPool.splice(i, 1);
      }
    }
  }

  private spawnSteamWisp(): void {
    const x = this.w * (0.1 + Math.random() * 0.8);
    const y = this.h + 10;
    this.steamPool.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -30 - Math.random() * 40,
      life: 2.5 + Math.random() * 1.5,
      maxLife: 2.5 + Math.random() * 1.5,
      size: 12 + Math.random() * 18,
    });
  }

  private paintSteam(): void {
    const g = this.steamG;
    g.clear();

    for (const w of this.steamPool) {
      const u = w.life / w.maxLife;
      const alpha = 0.12 * Math.sin(u * Math.PI);
      const sz = w.size * (0.6 + 0.4 * u);

      g.circle(w.x, w.y, sz);
      g.fill({ color: 0x888880, alpha });
      g.circle(w.x + sz * 0.3, w.y - sz * 0.2, sz * 0.6);
      g.fill({ color: 0x999990, alpha: alpha * 0.7 });
    }
  }

  destroy(): void {
    this.view.removeChildren();
    this.vignetteG.destroy();
    this.backlightG.destroy();
    this.gearsG.destroy();
    this.steamG.destroy();
    this.gears = [];
    this.steamPool = [];
  }
}
