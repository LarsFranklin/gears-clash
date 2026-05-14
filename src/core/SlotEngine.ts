export type SlotEngineState =
  | 'idle'
  | 'spinning'
  | 'resolving'
  | 'bonus'
  | 'error';

/**
 * Zentrale State Machine — verhindert doppelte Spins und unsaubere Übergänge.
 */
export class SlotEngine {
  private state: SlotEngineState = 'idle';

  getState(): SlotEngineState {
    return this.state;
  }

  canSpin(hostDisabled?: boolean): boolean {
    return this.state === 'idle' && !hostDisabled;
  }

  beginSpin(): boolean {
    if (this.state !== 'idle') return false;
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

  finishRound(): void {
    if (
      this.state === 'resolving' ||
      this.state === 'spinning' ||
      this.state === 'bonus'
    ) {
      this.state = 'idle';
    }
  }

  setError(): void {
    this.state = 'error';
  }

  resetError(): void {
    if (this.state === 'error') this.state = 'idle';
  }
}
