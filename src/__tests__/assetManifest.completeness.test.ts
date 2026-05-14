import { describe, expect, it } from 'vitest';
import {
  defaultAssetManifest,
  resolveManifestPaths,
} from '../config/assetManifest';
import { defaultGameConfig } from '../config/defaultGameConfig';

describe('defaultAssetManifest Konsistenz', () => {
  it('hat einen Pfad für jede ID aus defaultGameConfig.symbols', () => {
    const missing: string[] = [];
    for (const sym of defaultGameConfig.symbols) {
      if (!defaultAssetManifest.symbols[sym.id]) missing.push(sym.id);
    }
    expect(missing).toEqual([]);
  });

  it('definiert einen Fallback-Pfad', () => {
    expect(defaultAssetManifest.fallback?.symbol).toBeTruthy();
  });

  it('resolveManifestPaths lässt absolute Pfade unverändert', () => {
    const resolved = resolveManifestPaths(defaultAssetManifest, defaultGameConfig);
    expect(resolved.symbols.bolt).toBe('/assets/symbols/bolt.png');
  });

  it('resolveManifestPaths kombiniert relative Pfade mit basePath', () => {
    const manifest = {
      themeId: 't',
      symbols: { bolt: 'symbols/bolt.png' },
      sounds: {},
    };
    const cfg = {
      ...defaultGameConfig,
      assets: { basePath: '/cdn/v1' },
    };
    const resolved = resolveManifestPaths(manifest, cfg);
    expect(resolved.symbols.bolt).toBe('/cdn/v1/symbols/bolt.png');
  });

  it('resolveManifestPaths erkennt http/https als absolut', () => {
    const manifest = {
      themeId: 't',
      symbols: { bolt: 'https://cdn.example/bolt.png' },
      sounds: {},
    };
    const resolved = resolveManifestPaths(manifest, defaultGameConfig);
    expect(resolved.symbols.bolt).toBe('https://cdn.example/bolt.png');
  });
});
