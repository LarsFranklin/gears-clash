import type { SpinResult } from '../config/types';

/** Bonus `gears_clash` — Kurzbeschreibung aus Server-Payload (nur Anzeige). */
export class GearsClashFeature {
  describe(bonus: SpinResult['bonus']): string {
    if (!bonus || bonus.type !== 'gears_clash') return '';
    const p = bonus.payload;
    const base = `Gears Clash — ×${p.gearA.multiplier} vs ×${p.gearB.multiplier}`;
    if (p.winnerReel != null && p.winnerMultiplier != null) {
      return `${base} · Walze ${p.winnerReel + 1} ×${p.winnerMultiplier}`;
    }
    if (p.winnerMultiplier != null) {
      return `${base} · ×${p.winnerMultiplier}`;
    }
    return base;
  }
}
