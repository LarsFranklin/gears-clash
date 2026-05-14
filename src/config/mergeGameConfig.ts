import { deepMerge } from '../util/deepMerge';
import { defaultGameConfig } from './defaultGameConfig';
import type { GameConfig } from './types';

/**
 * Gleiche effektive Konfiguration wie `GearsClashGame` (Default + Patch + Turbo-Kurzform).
 * Hosts können dieselbe Instanz an `MockGameApiAdapter({ config })` und Analysen übergeben.
 */
export function mergeGameConfig(
  patch: Partial<GameConfig> | undefined,
  turbo: boolean | undefined,
): GameConfig {
  const merged = patch
    ? (deepMerge(
        defaultGameConfig as unknown as Record<string, unknown>,
        patch as unknown as Record<string, unknown>,
      ) as unknown as GameConfig)
    : structuredClone(defaultGameConfig);
  if (turbo !== undefined) {
    merged.animation = { ...merged.animation, turbo };
  }
  return merged;
}
