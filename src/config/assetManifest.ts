import type { GameConfig } from './types';

/**
 * Austauschbare Theme-/Asset-Pfade — später echte PNG/MP3, v1 Platzhalter-kompatibel.
 *
 * Pfade können sein:
 * - absolut (`/path/to/asset.png` oder `https://cdn.example/asset.png`) — werden 1:1 verwendet
 * - relativ (`symbols/bolt.png`) — werden mit `GameConfig.assets.basePath` kombiniert
 *
 * `fallback` ist optional, aber empfohlen: wird vom AssetLoader verwendet,
 * wenn eine Symbol-/Sound-ID nicht im Manifest vorkommt.
 */
export interface AssetManifest {
  themeId: string;
  symbols: Record<string, string>;
  sounds: Record<string, string>;
  /** Optionale Fallback-Pfade. */
  fallback?: {
    symbol?: string;
    sound?: string;
  };
}

export const defaultAssetManifest: AssetManifest = {
  themeId: 'default-industrial',
  symbols: {
    bolt: '/assets/symbols/bolt.png',
    nut: '/assets/symbols/nut.png',
    fuse: '/assets/symbols/fuse.png',
    valve: '/assets/symbols/valve.png',
    cable: '/assets/symbols/cable.png',
    steam_piston: '/assets/symbols/steam_piston.png',
    fuel_canister: '/assets/symbols/fuel_canister.png',
    reactor_pipe: '/assets/symbols/reactor_pipe.png',
    overdrive_core: '/assets/symbols/overdrive_core.png',
    quantum_chamber: '/assets/symbols/quantum_chamber.png',
    wild_gear: '/assets/symbols/wild_gear.png',
    /** PNG optional — fehlt → prozeduraler VS-Fallback im Renderer. */
    gears_vs: '/assets/symbols/gears_vs.png',
    broken_gear: '/assets/symbols/broken_gear.png',
    multiplier_gear: '/assets/symbols/multiplier_gear.png',
    bonus_gears_clash: '/assets/symbols/bonus_gears_clash.png',
    bonus_heist_run: '/assets/symbols/bonus_heist_run.png',
    bonus_deadlock_mode: '/assets/symbols/bonus_deadlock_mode.png',
  },
  sounds: {
    spin: '/assets/sounds/spin.mp3',
    reel_stop: '/assets/sounds/reel_stop.mp3',
    win: '/assets/sounds/win.mp3',
    bonus_intro: '/assets/sounds/bonus_intro.mp3',
  },
  fallback: {
    symbol: '/assets/symbols/_missing.png',
    sound: '',
  },
};

/**
 * Manifest mit GameConfig.basePath kombinieren.
 *
 * - Absolute Pfade (`/...` oder `http(s)://...`) bleiben unverändert.
 * - Relative Pfade werden mit `config.assets.basePath` zusammengeführt.
 */
export function resolveManifestPaths(
  manifest: AssetManifest,
  config: GameConfig,
): AssetManifest {
  const base = config.assets.basePath.replace(/\/+$/, '');
  const join = (p: string): string => {
    if (!p) return p;
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/')) {
      return p;
    }
    return `${base}/${p}`.replace(/([^:])\/+/g, '$1/');
  };

  const fallback = manifest.fallback
    ? {
        ...(manifest.fallback.symbol !== undefined
          ? { symbol: join(manifest.fallback.symbol) }
          : {}),
        ...(manifest.fallback.sound !== undefined
          ? { sound: join(manifest.fallback.sound) }
          : {}),
      }
    : undefined;

  return {
    themeId: manifest.themeId,
    symbols: Object.fromEntries(
      Object.entries(manifest.symbols).map(([k, v]) => [k, join(v)]),
    ),
    sounds: Object.fromEntries(
      Object.entries(manifest.sounds).map(([k, v]) => [k, join(v)]),
    ),
    ...(fallback ? { fallback } : {}),
  };
}
