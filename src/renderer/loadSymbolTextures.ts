import { Assets, Texture } from 'pixi.js';
import type { AssetLoader } from './AssetLoader';

function asTexture(res: unknown): Texture | null {
  if (res instanceof Texture) return res;
  if (res && typeof res === 'object' && 'texture' in res) {
    const t = (res as { texture: unknown }).texture;
    return t instanceof Texture ? t : null;
  }
  return null;
}

export interface LoadedSymbolTextures {
  readonly map: ReadonlyMap<string, Texture>;
  /** URLs an `Assets.unload` übergeben (Renderer-Destroy). */
  readonly sourceUrls: readonly string[];
}

/**
 * Lädt Symbol-Texturen aus dem Manifest (fehlgeschlagene URLs → kein Eintrag, prozeduraler Fallback).
 */
export async function loadSymbolTexturesFromManifest(
  loader: AssetLoader,
  symbolIds: readonly string[],
): Promise<LoadedSymbolTextures> {
  const map = new Map<string, Texture>();
  const sourceUrls: string[] = [];

  for (const id of symbolIds) {
    const url = loader.getSymbolPath(id);
    if (!url) continue;
    try {
      const res = await Assets.load(url);
      const tex = asTexture(res);
      if (!tex) continue;
      map.set(id, tex);
      sourceUrls.push(url);
    } catch {
      /* 404 / CORS — Fallback bleibt prozedural */
    }
  }

  return { map, sourceUrls };
}
