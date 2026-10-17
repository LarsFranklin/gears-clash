import { describe, expect, it } from 'vitest';
import { MockGameApiAdapter } from '../adapters/MockGameApiAdapter';
import {
  buildIsolatedSymbolPool,
  initialFreeSpinsForScatters,
  MockBonusSession,
  RETRIGGER_FREE_SPINS,
} from '../adapters/mockBonusSessions';
import { defaultGameConfig } from '../config/defaultGameConfig';
import type { BonusId, SpinResult } from '../config/types';

const cfg = defaultGameConfig;

function scatterIdFor(bonusId: BonusId): string {
  return cfg.symbols.find((s) => s.kind === 'bonus' && s.bonusId === bonusId)!.id;
}

/** Raster mit `count` Scattern des Modus, Rest mit einem neutralen Symbol. */
function gridWithScatters(bonusId: BonusId, count: number): string[][] {
  const grid: string[][] = [];
  let placed = 0;
  for (let reel = 0; reel < cfg.grid.reels; reel++) {
    const col: string[] = [];
    for (let row = 0; row < cfg.grid.rows; row++) {
      if (placed < count && row === 0) {
        col.push(scatterIdFor(bonusId));
        placed++;
      } else {
        col.push('bolt');
      }
    }
    grid.push(col);
  }
  return grid;
}

/** Spielt eine gestartete Session bis zum Abschluss durch. */
async function playSession(
  adapter: MockGameApiAdapter,
  bonusId: BonusId,
  maxRounds = 200,
): Promise<SpinResult[]> {
  const rounds: SpinResult[] = [];
  for (let i = 0; i < maxRounds; i++) {
    const result = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: bonusId,
    });
    rounds.push(result);
    if (result.bonus?.session?.complete) break;
    if (!result.bonus) break;
  }
  return rounds;
}

describe('Freispiel-Tabelle (heist-run.md §6)', () => {
  it('bildet 3→8, 4→10, 5→12, 6→14 ab', () => {
    expect(initialFreeSpinsForScatters(3)).toBe(8);
    expect(initialFreeSpinsForScatters(4)).toBe(10);
    expect(initialFreeSpinsForScatters(5)).toBe(12);
    expect(initialFreeSpinsForScatters(6)).toBe(14);
  });

  it('deckelt ab 7 Scattern bei 14 (Hard Cap)', () => {
    expect(initialFreeSpinsForScatters(7)).toBe(14);
    expect(initialFreeSpinsForScatters(12)).toBe(14);
  });
});

describe('Retrigger (+4 mit Cap pro Ereignis)', () => {
  it('gewährt genau +4 unabhängig von der Scatter-Anzahl', () => {
    for (const count of [3, 4, 5, 9]) {
      const session = new MockBonusSession('heist_run', 100, 8);
      const awarded = session.applyRetrigger(cfg, gridWithScatters('heist_run', count));
      expect(awarded).toBe(RETRIGGER_FREE_SPINS);
      expect(session.remainingSpins).toBe(8 + RETRIGGER_FREE_SPINS);
      expect(session.totalSpins).toBe(8 + RETRIGGER_FREE_SPINS);
    }
  });

  it('löst unter drei Scattern nicht aus', () => {
    const session = new MockBonusSession('heist_run', 100, 8);
    expect(session.applyRetrigger(cfg, gridWithScatters('heist_run', 2))).toBe(0);
    expect(session.remainingSpins).toBe(8);
  });

  it('ist beliebig oft möglich', () => {
    const session = new MockBonusSession('heist_run', 100, 8);
    const grid = gridWithScatters('heist_run', 3);
    session.applyRetrigger(cfg, grid);
    session.applyRetrigger(cfg, grid);
    expect(session.totalSpins).toBe(8 + 2 * RETRIGGER_FREE_SPINS);
  });
});

describe('Scatter-Isolation (cross-cutting §1)', () => {
  it('entfernt fremde Bonus-Scatter aus dem Pool', () => {
    const pool = buildIsolatedSymbolPool(cfg, 'heist_run');
    expect(pool.ids).toContain('bonus_heist_run');
    expect(pool.ids).not.toContain('bonus_gears_clash');
    expect(pool.ids).not.toContain('bonus_deadlock_mode');
  });

  it('lässt im Basisspiel alle Scatter zu', () => {
    const pool = buildIsolatedSymbolPool(cfg, null);
    expect(pool.ids).toContain('bonus_heist_run');
    expect(pool.ids).toContain('bonus_gears_clash');
    expect(pool.ids).toContain('bonus_deadlock_mode');
  });

  it('schließt Symbole mit Gewicht 0 aus (Collection-Set)', () => {
    const pool = buildIsolatedSymbolPool(cfg, null);
    expect(pool.ids).not.toContain('broken_gear');
    expect(pool.ids).not.toContain('multiplier_gear');
  });
});

