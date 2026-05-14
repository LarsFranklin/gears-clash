import { defaultGameConfig } from '../config/defaultGameConfig';
import type {
  BonusId,
  BonusSessionPayload,
  DeadlockModePayload,
  GameConfig,
  GearsClashPayload,
  HeistRunPayload,
  HeistRunStickyWild,
  SpinRequest,
  SpinResult,
} from '../config/types';
import { countBonusScatterOfTypeFullGrid } from '../core/scatterAnticipation';
import { evaluateDemoBaseSpin } from '../core/slotEvaluation';
import {
  buildDemoReelStops,
  isDemoSpinScenarioId,
} from '../config/demoSpinPresets';
import { pickWeightedSymbolId } from '../util/pickWeightedSymbolId';
import { mulberry32 } from '../util/random';
import type { GameApiAdapter } from './GameApiAdapter';
import { MOCK_DEADLOCK_DEMO_SEQUENCE } from './mockDeadlockDemoSequence';

const MOCK_EXTRA_FREESPINS_PER_SCATTER_ABOVE_MIN = 2;

export interface MockGameApiAdapterOptions {
  /** Optional: reproduzierbare Spins für Tests/Debug. */
  seed?: number;
  /** Startguthaben (Social Coins). */
  initialBalance?: number;
  config?: GameConfig;
}

/**
 * NUR Demo / lokale Entwicklung.
 *
 * Mit `config.slotMath` entsprechen Gewinne, Win-Lines und Scatter dem Modul `evaluateDemoBaseSpin`.
 * Echte Auszahlungen liefert nur der Host über `HttpGameApiAdapter`.
 */
export class MockGameApiAdapter implements GameApiAdapter {
  private balance: number;
  private readonly rng: () => number;
  private readonly symbolIds: string[];
  private spinCounter = 0;
  /** Demo: Fortsetzungsspins nach Deadlock-Trigger (siehe `MOCK_DEADLOCK_DEMO_SEQUENCE`). */
  private deadlockSessionActive = false;
  private deadlockSessionStep = 0;

  constructor(private readonly options: MockGameApiAdapterOptions = {}) {
    this.balance = options.initialBalance ?? 10_000;
    const cfg = options.config ?? defaultGameConfig;
    this.symbolIds = cfg.symbols.map((s) => s.id);
    this.rng =
      options.seed !== undefined
        ? mulberry32(options.seed)
        : () => Math.random();
  }

  async getBalance(): Promise<number> {
    await this.delay(40);
    return this.balance;
  }

  async spin(request: SpinRequest): Promise<SpinResult> {
    const cfg = this.options.config ?? defaultGameConfig;
    const mode = request.mode ?? 'base';
    const isDeadlockContinue =
      mode === 'deadlock_mode' || request.meta?.deadlockSession === true;

    if (mode === 'base' && !isDeadlockContinue) {
      this.deadlockSessionActive = false;
    }

    if (this.deadlockSessionActive && isDeadlockContinue) {
      return this.spinDeadlockContinuation(cfg, request);
    }

    const scenarioRaw = request.meta?.demoSpinScenario;
    const usePreset =
      typeof scenarioRaw === 'string' && isDemoSpinScenarioId(scenarioRaw);
    await this.delay(
      usePreset ? 40 : 120 + this.rng() * 120,
    );
    const bet = Math.max(0, Math.min(request.bet, this.balance));
    const { reels, rows } = cfg.grid;
    let reelStops: string[][];
    if (usePreset) {
      reelStops = buildDemoReelStops(scenarioRaw, cfg);
    } else {
      reelStops = [];
      for (let r = 0; r < reels; r++) {
        const col: string[] = [];
        for (let row = 0; row < rows; row++) {
          col.push(this.pickSymbolIdWeighted(cfg));
        }
        reelStops.push(col);
      }
    }

    const evaluated = evaluateDemoBaseSpin(cfg, reelStops, bet);
    const winAmount = evaluated.winAmount;
    this.balance = Math.max(0, Math.round(this.balance - bet + winAmount));

    const spinId = `mock-${++this.spinCounter}-${Math.floor(this.rng() * 1e9)}`;

    let bonus = this.pickBonusPayload(
      evaluated.bonusType,
      cfg,
      reelStops,
    );

    if (bonus?.type === 'deadlock_mode') {
      this.deadlockSessionActive = true;
      this.deadlockSessionStep = 0;
      const full = this.mockDeadlockModePayload(cfg, reelStops);
      bonus = {
        type: 'deadlock_mode',
        payload: {
          ...full,
          collectedSymbols: [],
        },
      };
    }

    const displayHighlights =
      evaluated.displayHighlights.length > 0 ? evaluated.displayHighlights : undefined;
    const displayWinLines =
      evaluated.displayWinLines.length > 0 ? evaluated.displayWinLines : undefined;

    return {
      spinId,
      reelStops,
      winAmount,
      balanceAfter: this.balance,
      bonus,
      ...(displayHighlights ? { displayHighlights } : {}),
      ...(displayWinLines ? { displayWinLines } : {}),
    };
  }

