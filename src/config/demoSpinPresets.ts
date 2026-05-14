import type { BonusId, GameConfig } from './types';

/** Bekannte Demo-Szenarien — nur `MockGameApiAdapter` + lokale Vorschau (`meta.demoSpinScenario`). */
export const DEMO_SPIN_SCENARIO_IDS = [
  'demo_near_miss_heist',
  'demo_near_miss_gears',
  'demo_near_miss_deadlock',
  'demo_bonus_gears_clash',
  'demo_bonus_heist_run',
  'demo_bonus_deadlock_mode',
  'demo_big_line_win',
  'demo_gears_vs_symbols',
] as const;

export type DemoSpinScenarioId = (typeof DEMO_SPIN_SCENARIO_IDS)[number];

const SCENARIO_SET = new Set<string>(DEMO_SPIN_SCENARIO_IDS);

export function isDemoSpinScenarioId(v: unknown): v is DemoSpinScenarioId {
  return typeof v === 'string' && SCENARIO_SET.has(v);
}

function bonusSymbolId(cfg: GameConfig, bonusId: BonusId): string {
  const s = cfg.symbols.find((x) => x.kind === 'bonus' && x.bonusId === bonusId);
  if (!s) throw new Error(`demoSpinPresets: fehlendes Bonus-Symbol für ${bonusId}`);
  return s.id;
}

function fillGrid(cfg: GameConfig, fillId: string): string[][] {
  const { reels, rows } = cfg.grid;
  return Array.from({ length: reels }, () =>
    Array.from({ length: rows }, () => fillId),
  );
}

/**
 * Deterministische Raster für visuelle Tests (Scatter-Jagd, Bonus-Trigger, Liniengewinn).
 */
export function buildDemoReelStops(
  scenario: DemoSpinScenarioId,
  cfg: GameConfig,
): string[][] {
  const bolt = 'bolt';
  const g = fillGrid(cfg, bolt);

  switch (scenario) {
    case 'demo_near_miss_heist': {
      const h = bonusSymbolId(cfg, 'heist_run');
      g[0]![0] = h;
      g[1]![0] = h;
      break;
    }
    case 'demo_near_miss_gears': {
      const b = bonusSymbolId(cfg, 'gears_clash');
      g[0]![4] = b;
      g[1]![4] = b;
      break;
    }
    case 'demo_near_miss_deadlock': {
      const b = bonusSymbolId(cfg, 'deadlock_mode');
      g[0]![2] = b;
      g[1]![2] = b;
      break;
    }
    case 'demo_bonus_gears_clash': {
      const b = bonusSymbolId(cfg, 'gears_clash');
      g[0]![2] = b;
      g[1]![2] = b;
      g[2]![2] = b;
      break;
    }
    case 'demo_bonus_heist_run': {
      const b = bonusSymbolId(cfg, 'heist_run');
      g[0]![1] = b;
      g[1]![1] = b;
      g[2]![1] = b;
      break;
    }
    case 'demo_bonus_deadlock_mode': {
      const b = bonusSymbolId(cfg, 'deadlock_mode');
      g[0]![3] = b;
      g[1]![3] = b;
      g[2]![3] = b;
      break;
    }
    case 'demo_big_line_win': {
      const w = 'wild_gear';
      const mid = Math.floor(cfg.grid.rows / 2);
      for (let c = 0; c < cfg.grid.reels; c++) {
        g[c]![mid] = w;
      }
      break;
    }
    case 'demo_gears_vs_symbols': {
      const vs = 'gears_vs';
      // Platziere VS-Symbole in der Center-Line + einige weitere Positionen
      g[1]![2] = vs; // Reel 1, Center
      g[2]![2] = vs; // Reel 2, Center
      g[3]![1] = vs; // Reel 3, Upper Mid
      g[0]![3] = vs; // Reel 0, Lower Mid
      break;
    }
  }
  return g;
}
