import { describe, expect, it } from 'vitest';
import type {
  BonusSessionPayload,
  DeadlockModePayload,
  GearsClashPayload,
  HeistRunPayload,
} from '../config/types';

describe('BonusSessionPayload diskriminierte Union', () => {
  it('gears_clash trägt typed GearsClashPayload', () => {
    const bonus: BonusSessionPayload = {
      type: 'gears_clash',
      payload: {
        gearA: { multiplier: 2 },
        gearB: { multiplier: 6 },
        winnerReel: 2,
        winnerMultiplier: 6,
      },
    };
    if (bonus.type === 'gears_clash') {
      const payload: GearsClashPayload = bonus.payload;
      expect(payload.gearA.multiplier).toBe(2);
      expect(payload.gearB.multiplier).toBe(6);
      expect(payload.winnerReel).toBe(2);
    }
  });

  it('heist_run trägt typed HeistRunPayload', () => {
    const bonus: BonusSessionPayload = {
      type: 'heist_run',
      payload: {
        freeSpinsAwarded: 8,
        currentSpin: 1,
        stickyWilds: [
          { reel: 0, row: 1 },
          { reel: 3, row: 2, multiplier: 5 },
        ],
      },
    };
    if (bonus.type === 'heist_run') {
      const payload: HeistRunPayload = bonus.payload;
      expect(payload.freeSpinsAwarded).toBe(8);
      expect(payload.stickyWilds?.length).toBe(2);
      expect(payload.stickyWilds?.[1]?.multiplier).toBe(5);
    }
  });

  it('deadlock_mode trägt typed DeadlockModePayload', () => {
    const bonus: BonusSessionPayload = {
      type: 'deadlock_mode',
      payload: {
        phase: 'collection',
        lives: 3,
        collectedSymbols: [
          { reel: 1, row: 2, symbolId: 'wild_gear', multiplier: 3 },
        ],
        remainingSpins: 5,
      },
    };
    if (bonus.type === 'deadlock_mode') {
      const payload: DeadlockModePayload = bonus.payload;
      expect(payload.phase).toBe('collection');
      expect(payload.lives).toBe(3);
      expect(payload.collectedSymbols?.[0]?.symbolId).toBe('wild_gear');
    }
  });

  it('Type-Diskriminator engt narrow korrekt', () => {
    function describe(bonus: BonusSessionPayload): string {
      switch (bonus.type) {
        case 'gears_clash':
          return `gc:${bonus.payload.gearA.multiplier}`;
        case 'heist_run':
          return `hr:${bonus.payload.freeSpinsAwarded}`;
        case 'deadlock_mode':
          return `dm:${bonus.payload.phase}`;
      }
    }
    expect(
      describe({
        type: 'gears_clash',
        payload: { gearA: { multiplier: 1 }, gearB: { multiplier: 2 } },
      }),
    ).toBe('gc:1');
    expect(
      describe({
        type: 'heist_run',
        payload: { freeSpinsAwarded: 8 },
      }),
    ).toBe('hr:8');
    expect(
      describe({
        type: 'deadlock_mode',
        payload: { phase: 'overdrive' },
      }),
    ).toBe('dm:overdrive');
  });
});
