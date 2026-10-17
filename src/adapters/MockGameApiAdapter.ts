import { defaultGameConfig } from '../config/defaultGameConfig';
import type {
  BonusId,
  BonusSessionPayload,
  GameConfig,
  SpinRequest,
  SpinResult,
} from '../config/types';
import { countBonusScatterOfTypeFullGrid } from '../core/scatterAnticipation';
import { evaluateDemoBaseSpin } from '../core/slotEvaluation';
import type { DemoSpinEvaluation } from '../core/slotEvaluation';
import {
  buildDemoReelStops,
  isDemoSpinScenarioId,
} from '../config/demoSpinPresets';
import type { GameApiAdapter } from './GameApiAdapter';
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
} from './mockBonusSessions';
import { mulberry32 } from '../util/random';

export interface MockGameApiAdapterOptions {
  /** Optional: reproduzierbare Spins für Tests/Debug. */
  seed?: number;
  /** Startguthaben (Social Coins). */
  initialBalance?: number;
  config?: GameConfig;
}

const GEARS_VS_SYMBOL_ID = 'gears_vs';

/**
 * NUR Demo / lokale Entwicklung.
 *
 * Der Adapter übernimmt hier bewusst die **Server-Rolle**: er entscheidet Bonus-Trigger,
 * Free-Spin-Budgets, Retrigger und die Bonusbank. Der Client visualisiert das Ergebnis
 * nur. Die Session-Mechanik selbst liegt in `mockBonusSessions.ts` und ist mit
 * `server/spin-engine.ts` deckungsgleich gehalten.
 *
 * Echte Auszahlungen liefert ausschließlich der Host über `HttpGameApiAdapter`.
 */
export class MockGameApiAdapter implements GameApiAdapter {
  private balance: number;
  private readonly rng: Rng;
  private readonly basePool: SymbolPool;
  private spinCounter = 0;
  private session: MockBonusSession | null = null;

  constructor(private readonly options: MockGameApiAdapterOptions = {}) {
    this.balance = options.initialBalance ?? 10_000;
    const cfg = options.config ?? defaultGameConfig;
    this.basePool = buildIsolatedSymbolPool(cfg, null);
    this.rng =
      options.seed !== undefined ? mulberry32(options.seed) : () => Math.random();
  }

  async getBalance(): Promise<number> {
    await this.delay(40);
    return this.balance;
  }

  async spin(request: SpinRequest): Promise<SpinResult> {
    const cfg = this.options.config ?? defaultGameConfig;
    const mode = request.mode ?? 'base';

    if (this.session && this.isContinuationRequest(request, mode)) {
      return this.spinSessionRound(cfg, request);
    }

    /** Ein regulärer Base-Spin bricht eine hängengebliebene Session bewusst ab. */
    this.session = null;
    return this.spinBaseRound(cfg, request);
  }

  private isContinuationRequest(request: SpinRequest, mode: string): boolean {
    const active = this.session?.bonusId;
    if (!active) return false;
    if (mode === active) return true;
    const meta = request.meta ?? {};
    return (
      (active === 'heist_run' && meta.heistSession === true) ||
      (active === 'deadlock_mode' && meta.deadlockSession === true) ||
      (active === 'gears_clash' && meta.gearsSession === true)
    );
  }

  // ---------------------------------------------------------------- Base-Spin

