import type {
  BonusId,
  BonusSessionMeta,
  DeadlockCollectedSymbol,
  DeadlockPhase,
  GameConfig,
  HeistRunStickyWild,
} from '../config/types';
import { countBonusScatterOfTypeFullGrid } from '../core/scatterAnticipation';
import { pickWeightedSymbolId } from '../util/pickWeightedSymbolId';

/**
 * Referenz-Session-Logik für Demo und Tests — bewusst getrennt vom Adapter,
 * damit `MockGameApiAdapter` schlank bleibt und `server/spin-engine.ts` dieselbe
 * Mechanik spiegeln kann.
 *
 * Alles hier ist Server-Rolle: der Client rechnet keinen dieser Werte nach.
 * Quellen: `docs/bonuses/*.md`.
 */

/** Ab so vielen Scattern einer Runde greift der Retrigger (cross-cutting §1). */
export const RETRIGGER_MIN_SCATTER = 3;
/** Cap pro Retrigger-Ereignis — unabhängig von 3, 4 oder mehr Scattern. */
export const RETRIGGER_FREE_SPINS = 4;
/** Gears-Clash-Freispiel-Session (gears-clash.md §2.2). */
export const GEARS_CLASH_SESSION_SPINS = 8;
/** Deadlock Overdrive (deadlock-mode.md §6.2). */
export const DEADLOCK_OVERDRIVE_SPINS = 8;
/** Deadlock Collection-Start (deadlock-mode.md §5.3). */
export const DEADLOCK_START_LIVES = 3;

/** Deadlock Phase 1 — Symbol-IDs des eigenen Collection-Sets. */
export const DEADLOCK_BROKEN_GEAR_ID = 'broken_gear';
export const DEADLOCK_MULTIPLIER_GEAR_ID = 'multiplier_gear';

/**
 * Trefferrate pro Zelle in der Collection-Phase. Bewusst niedrig gehalten:
 * bei ~3 % Treffer je Zelle endet eine 5×5-Runde in rund der Hälfte der Fälle
 * leer, sodass drei Leben typischerweise nach 6–12 Runden aufgebraucht sind.
 */
const DEADLOCK_WILD_CELL_CHANCE = 0.022;
const DEADLOCK_MULTIPLIER_CELL_CHANCE = 0.008;

/** Multiplier-Gear-Stufen mit eigenen Landewahrscheinlichkeiten (deadlock-mode.md §5.1). */
const DEADLOCK_MULTIPLIER_VALUES: ReadonlyArray<{ value: number; weight: number }> = [
  { value: 2, weight: 44 },
  { value: 4, weight: 26 },
  { value: 6, weight: 15 },
  { value: 8, weight: 9 },
  { value: 10, weight: 4 },
  { value: 25, weight: 2 },
];

/** Anteil der Clashes, die der *niedrigere* Multiplier gewinnt (gears-clash.md §4.2). */
const GEARS_CLASH_LOWER_WINS_CHANCE = 0.7;
/** Wahrscheinlichkeit, dass in einer Gears-Freispiel-Runde ein Clash stattfindet (§2.3). */
const GEARS_CLASH_SESSION_SHOW_CHANCE = 0.42;

export type Rng = () => number;

/**
 * Initiale Free Spins aus der Scatter-Anzahl des auslösenden Spins.
 * Tabelle 3→8, 4→10, 5→12, 6→14, 7+→14 (Hard Cap, heist-run.md §6).
 */
export function initialFreeSpinsForScatters(
  scatterCount: number,
  baseCount = 8,
): number {
  if (scatterCount <= 3) return baseCount;
  if (scatterCount === 4) return baseCount + 2;
  if (scatterCount === 5) return baseCount + 4;
  return baseCount + 6;
}

export interface SymbolPool {
  ids: string[];
  weights: Record<string, number>;
}

/**
 * Symbol-Pool ohne Fremd-Bonus-Scatter (cross-cutting §1). Während einer Session
 * bleibt nur der Scatter des aktiven Modus ziehbar, damit keine widersprüchlichen
 * Doppel-Trigger entstehen.
 */
export function buildIsolatedSymbolPool(
  cfg: GameConfig,
  activeBonusId: BonusId | null,
): SymbolPool {
  const ids: string[] = [];
  const weights: Record<string, number> = {};
  for (const sym of cfg.symbols) {
    if (sym.kind === 'bonus' && activeBonusId !== null && sym.bonusId !== activeBonusId) {
      continue;
    }
    const w = cfg.symbolWeights[sym.id] ?? 0;
    if (w <= 0) continue;
    ids.push(sym.id);
    weights[sym.id] = w;
  }
  return { ids, weights };
}

export function sampleGridFromPool(
  cfg: GameConfig,
  pool: SymbolPool,
  rng: Rng,
): string[][] {
  const { reels, rows } = cfg.grid;
  const out: string[][] = [];
  for (let r = 0; r < reels; r++) {
    const col: string[] = [];
    for (let row = 0; row < rows; row++) {
      col.push(pickWeightedSymbolId(pool.ids, pool.weights, rng));
    }
    out.push(col);
  }
  return out;
}

