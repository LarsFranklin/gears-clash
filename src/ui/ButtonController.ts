const BTN_CLASS = 'gc-button';
const SPIN_MODIFIER = 'gc-button--spin';

export interface ButtonControllerOptions {
  /** Wenn gesetzt, wird kein eigener Button erzeugt. */
  externalButton?: HTMLButtonElement;
  label?: string;
  /** Runder Spin-Stil (nur bei internem Button). */
  spinStyle?: boolean;
}

export class ButtonController {
  private btn: HTMLButtonElement | null = null;
  private ownsButton = false;
  private listeners: { handler: () => void; controller: AbortController }[] = [];

  constructor(private readonly options: ButtonControllerOptions = {}) {}

  mount(parent: HTMLElement): void {
    if (this.options.externalButton) {
      this.btn = this.options.externalButton;
      this.ownsButton = false;
      if (!this.btn.classList.contains(BTN_CLASS)) {
        this.btn.classList.add(BTN_CLASS);
      }
      return;
    }
    this.ownsButton = true;
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = BTN_CLASS;
    if (this.options.spinStyle !== false) {
      this.btn.classList.add(SPIN_MODIFIER);
    }
    this.btn.textContent = this.options.label ?? 'Spin';
    parent.appendChild(this.btn);
  }

  setDisabled(disabled: boolean): void {
    if (this.btn) this.btn.disabled = disabled;
  }

  onClick(handler: () => void): void {
    if (!this.btn) return;
    const controller = new AbortController();
    this.btn.addEventListener('click', handler, { signal: controller.signal });
    this.listeners.push({ handler, controller });
  }

  offClick(handler: () => void): void {
    const idx = this.listeners.findIndex((l) => l.handler === handler);
    if (idx >= 0) {
      this.listeners[idx]!.controller.abort();
      this.listeners.splice(idx, 1);
    }
  }

  destroy(): void {
    for (const { controller } of this.listeners) controller.abort();
    this.listeners = [];
    if (this.ownsButton) this.btn?.remove();
    this.btn = null;
  }

  get element(): HTMLButtonElement | null {
    return this.btn;
  }
}
