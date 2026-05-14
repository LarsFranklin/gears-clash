import type { SpinResult } from '../config/types';

/** Bonus `heist_run` — Kurzbeschreibung aus Server-Payload (nur Anzeige). */
export class HeistRunFeature {
  describe(bonus: SpinResult['bonus']): string {
    if (!bonus || bonus.type !== 'heist_run') return '';
    const p = bonus.payload;
    const max = p.freeSpinsAwarded;
    const cur = p.currentSpin;
    const spinTxt =
      cur != null ? `${cur} / ${max} Freispiele` : `${max} Freispiele`;
    const n = p.stickyWilds?.length ?? 0;
    const sticky = n === 1 ? '1 Sticky' : `${n} Sticky`;
    return `Heist Run — ${spinTxt} · ${sticky}`;
  }
}
