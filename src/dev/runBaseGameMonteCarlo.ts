import type { BonusId, GameConfig } from '../config/types';
import { evaluateDemoBaseSpin } from '../core/slotEvaluation';
import { pickWeightedSymbolId } from '../util/pickWeightedSymbolId';
import { mulberry32 } from '../util/random';

export interface BaseGameMonteCarloParams {
  config: GameConfig;
  bet: number;
  iterations: number;
  /** Ohne Seed: `Math.random()` (nicht reproduzierbar). */
  seed?: number;
}

export interface BaseGameMonteCarloResult {
  params: {
    iterations: number;
    bet: number;
    seed: number | null;
    referenceBet: number | undefined;
  };
  totalBet: number;
  totalWin: number;
  /** `totalWin / totalBet` — nur Basis-Spiel laut `evaluateDemoBaseSpin` (keine Bonus-Runden-Gewinne). */
  empiricalBaseRtp: number;
  anyWinSpins: number;
  bonusTriggers: Partial<Record<BonusId, number>>;
  maxSingleWin: number;
  /** Mittlerer Return `win / bet` pro Spin (≈ 1 = Break-even bei diesem Bet). */
  meanReturnPerBet: number;
  /** Standardabweichung von `win/bet` — grober Volatilitäts-Proxy fürs Basis-Spiel. */
  stdDevReturnPerBet: number;
  /** Grobe Verteilung von `win/bet` pro Spin (inkl. Bucket `0` für Nieten). */
  winMultiplierHistogram: {
    label: string;
    count: number;
  }[];
}

interface MonteCarloAccumulator {
  totalBet: number;
  totalWin: number;
  anyWinSpins: number;
  bonusTriggers: Partial<Record<BonusId, number>>;
  maxSingleWin: number;
  meanR: number;
  m2: number;
  countR: number;
  hist: Map<string, number>;
}

function bucketWinMultiplier(ratio: number): string {
  if (ratio <= 0) return '0';
  if (ratio < 0.5) return '(0, 0.5)';
  if (ratio < 1) return '[0.5, 1)';
  if (ratio < 2) return '[1, 2)';
  if (ratio < 5) return '[2, 5)';
  if (ratio < 10) return '[5, 10)';
  if (ratio < 50) return '[10, 50)';
  return '≥50';
}

function bumpHistogram(
  map: Map<string, number>,
  ratio: number,
): void {
  const k = bucketWinMultiplier(ratio);
  map.set(k, (map.get(k) ?? 0) + 1);
}

function sampleReelStops(
  cfg: GameConfig,
  symbolIds: string[],
  rng: () => number,
): string[][] {
  const { reels, rows } = cfg.grid;
  const out: string[][] = [];
  for (let r = 0; r < reels; r++) {
    const col: string[] = [];
    for (let row = 0; row < rows; row++) {
      col.push(pickWeightedSymbolId(symbolIds, cfg.symbolWeights, rng));
    }
    out.push(col);
  }
  return out;
}

function createAccumulator(): MonteCarloAccumulator {
  return {
    totalBet: 0,
    totalWin: 0,
    anyWinSpins: 0,
    bonusTriggers: {},
    maxSingleWin: 0,
    meanR: 0,
    m2: 0,
    countR: 0,
    hist: new Map(),
  };
}

function appendMonteCarloSpins(
  cfg: GameConfig,
  symbolIds: string[],
  safeBet: number,
  spinCount: number,
  rng: () => number,
  acc: MonteCarloAccumulator,
): void {
  for (let i = 0; i < spinCount; i++) {
    const reelStops = sampleReelStops(cfg, symbolIds, rng);
    const ev = evaluateDemoBaseSpin(cfg, reelStops, safeBet);
    const w = Math.max(0, Math.floor(ev.winAmount));
    acc.totalBet += safeBet;
    acc.totalWin += w;
    const ratio = safeBet > 0 ? w / safeBet : 0;
    bumpHistogram(acc.hist, ratio);
    if (w > 0) acc.anyWinSpins += 1;
    if (ev.bonusType) {
      acc.bonusTriggers[ev.bonusType] =
        (acc.bonusTriggers[ev.bonusType] ?? 0) + 1;
    }
    if (w > acc.maxSingleWin) acc.maxSingleWin = w;

    if (safeBet > 0) {
      const r = w / safeBet;
      acc.countR += 1;
      const delta = r - acc.meanR;
      acc.meanR += delta / acc.countR;
      acc.m2 += delta * (r - acc.meanR);
    }
  }
}

