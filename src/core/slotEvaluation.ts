import type {
  BonusId,
  GameConfig,
  SlotMathConfig,
  SlotPaylineDefinition,
  SpinDisplayHighlight,
  SpinDisplayWinLine,
  SymbolKind,
} from '../config/types';
import { countBonusScatterOfTypeFullGrid } from './scatterAnticipation';

/** Ergebnis der Demo-/Referenzauswertung — identisch strukturiert zur API-Darstellung. */
export interface DemoSpinEvaluation {
  readonly winAmount: number;
  readonly displayWinLines: SpinDisplayWinLine[];
  readonly displayHighlights: SpinDisplayHighlight[];
  readonly bonusType: BonusId | null;
}

function mapSymbols(cfg: GameConfig): Map<
  string,
  { kind: SymbolKind; label: string; bonusId?: BonusId }
> {
  return new Map(
    cfg.symbols.map((s) => [
      s.id,
      {
        kind: s.kind,
        label: s.label,
        ...(s.bonusId ? { bonusId: s.bonusId } : {}),
      },
    ]),
  );
}

function symbolKindFor(
  defs: Map<string, { kind: SymbolKind }>,
  id: string,
): SymbolKind | undefined {
  return defs.get(id)?.kind;
}

/** Erste Wild-ID in `cfg.symbols` — für reine-Wild-Ketten (Pay-Ladder wie in `lineMultipliersBySymbolId`). */
function firstWildSymbolIdForPayline(cfg: GameConfig, math: SlotMathConfig): string | null {
  for (const s of cfg.symbols) {
    if (s.kind !== 'wild') continue;
    const row = math.lineMultipliersBySymbolId[s.id];
    if (row?.length) return s.id;
  }
  return null;
}

/**
 * Nur aktive Linien werden ausgewertet und angezeigt. `enabled` ist optional —
 * fehlt es, gilt die Linie als aktiv (Rückwärtskompatibilität bestehender Configs).
 */
export function activePaylines(
  math: SlotMathConfig,
): readonly SlotPaylineDefinition[] {
  return math.paylines.filter((line) => line.enabled !== false);
}

/** Links-nach-Rechts; Wild gilt als Gleiches zur Pay-Symbolkette → 2×Pay + Wild = 3 Walzen Treffer bei minMatch 3. */
function evaluatePayline(
  reelStops: string[][],
  cfg: GameConfig,
  math: SlotMathConfig,
  bet: number,
  line: SlotMathConfig['paylines'][number],
  defs: Map<string, { kind: SymbolKind; label: string; bonusId?: BonusId }>,
): SpinDisplayWinLine | null {
  const { reels, rows } = cfg.grid;
  if (!Array.isArray(line.rows) || line.rows.length !== reels) return null;

  const ids: string[] = [];
  const points: SpinDisplayHighlight[] = [];

  for (let reel = 0; reel < reels; reel++) {
    const row = line.rows[reel]!;
    if (typeof row !== 'number' || row < 0 || row >= rows) return null;
    const id = reelStops[reel]?.[row];
    if (!id) return null;
    ids.push(id);
    points.push({ reel, row });
  }

  let paySymId: string | null = null;
  let runLen = 0;

  for (const id of ids) {
    /** Scatter zahlen nicht auf Linien — sie beenden die Kette, verwerfen sie aber nicht. */
    if (symbolKindFor(defs, id) === 'bonus') break;

    if (paySymId === null) {
      if (symbolKindFor(defs, id) === 'wild') {
        runLen += 1;
        continue;
      }
      paySymId = id;
      runLen += 1;
      continue;
    }

    if (
      symbolKindFor(defs, id) === 'wild' ||
      paySymId === id
    ) {
      runLen += 1;
      continue;
    }
    break;
  }

  if (paySymId === null && runLen >= math.minMatchLength) {
    paySymId = firstWildSymbolIdForPayline(cfg, math);
  }

  if (paySymId === null || runLen < math.minMatchLength) return null;

  const multRow = math.lineMultipliersBySymbolId[paySymId];
  if (!multRow?.length) {
    return null;
  }

  const ladderIdx = Math.min(
    Math.max(runLen - math.minMatchLength, 0),
    multRow.length - 1,
  );
  const mult = multRow[ladderIdx] ?? 0;
  if (!(mult > 0)) return null;

  let amount = Math.floor((bet * mult) / math.referenceBet);
  /** Kleine Beträge: sonst verschwindet 2 OAK bei niedrigem Betrag rechnerisch als 0 Coins. */
  if (mult > 0 && amount < 1) amount = 1;
  if (amount <= 0) return null;

  const trimmedPoints = points.slice(0, runLen);
  const labelDef = defs.get(paySymId);
  const labelTxt = `${runLen}x ${labelDef?.label ?? paySymId}`;

  return {
    id: line.id,
    points: trimmedPoints,
    amount,
    label: labelTxt,
  };
}

