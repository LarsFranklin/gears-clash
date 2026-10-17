import { describe, expect, it } from 'vitest';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { ReelEngine } from '../core/ReelEngine';

describe('ReelEngine', () => {
  const engine = new ReelEngine(defaultGameConfig);

  it('liefert Grid-Dimensionen aus Config', () => {
    expect(engine.dimensions).toEqual({ reels: 5, rows: 5 });
  });

  it('validiert korrekte reelStops', () => {
    const stops = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => 'bolt'),
    );
    expect(engine.validateStops(stops)).toBe(true);
  });

  it('lehnt falsche Spaltenzahl ab', () => {
    const stops = Array.from({ length: 4 }, () =>
      Array.from({ length: 5 }, () => 'bolt'),
    );
    expect(engine.validateStops(stops)).toBe(false);
  });

  it('lehnt falsche Zeilenanzahl ab', () => {
    const stops = Array.from({ length: 5 }, () =>
      Array.from({ length: 4 }, () => 'bolt'),
    );
    expect(engine.validateStops(stops)).toBe(false);
  });
});
