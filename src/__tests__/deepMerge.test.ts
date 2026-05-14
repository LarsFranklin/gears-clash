import { describe, expect, it } from 'vitest';
import { deepMerge, isPlainObject } from '../util/deepMerge';

describe('deepMerge', () => {
  it('merged nested objects rekursiv', () => {
    const base: Record<string, unknown> = { a: 1, nested: { b: 2, c: 3 } };
    const patch: Record<string, unknown> = { nested: { c: 99 } };
    const result = deepMerge(base, patch);
    expect(result).toEqual({ a: 1, nested: { b: 2, c: 99 } });
  });

  it('ersetzt Arrays vollständig (keine Element-Merges)', () => {
    const base: Record<string, unknown> = { list: [1, 2, 3], keep: 'x' };
    const patch: Record<string, unknown> = { list: [9] };
    const result = deepMerge(base, patch);
    expect(result.list).toEqual([9]);
    expect(result.keep).toBe('x');
  });

  it('liefert Klon bei undefined-Patch zurück (kein Mutate)', () => {
    const base: Record<string, unknown> = { a: { b: 1 } };
    const result = deepMerge(base, undefined);
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
    expect(result.a).not.toBe(base.a);
  });

  it('mutiert das Original nicht', () => {
    const base: { nested: { b: number } } = { nested: { b: 2 } };
    const patch: Record<string, unknown> = { nested: { b: 99 } };
    deepMerge(base as unknown as Record<string, unknown>, patch);
    expect(base.nested.b).toBe(2);
  });

  it('überschreibt primitive Werte', () => {
    const base: Record<string, unknown> = { a: 1, b: 'x' };
    const patch: Record<string, unknown> = { a: 2 };
    expect(deepMerge(base, patch)).toEqual({ a: 2, b: 'x' });
  });

  it('isPlainObject erkennt nur Plain Objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('s')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
  });
});
