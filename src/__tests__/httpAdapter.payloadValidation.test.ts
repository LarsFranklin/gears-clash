import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpGameApiAdapter } from '../adapters/HttpGameApiAdapter';
import { InvalidResponseError } from '../adapters/errors';

const GRID = [
  ['bolt', 'nut', 'fuse', 'valve', 'cable'],
  ['bolt', 'nut', 'fuse', 'valve', 'cable'],
  ['bolt', 'nut', 'fuse', 'valve', 'cable'],
  ['bolt', 'nut', 'fuse', 'valve', 'cable'],
  ['bolt', 'nut', 'fuse', 'valve', 'cable'],
];

function stubSpinResponse(body: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

function baseBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    spinId: 'spin-1',
    reelStops: GRID,
    winAmount: 0,
    balanceAfter: 1000,
    ...extra,
  };
}

async function spin(): Promise<unknown> {
  const adapter = new HttpGameApiAdapter({ spinEndpoint: '/api/spin' });
  return adapter.spin({ bet: 100, currency: 'COINS', mode: 'base' });
}

/** Erwartet, dass eine kaputte Server-Antwort abgelehnt statt blind gerendert wird. */
async function expectRejected(body: Record<string, unknown>): Promise<void> {
  stubSpinResponse(body);
  await expect(spin()).rejects.toBeInstanceOf(InvalidResponseError);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpGameApiAdapter Payload-Validierung', () => {
  it('lehnt nicht-rechteckige reelStops ab', async () => {
    await expectRejected(
      baseBody({ reelStops: [['bolt', 'nut'], ['bolt', 'nut', 'fuse']] }),
    );
  });

  it('lehnt nicht-endliche Zahlen in winAmount und balanceAfter ab', async () => {
    await expectRejected(baseBody({ winAmount: 'viel' }));
    await expectRejected(baseBody({ balanceAfter: null }));
  });

  it('lehnt negative Gewinne ab', async () => {
    await expectRejected(baseBody({ winAmount: -5 }));
  });

  it('lehnt unbekannte Bonus-Typen ab', async () => {
    await expectRejected(
      baseBody({ bonus: { type: 'mega_bonus', payload: {} } }),
    );
  });

  it('lehnt gears_clash ohne gearA/gearB ab', async () => {
    await expectRejected(
      baseBody({ bonus: { type: 'gears_clash', payload: { gearA: {} } } }),
    );
  });

  it('lehnt gears_clash mit winnerReel außerhalb des Rasters ab', async () => {
    await expectRejected(
      baseBody({
        bonus: {
          type: 'gears_clash',
          payload: {
            gearA: { multiplier: 2 },
            gearB: { multiplier: 6 },
            winnerReel: 9,
          },
        },
      }),
    );
  });

  it('lehnt heist_run ohne ganzzahlige freeSpinsAwarded ab', async () => {
    await expectRejected(
      baseBody({
        bonus: { type: 'heist_run', payload: { freeSpinsAwarded: 8.5 } },
      }),
    );
  });

  it('lehnt Sticky Wilds außerhalb des Rasters ab', async () => {
    await expectRejected(
      baseBody({
        bonus: {
          type: 'heist_run',
          payload: {
            freeSpinsAwarded: 8,
            stickyWilds: [{ reel: 0, row: 99 }],
          },
        },
      }),
    );
  });

  it('lehnt deadlock_mode mit unbekannter Phase ab', async () => {
    await expectRejected(
      baseBody({
        bonus: { type: 'deadlock_mode', payload: { phase: 'warmup' } },
      }),
    );
  });

  it('akzeptiert vollständige Bonus-Payloads', async () => {
    stubSpinResponse(
      baseBody({
        bonus: {
          type: 'heist_run',
          payload: {
            freeSpinsAwarded: 8,
            currentSpin: 1,
            stickyWilds: [{ reel: 1, row: 2 }],
          },
        },
      }),
    );
    const result = (await spin()) as {
      bonus?: { type: string; payload: { stickyWilds?: unknown[] } };
    };
    expect(result.bonus?.type).toBe('heist_run');
    expect(result.bonus?.payload.stickyWilds).toHaveLength(1);
  });
});
