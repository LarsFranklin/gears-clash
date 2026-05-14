import type { SpinResult } from '../config/types';

/** Bonus `deadlock_mode` — Darstellungstext aus Server-Payload (keine Mathe). */
export class DeadlockModeFeature {
  describe(bonus: SpinResult['bonus']): string {
    if (!bonus || bonus.type !== 'deadlock_mode') return '';
    const p = bonus.payload;
    const ph = p.phase === 'collection' ? 'Collection' : 'Overdrive';
    const lives = p.lives !== undefined ? ` · ${p.lives} Lives` : '';
    const rem =
      p.remainingSpins !== undefined ? ` · ${p.remainingSpins} Spins` : '';
    return `Deadlock — ${ph}${lives}${rem}`;
  }
}
