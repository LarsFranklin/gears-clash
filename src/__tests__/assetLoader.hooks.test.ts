import { describe, expect, it, vi } from 'vitest';
import { defaultAssetManifest } from '../config/assetManifest';
import { AssetLoader } from '../renderer/AssetLoader';

describe('AssetLoader hooks', () => {
  it('ruft onSymbolMissing bei unbekannter Symbol-ID auf', () => {
    const onSymbolMissing = vi.fn();
    const loader = new AssetLoader(defaultAssetManifest, { onSymbolMissing });
    const path = loader.getSymbolPath('unknown_symbol_xyz');
    expect(onSymbolMissing).toHaveBeenCalledWith(
      'unknown_symbol_xyz',
      defaultAssetManifest.fallback?.symbol ?? null,
    );
    expect(path).toBe(defaultAssetManifest.fallback?.symbol ?? null);
  });

  it('ruft onSymbolMissing nicht auf bei bekanntem Symbol', () => {
    const onSymbolMissing = vi.fn();
    const loader = new AssetLoader(defaultAssetManifest, { onSymbolMissing });
    loader.getSymbolPath('bolt');
    expect(onSymbolMissing).not.toHaveBeenCalled();
  });
});
