import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { SymbolRegistry } from '../core/SymbolRegistry';

describe('SymbolRegistry', () => {
  const registry = new SymbolRegistry(defaultGameConfig);

  it('liefert alle 17 Symbole aus defaultGameConfig (inkl. gears_vs und Collection-Set)', () => {
    expect(registry.allIds.length).toBe(17);
    expect(registry.all.length).toBe(17);
    expect(registry.allIds).toContain('gears_vs');
    expect(registry.allIds).toContain('broken_gear');
    expect(registry.allIds).toContain('multiplier_gear');
  });

  it('hat 13 normale, 1 wild, 3 bonus Symbole', () => {
    const kinds = registry.all.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'normal').length).toBe(13);
    expect(kinds.filter((k) => k === 'wild').length).toBe(1);
    expect(kinds.filter((k) => k === 'bonus').length).toBe(3);
  });

  it('liefert undefined bei unbekannter ID', () => {
    expect(registry.get('nope')).toBeUndefined();
  });

  it('Lookup für jede Default-ID liefert die Definition', () => {
    for (const id of registry.allIds) {
      expect(registry.get(id)?.id).toBe(id);
    }
  });

  it('Bonus-Symbole haben konsistente bonusId', () => {
    const bonusSyms = registry.all.filter((s) => s.kind === 'bonus');
    const ids = new Set(bonusSyms.map((s) => s.bonusId));
    expect(ids.has('gears_clash')).toBe(true);
    expect(ids.has('heist_run')).toBe(true);
    expect(ids.has('deadlock_mode')).toBe(true);
  });
});
