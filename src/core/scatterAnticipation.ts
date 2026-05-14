import type { BonusId, GameConfig } from '../config/types';

/**
 * Zählt Bonussymbole einer ID im Prefix der Walzen `0 … lastStoppedColumnInclusive`.
 * Nur Darstellung / Mock-Tuning — Welche Kombis den Bonus auslösen, entscheidet der Server.
 */
export function countBonusScatterOfTypeForColumnPrefix(
  reelStops: string[][],
  lastStoppedColumnInclusive: number,
  bonusId: BonusId,
  cfg: GameConfig,
): number {
  const symId = cfg.symbols.find(
    (s) => s.kind === 'bonus' && s.bonusId === bonusId,
  )?.id;
  if (!symId) return 0;
  let n = 0;
  const hi = Math.min(lastStoppedColumnInclusive, reelStops.length - 1);
  for (let c = 0; c <= hi; c++) {
    const col = reelStops[c] ?? [];
    for (const id of col) {
      if (id === symId) n++;
    }
  }
  return n;
}

/** True, wenn in den bereits stehenden Walzen irgendein Bonustyp bereits mindestens 2× vorkommt. */
export function columnPrefixTriggersScatterHuntVisual(
  reelStops: string[][],
  lastStoppedColumnInclusive: number,
  cfg: GameConfig,
): boolean {
  const symById = new Map(cfg.symbols.map((s) => [s.id, s] as const));
  const counts = new Map<BonusId, number>();
  const hi = Math.min(lastStoppedColumnInclusive, reelStops.length - 1);
  for (let c = 0; c <= hi; c++) {
    for (const id of reelStops[c] ?? []) {
      const sym = symById.get(id);
      if (sym?.kind === 'bonus' && sym.bonusId) {
        counts.set(sym.bonusId, (counts.get(sym.bonusId) ?? 0) + 1);
      }
    }
  }
  for (const n of counts.values()) {
    if (n >= 2) return true;
  }
  return false;
}

/** Volles Raster (alle Walzen ausgewertet) — z. B. Mock-Payload bei Bonus. */
export function countBonusScatterOfTypeFullGrid(
  reelStops: string[][],
  bonusId: BonusId,
  cfg: GameConfig,
): number {
  const lastCol = reelStops.length === 0 ? -1 : reelStops.length - 1;
  if (lastCol < 0) return 0;
  return countBonusScatterOfTypeForColumnPrefix(reelStops, lastCol, bonusId, cfg);
}
