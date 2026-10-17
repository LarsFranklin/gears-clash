import type {
  BonusId,
  BonusSessionPayload,
  DeadlockModePayload,
  SpinResult,
} from '../config/types';
import { BonusSessionOverlay } from './BonusSessionOverlay';

export interface DeadlockModeSessionHooks {
  /** Nach jedem gerenderten Payload — z. B. Phasen-Umschaltung der Atmosphäre. */
  onPayloadRendered?: (payload: DeadlockModePayload) => void;
}

const COLLECTION_PAUSE_MS = 720;
const OVERDRIVE_PAUSE_MS = 620;

function sumMultipliers(payload: DeadlockModePayload): number {
  return (payload.collectedSymbols ?? []).reduce(
    (sum, c) => sum + (c.multiplier ?? 0),
    0,
  );
}

function countWilds(payload: DeadlockModePayload): number {
  return (payload.collectedSymbols ?? []).filter(
    (c) => c.multiplier === undefined,
  ).length;
}

/**
 * Deadlock Mode — Phase 1 sammelt Wilds und additive Multiplier bis die Leben
 * aufgebraucht sind, Phase 2 spielt 8 Overdrive-Freispiele
 * (docs/bonuses/deadlock-mode.md §5–§6). Beide Phasen laufen automatisch.
 */
export class DeadlockModeSessionController extends BonusSessionOverlay {
  protected readonly bonusId: BonusId = 'deadlock_mode';
  protected readonly title = 'Deadlock Mode';

  constructor(private readonly hooks?: DeadlockModeSessionHooks) {
    super();
  }

  async runSession(
    initial: SpinResult,
    requestNextSpin: () => Promise<SpinResult>,
  ): Promise<BonusSessionPayload | undefined> {
    if (!this.el || initial.bonus?.type !== 'deadlock_mode') return undefined;

    this.show();
    let current = initial.bonus;
    let phase = current.payload.phase;
    this.render(current);

    await this.flashDialog(
      'Phase 1 — Collection',
      'Sammle Wild-Gears und Multiplier. Drei Runden ohne Treffer beenden die Phase.',
      1800,
    );

    while (!this.signal.aborted && !current.session?.complete) {
      await this.delay(
        phase === 'collection' ? COLLECTION_PAUSE_MS : OVERDRIVE_PAUSE_MS,
      );
      if (this.signal.aborted) break;

      let result: SpinResult;
      try {
        result = await requestNextSpin();
      } catch {
        break;
      }
      if (result.bonus?.type !== 'deadlock_mode') break;

      current = result.bonus;
      this.render(current);

      if (phase === 'collection' && current.payload.phase === 'overdrive') {
        phase = 'overdrive';
        const mult = sumMultipliers(current.payload);
        await this.flashDialog(
          'Phase 2 — Overdrive',
          `${countWilds(current.payload)} garantierte Wilds · Gesamt-Multiplier ×${mult > 0 ? mult : 1}`,
          1900,
        );
      }

      const retrigger = current.session?.retriggerAwarded ?? 0;
      if (retrigger > 0) {
        await this.flashDialog('Retrigger', `+${retrigger} Freispiele`, 1200);
      }
    }

    if (!this.signal.aborted) {
      const total = current.session?.bankedWin ?? 0;
      await this.awaitDialog(
        'Deadlock Mode beendet',
        `Bonusgewinn: ${total.toLocaleString()} Coins`,
        'Gutschreiben',
      );
    }

    this.hide();
    return current;
  }

  private render(
    bonus: Extract<BonusSessionPayload, { type: 'deadlock_mode' }>,
  ): void {
    const p = bonus.payload;
    const mult = sumMultipliers(p);
    if (p.phase === 'collection') {
      this.renderStats([
        { key: 'Phase', value: 'Collection' },
        { key: 'Leben', value: String(p.lives ?? 0) },
        { key: 'Wilds', value: String(countWilds(p)) },
        { key: 'Multiplier', value: `×${mult > 0 ? mult : 1}` },
      ]);
    } else {
      this.renderStats([
        { key: 'Phase', value: 'Overdrive' },
        { key: 'Freispiele', value: String(bonus.session?.remainingSpins ?? 0) },
        { key: 'Wilds', value: String(countWilds(p)) },
        { key: 'Multiplier', value: `×${mult > 0 ? mult : 1}` },
        {
          key: 'Gesammelt',
          value: (bonus.session?.bankedWin ?? 0).toLocaleString(),
        },
      ]);
    }
    this.hooks?.onPayloadRendered?.(p);
  }
}
