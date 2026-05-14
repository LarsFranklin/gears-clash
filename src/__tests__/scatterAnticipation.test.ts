import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../config/defaultGameConfig';
import {
  columnPrefixTriggersScatterHuntVisual,
  countBonusScatterOfTypeForColumnPrefix,
  countBonusScatterOfTypeFullGrid,
} from '../core/scatterAnticipation';

const cfg = defaultGameConfig;
const bolts = (): string[] => Array<string>(cfg.grid.rows).fill('bolt');

describe('scatterAnticipation', () => {
  it('erkennt 2gleiche Scatter in einer bereits stehenden Walze', () => {
    const c0 = bolts();
    c0[1] = 'bonus_heist_run';
    c0[3] = 'bonus_heist_run';
    const reelStops = [c0, bolts(), bolts(), bolts(), bolts()];
    expect(columnPrefixTriggersScatterHuntVisual(reelStops, 0, cfg)).toBe(
      true,
    );
  });

  it('bei nur einem Scatter weiterhin keine Jagd-Stimmung', () => {
    const c0 = bolts();
    c0[2] = 'bonus_heist_run';
    const reelStops = [c0, bolts(), bolts(), bolts(), bolts()];
    expect(columnPrefixTriggersScatterHuntVisual(reelStops, 0, cfg)).toBe(
      false,
    );
  });

  it('Prefix-Zählung über mehrere Walzen', () => {
    const ah = bolts();
    ah[0] = 'bonus_gears_clash';
    const bh = bolts();
    bh[4] = 'bonus_gears_clash';
    const reelStops = [ah, bh, bolts(), bolts(), bolts()];
    expect(columnPrefixTriggersScatterHuntVisual(reelStops, 0, cfg)).toBe(false);
    expect(columnPrefixTriggersScatterHuntVisual(reelStops, 1, cfg)).toBe(true);
    expect(
      countBonusScatterOfTypeForColumnPrefix(reelStops, 4, 'gears_clash', cfg),
    ).toBe(2);
  });

  it('Volles Raster: Zähler für Mock-Payload', () => {
    const g = bolts();
    g[0] = 'bonus_deadlock_mode';
    g[1] = 'bonus_deadlock_mode';
    g[2] = 'bonus_deadlock_mode';
    g[3] = 'bonus_deadlock_mode';
    const reelStops = [g, bolts(), bolts(), bolts(), bolts()];
    expect(countBonusScatterOfTypeFullGrid(reelStops, 'deadlock_mode', cfg)).toBe(
      4,
    );
  });
});
