import type { WinTier } from '../renderer/BigWinLayer';

const BAR_CLASS = 'gc-hud';
const PANEL_CLASS = 'gc-hud-panel';

export class HudController {
  private el: HTMLDivElement | null = null;
  private balance = 0;
  private win = 0;
  private animToken = 0;
  /** Wird bei `destroy` erhöht — offene `setTimeout` für Roll-CSS ignorieren dann das DOM. */
  private hudGen = 0;
  private rollTimers = new Set<number>();
  private reducedMotion = false;
  private motionQuery: MediaQueryList | null = null;
  private readonly onMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
  };

  mount(parent: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = BAR_CLASS;
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    this.el.innerHTML = `
      <div class="${PANEL_CLASS}">
        <span class="gc-hud-panel__label" id="gc-hud-label-balance">Balance</span>
        <span class="gc-hud-panel__value gc-rolling-digits" data-role="balance" aria-labelledby="gc-hud-label-balance">—</span>
      </div>
      <div class="${PANEL_CLASS}">
        <span class="gc-hud-panel__label" id="gc-hud-label-bet">Einsatz</span>
        <span class="gc-hud-panel__value" data-role="bet" aria-labelledby="gc-hud-label-bet">—</span>
      </div>
      <div class="${PANEL_CLASS}" data-role="win-panel">
        <span class="gc-hud-panel__label" id="gc-hud-label-win">Gewinn</span>
        <span class="gc-hud-panel__value gc-rolling-digits" data-role="win" aria-labelledby="gc-hud-label-win">—</span>
      </div>
    `;
    parent.appendChild(this.el);

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery.matches;
      this.motionQuery.addEventListener('change', this.onMotionChange);
    }
  }

  setBalance(value: number): void {
    this.balance = value;
    this.setRollingDigits('balance', value);
  }

  /** Zuletzt angezeigter Kontostand (Server-Wert, keine Client-Rechnung). */
  getBalance(): number {
    return this.balance;
  }

  setBet(value: number): void {
    this.setText('bet', this.formatNumber(value));
  }

  setWin(value: number): void {
    this.win = value;
    if (value <= 0) {
      this.setText('win', '—');
    } else {
      this.setRollingDigits('win', value);
    }
  }

  setWinTier(tier: WinTier): void {
    const panel = this.el?.querySelector('[data-role="win-panel"]') as HTMLElement | null;
    if (panel) {
      panel.style.setProperty('--gc-tier', tier);
      panel.dataset.tier = tier;
    }
  }

  clearWinTier(): void {
    const panel = this.el?.querySelector('[data-role="win-panel"]') as HTMLElement | null;
    if (panel) {
      panel.style.removeProperty('--gc-tier');
      delete panel.dataset.tier;
    }
  }

  setBalanceAnimated(target: number): void {
    const from = this.balance;
    this.balance = target;
    this.animateRollingDigits('balance', from, target, 380);
  }

  setWinAnimated(target: number, tier?: WinTier): void {
    const from = this.win;
    this.win = target;
    if (tier) {
      this.setWinTier(tier);
    }
    if (target <= 0) {
      this.setText('win', '—');
      this.clearWinTier();
      return;
    }
    this.animateRollingDigits('win', from, target, 320);
  }

  private setRollingDigits(role: string, value: number): void {
    const span = this.el?.querySelector(`[data-role="${role}"]`);
    if (!span) return;

    if (this.reducedMotion || value <= 0) {
      span.textContent = value > 0 ? this.formatNumber(value) : '—';
      return;
    }

    const formatted = this.formatNumber(value);
    span.innerHTML = '';
    for (const char of formatted) {
      const digitSpan = document.createElement('span');
      digitSpan.className = 'gc-rolling-digit';
      digitSpan.textContent = char;
      span.appendChild(digitSpan);
    }
  }

  private animateRollingDigits(
    role: string,
    from: number,
    to: number,
    durationMs: number,
  ): void {
    const span = this.el?.querySelector(`[data-role="${role}"]`);
    if (!span) return;
    const panel = span.closest('.gc-hud-panel');
    panel?.classList.add('gc-hud-panel--tick');
    const token = ++this.animToken;
    const t0 = performance.now();

    const step = (now: number) => {
      if (token !== this.animToken || !this.el) {
        panel?.classList.remove('gc-hud-panel--tick');
        return;
      }
      const u = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - u, 3);
      const v = Math.round(from + (to - from) * eased);

      if (this.reducedMotion) {
        span.textContent = this.formatNumber(v);
      } else {
        this.updateRollingDigits(span as HTMLElement, v);
      }

      if (u < 1) {
        requestAnimationFrame(step);
      } else {
        panel?.classList.remove('gc-hud-panel--tick');
      }
    };
    requestAnimationFrame(step);
  }

  private updateRollingDigits(container: HTMLElement, value: number): void {
    // Placeholder „—“ ist ein Textknoten; `children` zählt ihn nicht → sonst Anzeige „—92“.
    for (const n of Array.from(container.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) {
        container.removeChild(n);
      }
    }
    const formatted = this.formatNumber(value);
    const newLength = formatted.length;

    while (container.lastChild && container.children.length > newLength) {
      container.removeChild(container.lastChild);
    }
    while (container.children.length < newLength) {
      const digitSpan = document.createElement('span');
      digitSpan.className = 'gc-rolling-digit';
      container.appendChild(digitSpan);
    }

    const digits = container.querySelectorAll('.gc-rolling-digit');
    const gen = this.hudGen;
    for (let i = 0; i < formatted.length; i++) {
      const digitSpan = digits[i] as HTMLElement | undefined;
      if (!digitSpan) break;
      const newChar = formatted[i]!;
      if (digitSpan.textContent !== newChar) {
        digitSpan.classList.add('gc-rolling-digit--roll');
        digitSpan.textContent = newChar;
        const timerId = window.setTimeout(() => {
          this.rollTimers.delete(timerId);
          if (gen !== this.hudGen) return;
          digitSpan.classList.remove('gc-rolling-digit--roll');
        }, 150);
        this.rollTimers.add(timerId);
      }
    }
  }

  private setText(role: string, text: string): void {
    const span = this.el?.querySelector(`[data-role="${role}"]`);
    if (span) span.textContent = text;
  }

  private formatNumber(n: number): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
      n,
    );
  }

  destroy(): void {
    this.animToken++;
    this.hudGen++;
    for (const timerId of this.rollTimers) {
      clearTimeout(timerId);
    }
    this.rollTimers.clear();
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    this.motionQuery = null;
    this.el?.remove();
    this.el = null;
  }
}
