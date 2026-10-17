import type { AssetManifest } from '../config/assetManifest';

export interface AssetLoaderHooks {
  /** Symbol-ID fehlt im Manifest — es wird der Fallback-Pfad genutzt (falls gesetzt). */
  onSymbolMissing?: (symbolId: string, fallbackPath: string | null) => void;
}

/**
 * Asset-Lookup-Schicht.
 *
 * Manifest-Lookup für Symbole und Sounds. Der Renderer kann vorhandene PNG-Pfade
 * via `loadSymbolTexturesFromManifest` laden; fehlende oder kaputte URLs →
 * prozeduraler Fallback (`proceduralSymbol.ts`). Sounds bleiben optional.
 *
 * **Server-Vertrag**: Symbol-IDs / Sound-IDs werden vom Server bzw. der
 * `GameConfig` definiert; das Manifest mappt sie nur auf Pfade. Der Loader
 * trifft keine Spielentscheidungen.
 */
export class AssetLoader {
  constructor(
    private readonly manifest: AssetManifest,
    private readonly hooks?: AssetLoaderHooks,
  ) {}

  getManifest(): AssetManifest {
    return this.manifest;
  }

  /**
   * Pfad für eine Symbol-ID — fällt auf `manifest.fallback.symbol` zurück,
   * wenn die ID nicht im Manifest vorhanden ist.
   */
  getSymbolPath(symbolId: string): string | null {
    const direct = this.manifest.symbols[symbolId];
    if (direct) return direct;
    const fallback = this.manifest.fallback?.symbol ?? null;
    this.hooks?.onSymbolMissing?.(symbolId, fallback);
    return fallback;
  }

  /**
   * Pfad für eine Sound-ID — fällt auf `manifest.fallback.sound` zurück,
   * wenn die ID nicht im Manifest vorhanden ist.
   */
  getSoundPath(soundId: string): string | null {
    const direct = this.manifest.sounds[soundId];
    if (direct) return direct;
    const fb = this.manifest.fallback?.sound;
    return fb ? fb : null;
  }
}
