import { describe, expect, it } from 'vitest';
import { MockGameApiAdapter } from '../adapters/MockGameApiAdapter';
import type { SpinResult } from '../config/types';

async function runSpins(adapter: MockGameApiAdapter, count: number): Promise<SpinResult[]> {
  const out: SpinResult[] = [];
  for (let i = 0; i < count; i++) {
    out.push(await adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' }));
  }
  return out;
}

describe('MockGameApiAdapter Seed-Reproducibility', () => {
  it('liefert identische Spin-Sequenzen bei gleichem Seed', async () => {
    const a = new MockGameApiAdapter({ seed: 42, initialBalance: 10_000 });
    const b = new MockGameApiAdapter({ seed: 42, initialBalance: 10_000 });
    const [seqA, seqB] = await Promise.all([runSpins(a, 5), runSpins(b, 5)]);
    expect(seqA.length).toBe(5);
    expect(seqA.map((r) => r.reelStops)).toEqual(seqB.map((r) => r.reelStops));
    expect(seqA.map((r) => r.winAmount)).toEqual(seqB.map((r) => r.winAmount));
    expect(seqA.map((r) => r.balanceAfter)).toEqual(seqB.map((r) => r.balanceAfter));
    expect(seqA.map((r) => r.bonus?.type ?? null)).toEqual(
      seqB.map((r) => r.bonus?.type ?? null),
    );
  });

  it('liefert unterschiedliche Sequenzen bei unterschiedlichem Seed', async () => {
    const a = new MockGameApiAdapter({ seed: 1, initialBalance: 10_000 });
    const b = new MockGameApiAdapter({ seed: 2, initialBalance: 10_000 });
    const seqA = await runSpins(a, 5);
    const seqB = await runSpins(b, 5);
    const allReelsEqual = seqA.every(
      (r, i) => JSON.stringify(r.reelStops) === JSON.stringify(seqB[i]!.reelStops),
    );
    expect(allReelsEqual).toBe(false);
  });

  it('balanceAfter ist deterministisch bei gleichem Seed', async () => {
    const a = new MockGameApiAdapter({ seed: 7, initialBalance: 5_000 });
    const seq = await runSpins(a, 3);
    const balances = seq.map((r) => r.balanceAfter);
    const b = new MockGameApiAdapter({ seed: 7, initialBalance: 5_000 });
    const seq2 = await runSpins(b, 3);
    expect(seq2.map((r) => r.balanceAfter)).toEqual(balances);
  });
});
