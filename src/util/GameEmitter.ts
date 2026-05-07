import type { GameEventName } from '../config/types';

type Listener = (payload?: unknown) => void;

export class GameEmitter {
  private readonly listeners = new Map<GameEventName, Set<Listener>>();

  on(event: GameEventName, fn: Listener): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
  }

  off(event: GameEventName, fn: Listener): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: GameEventName, payload?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      fn(payload);
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
