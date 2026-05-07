import type { SpinResult } from '../config/types';

/** Bonus `gears_clash` — v1 Stub, Darstellung folgt Server-Payload. */
export class GearsClashFeature {
  describe(bonus: SpinResult['bonus']): string {
    if (!bonus || bonus.type !== 'gears_clash') return '';
    return 'Gears Clash';
  }
}
