/**
 * Zieht eine Symbol-ID gemäß `symbolWeights`; fehlende Keys zählen als 1 (nutzbar für optionale Overrides).
 */
export function pickWeightedSymbolId(
  ids: readonly string[],
  weights: Record<string, number> | undefined,
  rng: () => number,
): string {
  let total = 0;
  const row: number[] = [];
  for (const id of ids) {
    const w = weights?.[id];
    const n = typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
    row.push(n);
    total += n;
  }
  if (total <= 0 || ids.length === 0) {
    return ids[0] ?? 'bolt';
  }
  let r = rng() * total;
  for (let i = 0; i < ids.length; i++) {
    r -= row[i]!;
    if (r < 0) return ids[i]!;
  }
  return ids[ids.length - 1]!;
}
