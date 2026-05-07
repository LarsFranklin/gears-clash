import type { BonusId, SpinResult } from '../config/types';
import { DeadlockModeFeature } from '../features/DeadlockModeFeature';
import { GearsClashFeature } from '../features/GearsClashFeature';
import { HeistRunFeature } from '../features/HeistRunFeature';

/**
 * Routing der Bonus-IDs — Darstellung / spätere State-Maschinen.
 *
 * WICHTIG: Keine finalen Bonus-Ergebnisse im Client; nur Interpretation des API-Payloads.
 */
export class BonusEngine {
  private readonly gears = new GearsClashFeature();
  private readonly heist = new HeistRunFeature();
  private readonly deadlock = new DeadlockModeFeature();

  getBonusIdFromResult(result: SpinResult): BonusId | null {
    const b = result.bonus;
    if (!b) return null;
    return b.type;
  }

  describeBonus(result: SpinResult): string {
    const id = this.getBonusIdFromResult(result);
    if (!id) return '';
    switch (id) {
      case 'gears_clash':
        return this.gears.describe(result.bonus);
      case 'heist_run':
        return this.heist.describe(result.bonus);
      case 'deadlock_mode':
        return this.deadlock.describe(result.bonus);
      default:
        return '';
    }
  }
}
