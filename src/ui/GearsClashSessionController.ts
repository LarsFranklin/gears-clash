import type { GearsClashPayload } from '../config/types';

const ROOT = 'gc-gears-clash-session';

export interface GearsClashSessionHooks {
  /** Pixi-Battle + Full-Reel-Wild — vom Host/Game angestoßen. */
  onBattle?: (payload: GearsClashPayload) => void | Promise<void>;
}

/**
 * Gears Clash — Multiplier-Battle UI (DOM). Mathematik/Outcome kommt aus dem Server-Payload.
 */
export class GearsClashSessionController {
  private el: HTMLDivElement | null = null;
  private abort = new AbortController();

  mount(parent: HTMLElement): void {
    if (this.el) return;
    const el = document.createElement('div');
    el.className = ROOT;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="gc-gears-clash-session__panel">
        <header class="gc-gears-clash-session__head">
          <h2 class="gc-gears-clash-session__title">Gears Clash</h2>
          <p class="gc-gears-clash-session__subtitle">Multiplier Battle</p>
        </header>
        <div class="gc-gears-clash-session__arena">
          <div class="gc-gears-clash-session__gear gc-gears-clash-session__gear--a">
            <span class="gc-gears-clash-session__gear-label">Gear A</span>
            <span class="gc-gears-clash-session__gear-mul" data-role="gear-a">×—</span>
          </div>
          <div class="gc-gears-clash-session__vs">VS</div>
          <div class="gc-gears-clash-session__gear gc-gears-clash-session__gear--b">
            <span class="gc-gears-clash-session__gear-label">Gear B</span>
            <span class="gc-gears-clash-session__gear-mul" data-role="gear-b">×—</span>
          </div>
        </div>
        <p class="gc-gears-clash-session__status" data-role="status">Kampf startet …</p>
        <p class="gc-gears-clash-session__winner" data-role="winner" hidden></p>
        <button type="button" class="gc-gears-clash-session__action" data-role="continue" hidden>
          Weiter
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
   * Zeigt Battle-UI, spielt Renderer-Hook ab, zeigt Sieger — schließt nach „Weiter".
   */
  async runSession(
    payload: GearsClashPayload,
    hooks?: GearsClashSessionHooks,
  ): Promise<void> {
    if (!this.el) return;
    const signal = this.abort.signal;

    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('gc-gears-clash-session--visible');

    const gearA = this.el.querySelector('[data-role="gear-a"]');
    const gearB = this.el.querySelector('[data-role="gear-b"]');
    const status = this.el.querySelector('[data-role="status"]');
    const winner = this.el.querySelector('[data-role="winner"]') as HTMLElement | null;
    const btn = this.el.querySelector('[data-role="continue"]') as HTMLButtonElement | null;

    if (gearA) gearA.textContent = `×${payload.gearA.multiplier}`;
    if (gearB) gearB.textContent = `×${payload.gearB.multiplier}`;
    if (status) status.textContent = 'Zahnräder prallen aufeinander …';
    if (winner) {
      winner.hidden = true;
      winner.textContent = '';
    }
    if (btn) btn.hidden = true;

    this.el.classList.add('gc-gears-clash-session--battle');

    await this.delay(600, signal);
    if (signal.aborted) return;

    await hooks?.onBattle?.(payload);

    if (signal.aborted) return;

    this.el.classList.remove('gc-gears-clash-session--battle');
    this.el.classList.add('gc-gears-clash-session--winner');

    const winMul =
      payload.winnerMultiplier ??
      Math.max(payload.gearA.multiplier, payload.gearB.multiplier);
    const reelTxt =
      payload.winnerReel !== undefined
        ? `Walze ${payload.winnerReel + 1}`
        : 'Sieger-Walze';

    if (status) status.textContent = 'Full-Reel-Wild aktiv';
    if (winner) {
      winner.hidden = false;
      winner.textContent = `${reelTxt} · ×${winMul}`;
    }
    if (btn) {
      btn.hidden = false;
      btn.textContent = 'Weiter';
    }

    if (btn) {
      await this.waitClick(btn, signal);
    }

    this.hide();
  }

  private hide(): void {
    if (!this.el) return;
    this.el.classList.remove(
      'gc-gears-clash-session--visible',
      'gc-gears-clash-session--battle',
      'gc-gears-clash-session--winner',
    );
    this.el.setAttribute('aria-hidden', 'true');
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const t = window.setTimeout(() => resolve(), ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });
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
