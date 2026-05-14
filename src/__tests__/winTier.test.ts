import { describe, it, expect } from 'vitest';
import { getWinTier } from '../renderer/BigWinLayer';

describe('getWinTier', () => {
  it('returns "small" for wins less than 5x bet', () => {
    expect(getWinTier(40, 10)).toBe('small');
    expect(getWinTier(10, 10)).toBe('small');
    expect(getWinTier(49, 10)).toBe('small');
  });

  it('returns "medium" for wins between 5x and 15x bet', () => {
    expect(getWinTier(50, 10)).toBe('medium');
    expect(getWinTier(100, 10)).toBe('medium');
    expect(getWinTier(149, 10)).toBe('medium');
  });

  it('returns "big" for wins between 15x and 50x bet', () => {
    expect(getWinTier(150, 10)).toBe('big');
    expect(getWinTier(300, 10)).toBe('big');
    expect(getWinTier(499, 10)).toBe('big');
  });

  it('returns "mega" for wins 50x bet or more', () => {
    expect(getWinTier(500, 10)).toBe('mega');
    expect(getWinTier(1000, 10)).toBe('mega');
    expect(getWinTier(5000, 10)).toBe('mega');
  });

  it('returns "small" for zero or negative bet', () => {
    expect(getWinTier(100, 0)).toBe('small');
    expect(getWinTier(100, -10)).toBe('small');
  });

  it('handles fractional ratios correctly', () => {
    expect(getWinTier(75, 10)).toBe('medium');
    expect(getWinTier(225, 10)).toBe('big');
  });
});
