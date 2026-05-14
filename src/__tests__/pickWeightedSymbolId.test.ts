import { describe, expect, it } from 'vitest';
import { pickWeightedSymbolId } from '../util/pickWeightedSymbolId';

describe('pickWeightedSymbolId', () => {
  const ids = ['low', 'high'] as const;

  it('bevorzugt höheres Gewicht deterministisch bei festem RNG', () => {
    const rng = () => 0.999;
    const pick = () =>
      pickWeightedSymbolId(ids, { low: 1, high: 9 }, rng);
    expect(Array.from({ length: 20 }, pick).every((id) => id === 'high')).toBe(
      true,
    );
  });

  it('nutzt 1 als Default wenn kein Gewicht-Eintrag existiert', () => {
    let n = 0;
    const rng = () => ++n * 0.3;
    expect(pickWeightedSymbolId(['a', 'b', 'c'], { a: 0, b: 0 }, rng)).toBe(
      'c',
    );
  });
});
