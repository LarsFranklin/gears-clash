import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpGameApiAdapter,
  type HttpGameApiAdapterOptions,
} from '../adapters/HttpGameApiAdapter';
import {
  InsufficientBalanceError,
  InvalidResponseError,
  NetworkError,
} from '../adapters/errors';

function makeAdapter(opts: Partial<HttpGameApiAdapterOptions> = {}): HttpGameApiAdapter {
  return new HttpGameApiAdapter({
    spinEndpoint: '/api/spin',
    balanceEndpoint: '/api/balance',
    ...opts,
  });
}

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpGameApiAdapter Error-Mapping', () => {
  it('fetch wirft → NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('network down')),
    );
    const adapter = makeAdapter();
    await expect(
      adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('500 Status → InvalidResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, { status: 500 })),
    );
    const adapter = makeAdapter();
    await expect(
      adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('402 mit httpStatuses-Config → InsufficientBalanceError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'INSUFFICIENT_FUNDS' }, { status: 402 }),
      ),
    );
    const adapter = makeAdapter({
      insufficientBalance: { httpStatuses: [402] },
    });
    await expect(
      adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('bodyCodes-Match → InsufficientBalanceError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'INSUFFICIENT_FUNDS' }, { status: 409 }),
      ),
    );
    const adapter = makeAdapter({
      insufficientBalance: { bodyCodes: ['INSUFFICIENT_FUNDS'] },
    });
    await expect(
      adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('non-JSON Body → InvalidResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('this is not json', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );
    const adapter = makeAdapter();
    await expect(
      adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('getBalance ohne balanceEndpoint → InvalidResponseError', async () => {
    const adapter = new HttpGameApiAdapter({ spinEndpoint: '/api/spin' });
    await expect(adapter.getBalance()).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('valide Spin-Response wird gemappt', async () => {
    const validBody = {
      spinId: 'test-1',
      reelStops: [
        ['bolt', 'nut', 'steam_piston', 'wild_gear', 'bonus_gears_clash'],
        ['fuel_canister', 'reactor_pipe', 'overdrive_core', 'quantum_chamber', 'fuse'],
        ['cable', 'valve', 'bolt', 'nut', 'steam_piston'],
        ['wild_gear', 'fuel_canister', 'reactor_pipe', 'overdrive_core', 'quantum_chamber'],
        ['fuse', 'cable', 'valve', 'bolt', 'nut'],
      ],
      winAmount: 250,
      balanceAfter: 9850,
      bonus: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(validBody)));
    const adapter = makeAdapter();
    const result = await adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' });
    expect(result.spinId).toBe('test-1');
    expect(result.winAmount).toBe(250);
    expect(result.balanceAfter).toBe(9850);
    expect(result.bonus).toBeNull();
  });
});