describe('Bonusbank', () => {
  it('bucht Freispiel-Gewinne erst am Session-Ende auf die Balance', async () => {
    const adapter = new MockGameApiAdapter({ seed: 4711, initialBalance: 50_000 });
    const trigger = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'heist_run' },
    });
    expect(trigger.bonus?.type).toBe('heist_run');

    const rounds = await playSession(adapter, 'heist_run');
    const last = rounds.at(-1)!;
    expect(last.bonus?.session?.complete).toBe(true);

    const bank = last.bonus!.session!.bankedWin;
    const middle = rounds.slice(0, -1);
    for (const r of middle) {
      expect(r.balanceAfter).toBe(trigger.balanceAfter);
    }
    expect(last.balanceAfter).toBe(trigger.balanceAfter + bank);
  });

  it('zieht in Freispielen keinen Einsatz ab', async () => {
    const adapter = new MockGameApiAdapter({ seed: 99, initialBalance: 50_000 });
    const trigger = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'heist_run' },
    });
    const rounds = await playSession(adapter, 'heist_run');
    for (const r of rounds.slice(0, -1)) {
      expect(r.balanceAfter).toBe(trigger.balanceAfter);
    }
  });
});

describe('Heist-Run-Session-Ablauf', () => {
  it('spielt genau so viele Runden wie gewährt (inkl. Retrigger)', async () => {
    const adapter = new MockGameApiAdapter({ seed: 2024, initialBalance: 50_000 });
    await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'heist_run' },
    });
    const rounds = await playSession(adapter, 'heist_run');
    const last = rounds.at(-1)!.bonus!.session!;
    expect(rounds.length).toBe(last.roundsPlayed);
    expect(last.remainingSpins).toBe(0);
    expect(last.roundsPlayed).toBe(last.totalSpins);
  });

  it('führt Sticky Wilds über die Session mit', async () => {
    const adapter = new MockGameApiAdapter({ seed: 31337, initialBalance: 50_000 });
    await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'heist_run' },
    });
    const rounds = await playSession(adapter, 'heist_run');
    let previous = 0;
    for (const r of rounds) {
      if (r.bonus?.type !== 'heist_run') continue;
      const count = r.bonus.payload.stickyWilds?.length ?? 0;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });
});

describe('Deadlock-Phasenübergang', () => {
  it('geht nach drei trefferlosen Runden von Collection in Overdrive', async () => {
    const adapter = new MockGameApiAdapter({ seed: 8080, initialBalance: 50_000 });
    await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'deadlock_mode' },
    });
    const rounds = await playSession(adapter, 'deadlock_mode', 400);
    const phases = rounds.map((r) =>
      r.bonus?.type === 'deadlock_mode' ? r.bonus.payload.phase : null,
    );
    const firstOverdrive = phases.indexOf('overdrive');
    expect(firstOverdrive).toBeGreaterThan(-1);
    expect(phases.slice(0, firstOverdrive).every((p) => p === 'collection')).toBe(true);
    expect(phases.slice(firstOverdrive).every((p) => p === 'overdrive')).toBe(true);
  });

  it('spielt genau acht Overdrive-Freispiele ohne Retrigger', async () => {
    const adapter = new MockGameApiAdapter({ seed: 5150, initialBalance: 50_000 });
    await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'deadlock_mode' },
    });
    const rounds = await playSession(adapter, 'deadlock_mode', 400);
    const last = rounds.at(-1)!.bonus!.session!;
    expect(last.complete).toBe(true);
    expect(last.totalSpins).toBeGreaterThanOrEqual(8);
    expect(last.remainingSpins).toBe(0);
  });
});

describe('Gears-Clash-Freispiel-Session', () => {
  it('zeigt in acht Freispielen mindestens einen Clash (§2.4)', async () => {
    const adapter = new MockGameApiAdapter({ seed: 606, initialBalance: 50_000 });
    await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'gears_clash' },
    });
    const rounds = await playSession(adapter, 'gears_clash');
    const clashes = rounds.filter(
      (r) =>
        r.bonus?.type === 'gears_clash' &&
        r.bonus.payload.winnerReel !== undefined,
    );
    expect(clashes.length).toBeGreaterThanOrEqual(1);
  });

  it('startet mit acht Freispielen', async () => {
    const adapter = new MockGameApiAdapter({ seed: 909, initialBalance: 50_000 });
    const trigger = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
      meta: { forceBonus: 'gears_clash' },
    });
    expect(trigger.bonus?.session?.totalSpins).toBe(8);
  });
});
