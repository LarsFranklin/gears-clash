import { deepMerge } from '../util/deepMerge';
import { defaultGameConfig } from './defaultGameConfig';
import type { GameConfig } from './types';
import { validateGameConfig } from './validateGameConfig';

export interface MergeGameConfigOptions {
  /** Nach dem Merge gegen `gameConfig.schema.json` prüfen — wirft `GameConfigValidationError`. */
  validate?: boolean;
}

/**
 * Gleiche effektive Konfiguration wie `GearsClashGame` (Default + Patch + Turbo-Kurzform).
 * Hosts können dieselbe Instanz an `MockGameApiAdapter({ config })` und Analysen übergeben.
 */
export function mergeGameConfig(
  patch: Partial<GameConfig> | undefined,
  turbo: boolean | undefined,
  options?: MergeGameConfigOptions,
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
  if (options?.validate) {
    validateGameConfig(merged);
  }
  return merged;
}
