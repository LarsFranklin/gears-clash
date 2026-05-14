import type {
  GameConfig,
  SlotMathConfig,
  SpinResult,
  GearsClashPayload,
  SpinDisplayWinLine,
  SpinDisplayHighlight,
} from '../src/config/types';
import { evaluateDemoBaseSpin } from '../src/core/slotEvaluation';

interface GearsVsPosition {
  reel: number;
  row: number;
}

/**
 * Server-Spin-Engine für Gears Clash Feature.
 * Erkennt VS-Symbole und entscheidet ob Expand/Battle ausgelöst wird.
 */
export class SpinEngine {
  private rng: () => number;

  constructor(seed?: number) {
    // Einfacher seeded RNG für reproduzierbare Tests
    let s = seed ?? Math.random() * 0x100000000;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) / 0x100000000);
    };
  }

  /**
   * Generiert einen zufälligen Spin mit Gears Clash Logic.
   */
  generateSpin(
    cfg: GameConfig,
    bet: number,
    balanceBefore: number,
  ): SpinResult {
    // 1. Reel Stops generieren
    let reelStops = this.generateReelStops(cfg);

    // 2. Basis-Auswertung (ohne Gears Clash)
    let evaluation = evaluateDemoBaseSpin(cfg, reelStops, bet);

    // 3. Gears Clash Feature prüfen
    const vsPositions = this.findGearsVsSymbols(reelStops, cfg);
    let gearsClashPayload: GearsClashPayload | null = null;

    if (vsPositions.length > 0) {
      const result = this.evaluateGearsClash(
        reelStops,
        vsPositions,
        cfg,
        bet,
        evaluation,
      );

      if (result) {
        gearsClashPayload = result.payload;
        evaluation = result.updatedEvaluation;
        // WICHTIG: Wir liefern die expandierten Stops aus, damit
        // Renderer + Win-Lines konsistent sind (Linien gehen durch Wilds).
        reelStops = result.expandedReelStops;
      }
    }

    const totalWin = evaluation.winAmount;
    const balanceAfter = balanceBefore + totalWin - bet;

    return {
      spinId: `spin_${Date.now()}_${Math.floor(this.rng() * 10000)}`,
      reelStops,
      winAmount: totalWin,
      balanceAfter,
      displayWinLines: evaluation.displayWinLines,
      displayHighlights: evaluation.displayHighlights,
      bonus: gearsClashPayload
        ? { type: 'gears_clash', payload: gearsClashPayload }
        : evaluation.bonusType
          ? { type: evaluation.bonusType, payload: this.mockBonusPayload(evaluation.bonusType) }
          : null,
      meta: {
        gearsClashTriggered: gearsClashPayload !== null,
        vsSymbolCount: vsPositions.length,
      },
    };
  }

  private generateReelStops(cfg: GameConfig): string[][] {
    const { reels, rows } = cfg.grid;
    const weights = cfg.symbolWeights;
    const symbolIds = Object.keys(weights);
    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);

    const result: string[][] = [];
    for (let r = 0; r < reels; r++) {
      const col: string[] = [];
      for (let row = 0; row < rows; row++) {
        let rand = this.rng() * totalWeight;
        let picked = symbolIds[0]!;
        for (const id of symbolIds) {
          rand -= weights[id]!;
          if (rand <= 0) {
            picked = id;
            break;
          }
        }
        col.push(picked);
      }
      result.push(col);
    }
    return result;
  }

  private findGearsVsSymbols(
    reelStops: string[][],
    cfg: GameConfig,
  ): GearsVsPosition[] {
    const positions: GearsVsPosition[] = [];
    for (let reel = 0; reel < reelStops.length; reel++) {
      const col = reelStops[reel]!;
      for (let row = 0; row < col.length; row++) {
        if (col[row] === 'gears_vs') {
          positions.push({ reel, row });
        }
      }
    }
    return positions;
  }

  private evaluateGearsClash(
    reelStops: string[][],
    vsPositions: GearsVsPosition[],
    cfg: GameConfig,
    bet: number,
    baseEvaluation: ReturnType<typeof evaluateDemoBaseSpin>,
  ): {
    payload: GearsClashPayload;
    updatedEvaluation: ReturnType<typeof evaluateDemoBaseSpin>;
    expandedReelStops: string[][];
  } | null {
    const math = cfg.slotMath;
    if (!math) return null;

    // Nimm das erste VS-Symbol (vereinfacht - später mehrere möglich)
    const vsPos = vsPositions[0]!;

    // Prüfe ob dieses VS in einer Win-Line liegt UND als Wild einen Gewinn erzeugen würde
    const wouldWinWithWild = this.checkIfWildWouldWinOnReel(
      reelStops,
      vsPos.reel,
      cfg,
      math,
    );

    if (!wouldWinWithWild) {
      return null; // Kein Expand, bleibt normales Symbol
    }

    // Battle: zwei Multiplier generieren
    const range = cfg.multiplierRanges;
    const mulA = range.min + Math.floor(this.rng() * (range.max - range.min + 1));
    const mulB = range.min + Math.floor(this.rng() * (range.max - range.min + 1));

    // Niedrigerer gewinnt häufiger (70% Chance)
    const lowerWins = this.rng() < 0.7;
    const winnerMultiplier = lowerWins
      ? Math.min(mulA, mulB)
      : Math.max(mulA, mulB);

    // Expandiere die gesamte Walze zu Wild mit Multiplier
    const expandedReelStops = this.expandReelToWild(
      reelStops,
      vsPos.reel,
      cfg,
    );

    // Neu evaluieren mit Full-Reel-Wild
    const expandedEval = evaluateDemoBaseSpin(cfg, expandedReelStops, bet);

    const m = winnerMultiplier;
    const scaledLines = expandedEval.displayWinLines.map((ln) => ({
      ...ln,
      amount: Math.floor(ln.amount * m),
    }));
    let winAmount = scaledLines.reduce((s, ln) => s + ln.amount, 0);
    winAmount = Math.min(winAmount, Math.max(0, cfg.maxWin));

    const key = (r: SpinDisplayHighlight) => `${r.reel},${r.row}`;
    const seen = new Set<string>();
    const displayHighlights: SpinDisplayHighlight[] = [];
    for (const ln of scaledLines) {
      for (const p of ln.points) {
        const k = key(p);
        if (!seen.has(k)) {
          seen.add(k);
          displayHighlights.push({ ...p });
        }
      }
    }

    const payload: GearsClashPayload = {
      gearA: { multiplier: mulA },
      gearB: { multiplier: mulB },
      winnerReel: vsPos.reel,
      winnerMultiplier,
    };

    return {
      payload,
      updatedEvaluation: {
        ...expandedEval,
        winAmount,
        displayWinLines: scaledLines,
        displayHighlights,
      },
      expandedReelStops,
    };
  }

  private checkIfWildWouldWinOnReel(
    reelStops: string[][],
    targetReel: number,
    cfg: GameConfig,
    math: SlotMathConfig,
  ): boolean {
    // Vereinfacht: Setze die Reel temporär auf Wild und prüfe ob Gewinn
    const testStops = reelStops.map((col, r) =>
      r === targetReel ? col.map(() => 'wild_gear') : [...col],
    );
    const testEval = evaluateDemoBaseSpin(cfg, testStops, 100);
    return testEval.winAmount > 0;
  }

  private expandReelToWild(
    reelStops: string[][],
    targetReel: number,
    cfg: GameConfig,
  ): string[][] {
    return reelStops.map((col, r) =>
      r === targetReel ? col.map(() => 'wild_gear') : [...col],
    );
  }

  private mockBonusPayload(bonusType: string): any {
    // Vereinfachte Bonus-Payloads für andere Boni
    return {};
  }
}