  private async spinBaseRound(
    cfg: GameConfig,
    request: SpinRequest,
  ): Promise<SpinResult> {
    const scenarioRaw = request.meta?.demoSpinScenario;
    const usePreset =
      typeof scenarioRaw === 'string' && isDemoSpinScenarioId(scenarioRaw);
    await this.delay(usePreset ? 40 : 120 + this.rng() * 120);

    const bet = Math.max(0, Math.min(request.bet, this.balance));
    const reelStops = usePreset
      ? buildDemoReelStops(scenarioRaw, cfg)
      : sampleGridFromPool(cfg, this.basePool, this.rng);

    const evaluated = evaluateDemoBaseSpin(cfg, reelStops, bet);
    const forced = this.readForcedBonus(request);
    const bonusId = forced ?? evaluated.bonusType;

    let winAmount = evaluated.winAmount;
    let displayWinLines = evaluated.displayWinLines;
    let displayHighlights = evaluated.displayHighlights;
    let bonus: BonusSessionPayload | null = null;

    if (bonusId) {
      bonus = this.startSession(cfg, bonusId, reelStops, bet);
    } else {
      /** Einzelspin-Battle: nur wenn das VS-Symbol als Full-Reel-Wild einen Treffer erzeugt. */
      const battle = this.resolveSingleSpinBattle(cfg, reelStops, bet, evaluated);
      if (battle) {
        winAmount = battle.winAmount;
        displayWinLines = battle.evaluation.displayWinLines;
        displayHighlights = battle.evaluation.displayHighlights;
        bonus = battle.bonus;
      }
    }

    this.balance = Math.max(0, Math.round(this.balance - bet + winAmount));

    return this.buildResult(
      `mock-${++this.spinCounter}-${Math.floor(this.rng() * 1e9)}`,
      reelStops,
      winAmount,
      bonus,
      displayHighlights,
      displayWinLines,
    );
  }

  private readForcedBonus(request: SpinRequest): BonusId | null {
    const raw = request.meta?.forceBonus;
    if (
      raw === 'gears_clash' ||
      raw === 'heist_run' ||
      raw === 'deadlock_mode'
    ) {
      return raw;
    }
    return null;
  }

