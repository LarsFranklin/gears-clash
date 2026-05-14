import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { runBaseGameMonteCarlo } from '../dev/runBaseGameMonteCarlo';

describe('runBaseGameMonteCarlo', () => {
  it('ist bei gleichem Seed deterministisch', () => {
    const a = runBaseGameMonteCarlo({
      config: defaultGameConfig,
      bet: 100,
      iterations: 5000,
      seed: 2026,
    });
    const b = runBaseGameMonteCarlo({
      config: defaultGameConfig,
      bet: 100,
      iterations: 5000,
      seed: 2026,
    });
    expect(a.empiricalBaseRtp).toBe(b.empiricalBaseRtp);
    expect(a.totalWin).toBe(b.totalWin);
    expect(a.bonusTriggers).toEqual(b.bonusTriggers);
  });

  it('liefert plausible Basis-RTP und Volatilitäts-Größenordnung', () => {
    const r = runBaseGameMonteCarlo({
      config: defaultGameConfig,
      bet: 100,
      iterations: 25_000,
      seed: 7,
    });
    expect(r.empiricalBaseRtp).toBeGreaterThan(0);
    expect(r.empiricalBaseRtp).toBeLessThan(2);
    expect(r.stdDevReturnPerBet).toBeGreaterThan(0);
    expect(r.params.iterations).toBe(25_000);
  });
});
