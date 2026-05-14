import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../config/defaultGameConfig';
import {
  buildDemoReelStops,
  DEMO_SPIN_SCENARIO_IDS,
  isDemoSpinScenarioId,
} from '../config/demoSpinPresets';
import { countBonusScatterOfTypeFullGrid } from '../core/scatterAnticipation';
import { evaluateDemoBaseSpin } from '../core/slotEvaluation';

describe('demoSpinPresets', () => {
  it('kennt alle Szenario-IDs', () => {
    for (const id of DEMO_SPIN_SCENARIO_IDS) {
      expect(isDemoSpinScenarioId(id)).toBe(true);
    }
    expect(isDemoSpinScenarioId('invalid')).toBe(false);
  });

  it('liefert 5×5-Raster passend zur Config', () => {
    const cfg = defaultGameConfig;
    for (const id of DEMO_SPIN_SCENARIO_IDS) {
      const g = buildDemoReelStops(id, cfg);
      expect(g.length).toBe(cfg.grid.reels);
      for (const col of g) {
        expect(col.length).toBe(cfg.grid.rows);
      }
    }
  });

  it('Near-Miss Heist löst keinen Bonus aus, Bonus-Heist schon', () => {
    const cfg = defaultGameConfig;
    const near = buildDemoReelStops('demo_near_miss_heist', cfg);
    const evNear = evaluateDemoBaseSpin(cfg, near, 100);
    expect(evNear.bonusType).toBeNull();

    const full = buildDemoReelStops('demo_bonus_heist_run', cfg);
    expect(countBonusScatterOfTypeFullGrid(full, 'heist_run', cfg)).toBeGreaterThanOrEqual(3);
    const evFull = evaluateDemoBaseSpin(cfg, full, 100);
    expect(evFull.bonusType).toBe('heist_run');
  });
});
