import type {
  BonusId,
  BonusSessionPayload,
  GameConfig,
  SpinDisplayHighlight,
  SpinDisplayWinLine,
  SpinResult,
} from '../src/config/types';
import { evaluateDemoBaseSpin } from '../src/core/slotEvaluation';
import { countBonusScatterOfTypeFullGrid } from '../src/core/scatterAnticipation';
import {
  applyStickyWilds,
  buildIsolatedSymbolPool,
  DEADLOCK_START_LIVES,
  firstWildSymbolId,
  GEARS_CLASH_SESSION_SPINS,
  initialFreeSpinsForScatters,
  injectGuaranteedWilds,
  MockBonusSession,
  rollClashOutcome,
  rollDeadlockCollectionRound,
  sampleGridFromPool,
  wildCellsOnGrid,
  type Rng,
  type SymbolPool,
} from '../src/adapters/mockBonusSessions';

const GEARS_VS_SYMBOL_ID = 'gears_vs';

export interface SpinEngineRequest {
  bet: number;
  balanceBefore: number;
  /** Fortsetzungsrunde einer laufenden Session — sonst Base-Spin. */
  mode?: BonusId | 'base';
}

/**
 * Referenz-Serverlogik für den Dev-Server.
 *
 * Spiegelt bewusst `MockGameApiAdapter`: beide nutzen dieselben Session-Bausteine aus
 * `src/adapters/mockBonusSessions.ts`, damit Demo und Server nicht auseinanderlaufen.
 * Eine Instanz entspricht einer Spieler-Session (In-Memory, nur Entwicklung).
 */
export class SpinEngine {
  private readonly rng: Rng;
  private readonly basePool: SymbolPool;
  private session: MockBonusSession | null = null;
  private spinCounter = 0;

