import { describe, expect, it } from 'vitest';
import { MockGameApiAdapter } from '../adapters/MockGameApiAdapter';
import type { BonusId } from '../config/types';

const BONUS_IDS: BonusId[] = ['gears_clash', 'heist_run', 'deadlock_mode'];

describe('MockGameApiAdapter forceBonus', () => {
  it('meta.forceBonus erzwingt den gewünschten Bonus-Typ', async () => {
    const adapter = new MockGameApiAdapter({ seed: 777, initialBalance: 50_000 });

    for (const bonusId of BONUS_IDS) {
      const result = await adapter.spin({
        bet: 100,
        currency: 'COINS',
        mode: 'base',
        meta: { forceBonus: bonusId },
      });
      expect(result.bonus?.type).toBe(bonusId);
    }
  });

  it('liefert typisierte Payload-Struktur pro Bonus', async () => {
    const adapter = new MockGameApiAdapter({ seed: 42, initialBalance: 50_000 });

    const gears = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'gears_clash' },
    });
    expect(gears.bonus?.type).toBe('gears_clash');
    if (gears.bonus?.type === 'gears_clash') {
      expect(gears.bonus.payload.gearA.multiplier).toBeGreaterThan(0);
      expect(gears.bonus.payload.gearB.multiplier).toBeGreaterThan(0);
    }

    const heist = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'heist_run' },
    });
    expect(heist.bonus?.type).toBe('heist_run');
    if (heist.bonus?.type === 'heist_run') {
      expect(heist.bonus.payload.freeSpinsAwarded).toBeGreaterThan(0);
    }
  });
});
