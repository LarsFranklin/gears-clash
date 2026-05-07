import type { SpinResult } from '../config/types';

/** Bonus `deadlock_mode` — v1 Stub. */
export class DeadlockModeFeature {
  describe(bonus: SpinResult['bonus']): string {
    if (!bonus || bonus.type !== 'deadlock_mode') return '';
    return 'Deadlock Mode';
  }
}
