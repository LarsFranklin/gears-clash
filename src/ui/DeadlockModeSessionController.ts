import type {
  BonusSessionPayload,
  DeadlockModePayload,
  GameConfig,
  SpinResult,
} from '../config/types';

const ROOT = 'gc-deadlock-session';

export interface DeadlockModeSessionHooks {
  /** Nach jedem gerenderten Payload (inkl. erstem Schritt) — z. B. Bonus-Intro-Phasen-UI. */
  onPayloadRendered?: (payload: DeadlockModePayload) => void;
}

/**
 * Deadlock Mode — Phase 1 (Collection) / Phase 2 (Overdrive) laut Gameplay-Doku.
 * Zeigt Server-/Mock-Payload; Fortsetzungsspins ruft der Host über die gelieferte Callback-Funktion.
 */
export class DeadlockModeSessionController {
  private el: HTMLDivElement | null = null;
  private abort = new AbortController();

  constructor(
    private readonly config: GameConfig,
    private readonly hooks?: DeadlockModeSessionHooks,
  ) {}

  mount(parent: HTMLElement): void {
    if (this.el) return;
    const el = document.createElement('div');
    el.className = ROOT;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="gc-deadlock-session__panel">
        <header class="gc-deadlock-session__head">
          <h2 class="gc-deadlock-session__title">Deadlock Mode</h2>
          <p class="gc-deadlock-session__phase" data-role="phase-label"></p>
        </header>
        <div class="gc-deadlock-session__stats">
          <div class="gc-deadlock-session__stat">
            <span class="gc-deadlock-session__stat-k">Lives</span>
            <span class="gc-deadlock-session__stat-v" data-role="lives">—</span>
          </div>
          <div class="gc-deadlock-session__stat">
            <span class="gc-deadlock-session__stat-k">Rest-Spins</span>
            <span class="gc-deadlock-session__stat-v" data-role="remaining">—</span>
          </div>
        </div>
        <section class="gc-deadlock-session__storage" aria-label="Overdrive Storage">
          <h3 class="gc-deadlock-session__storage-title">Overdrive Storage</h3>
          <ul class="gc-deadlock-session__list" data-role="storage-list"></ul>
        </section>
        <p class="gc-deadlock-session__hint" data-role="hint"></p>
        <button type="button" class="gc-deadlock-session__action" data-role="continue">
          Sammel-Spin / Overdrive
        </button>
      </div>
    `;
    parent.appendChild(el);
    this.el = el;
  }

  destroy(): void {
    this.abort.abort();
    this.el?.remove();
    this.el = null;
    this.abort = new AbortController();
  }

  /**
   * Zeigt Session-UI und wartet pro Server-Schritt auf Klick → `requestNextSpin()`.
   * Beendet, wenn `SpinResult.bonus` kein `deadlock_mode` mehr ist (z. B. Auszahlungs-Spin).
   * @returns letztes `deadlock_mode`-Payload vor Abschluss (für `bonus:end`).
   */
  async runSession(
    initial: SpinResult,
    requestNextSpin: () => Promise<SpinResult>,
  ): Promise<BonusSessionPayload | undefined> {
    if (!this.el || initial.bonus?.type !== 'deadlock_mode') return undefined;

    const signal = this.abort.signal;
    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('gc-deadlock-session--visible');

    let current: SpinResult = initial;
    let lastDeadlock: BonusSessionPayload | undefined = initial.bonus;

    const stepOnce = async (): Promise<boolean> => {
      if (signal.aborted) return false;
      this.renderPayload(current);
      const btn = this.el!.querySelector(
        '[data-role="continue"]',
      ) as HTMLButtonElement | null;
      if (!btn) return false;

      const clicked = await this.waitClick(btn, signal);
      if (!clicked) return false;

      try {
        current = await requestNextSpin();
      } catch {
        return false;
      }

      if (current.bonus?.type !== 'deadlock_mode') {
        this.renderPayloadFromResult(current);
        btn.textContent = 'Schließen';
        await this.waitClick(btn, signal);
        return false;
      }
      lastDeadlock = current.bonus;
      return true;
    };

    while (await stepOnce()) {
      /* nächster Demo-Schritt */
    }

    this.hide();
    return lastDeadlock;
  }

  private hide(): void {
    if (!this.el) return;
    this.el.classList.remove('gc-deadlock-session--visible');
    this.el.setAttribute('aria-hidden', 'true');
  }

  private renderPayloadFromResult(result: SpinResult): void {
    if (result.bonus?.type === 'deadlock_mode') {
      this.renderFromPayload(result.bonus.payload);
      return;
    }
    const hint = this.el?.querySelector('[data-role="hint"]');
    if (hint) {
      hint.textContent = `Runde beendet · Gewinn ${Math.max(0, Math.floor(result.winAmount))} Coins (vom Server/Mock).`;
    }
    const lives = this.el?.querySelector('[data-role="lives"]');
    const rem = this.el?.querySelector('[data-role="remaining"]');
    if (lives) lives.textContent = '—';
    if (rem) rem.textContent = '—';
  }

  private renderPayload(result: SpinResult): void {
    if (result.bonus?.type === 'deadlock_mode') {
      this.renderFromPayload(result.bonus.payload);
    }
  }

  private renderFromPayload(payload: DeadlockModePayload): void {
    if (!this.el) return;
    const phaseEl = this.el.querySelector('[data-role="phase-label"]');
    const livesEl = this.el.querySelector('[data-role="lives"]');
    const remEl = this.el.querySelector('[data-role="remaining"]');
    const list = this.el.querySelector('[data-role="storage-list"]');
    const hint = this.el.querySelector('[data-role="hint"]');
    const btn = this.el.querySelector(
      '[data-role="continue"]',
    ) as HTMLButtonElement | null;

    const phaseLabel =
      payload.phase === 'collection'
        ? 'Phase 1 — Collection'
        : 'Phase 2 — Overdrive';
    if (phaseEl) phaseEl.textContent = phaseLabel;
    if (livesEl)
      livesEl.textContent =
        payload.lives !== undefined ? String(payload.lives) : '—';
    if (remEl)
      remEl.textContent =
        payload.remainingSpins !== undefined
          ? String(payload.remainingSpins)
          : '—';

    if (list) {
      list.replaceChildren();
      const items = payload.collectedSymbols ?? [];
      if (items.length === 0) {
        const li = document.createElement('li');
        li.className = 'gc-deadlock-session__list-empty';
        li.textContent = 'Noch leer — sammle Wilds, Multiplier und Special-Gears.';
        list.appendChild(li);
      } else {
        const symById = new Map(this.config.symbols.map((s) => [s.id, s]));
        for (const c of items) {
          const li = document.createElement('li');
          li.className = 'gc-deadlock-session__list-item';
          const def = symById.get(c.symbolId);
          const mul =
            c.multiplier !== undefined ? ` ×${c.multiplier}` : '';
          li.textContent = `${def?.label ?? c.symbolId} @ ${c.reel},${c.row}${mul}`;
          list.appendChild(li);
        }
      }
    }

    if (hint) {
      hint.textContent =
        payload.phase === 'collection'
          ? 'Mind. ein Treffer pro Spin setzt die Lives auf 3 zurück; kein Treffer −1. Bei 0 Lives startet Overdrive.'
          : 'Gesammelte Symbole werden verteilt — finaler Reveal-Spin (Mock liefert Auszahlung im nächsten Schritt).';
    }

    if (btn) {
      btn.textContent =
        payload.phase === 'collection'
          ? 'Nächster Sammel-Spin'
          : 'Overdrive / Abschluss-Spin';
    }

    this.hooks?.onPayloadRendered?.(payload);
  }

  private waitClick(
    btn: HTMLButtonElement,
    signal: AbortSignal,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const onAbort = (): void => {
        btn.removeEventListener('click', onClick);
        resolve(false);
      };
      const onClick = (): void => {
        btn.removeEventListener('click', onClick);
        signal.removeEventListener('abort', onAbort);
        resolve(true);
      };
      if (signal.aborted) {
        resolve(false);
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      btn.addEventListener('click', onClick, { once: true });
    });
  }
}
