import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpGameApiAdapter } from '../adapters/HttpGameApiAdapter';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpGameApiAdapter Erfolgsfälle', () => {
  it('getBalance parst numerisches balance-Feld', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ balance: 12_345 })),
    );
    const adapter = new HttpGameApiAdapter({
      balanceEndpoint: '/api/balance',
      spinEndpoint: '/api/spin',
    });
    await expect(adapter.getBalance()).resolves.toBe(12_345);
  });

  it('spin mappt valide SpinResult-Antwort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          spinId: 'srv-1',
          reelStops: [
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
          ],
          winAmount: 200,
          balanceAfter: 9800,
          bonus: null,
        }),
      ),
    );
    const adapter = new HttpGameApiAdapter({
      spinEndpoint: '/api/spin',
      balanceEndpoint: '/api/balance',
    });
    const result = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
    });
    expect(result.spinId).toBe('srv-1');
    expect(result.winAmount).toBe(200);
    expect(result.balanceAfter).toBe(9800);
    expect(result.reelStops.length).toBe(5);
    expect(result.bonus).toBeNull();
  });

  it('spin akzeptiert gears_clash Bonus-Payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          spinId: 'srv-bonus',
          reelStops: [
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
            ['bolt', 'nut', 'fuse', 'valve', 'cable'],
          ],
          winAmount: 0,
          balanceAfter: 9900,
          bonus: {
            type: 'gears_clash',
            payload: {
              gearA: { multiplier: 3 },
              gearB: { multiplier: 7 },
              winnerReel: 1,
              winnerMultiplier: 7,
            },
          },
        }),
      ),
    );
    const adapter = new HttpGameApiAdapter({
      spinEndpoint: '/api/spin',
    });
    const result = await adapter.spin({
      bet: 100,
      currency: 'COINS',
      mode: 'base',
    });
    expect(result.bonus?.type).toBe('gears_clash');
    if (result.bonus?.type === 'gears_clash') {
      expect(result.bonus.payload.winnerMultiplier).toBe(7);
    }
  });
});
