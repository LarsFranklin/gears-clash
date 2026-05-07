import type { GameConfig } from './types';

/**
 * Austauschbare Theme-/Asset-Pfade — später echte PNG/MP3, v1 Platzhalter-kompatibel.
 */
export interface AssetManifest {
  themeId: string;
  symbols: Record<string, string>;
  sounds: Record<string, string>;
}

export const defaultAssetManifest: AssetManifest = {
  themeId: 'default-industrial',
  symbols: {
    bolt: '/assets/symbols/bolt.png',
    nut: '/assets/symbols/nut.png',
    gear: '/assets/symbols/gear.png',
    wild_gear: '/assets/symbols/wild_gear.png',
    bonus_gears_clash: '/assets/symbols/bonus_gears_clash.png',
    bonus_heist_run: '/assets/symbols/bonus_heist_run.png',
    bonus_deadlock_mode: '/assets/symbols/bonus_deadlock_mode.png',
  },
  sounds: {
    spin: '/assets/sounds/spin.mp3',
  },
};

/** Manifest mit GameConfig.basePath kombinieren (einfache Konkatenation). */
export function resolveManifestPaths(
  manifest: AssetManifest,
  config: GameConfig,
): AssetManifest {
  const base = config.assets.basePath.replace(/\/$/, '');
  const prefix = base ? `${base}` : '';
  const join = (p: string) =>
    p.startsWith('http') || p.startsWith('/') ? p : `${prefix}/${p}`.replace(/\/+/g, '/');

  return {
    themeId: manifest.themeId,
    symbols: Object.fromEntries(
      Object.entries(manifest.symbols).map(([k, v]) => [k, join(v)]),
    ),
    sounds: Object.fromEntries(
      Object.entries(manifest.sounds).map(([k, v]) => [k, join(v)]),
    ),
  };
}