function accumulatorToResult(
  cfg: GameConfig,
  params: BaseGameMonteCarloParams,
  safeBet: number,
  n: number,
  acc: MonteCarloAccumulator,
): BaseGameMonteCarloResult {
  const stdDevReturnPerBet =
    acc.countR > 1 ? Math.sqrt(acc.m2 / (acc.countR - 1)) : 0;

  const winMultiplierHistogram = [
    '0',
    '(0, 0.5)',
    '[0.5, 1)',
    '[1, 2)',
    '[2, 5)',
    '[5, 10)',
    '[10, 50)',
    '≥50',
  ].map((label) => ({ label, count: acc.hist.get(label) ?? 0 }));

  const empiricalBaseRtp =
    acc.totalBet > 0 ? acc.totalWin / acc.totalBet : 0;

  return {
    params: {
      iterations: n,
      bet: safeBet,
      seed: params.seed ?? null,
      referenceBet: cfg.slotMath?.referenceBet,
    },
    totalBet: acc.totalBet,
    totalWin: acc.totalWin,
    empiricalBaseRtp,
    anyWinSpins: acc.anyWinSpins,
    bonusTriggers: acc.bonusTriggers,
    maxSingleWin: acc.maxSingleWin,
    meanReturnPerBet: acc.meanR,
    stdDevReturnPerBet,
    winMultiplierHistogram,
  };
}

/**
 * Schnelle Basis-Spiel-Monte-Carlo — gleiche Symbol-Ziehung + Auswertung wie `MockGameApiAdapter`,
 * aber ohne Netzwerk/Delays/Bonus-Payloads. Bonus-**Trigger** werden nur gezählt.
 *
 * **Nicht** die Produkt-RTP: Server/Mathe-Backend ist Source of Truth. Hilfreich für
 * Paytable-/Gewicht-Tuning in der Demo-Konfiguration.
 */
export function runBaseGameMonteCarlo(
  params: BaseGameMonteCarloParams,
): BaseGameMonteCarloResult {
  const { config: cfg, bet, iterations } = params;
  const rng =
    params.seed !== undefined ? mulberry32(params.seed) : () => Math.random();

  const symbolIds = cfg.symbols.map((s) => s.id);
  const safeBet = Math.max(0, Math.floor(bet));
  const n = Math.max(0, Math.floor(iterations));

  const acc = createAccumulator();
  appendMonteCarloSpins(cfg, symbolIds, safeBet, n, rng, acc);
  return accumulatorToResult(cfg, params, safeBet, n, acc);
}

export interface BaseGameMonteCarloBatchedOptions {
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Wie `runBaseGameMonteCarlo`, aber mit kurzen UI-Yields (`queueMicrotask`) alle `chunkSize` Spins.
 */
export async function runBaseGameMonteCarloBatched(
  params: BaseGameMonteCarloParams,
  options?: BaseGameMonteCarloBatchedOptions,
): Promise<BaseGameMonteCarloResult> {
  const chunkSize = Math.max(1, options?.chunkSize ?? 4000);
  const { config: cfg, bet, iterations } = params;
  const rng =
    params.seed !== undefined ? mulberry32(params.seed) : () => Math.random();

  const symbolIds = cfg.symbols.map((s) => s.id);
  const safeBet = Math.max(0, Math.floor(bet));
  const n = Math.max(0, Math.floor(iterations));

  const acc = createAccumulator();
  let done = 0;

  while (done < n) {
    const batch = Math.min(chunkSize, n - done);
    appendMonteCarloSpins(cfg, symbolIds, safeBet, batch, rng, acc);
    done += batch;
    options?.onProgress?.(done, n);
    if (done < n) {
      options?.signal?.throwIfAborted();
      await new Promise<void>((r) => queueMicrotask(r));
    }
  }

  return accumulatorToResult(cfg, params, safeBet, n, acc);
}
