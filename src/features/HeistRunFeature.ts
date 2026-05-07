import type { SpinResult } from '../config/types';

/** Bonus `heist_run` — v1 Stub. */
export class HeistRunFeature {
  describe(bonus: SpinResult['bonus']): string {
    if (!bonus || bonus.type !== 'heist_run') return '';
    return 'Heist Run';
  }
}
