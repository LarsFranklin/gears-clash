const BAR_CLASS = 'gc-hud';
const PANEL_CLASS = 'gc-hud-panel';

export class HudController {
  private el: HTMLDivElement | null = null;
  private balance = 0;
  private win = 0;

  mount(parent: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = BAR_CLASS;
    this.el.innerHTML = `
      <div class="${PANEL_CLASS}">
        <span class="gc-hud-panel__label">Balance</span>
        <span class="gc-hud-panel__value" data-role="balance">—</span>
      </div>
      <div class="${PANEL_CLASS}">
        <span class="gc-hud-panel__label">Einsatz</span>
        <span class="gc-hud-panel__value" data-role="bet">—</span>
      </div>
      <div class="${PANEL_CLASS}">
        <span class="gc-hud-panel__label">Gewinn</span>
        <span class="gc-hud-panel__value" data-role="win">—</span>
      </div>
    `;
    parent.appendChild(this.el);
  }

  setBalance(value: number): void {
    this.balance = value;
    this.setText('balance', this.formatNumber(value));
  }

  setBet(value: number): void {
    this.setText('bet', this.formatNumber(value));
  }

  setWin(value: number): void {
    this.win = value;
    this.setText('win', value > 0 ? this.formatNumber(value) : '—');
  }

  setBalanceAnimated(target: number): void {
    const from = this.balance;
    this.balance = target;
    this.animateNumber('balance', from, target, 380);
  }

  setWinAnimated(target: number): void {
    const from = this.win;
    this.win = target;
    if (target <= 0) {
      this.setText('win', '—');
      return;
    }
    this.animateNumber('win', from, target, 320);
  }

  private animateNumber(
    role: string,
    from: number,
    to: number,
    durationMs: number,
  ): void {
    const span = this.el?.querySelector(`[data-role="${role}"]`);
    if (!span) return;
    const panel = span.closest('.gc-hud-panel');
    panel?.classList.add('gc-hud-panel--tick');
    const t0 = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - u, 3);
      const v = Math.round(from + (to - from) * eased);
      span.textContent = this.formatNumber(v);
      if (u < 1) requestAnimationFrame(step);
      else panel?.classList.remove('gc-hud-panel--tick');
    };
    requestAnimationFrame(step);
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
    this.el?.remove();
    this.el = null;
  }
}
