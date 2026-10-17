import type {
  BonusId,
  BonusSessionPayload,
  GearsClashPayload,
  SpinResult,
} from '../config/types';
import { BonusSessionOverlay } from './BonusSessionOverlay';

export interface GearsClashSessionHooks {
  /** Pixi-Battle + Full-Reel-Wild — vom Spiel angestoßen, Outcome kommt vom Server. */
  onBattle?: (payload: GearsClashPayload) => void | Promise<void>;
}

const AUTO_SPIN_PAUSE_MS = 620;

function hasClash(payload: GearsClashPayload): boolean {
  return payload.winnerReel !== undefined && payload.winnerMultiplier !== undefined;
}

/**
 * Gears Clash — zwei Betriebsarten:
 * - **Einzelspin-Battle** (`runBattle`): VS-Symbol expandiert zur Full-Reel-Wild.
 * - **Freispiel-Session** (`runSession`): 8 Freispiele mit erhöhter Clash-Rate
 *   und garantiert mindestens einem Clash (gears-clash.md §2).
 */
export class GearsClashSessionController extends BonusSessionOverlay {
  protected readonly bonusId: BonusId = 'gears_clash';
  protected readonly title = 'Gears Clash';

  /** Einzelspin: nur Battle-Anzeige, keine Session-Buchhaltung. */
  async runBattle(
    payload: GearsClashPayload,
    hooks?: GearsClashSessionHooks,
  ): Promise<void> {
    if (!this.el) return;
    this.show();
    this.renderArena(payload);
    await this.playBattle(payload, hooks);
    await this.delay(700);
    this.hide();
  }

  async runSession(
    initial: SpinResult,
    requestNextSpin: () => Promise<SpinResult>,
    hooks?: GearsClashSessionHooks,
  ): Promise<BonusSessionPayload | undefined> {
    if (!this.el || initial.bonus?.type !== 'gears_clash') return undefined;

    this.show();
    let current = initial.bonus;
    this.renderStats([
      { key: 'Freispiele', value: String(current.session?.remainingSpins ?? 0) },
      { key: 'Clashes', value: '0' },
      { key: 'Gesammelt', value: '0' },
    ]);

    await this.flashDialog(
      'Gears Clash',
      `${current.session?.totalSpins ?? 8} Freispiele — mindestens ein Clash ist garantiert.`,
      1600,
    );

    let clashes = 0;
    while (!this.signal.aborted && !current.session?.complete) {
      await this.delay(AUTO_SPIN_PAUSE_MS);
      if (this.signal.aborted) break;

      let result: SpinResult;
      try {
        result = await requestNextSpin();
      } catch {
        break;
      }
      if (result.bonus?.type !== 'gears_clash') break;

      current = result.bonus;
      if (hasClash(current.payload)) {
        clashes += 1;
        this.renderArena(current.payload);
        await this.playBattle(current.payload, hooks);
      }
      this.renderStats([
        { key: 'Freispiele', value: String(current.session?.remainingSpins ?? 0) },
        { key: 'Clashes', value: String(clashes) },
        {
          key: 'Gesammelt',
          value: (current.session?.bankedWin ?? 0).toLocaleString(),
        },
      ]);

      const retrigger = current.session?.retriggerAwarded ?? 0;
      if (retrigger > 0) {
        await this.flashDialog('Retrigger', `+${retrigger} Freispiele`, 1200);
      }
    }

    if (!this.signal.aborted) {
      const total = current.session?.bankedWin ?? 0;
      await this.awaitDialog(
        'Gears Clash beendet',
        `Bonusgewinn: ${total.toLocaleString()} Coins · ${clashes} Clash${clashes === 1 ? '' : 'es'}`,
        'Gutschreiben',
      );
    }

    this.hide();
    return current;
  }

  private renderArena(payload: GearsClashPayload): void {
    this.renderStats([
      { key: 'Gear A', value: `×${payload.gearA.multiplier}` },
      { key: 'Gear B', value: `×${payload.gearB.multiplier}` },
    ]);
  }

  private async playBattle(
    payload: GearsClashPayload,
    hooks?: GearsClashSessionHooks,
  ): Promise<void> {
    this.el?.classList.add('gc-bonus-session--battle');
    await this.delay(420);
    if (this.signal.aborted) {
      this.el?.classList.remove('gc-bonus-session--battle');
      return;
    }
    await hooks?.onBattle?.(payload);
    this.el?.classList.remove('gc-bonus-session--battle');

    if (this.signal.aborted || !hasClash(payload)) return;
    const reel = (payload.winnerReel ?? 0) + 1;
    await this.flashDialog(
      'Full-Reel-Wild',
      `Walze ${reel} · ×${payload.winnerMultiplier}`,
      1000,
    );
  }
}
