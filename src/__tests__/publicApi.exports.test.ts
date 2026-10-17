import { describe, expect, it, vi } from 'vitest';

describe('Public API (index.ts)', () => {
  it('exportiert Kern-Klassen und Adapter', async () => {
    vi.stubGlobal('navigator', { userAgent: 'vitest' });
    const Public = await import('../index');
    expect(Public.GearsClashGame).toBeTypeOf('function');
    expect(Public.MockGameApiAdapter).toBeTypeOf('function');
    expect(Public.HttpGameApiAdapter).toBeTypeOf('function');
    expect(Public.defaultGameConfig).toBeDefined();
    expect(Public.mergeGameConfig).toBeTypeOf('function');
    expect(Public.validateGameConfig).toBeTypeOf('function');
  });

  it('exportiert Fehlerklassen', async () => {
    vi.stubGlobal('navigator', { userAgent: 'vitest' });
    const Public = await import('../index');
    expect(Public.NetworkError).toBeTypeOf('function');
    expect(Public.InvalidResponseError).toBeTypeOf('function');
    expect(Public.InsufficientBalanceError).toBeTypeOf('function');
  });
});