  constructor(
    private readonly config: GameConfig,
    seed?: number,
  ) {
    this.basePool = buildIsolatedSymbolPool(config, null);
    let s = (seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  /** True, solange eine Bonus-Session läuft — der Host darf dann keinen Base-Spin schicken. */
  hasActiveSession(): boolean {
    return this.session !== null;
  }

  activeBonusId(): BonusId | null {
    return this.session?.bonusId ?? null;
  }

  generateSpin(request: SpinEngineRequest): SpinResult {
    if (this.session && request.mode && request.mode !== 'base') {
      return this.spinSessionRound(request.balanceBefore);
    }
    this.session = null;
    return this.spinBaseRound(request.bet, request.balanceBefore);
  }

  // ---------------------------------------------------------------- Base-Spin

  private spinBaseRound(bet: number, balanceBefore: number): SpinResult {
    const cfg = this.config;
    const reelStops = sampleGridFromPool(cfg, this.basePool, this.rng);
    const base = evaluateDemoBaseSpin(cfg, reelStops, bet);

    let grid = reelStops;
    let winAmount = base.winAmount;
    let highlights: SpinDisplayHighlight[] = base.displayHighlights;
    let winLines: SpinDisplayWinLine[] = base.displayWinLines;
    let bonus: BonusSessionPayload | null = null;

    if (base.bonusType) {
      bonus = this.startSession(base.bonusType, reelStops, bet);
    } else {
      const battle = this.resolveSingleSpinBattle(reelStops, bet, base.winAmount);
      if (battle) {
        grid = battle.grid;
        winAmount = battle.winAmount;
        highlights = battle.highlights;
        winLines = battle.winLines;
        bonus = battle.bonus;
      }
    }

    const balanceAfter = Math.max(0, Math.round(balanceBefore - bet + winAmount));
    return this.buildResult(grid, winAmount, balanceAfter, bonus, highlights, winLines);
  }

  private startSession(
    bonusId: BonusId,
    reelStops: string[][],
    bet: number,
  ): BonusSessionPayload {
    const cfg = this.config;
    const scatters = countBonusScatterOfTypeFullGrid(reelStops, bonusId, cfg);

    if (bonusId === 'deadlock_mode') {
      this.session = new MockBonusSession(bonusId, bet, 0);
      return {
        type: 'deadlock_mode',
        payload: {
          phase: 'collection',
          lives: DEADLOCK_START_LIVES,
          collectedSymbols: [],
        },
        session: this.session.meta(false),
      };
    }

    const awarded = initialFreeSpinsForScatters(
      scatters,
      bonusId === 'gears_clash'
        ? GEARS_CLASH_SESSION_SPINS
        : cfg.freeSpinDefaults.count,
    );
    const session = new MockBonusSession(bonusId, bet, awarded);
    this.session = session;

    if (bonusId === 'heist_run') {
      session.stickyWilds = wildCellsOnGrid(cfg, reelStops);
      return {
        type: 'heist_run',
        payload: {
          freeSpinsAwarded: awarded,
          currentSpin: 0,
          stickyWilds: [...session.stickyWilds],
        },
        session: session.meta(false),
      };
    }

    const clash = rollClashOutcome(cfg, this.rng);
    return {
      type: 'gears_clash',
      payload: {
        gearA: { multiplier: clash.gearA },
        gearB: { multiplier: clash.gearB },
      },
      session: session.meta(false),
    };
  }

  /** Expand nur, wenn die Walze als Full-Reel-Wild wirklich einen Treffer erzeugt. */
  private resolveSingleSpinBattle(
    reelStops: string[][],
    bet: number,
    baseWin: number,
  ): {
    grid: string[][];
    winAmount: number;
    highlights: SpinDisplayHighlight[];
    winLines: SpinDisplayWinLine[];
    bonus: BonusSessionPayload;
  } | null {
    const cfg = this.config;
    const wildId = firstWildSymbolId(cfg);
    if (!wildId || bet <= 0) return null;

    for (let reel = 0; reel < reelStops.length; reel++) {
      if (!reelStops[reel]?.includes(GEARS_VS_SYMBOL_ID)) continue;
      const expanded = reelStops.map((col, i) =>
        i === reel ? col.map(() => wildId) : [...col],
      );
      const evaluation = evaluateDemoBaseSpin(cfg, expanded, bet);
      if (evaluation.winAmount <= baseWin) continue;

      const clash = rollClashOutcome(cfg, this.rng);
      const scaledLines = evaluation.displayWinLines.map((ln) => ({
        ...ln,
        amount: Math.floor(ln.amount * clash.winnerMultiplier),
      }));
      const winAmount = Math.min(
        scaledLines.reduce((s, ln) => s + ln.amount, 0),
        Math.max(0, cfg.maxWin),
      );

      return {
        grid: expanded,
        winAmount,
        highlights: evaluation.displayHighlights,
        winLines: scaledLines,
        bonus: {
          type: 'gears_clash',
          payload: {
            gearA: { multiplier: clash.gearA },
            gearB: { multiplier: clash.gearB },
            winnerReel: reel,
            winnerMultiplier: clash.winnerMultiplier,
          },
        },
      };
    }
    return null;
  }

  // ------------------------------------------------------------- Session-Spin

  private spinSessionRound(balanceBefore: number): SpinResult {
    const cfg = this.config;
    const session = this.session!;

    if (session.bonusId === 'deadlock_mode' && session.phase === 'collection') {
      return this.spinDeadlockCollection(balanceBefore);
    }

    const bet = session.triggerBet;
    const pool = buildIsolatedSymbolPool(cfg, session.bonusId);
    const landed = sampleGridFromPool(cfg, pool, this.rng);

    let grid = landed;
    if (session.bonusId === 'heist_run') {
      session.stickyWilds = mergeCells(session.stickyWilds, wildCellsOnGrid(cfg, landed));
      grid = applyStickyWilds(cfg, landed, session.stickyWilds);
    } else if (session.bonusId === 'deadlock_mode') {
      grid = injectGuaranteedWilds(cfg, landed, session.wildPool, this.rng);
    }

    const evaluated = evaluateDemoBaseSpin(cfg, grid, bet);
    let winAmount = evaluated.winAmount;
    let clash: ReturnType<typeof rollClashOutcome> | null = null;

    if (session.bonusId === 'deadlock_mode') {
      winAmount = Math.min(
        winAmount * session.overdriveMultiplier(),
        Math.max(0, cfg.maxWin),
      );
    }

    if (session.bonusId === 'gears_clash' && session.shouldShowClash(this.rng)) {
      clash = rollClashOutcome(cfg, this.rng);
      session.clashesShown += 1;
      const wildId = firstWildSymbolId(cfg);
      if (wildId) {
        const expanded = grid.map((col, i) =>
          i === clash!.winnerReel ? col.map(() => wildId) : col,
        );
        winAmount = Math.min(
          Math.round(
            evaluateDemoBaseSpin(cfg, expanded, bet).winAmount * clash.winnerMultiplier,
          ),
          Math.max(0, cfg.maxWin),
        );
      }
    }

    session.addWin(winAmount);
    session.consumeSpin();
    session.applyRetrigger(cfg, landed);

    const complete = session.remainingSpins === 0;
    const balanceAfter = complete
      ? Math.max(0, Math.round(balanceBefore + session.bankedWin))
      : balanceBefore;

    const bonus = this.buildSessionPayload(session, complete, clash);
    if (complete) this.session = null;

    return this.buildResult(
      grid,
      winAmount,
      balanceAfter,
      bonus,
      evaluated.displayHighlights,
      evaluated.displayWinLines,
    );
  }

  private buildSessionPayload(
    session: MockBonusSession,
    complete: boolean,
    clash: ReturnType<typeof rollClashOutcome> | null,
  ): BonusSessionPayload {
    switch (session.bonusId) {
      case 'heist_run':
        return {
          type: 'heist_run',
          payload: {
            freeSpinsAwarded: session.totalSpins,
            currentSpin: session.roundsPlayed,
            stickyWilds: [...session.stickyWilds],
          },
          session: session.meta(complete),
        };
      case 'gears_clash':
        return {
          type: 'gears_clash',
          payload: {
            gearA: { multiplier: clash?.gearA ?? 0 },
            gearB: { multiplier: clash?.gearB ?? 0 },
            ...(clash
              ? {
                  winnerReel: clash.winnerReel,
                  winnerMultiplier: clash.winnerMultiplier,
                }
              : {}),
          },
          session: session.meta(complete),
        };
      default:
        return {
          type: 'deadlock_mode',
          payload: {
            phase: 'overdrive',
            collectedSymbols: [...session.collected],
            remainingSpins: session.remainingSpins,
          },
          session: session.meta(complete),
        };
    }
  }

  private spinDeadlockCollection(balanceBefore: number): SpinResult {
    const session = this.session!;
    const round = rollDeadlockCollectionRound(this.config, this.rng);
    const phaseDone = session.applyCollectionRound(round);
    session.roundsPlayed += 1;
    if (phaseDone) session.enterOverdrive();

    return this.buildResult(
      round.reelStops,
      0,
      balanceBefore,
      {
        type: 'deadlock_mode',
        payload: {
          phase: session.phase,
          lives: session.lives,
          collectedSymbols: [...session.collected],
          ...(session.phase === 'overdrive'
            ? { remainingSpins: session.remainingSpins }
            : {}),
        },
        session: session.meta(false),
      },
      round.collected.map((c) => ({ reel: c.reel, row: c.row })),
      [],
    );
  }

  private buildResult(
    reelStops: string[][],
    winAmount: number,
    balanceAfter: number,
    bonus: BonusSessionPayload | null,
    displayHighlights: SpinResult['displayHighlights'] = [],
    displayWinLines: SpinResult['displayWinLines'] = [],
  ): SpinResult {
    return {
      spinId: `spin_${Date.now()}_${++this.spinCounter}`,
      reelStops,
      winAmount,
      balanceAfter,
      bonus,
      ...(displayHighlights && displayHighlights.length > 0
        ? { displayHighlights }
        : {}),
      ...(displayWinLines && displayWinLines.length > 0 ? { displayWinLines } : {}),
    };
  }
}

function mergeCells<T extends { reel: number; row: number }>(
  existing: T[],
  incoming: T[],
): T[] {
  const map = new Map<string, T>();
  for (const cell of [...existing, ...incoming]) {
    map.set(`${cell.reel},${cell.row}`, cell);
  }
  return [...map.values()];
}
