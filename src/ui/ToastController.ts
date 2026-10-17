export type ToastKind = 'info' | 'warning' | 'error';

export interface ToastOptions {
  /** Anzeigedauer in ms. `0` hält den Toast bis zum nächsten Aufruf offen. */
  durationMs?: number;
  kind?: ToastKind;
}

const DEFAULT_DURATION_MS = 3200;

/**
 * Nicht blockierende Kurzmeldungen im Host-Container.
 *
 * Ersetzt `alert()` (Projektregel `code-quality.mdc`) und bleibt innerhalb der
 * Slot-Wurzel, damit die CSS-Isolation gewahrt bleibt.
 */
export class ToastController {
  private el: HTMLDivElement | null = null;
  private timer: number | null = null;

  mount(parent: HTMLElement): void {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'gc-toast';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.hidden = true;
    parent.appendChild(this.el);
  }

  show(message: string, opts: ToastOptions = {}): void {
    if (!this.el) return;
    const { durationMs = DEFAULT_DURATION_MS, kind = 'info' } = opts;

    this.clearTimer();
    this.el.textContent = message;
    this.el.dataset.gcToastKind = kind;
    this.el.hidden = false;
    // Reflow, damit die Einblend-Animation bei Folge-Toasts erneut startet.
    void this.el.offsetWidth;
    this.el.classList.add('gc-toast--visible');

    if (durationMs > 0) {
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.hide();
      }, durationMs);
    }
  }

  hide(): void {
    this.clearTimer();
    if (!this.el) return;
    this.el.classList.remove('gc-toast--visible');
    this.el.hidden = true;
  }

  destroy(): void {
    this.clearTimer();
    this.el?.remove();
    this.el = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