  private startSession(
    cfg: GameConfig,
    bonusId: BonusId,
    reelStops: string[][],
    bet: number,
  ): BonusSessionPayload {
    const scatters = countBonusScatterOfTypeFullGrid(reelStops, bonusId, cfg);

    if (bonusId === 'deadlock_mode') {
      const session = new MockBonusSession(bonusId, bet, 0);
      this.session = session;
      return {
        type: 'deadlock_mode',
        payload: {
          phase: 'collection',
          lives: DEADLOCK_START_LIVES,
          collectedSymbols: [],
        },
        session: session.meta(false),
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

  /**
   * Gears Clash im Basisspiel (gears-clash.md §3): Expand nur, wenn die Walze als
   * Full-Reel-Wild tatsächlich einen Treffer erzeugt. Ohne Freispiel-Session.
   */
  private resolveSingleSpinBattle(
    cfg: GameConfig,
    reelStops: string[][],
    bet: number,
    base: DemoSpinEvaluation,
  ): {
    winAmount: number;
    evaluation: DemoSpinEvaluation;
    bonus: BonusSessionPayload;
  } | null {
    const wildId = firstWildSymbolId(cfg);
    if (!wildId || bet <= 0) return null;

    for (let reel = 0; reel < reelStops.length; reel++) {
      if (!reelStops[reel]?.includes(GEARS_VS_SYMBOL_ID)) continue;
      const expanded = reelStops.map((col, i) =>
        i === reel ? col.map(() => wildId) : [...col],
      );
      const evaluation = evaluateDemoBaseSpin(cfg, expanded, bet);
      if (evaluation.winAmount <= base.winAmount) continue;

      const clash = rollClashOutcome(cfg, this.rng);
      const winAmount = Math.min(
        Math.round(evaluation.winAmount * clash.winnerMultiplier),
        Math.max(0, cfg.maxWin),
      );
      return {
        winAmount,
        evaluation,
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

  private async spinSessionRound(
    cfg: GameConfig,
    _request: SpinRequest,
  ): Promise<SpinResult> {
    await this.delay(55 + this.rng() * 70);
    const session = this.session!;

    if (session.bonusId === 'deadlock_mode' && session.phase === 'collection') {
      return this.spinDeadlockCollection(cfg, session);
    }

    /** Freispiele kosten keinen Einsatz; bewertet wird der Einsatz des Trigger-Spins. */
    const bet = session.triggerBet;
    const pool = buildIsolatedSymbolPool(cfg, session.bonusId);
    const landed = sampleGridFromPool(cfg, pool, this.rng);

    let grid = landed;
    let bonusPayload: BonusSessionPayload;

    if (session.bonusId === 'heist_run') {
      session.stickyWilds = mergeCells(session.stickyWilds, wildCellsOnGrid(cfg, landed));
      grid = applyStickyWilds(cfg, landed, session.stickyWilds);
    } else if (session.bonusId === 'deadlock_mode') {
      grid = injectGuaranteedWilds(cfg, landed, session.wildPool, this.rng);
    }

    const evaluated = evaluateDemoBaseSpin(cfg, grid, bet);
    let winAmount = evaluated.winAmount;
    let clashReel: number | undefined;
    let clashMultiplier: number | undefined;
    let gearA = 0;
    let gearB = 0;

    if (session.bonusId === 'deadlock_mode') {
      winAmount = Math.min(
        winAmount * session.overdriveMultiplier(),
        Math.max(0, cfg.maxWin),
      );
    }

    if (session.bonusId === 'gears_clash' && session.shouldShowClash(this.rng)) {
      const clash = rollClashOutcome(cfg, this.rng);
      gearA = clash.gearA;
      gearB = clash.gearB;
      clashReel = clash.winnerReel;
      clashMultiplier = clash.winnerMultiplier;
      session.clashesShown += 1;
      const wildId = firstWildSymbolId(cfg);
      if (wildId) {
        const expanded = grid.map((col, i) =>
          i === clashReel ? col.map(() => wildId) : col,
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
    if (complete) {
      /** Bonusbank wird erst am Session-Ende auf die Balance gebucht (heist-run.md §8.4). */
      this.balance = Math.max(0, Math.round(this.balance + session.bankedWin));
    }

    switch (session.bonusId) {
      case 'heist_run':
        bonusPayload = {
          type: 'heist_run',
          payload: {
            freeSpinsAwarded: session.totalSpins,
            currentSpin: session.roundsPlayed,
            stickyWilds: [...session.stickyWilds],
          },
          session: session.meta(complete),
        };
        break;
      case 'gears_clash':
        bonusPayload = {
          type: 'gears_clash',
          payload: {
            gearA: { multiplier: gearA },
            gearB: { multiplier: gearB },
            ...(clashReel !== undefined ? { winnerReel: clashReel } : {}),
            ...(clashMultiplier !== undefined
              ? { winnerMultiplier: clashMultiplier }
              : {}),
          },
          session: session.meta(complete),
        };
        break;
      default:
        bonusPayload = {
          type: 'deadlock_mode',
          payload: {
            phase: 'overdrive',
            collectedSymbols: [...session.collected],
            remainingSpins: session.remainingSpins,
          },
          session: session.meta(complete),
        };
    }

    const spinId = `mock-${session.bonusId}-${++this.spinCounter}`;
    if (complete) this.session = null;

    return this.buildResult(
      spinId,
      grid,
      winAmount,
      bonusPayload,
      evaluated.displayHighlights,
      evaluated.displayWinLines,
    );
  }

  private spinDeadlockCollection(
    cfg: GameConfig,
    session: MockBonusSession,
  ): SpinResult {
    const round = rollDeadlockCollectionRound(cfg, this.rng);
    const phaseDone = session.applyCollectionRound(round);
    session.roundsPlayed += 1;
    if (phaseDone) session.enterOverdrive();

    return this.buildResult(
      `mock-deadlock-collect-${++this.spinCounter}`,
      round.reelStops,
      0,
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

  // ------------------------------------------------------------------ Helfer

  private buildResult(
    spinId: string,
    reelStops: string[][],
    winAmount: number,
    bonus: BonusSessionPayload | null,
    displayHighlights: { reel: number; row: number }[],
    displayWinLines: SpinResult['displayWinLines'] = [],
  ): SpinResult {
    return {
      spinId,
      reelStops,
      winAmount,
      balanceAfter: this.balance,
      bonus,
      ...(displayHighlights.length > 0 ? { displayHighlights } : {}),
      ...(displayWinLines && displayWinLines.length > 0
        ? { displayWinLines }
        : {}),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
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
