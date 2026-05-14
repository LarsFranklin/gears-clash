import { describe, expect, it } from 'vitest';
import { mergeGameConfig } from '../config/mergeGameConfig';
import type { GameConfig } from '../config/types';

describe('mergeGameConfig', () => {
  it('wendet Patch und Turbo-Kurzform an (Quelle für GearsClashGame + Mock)', () => {
    const patch: Partial<GameConfig> = { maxWin: 999_000 };
    const a = mergeGameConfig(patch, true);
    expect(a.maxWin).toBe(999_000);
    expect(a.animation.turbo).toBe(true);
  });

  it('ist bei gleichen Parametern deterministisch', () => {
    const patch: Partial<GameConfig> = { maxWin: 12 };
    expect(mergeGameConfig(patch, false)).toEqual(mergeGameConfig(patch, false));
  });
});
