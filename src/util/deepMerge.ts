export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Rekursives Merge für JSON-ähnliche Config-Objekte (Arrays werden ersetzt, nicht elementweise gemerged). */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T> | undefined,
): T {
  if (!patch) return structuredClone(base) as T;
  const out = structuredClone(base) as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    const pv = (patch as Record<string, unknown>)[key];
    const bv = out[key];
    if (pv === undefined) continue;
    if (Array.isArray(pv)) {
      out[key] = structuredClone(pv);
      continue;
    }
    if (isPlainObject(pv) && isPlainObject(bv)) {
      out[key] = deepMerge(
        bv as Record<string, unknown>,
        pv as Record<string, unknown>,
      );
    } else {
      out[key] = structuredClone(pv);
    }
  }
  return out as T;
}
