export type SlotEngineState =
  | 'idle'
  | 'spinning'
  | 'resolving'
  | 'bonus'
  | 'bonus_session'
  | 'error';

/**
 * Zentrale State Machine — verhindert doppelte Spins und unsaubere Übergänge.
 *
 * Während einer Bonus-Session (`bonus_session`) sind reguläre Base-Spins gesperrt;
 * Fortsetzungsrunden laufen ausschließlich über `beginBonusRound()`.
 */
export class SlotEngine {
  private state: SlotEngineState = 'idle';
  private bonusSession = false;

  getState(): SlotEngineState {
    return this.state;
  }

  /** True, solange eine Bonus-Session läuft (auch während ihrer Fortsetzungs-Spins). */
  isBonusSessionActive(): boolean {
    return this.bonusSession;
  }

  canSpin(hostDisabled?: boolean): boolean {
    return this.state === 'idle' && !this.bonusSession && !hostDisabled;
  }

  beginSpin(): boolean {
    if (this.state !== 'idle' || this.bonusSession) return false;
    this.state = 'spinning';
    return true;
  }

  enterResolving(): void {
    if (this.state === 'spinning') this.state = 'resolving';
  }

  enterBonus(): boolean {
    if (this.state !== 'spinning' && this.state !== 'resolving') return false;
    this.state = 'bonus';
    return true;
  }

  /** Übergang vom Bonus-Trigger in die laufende Session (sperrt Base-Spins). */
  beginBonusSession(): boolean {
    if (this.state !== 'bonus') return false;
    this.bonusSession = true;
    return true;
  }

  canSpinBonusRound(hostDisabled?: boolean): boolean {
    return (
      this.bonusSession && this.state === 'bonus_session' && !hostDisabled
    );
  }

  /** Fortsetzungs-Spin innerhalb einer Session (Free Spin, Collection-Runde …). */
  beginBonusRound(): boolean {
    if (!this.canSpinBonusRound()) return false;
    this.state = 'spinning';
    return true;
  }

  finishRound(): void {
    if (
      this.state === 'resolving' ||
      this.state === 'spinning' ||
      this.state === 'bonus'
    ) {
      this.state = this.bonusSession ? 'bonus_session' : 'idle';
    }
  }

  /** Beendet die Session; ein zwischenzeitlicher Fehlerzustand bleibt erhalten. */
  endBonusSession(): void {
    this.bonusSession = false;
    if (this.state === 'bonus_session') this.state = 'idle';
  }

  setError(): void {
    this.state = 'error';
  }

  resetError(): void {
    if (this.state !== 'error') return;
    this.bonusSession = false;
    this.state = 'idle';
  }
}
