import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { defaultSlotMath } from '../config/defaultSlotMath';
import type { GameConfig } from '../config/types';
import { evaluateDemoBaseSpin } from '../core/slotEvaluation';

const filled = (sym: string): string[][] =>
  Array.from({ length: 5 }, () => Array<string>(5).fill(sym));

/** Eine einzige mittlere Payline isoliert Bolt-Szenarien (volles Raster würde 20 Lines summieren). */
const oneMiddleLineCfg: GameConfig = {
  ...defaultGameConfig,
  slotMath: {
    ...defaultSlotMath,
    paylines: [{ id: 'MID', rows: [2, 2, 2, 2, 2] }],
  },
};

const noLineCfg: GameConfig = {
  ...defaultGameConfig,
  slotMath: {
    ...defaultSlotMath,
    paylines: [],
  },
};

describe('evaluateDemoBaseSpin', () => {
  it('zahlt mittlere Linie bei fünf Bolt auf dieser Payline', () => {
    const grid = filled('bolt');
    const r = evaluateDemoBaseSpin(oneMiddleLineCfg, grid, 100);
    expect(r.winAmount).toBe(1);
    expect(r.displayWinLines.some((ln) => ln.id === 'MID')).toBe(true);
    expect(r.bonusType).toBeNull();
  });

  it('Wild substituiert in der Kombination', () => {
    const grid = filled('bolt');
    grid[0]![2] = 'wild_gear';
    grid[1]![2] = 'wild_gear';
    const r = evaluateDemoBaseSpin(oneMiddleLineCfg, grid, 100);
    expect(r.winAmount).toBe(1);
  });

  it('reine Wild-Linie nutzt erste Wild-ID mit Pay-Ladder aus der Konfiguration', () => {
    const grid = filled('wild_gear');
    const r = evaluateDemoBaseSpin(oneMiddleLineCfg, grid, 100);
    expect(r.winAmount).toBeGreaterThan(0);
    const mid = r.displayWinLines.find((ln) => ln.id === 'MID');
    expect(mid).toBeDefined();
    expect(mid?.label).toMatch(/^5x /);
  });

  it('zahlt 2 gleiche Pay-Symbole + Wild als 3er auf der Linie', () => {
    const grid = filled('nut');
    grid[0]![2] = 'bolt';
    grid[1]![2] = 'bolt';
    grid[2]![2] = 'wild_gear';
    const r = evaluateDemoBaseSpin(oneMiddleLineCfg, grid, 100);
    expect(r.winAmount).toBe(1);
    expect(r.displayWinLines[0]?.points.length).toBe(3);
  });

  it('2 gleiche ohne Wild oder drittes Match zahlen nicht', () => {
    const grid = filled('nut');
    grid[0]![2] = 'bolt';
    grid[1]![2] = 'bolt';
    const r = evaluateDemoBaseSpin(oneMiddleLineCfg, grid, 100);
    expect(r.winAmount).toBe(0);
  });

  it('Bonussymbol auf der Linie unterbindet diese Payline-Auszahlung', () => {
    const grid = filled('bolt');
    grid[2]![2] = 'bonus_gears_clash';
    const r = evaluateDemoBaseSpin(oneMiddleLineCfg, grid, 100);
    expect(r.displayWinLines.filter((ln) => ln.id === 'MID').length).toBe(0);
    expect(r.winAmount).toBe(0);
  });

  it('bei gleicher Scatter-Anzahl gewinnt die Priorität aus slotMath', () => {
    const grid = filled('nut');
    const place: [number, number, string][] = [
      [0, 0, 'bonus_heist_run'],
      [0, 1, 'bonus_heist_run'],
      [0, 2, 'bonus_heist_run'],
      [4, 0, 'bonus_deadlock_mode'],
      [4, 1, 'bonus_deadlock_mode'],
      [4, 2, 'bonus_deadlock_mode'],
    ];
    for (const [reel, row, id] of place) {
      grid[reel]![row] = id;
    }
    const r = evaluateDemoBaseSpin(noLineCfg, grid, 100);
    expect(r.winAmount).toBe(0);
    expect(r.bonusType).toBe('heist_run');
  });

  it('ohne slotMath keine Auswertung', () => {
    const cfg = { ...defaultGameConfig, slotMath: undefined };
    const r = evaluateDemoBaseSpin(cfg, filled('bolt'), 100);
    expect(r.winAmount).toBe(0);
    expect(r.displayWinLines.length).toBe(0);
    expect(r.bonusType).toBeNull();
  });
});
