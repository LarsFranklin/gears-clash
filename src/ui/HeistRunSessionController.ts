import type {
  BonusSessionPayload,
  GameConfig,
  HeistRunPayload,
  SpinResult,
} from '../config/types';

const ROOT = 'gc-heist-run-session';

export interface HeistRunSessionHooks {
  onPayloadRendered?: (payload: HeistRunPayload) => void;
}

/**
 * Heist Run — Free-Spin-Session mit Sticky-Wild-Tracker (Anzeige only).
 */
export class HeistRunSessionController {
  private el: HTMLDivElement | null = null;
  private abort = new AbortController();

  constructor(
    private readonly config: GameConfig,
    private readonly hooks?: HeistRunSessionHooks,
  ) {}

  mount(parent: HTMLElement): void {
    if (this.el) return;
    const el = document.createElement('div');
    el.className = ROOT;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="gc-heist-run-session__panel">
        <header class="gc-heist-run-session__head">
          <h2 class="gc-heist-run-session__title">Heist Run</h2>
          <p class="gc-heist-run-session__counter" data-role="counter">Freispiel — / —</p>
        </header>
        <section class="gc-heist-run-session__stickies" aria-label="Sticky Wilds">
          <h3 class="gc-heist-run-session__stickies-title">Sticky Wilds</h3>
          <ul class="gc-heist-run-session__list" data-role="sticky-list"></ul>
        </section>
        <p class="gc-heist-run-session__hint" data-role="hint"></p>
        <button type="button" class="gc-heist-run-session__action" data-role="continue">
          Nächster Freispiel-Spin
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
   * Free-Spin-Schleife — Fortsetzung über `requestNextSpin()` (mode `heist_run`).
   */
  async runSession(
    initial: SpinResult,
    requestNextSpin: () => Promise<SpinResult>,
  ): Promise<BonusSessionPayload | undefined> {
    if (!this.el || initial.bonus?.type !== 'heist_run') return undefined;

    const signal = this.abort.signal;
    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('gc-heist-run-session--visible');

    let current: SpinResult = initial;
    let lastHeist: BonusSessionPayload | undefined = initial.bonus;

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

      if (current.bonus?.type !== 'heist_run') {
        this.renderSessionEnd(current);
        btn.textContent = 'Schließen';
        await this.waitClick(btn, signal);
        return false;
      }
      lastHeist = current.bonus;
      return true;
    };

    while (await stepOnce()) {
      /* nächster Freispiel-Spin */
    }

    this.hide();
    return lastHeist;
  }

  private hide(): void {
    if (!this.el) return;
    this.el.classList.remove('gc-heist-run-session--visible');
    this.el.setAttribute('aria-hidden', 'true');
  }

  private renderSessionEnd(result: SpinResult): void {
    const hint = this.el?.querySelector('[data-role="hint"]');
    const counter = this.el?.querySelector('[data-role="counter"]');
    if (counter) counter.textContent = 'Heist Run beendet';
    if (hint) {
      hint.textContent = `Session-Gewinn ${Math.max(0, Math.floor(result.winAmount))} Coins (vom Server/Mock).`;
    }
  }

  private renderPayload(result: SpinResult): void {
    if (result.bonus?.type !== 'heist_run') return;
    this.renderFromPayload(result.bonus.payload);
  }

  private renderFromPayload(payload: HeistRunPayload): void {
    if (!this.el) return;
    const counter = this.el.querySelector('[data-role="counter"]');
    const list = this.el.querySelector('[data-role="sticky-list"]');
    const hint = this.el.querySelector('[data-role="hint"]');
    const btn = this.el.querySelector('[data-role="continue"]') as HTMLButtonElement | null;

    const max = payload.freeSpinsAwarded;
    const cur = payload.currentSpin ?? 1;
    if (counter) counter.textContent = `Freispiel ${cur} / ${max}`;

    if (list) {
      list.replaceChildren();
      const items = payload.stickyWilds ?? [];
      if (items.length === 0) {
        const li = document.createElement('li');
        li.className = 'gc-heist-run-session__list-empty';
        li.textContent = 'Noch keine Sticky Wilds — sammle Wilds während der Freispiele.';
        list.appendChild(li);
      } else {
        for (const sw of items) {
          const li = document.createElement('li');
          li.className = 'gc-heist-run-session__list-item';
          const mul = sw.multiplier !== undefined ? ` ×${sw.multiplier}` : '';
          li.textContent = `Wild @ ${sw.reel},${sw.row}${mul}`;
          list.appendChild(li);
        }
      }
    }

    if (hint) {
      hint.textContent =
        cur >= max
          ? 'Letzter Freispiel — danach Abschluss.'
          : 'Sticky Wilds bleiben bis Session-Ende auf dem Grid.';
    }

    if (btn) {
      btn.textContent =
        cur >= max ? 'Abschluss-Spin' : 'Nächster Freispiel-Spin';
    }

    this.hooks?.onPayloadRendered?.(payload);
  }

  private waitClick(btn: HTMLButtonElement, signal: AbortSignal): Promise<boolean> {
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
