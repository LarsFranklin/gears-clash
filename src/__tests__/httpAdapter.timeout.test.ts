import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpGameApiAdapter } from '../adapters/HttpGameApiAdapter';
import { NetworkError } from '../adapters/errors';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpGameApiAdapter Timeout/Abort', () => {
  it('timeoutMs greift → NetworkError mit kind="timeout"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init.signal;
            if (signal) {
              signal.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
              });
            }
          }),
      ),
    );
    const adapter = new HttpGameApiAdapter({
      spinEndpoint: '/api/spin',
      timeoutMs: 50,
    });

    const start = Date.now();
    let captured: unknown = null;
    try {
      await adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' });
    } catch (e) {
      captured = e;
    }
    const elapsed = Date.now() - start;

    expect(captured).toBeInstanceOf(NetworkError);
    expect((captured as NetworkError).kind).toBe('timeout');
    expect(elapsed).toBeLessThan(2000);
  });

  it('Default-Timeout wird überschrieben mit 0 (kein Timeout)', async () => {
    let resolveFetch: ((r: Response) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () => new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    const adapter = new HttpGameApiAdapter({
      spinEndpoint: '/api/spin',
      timeoutMs: 0,
    });
    const spinPromise = adapter.spin({ bet: 1, currency: 'COINS', mode: 'base' });

    await new Promise((r) => setTimeout(r, 60));
    expect(resolveFetch).not.toBeNull();

    resolveFetch!(
      new Response(
        JSON.stringify({
          spinId: 't',
          reelStops: [['bolt']],
          winAmount: 0,
          balanceAfter: 100,
          bonus: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const result = await spinPromise;
    expect(result.spinId).toBe('t');
  });
});
