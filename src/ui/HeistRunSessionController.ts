import type {
  BonusId,
  BonusSessionPayload,
  HeistRunPayload,
  SpinResult,
} from '../config/types';
import { BonusSessionOverlay } from './BonusSessionOverlay';

export interface HeistRunSessionHooks {
  onPayloadRendered?: (payload: HeistRunPayload) => void;
}

/** Pause zwischen zwei Freispielen — die Runde soll lesbar bleiben (heist-run.md §8.2). */
const AUTO_SPIN_PAUSE_MS = 620;

/**
 * Heist Run — Freispiele laufen automatisch durch, ohne Klick pro Runde.
 * Der Zähler zeigt nur die Restanzahl (§8.3), die Bonusbank die Session-Summe (§8.4).
 */
export class HeistRunSessionController extends BonusSessionOverlay {
  protected readonly bonusId: BonusId = 'heist_run';
  protected readonly title = 'Heist Run';

  constructor(private readonly hooks?: HeistRunSessionHooks) {
    super();
  }

  async runSession(
    initial: SpinResult,
    requestNextSpin: () => Promise<SpinResult>,
  ): Promise<BonusSessionPayload | undefined> {
    if (!this.el || initial.bonus?.type !== 'heist_run') return undefined;

    this.show();
    let current = initial.bonus;
    this.render(current);

    await this.flashDialog(
      'Heist Run',
      `${current.payload.freeSpinsAwarded} Freispiele — Sticky Wilds bleiben bis zum Ende liegen.`,
      1600,
    );

    while (!this.signal.aborted && !current.session?.complete) {
      await this.delay(AUTO_SPIN_PAUSE_MS);
      if (this.signal.aborted) break;

      let result: SpinResult;
      try {
        result = await requestNextSpin();
      } catch {
        break;
      }
      if (result.bonus?.type !== 'heist_run') break;

      const retrigger = result.bonus.session?.retriggerAwarded ?? 0;
      current = result.bonus;
      this.render(current);
      if (retrigger > 0) {
        await this.flashDialog('Retrigger', `+${retrigger} Freispiele`, 1200);
      }
    }

    if (!this.signal.aborted) {
      const total = current.session?.bankedWin ?? 0;
      await this.awaitDialog(
        'Heist Run beendet',
        `Bonusgewinn: ${total.toLocaleString()} Coins`,
        'Gutschreiben',
      );
    }

    this.hide();
    return current;
  }

  private render(bonus: Extract<BonusSessionPayload, { type: 'heist_run' }>): void {
    const stickies = bonus.payload.stickyWilds ?? [];
    this.renderStats([
      { key: 'Freispiele', value: String(bonus.session?.remainingSpins ?? 0) },
      { key: 'Sticky Wilds', value: String(stickies.length) },
      { key: 'Gesammelt', value: (bonus.session?.bankedWin ?? 0).toLocaleString() },
    ]);
    this.hooks?.onPayloadRendered?.(bonus.payload);
  }
}