export function firstWildSymbolId(cfg: GameConfig): string | null {
  return cfg.symbols.find((s) => s.kind === 'wild')?.id ?? null;
}

/** Zellen, auf denen in dieser Runde tatsächlich ein Wild gelandet ist. */
export function wildCellsOnGrid(
  cfg: GameConfig,
  reelStops: string[][],
): HeistRunStickyWild[] {
  const wildIds = new Set(
    cfg.symbols.filter((s) => s.kind === 'wild').map((s) => s.id),
  );
  const cells: HeistRunStickyWild[] = [];
  reelStops.forEach((col, reel) => {
    col.forEach((id, row) => {
      if (wildIds.has(id)) cells.push({ reel, row });
    });
  });
  return cells;
}

/** Sticky-Wilds haben Vorrang vor dem darunter rotierenden Symbol (heist-run.md §9.2). */
export function applyStickyWilds(
  cfg: GameConfig,
  reelStops: string[][],
  sticky: readonly HeistRunStickyWild[],
): string[][] {
  const wildId = firstWildSymbolId(cfg);
  if (!wildId || sticky.length === 0) return reelStops;
  const grid = reelStops.map((col) => [...col]);
  for (const cell of sticky) {
    const col = grid[cell.reel];
    if (col && cell.row >= 0 && cell.row < col.length) {
      col[cell.row] = wildId;
    }
  }
  return grid;
}

/** Streut garantierte Wilds ein (deadlock-mode.md §6.3) — pro Runde neu, nicht sticky. */
export function injectGuaranteedWilds(
  cfg: GameConfig,
  reelStops: string[][],
  count: number,
  rng: Rng,
): string[][] {
  const wildId = firstWildSymbolId(cfg);
  if (!wildId || count <= 0) return reelStops;
  const { reels, rows } = cfg.grid;
  const grid = reelStops.map((col) => [...col]);
  const free: Array<[number, number]> = [];
  for (let r = 0; r < reels; r++) {
    for (let row = 0; row < rows; row++) {
      if (grid[r]?.[row] !== wildId) free.push([r, row]);
    }
  }
  const target = Math.min(count, free.length);
  for (let i = 0; i < target; i++) {
    const pick = i + Math.floor(rng() * (free.length - i));
    const tmp = free[i]!;
    free[i] = free[pick]!;
    free[pick] = tmp;
    const [reel, row] = free[i]!;
    grid[reel]![row] = wildId;
  }
  return grid;
}

function pickMultiplierValue(rng: Rng): number {
  const total = DEADLOCK_MULTIPLIER_VALUES.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const entry of DEADLOCK_MULTIPLIER_VALUES) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return DEADLOCK_MULTIPLIER_VALUES[0]!.value;
}

export interface DeadlockCollectionRound {
  reelStops: string[][];
  collected: DeadlockCollectedSymbol[];
  wildsFound: number;
  multiplierSum: number;
}

/**
 * Collection-Raster aus genau drei Symboltypen (deadlock-mode.md §5.1):
 * kaputtes Gear (Null), Wild-Gear, Multiplier-Gear mit numerischem Wert.
 */
export function rollDeadlockCollectionRound(
  cfg: GameConfig,
  rng: Rng,
): DeadlockCollectionRound {
  const { reels, rows } = cfg.grid;
  const wildId = firstWildSymbolId(cfg) ?? DEADLOCK_BROKEN_GEAR_ID;
  const reelStops: string[][] = [];
  const collected: DeadlockCollectedSymbol[] = [];
  let wildsFound = 0;
  let multiplierSum = 0;

  for (let reel = 0; reel < reels; reel++) {
    const col: string[] = [];
    for (let row = 0; row < rows; row++) {
      const roll = rng();
      if (roll < DEADLOCK_WILD_CELL_CHANCE) {
        col.push(wildId);
        collected.push({ reel, row, symbolId: wildId });
        wildsFound++;
      } else if (roll < DEADLOCK_WILD_CELL_CHANCE + DEADLOCK_MULTIPLIER_CELL_CHANCE) {
        const multiplier = pickMultiplierValue(rng);
        col.push(DEADLOCK_MULTIPLIER_GEAR_ID);
        collected.push({
          reel,
          row,
          symbolId: DEADLOCK_MULTIPLIER_GEAR_ID,
          multiplier,
        });
        multiplierSum += multiplier;
      } else {
        col.push(DEADLOCK_BROKEN_GEAR_ID);
      }
    }
    reelStops.push(col);
  }

  return { reelStops, collected, wildsFound, multiplierSum };
}

export interface ClashOutcome {
  gearA: number;
  gearB: number;
  winnerMultiplier: number;
  winnerReel: number;
}

