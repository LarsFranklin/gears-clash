import { Container, Graphics } from 'pixi.js';
import type { BonusId } from '../config/types';
import type { GcFxQuality } from '../util/layoutMode';

interface AtmosphereMood {
  backlight: number;
  agitation: number;
}

const BASE_MOOD: AtmosphereMood = {
  backlight: 0xd08020,
  agitation: 0,
};

const BONUS_MOODS: Record<BonusId, AtmosphereMood> = {
  gears_clash: { backlight: 0xff8a2b, agitation: 0.55 },
  heist_run: { backlight: 0x2bb6ff, agitation: 0.35 },
  deadlock_mode: { backlight: 0xc03adf, agitation: 0.75 },
};

/**
 * Licht hinter den Walzen. Zahnräder und Dampf zeichnet `SlotCabinet`.
 */
export class AtmosphereLayer {
  readonly view = new Container();

  private vignetteG = new Graphics();
  private backlightG = new Graphics();

  private w = 0;
  private h = 0;
  private mood: AtmosphereMood = BASE_MOOD;
  private moodBlend = 0;

  constructor() {
    this.view.eventMode = 'none';
    this.view.zIndex = -10;
    this.view.addChild(this.backlightG, this.vignetteG);
  }

  setFxQuality(_q: GcFxQuality): void {
    // Partikel liegen im Schrank.
  }

  setBonusMood(bonusId: BonusId | null): void {
    this.mood = bonusId ? BONUS_MOODS[bonusId] : BASE_MOOD;
  }

  layout(width: number, height: number): void {
    this.w = width;
    this.h = height;
    this.drawVignette();
  }

  paint(timeSec: number, dtSec: number, isSpinning: boolean): void {
    const targetBlend = this.mood === BASE_MOOD ? 0 : 1;
    this.moodBlend += (targetBlend - this.moodBlend) * Math.min(1, dtSec * 2.2);
    this.paintBacklight(timeSec, isSpinning);
  }

  destroy(): void {
    this.view.removeChildren();
    this.vignetteG.destroy();
    this.backlightG.destroy();
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

  private paintBacklight(timeSec: number, isSpinning: boolean): void {
    const g = this.backlightG;
    g.clear();
    const agitation = this.mood.agitation * this.moodBlend;
    const speed = (isSpinning ? 8 : 1.5) + agitation * 4;
    const base = isSpinning ? 0.12 : 0.06;
    const pulse =
      base * (1 + agitation * 0.9) +
      (isSpinning ? 0.04 : 0.03) * (1 + agitation) * Math.sin(timeSec * speed);

    const cx = this.w / 2;
    const cy = this.h * 0.35;
    const r = Math.max(this.w, this.h) * 0.7;
    const color = mixColor(BASE_MOOD.backlight, this.mood.backlight, this.moodBlend);
    const steps = 8;
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const rr = r * u;
      const alpha = pulse * (1 - u * u);
      g.circle(cx, cy, rr);
      g.fill({ color, alpha });
    }
  }
}

function mixColor(from: number, to: number, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  return (
    ((Math.round(fr + (tr - fr) * u) & 0xff) << 16) |
    ((Math.round(fg + (tg - fg) * u) & 0xff) << 8) |
    (Math.round(fb + (tb - fb) * u) & 0xff)
  );
}