function resolveScatterBonus(
  cfg: GameConfig,
  reelStops: string[][],
  math: SlotMathConfig,
): BonusId | null {
  /**
   * `bonusTriggers.bonusSymbolIds` ist die Whitelist der auslösenden Scatter.
   * Ist sie leer, zählt jedes Symbol mit `kind: 'bonus'` — so bleiben ältere
   * Host-Configs ohne Whitelist unverändert lauffähig.
   */
  const allowed = new Set(cfg.bonusTriggers?.bonusSymbolIds ?? []);
  const seen = new Set<BonusId>();
  for (const s of cfg.symbols) {
    if (s.kind !== 'bonus' || !s.bonusId) continue;
    if (allowed.size > 0 && !allowed.has(s.id)) continue;
    seen.add(s.bonusId);
  }

  let bestCnt = -1;
  const atBest: BonusId[] = [];
  for (const bid of seen) {
    const n = countBonusScatterOfTypeFullGrid(reelStops, bid, cfg);
    if (n < math.scatterMinBonus) continue;
    if (n > bestCnt) {
      bestCnt = n;
      atBest.length = 0;
      atBest.push(bid);
    } else if (n === bestCnt) {
      atBest.push(bid);
    }
  }

  if (atBest.length === 0 || bestCnt < 0) return null;

  for (const bid of math.scatterBonusResolutionOrder) {
    if (atBest.includes(bid)) return bid;
  }
  return atBest.sort()[0] ?? null;
}

/**
 * Basis-Spiel-Auswertung für Raster + SlotMath-Konfiguration (Demo-/Referenz-Parität).
 * Standard: Gewinn ab `minMatchLength` von links; Wild zählt mit (2×Pay-Symbol + Wild = 3er bei min 3).
 * Produkt-Host liefert live autoritativ; ohne `cfg.slotMath` → Nullergebnisse.
 */
export function evaluateDemoBaseSpin(
  cfg: GameConfig,
  reelStops: string[][],
  bet: number,
): DemoSpinEvaluation {
  const math = cfg.slotMath;
  if (!math || bet <= 0) {
    return {
      winAmount: 0,
      displayWinLines: [],
      displayHighlights: [],
      bonusType: null,
    };
  }

  const defs = mapSymbols(cfg);
  const winLines: SpinDisplayWinLine[] = [];
  for (const ln of activePaylines(math)) {
    const w = evaluatePayline(reelStops, cfg, math, bet, ln, defs);
    if (w) winLines.push(w);
  }

  winLines.sort((a, b) => a.amount - b.amount);

  let winAmount = winLines.reduce((s, ln) => s + ln.amount, 0);
  winAmount = Math.min(winAmount, Math.max(0, cfg.maxWin));

  const key = (r: SpinDisplayHighlight) => `${r.reel},${r.row}`;
  const seen = new Set<string>();
  const displayHighlights: SpinDisplayHighlight[] = [];
  for (const ln of winLines) {
    for (const p of ln.points) {
      const k = key(p);
      if (!seen.has(k)) {
        seen.add(k);
        displayHighlights.push({ ...p });
      }
    }
  }

  const bonusType = resolveScatterBonus(cfg, reelStops, math);

  return {
    winAmount,
    displayWinLines: winLines,
    displayHighlights,
    bonusType,
  };
}