  /** Base-Spin: Gewichte aus Konfig (`symbolWeights`), nicht Gleichverteilung über IDs. */
  private pickSymbolIdWeighted(cfg: GameConfig): string {
    return pickWeightedSymbolId(this.symbolIds, cfg.symbolWeights, this.rng);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private pickBonusPayload(
    kind: BonusId | null,
    cfg: GameConfig,
    reelStops: string[][],
  ): BonusSessionPayload | null {
    if (kind === 'gears_clash') {
      return {
        type: 'gears_clash',
        payload: this.mockGearsClashPayload(cfg),
      };
    }
    if (kind === 'heist_run') {
      return {
        type: 'heist_run',
        payload: this.mockHeistRunPayload(cfg, reelStops),
      };
    }
    if (kind === 'deadlock_mode') {
      return {
        type: 'deadlock_mode',
        payload: this.mockDeadlockModePayload(cfg, reelStops),
      };
    }
    return null;
  }

  private mockGearsClashPayload(cfg: GameConfig): GearsClashPayload {
    const range = cfg.multiplierRanges;
    const span = Math.max(1, range.max - range.min);
    const mulA = range.min + Math.floor(this.rng() * span);
    const mulB = range.min + Math.floor(this.rng() * span);
    const winnerMultiplier = mulA >= mulB ? mulA : mulB;
    const winnerReel = Math.floor(this.rng() * cfg.grid.reels);
    return {
      gearA: { multiplier: mulA },
      gearB: { multiplier: mulB },
      winnerReel,
      winnerMultiplier,
    };
  }

  private mockHeistRunPayload(
    cfg: GameConfig,
    reelStops: string[][],
  ): HeistRunPayload {
    const scatterOnGrid = countBonusScatterOfTypeFullGrid(
      reelStops,
      'heist_run',
      cfg,
    );
    const minScatter = cfg.slotMath?.scatterMinBonus ?? 3;
    const freeSpinsAwarded =
      cfg.freeSpinDefaults.count +
      Math.max(0, scatterOnGrid - minScatter) * MOCK_EXTRA_FREESPINS_PER_SCATTER_ABOVE_MIN;
    const stickyCount = 1 + Math.floor(this.rng() * 3);
    const stickyWilds: HeistRunStickyWild[] = [];
    for (let i = 0; i < stickyCount; i++) {
      const reel = Math.floor(this.rng() * cfg.grid.reels);
      const row = Math.floor(this.rng() * cfg.grid.rows);
      stickyWilds.push({
        reel,
        row,
        ...(this.rng() < 0.4
          ? { multiplier: 2 + Math.floor(this.rng() * 4) }
          : {}),
      });
    }
    return {
      freeSpinsAwarded,
      currentSpin: 1,
      stickyWilds,
    };
  }

  private mockDeadlockModePayload(
    cfg: GameConfig,
    reelStops: string[][],
  ): DeadlockModePayload {
    const scatterOnGrid = countBonusScatterOfTypeFullGrid(
      reelStops,
      'deadlock_mode',
      cfg,
    );
    const minScatter = cfg.slotMath?.scatterMinBonus ?? 3;
    const bonusSpinsBoost =
      Math.max(0, scatterOnGrid - minScatter) * MOCK_EXTRA_FREESPINS_PER_SCATTER_ABOVE_MIN;
    return {
      phase: 'collection',
      lives: 3,
      remainingSpins: 5 + bonusSpinsBoost,
      collectedSymbols: [],
    };
  }

  private sampleReelGrid(cfg: GameConfig): string[][] {
    const { reels, rows } = cfg.grid;
    const out: string[][] = [];
    for (let r = 0; r < reels; r++) {
      const col: string[] = [];
      for (let row = 0; row < rows; row++) {
        col.push(this.pickSymbolIdWeighted(cfg));
      }
      out.push(col);
    }
    return out;
  }

  private async spinDeadlockContinuation(
    cfg: GameConfig,
    request: SpinRequest,
  ): Promise<SpinResult> {
    await this.delay(55 + this.rng() * 70);
    const bet = Math.max(0, Math.min(request.bet, this.balance));
    this.deadlockSessionStep += 1;
    const idx = this.deadlockSessionStep - 1;

    if (idx >= MOCK_DEADLOCK_DEMO_SEQUENCE.length) {
      this.deadlockSessionActive = false;
      const reelStops = this.sampleReelGrid(cfg);
      const evaluated = evaluateDemoBaseSpin(cfg, reelStops, bet);
      /** Demo-Abschluss — fester Beispiel-Gewinn (Mock, kein Produkt-RTP). */
      const winAmount = 920 + Math.floor(this.rng() * 80);
      this.balance = Math.max(0, Math.round(this.balance - bet + winAmount));
      const spinId = `mock-deadlock-final-${++this.spinCounter}`;
      return {
        spinId,
        reelStops,
        winAmount,
        balanceAfter: this.balance,
        bonus: null,
        ...(evaluated.displayHighlights.length > 0
          ? { displayHighlights: evaluated.displayHighlights }
          : {}),
        ...(evaluated.displayWinLines.length > 0
          ? { displayWinLines: evaluated.displayWinLines }
          : {}),
      };
    }

    const payload = MOCK_DEADLOCK_DEMO_SEQUENCE[idx]!;
    const reelStops = this.sampleReelGrid(cfg);
    const evaluated = evaluateDemoBaseSpin(cfg, reelStops, bet);
    const winAmount = evaluated.winAmount;
    this.balance = Math.max(0, Math.round(this.balance - bet + winAmount));
    const spinId = `mock-deadlock-${++this.spinCounter}`;
    const displayHighlights =
      evaluated.displayHighlights.length > 0 ? evaluated.displayHighlights : undefined;
    const displayWinLines =
      evaluated.displayWinLines.length > 0 ? evaluated.displayWinLines : undefined;

    return {
      spinId,
      reelStops,
      winAmount,
      balanceAfter: this.balance,
      bonus: { type: 'deadlock_mode', payload },
      ...(displayHighlights ? { displayHighlights } : {}),
      ...(displayWinLines ? { displayWinLines } : {}),
    };
  }
}
