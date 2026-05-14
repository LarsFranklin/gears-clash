import { describe, expect, it } from 'vitest';
import { BonusEngine } from '../core/BonusEngine';
import type { SpinResult } from '../config/types';

function spinWithBonus(bonus: SpinResult['bonus']): SpinResult {
  return {
    spinId: 't',
    reelStops: [],
    winAmount: 0,
    balanceAfter: 0,
    bonus,
  };
}

describe('BonusEngine.describeBonus', () => {
  const engine = new BonusEngine();

  it('beschreibt gears_clash aus Payload', () => {
    const s = spinWithBonus({
      type: 'gears_clash',
      payload: {
        gearA: { multiplier: 4 },
        gearB: { multiplier: 9 },
        winnerReel: 2,
        winnerMultiplier: 9,
      },
    });
    expect(engine.describeBonus(s)).toContain('×4');
    expect(engine.describeBonus(s)).toContain('×9');
    expect(engine.describeBonus(s)).toContain('Walze 3');
  });

  it('beschreibt heist_run aus Payload', () => {
    const s = spinWithBonus({
      type: 'heist_run',
      payload: {
        freeSpinsAwarded: 8,
        currentSpin: 2,
        stickyWilds: [{ reel: 0, row: 1 }],
      },
    });
    const t = engine.describeBonus(s);
    expect(t).toContain('Heist Run');
    expect(t).toContain('2 / 8');
    expect(t).toContain('1 Sticky');
  });

  it('beschreibt deadlock_mode', () => {
    const s = spinWithBonus({
      type: 'deadlock_mode',
      payload: { phase: 'collection', lives: 3, remainingSpins: 5 },
    });
    expect(engine.describeBonus(s)).toContain('Collection');
    expect(engine.describeBonus(s)).toContain('3 Lives');
  });
});