/**
 * Multiplier-Battle: einer der beiden gewinnt immer, der **niedrigere** häufiger
 * (gears-clash.md §4.2) — bewusst hausbank-freundlich, kein „höher gewinnt immer".
 */
export function rollClashOutcome(cfg: GameConfig, rng: Rng): ClashOutcome {
  const range = cfg.multiplierRanges;
  const span = Math.max(1, range.max - range.min + 1);
  const gearA = range.min + Math.floor(rng() * span);
  const gearB = range.min + Math.floor(rng() * span);
  const low = Math.min(gearA, gearB);
  const high = Math.max(gearA, gearB);
  const winnerMultiplier = rng() < GEARS_CLASH_LOWER_WINS_CHANCE ? low : high;
  return {
    gearA,
    gearB,
    winnerMultiplier,
    winnerReel: Math.floor(rng() * cfg.grid.reels),
  };
}

/**
 * Laufende Bonus-Session im Mock: Rundenbudget, Retrigger und Bonusbank.
 * Die Bank wird erst beim Abschluss der Session auf die Balance gebucht.
 */
export class MockBonusSession {
  totalSpins: number;
  remainingSpins: number;
  roundsPlayed = 0;
  bankedWin = 0;
  lastRetrigger = 0;

  /** Heist Run — bis Session-Ende bestehende Zell-Wilds. */
  stickyWilds: HeistRunStickyWild[] = [];

  /** Gears Clash — Anzahl gezeigter Clashes (für die Mindest-Garantie §2.4). */
  clashesShown = 0;

  /** Deadlock — Phasenzustand. */
  phase: DeadlockPhase = 'collection';
  lives = DEADLOCK_START_LIVES;
  collected: DeadlockCollectedSymbol[] = [];
  wildPool = 0;
  multiplierSum = 0;

  constructor(
    readonly bonusId: BonusId,
    readonly triggerBet: number,
    initialSpins: number,
  ) {
    this.totalSpins = initialSpins;
    this.remainingSpins = initialSpins;
  }

  /** Zählt eine gespielte Runde herunter. */
  consumeSpin(): void {
    this.roundsPlayed += 1;
    this.remainingSpins = Math.max(0, this.remainingSpins - 1);
  }

  addWin(amount: number): void {
    this.bankedWin += Math.max(0, Math.round(amount));
  }

  /** +4 Free Spins bei mindestens drei Scattern des aktiven Modus. */
  applyRetrigger(cfg: GameConfig, reelStops: string[][]): number {
    const scatters = countBonusScatterOfTypeFullGrid(reelStops, this.bonusId, cfg);
    if (scatters < RETRIGGER_MIN_SCATTER) {
      this.lastRetrigger = 0;
      return 0;
    }
    this.totalSpins += RETRIGGER_FREE_SPINS;
    this.remainingSpins += RETRIGGER_FREE_SPINS;
    this.lastRetrigger = RETRIGGER_FREE_SPINS;
    return RETRIGGER_FREE_SPINS;
  }

  /** Collection-Runde verbuchen; liefert true, wenn die Phase endet (0 Leben). */
  applyCollectionRound(round: DeadlockCollectionRound): boolean {
    const hit = round.wildsFound > 0 || round.multiplierSum > 0;
    if (hit) {
      this.lives = DEADLOCK_START_LIVES;
      this.collected.push(...round.collected);
      this.wildPool += round.wildsFound;
      this.multiplierSum += round.multiplierSum;
    } else {
      this.lives = Math.max(0, this.lives - 1);
    }
    return this.lives === 0;
  }

  /** Übergang Collection → Overdrive mit fixem Freispiel-Budget. */
  enterOverdrive(): void {
    this.phase = 'overdrive';
    this.totalSpins = DEADLOCK_OVERDRIVE_SPINS;
    this.remainingSpins = DEADLOCK_OVERDRIVE_SPINS;
  }

  /** Overdrive-Gesamtfaktor: Summe der gesammelten Werte, mindestens ×1 (§6.4). */
  overdriveMultiplier(): number {
    return this.multiplierSum > 0 ? this.multiplierSum : 1;
  }

  /**
   * Findet in dieser Gears-Runde ein Clash statt? Die letzte Runde erzwingt einen,
   * falls die Session sonst ohne Show enden würde (gears-clash.md §2.4).
   */
  shouldShowClash(rng: Rng): boolean {
    if (this.remainingSpins === 0 && this.clashesShown === 0) return true;
    return rng() < GEARS_CLASH_SESSION_SHOW_CHANCE;
  }

  meta(complete: boolean): BonusSessionMeta {
    return {
      remainingSpins: this.remainingSpins,
      totalSpins: this.totalSpins,
      roundsPlayed: this.roundsPlayed,
      bankedWin: this.bankedWin,
      complete,
      ...(this.lastRetrigger > 0 ? { retriggerAwarded: this.lastRetrigger } : {}),
    };
  }
}
