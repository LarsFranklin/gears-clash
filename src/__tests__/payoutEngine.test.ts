import { describe, expect, it } from 'vitest';
import { PayoutEngine } from '../core/PayoutEngine';
import type { SpinResult } from '../config/types';

describe('PayoutEngine', () => {
  const engine = new PayoutEngine();

  const base: SpinResult = {
    spinId: 't',
    reelStops: [],
    winAmount: 0,
    balanceAfter: 1000,
    bonus: null,
  };

  it('formatWinLine liefert — bei keinem Gewinn', () => {
    expect(engine.formatWinLine(base)).toBe('—');
  });

  it('formatWinLine gibt winAmount als String zurück', () => {
    expect(engine.formatWinLine({ ...base, winAmount: 250 })).toBe('250');
  });
});
