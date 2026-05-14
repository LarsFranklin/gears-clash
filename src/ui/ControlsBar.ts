const DEFAULT_BET_LEVELS = [10, 25, 50, 100, 250];
const AUTO_SPIN_OPTIONS = [0, 10, 25, 50, 100];
const TURBO_STORAGE_KEY = 'gc:turbo';

export interface ControlsBarOptions {
  betLevels?: number[];
  showBetStepper?: boolean;
  showAutoSpin?: boolean;
  showTurboToggle?: boolean;
  showInfoButton?: boolean;
  onBetChange?: (bet: number) => void;
  onAutoSpinChange?: (count: number) => void;
  onTurboChange?: (enabled: boolean) => void;
  onSpin?: () => void;
  onInfoClick?: () => void;
}

/**
 * Controls bar with Bet Stepper, Auto-Spin, Turbo Toggle, and Spin button integration.
 */
export class ControlsBar {
  private el: HTMLDivElement | null = null;
  private betLevels: number[];
  private betIndex = 0;
  private autoSpinCount = 0;
  private turboEnabled = false;
  private spinning = false;
  private opts: ControlsBarOptions;
  private abortController: AbortController | null = null;

  constructor(opts: ControlsBarOptions = {}) {
    this.opts = opts;
    this.betLevels = opts.betLevels ?? DEFAULT_BET_LEVELS;

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(TURBO_STORAGE_KEY);
      this.turboEnabled = stored === 'true';
    }
  }

  get currentBet(): number {
    return this.betLevels[this.betIndex] ?? this.betLevels[0] ?? 10;
  }

  get isTurbo(): boolean {
    return this.turboEnabled;
  }

  get autoSpinsRemaining(): number {
    return this.autoSpinCount;
  }

  mount(parent: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = 'gc-controls-bar';
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const {
      showBetStepper = false,
      showAutoSpin = false,
      showTurboToggle = false,
      showInfoButton = false,
    } = this.opts;

    if (showBetStepper) {
      const betGroup = this.createBetStepper();
      this.el.appendChild(betGroup);
    }

    if (showAutoSpin) {
      const autoGroup = this.createAutoSpin();
      this.el.appendChild(autoGroup);
    }

    if (showTurboToggle) {
      const turboBtn = this.createTurboToggle();
      this.el.appendChild(turboBtn);
    }

    if (showInfoButton) {
      const infoBtn = this.createInfoButton();
      this.el.appendChild(infoBtn);
    }

    parent.appendChild(this.el);
    this.bindEvents(signal);
    this.updateUI();
  }

  private createBetStepper(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'gc-controls-bar__group';
    group.innerHTML = `
      <button class="gc-controls-bar__btn" data-action="bet-down" aria-label="Einsatz verringern">−</button>
      <span class="gc-controls-bar__bet-display" data-role="bet-display">${this.currentBet}</span>
      <button class="gc-controls-bar__btn" data-action="bet-up" aria-label="Einsatz erhöhen">+</button>
    `;
    return group;
  }

  private createAutoSpin(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'gc-controls-bar__group';
    const options = AUTO_SPIN_OPTIONS.map(
      (v) => `<option value="${v}">${v === 0 ? 'Auto' : v}</option>`,
    ).join('');
    group.innerHTML = `
      <select class="gc-controls-bar__auto-select" data-role="auto-select" aria-label="Auto-Spin Anzahl">
        ${options}
      </select>
      <span class="gc-controls-bar__auto-count" data-role="auto-count" style="display:none"></span>
    `;
    return group;
  }

  private createTurboToggle(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'gc-controls-bar__toggle';
    btn.dataset.action = 'turbo';
    btn.textContent = 'Turbo';
    btn.setAttribute('aria-pressed', String(this.turboEnabled));
    return btn;
  }

  private createInfoButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'gc-controls-bar__info-btn';
    btn.dataset.action = 'info';
    btn.textContent = 'i';
    btn.setAttribute('aria-label', 'Spielinformationen');
    btn.setAttribute('title', 'Spielregeln & Auszahlungen');
    return btn;
  }

  private bindEvents(signal: AbortSignal): void {
    if (!this.el) return;

    this.el.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        if (!action) return;

        switch (action) {
          case 'bet-down':
            this.changeBet(-1);
            break;
          case 'bet-up':
            this.changeBet(1);
            break;
          case 'turbo':
            this.toggleTurbo();
            break;
          case 'info':
            this.opts.onInfoClick?.();
            break;
        }
      },
      { signal },
    );

    const autoSelect = this.el.querySelector('[data-role="auto-select"]') as HTMLSelectElement | null;
    if (autoSelect) {
      autoSelect.addEventListener(
        'change',
        () => {
          this.autoSpinCount = parseInt(autoSelect.value, 10) || 0;
          this.opts.onAutoSpinChange?.(this.autoSpinCount);
          this.updateUI();
        },
        { signal },
      );
    }
  }

  private changeBet(delta: number): void {
    if (this.spinning) return;
    const newIndex = Math.max(0, Math.min(this.betLevels.length - 1, this.betIndex + delta));
    if (newIndex !== this.betIndex) {
      this.betIndex = newIndex;
      this.opts.onBetChange?.(this.currentBet);
      this.updateUI();
    }
  }

  private toggleTurbo(): void {
    this.turboEnabled = !this.turboEnabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TURBO_STORAGE_KEY, String(this.turboEnabled));
    }
    this.opts.onTurboChange?.(this.turboEnabled);
    this.updateUI();
  }

  decrementAutoSpin(): boolean {
    if (this.autoSpinCount > 0) {
      this.autoSpinCount--;
      this.updateUI();
      return this.autoSpinCount > 0;
    }
    return false;
  }

  cancelAutoSpin(): void {
    this.autoSpinCount = 0;
    const autoSelect = this.el?.querySelector('[data-role="auto-select"]') as HTMLSelectElement | null;
    if (autoSelect) {
      autoSelect.value = '0';
    }
    this.updateUI();
  }

  setSpinning(spinning: boolean): void {
    this.spinning = spinning;
    this.updateUI();
  }

  setBetLevels(levels: number[]): void {
    this.betLevels = levels.length > 0 ? levels : DEFAULT_BET_LEVELS;
    this.betIndex = Math.min(this.betIndex, this.betLevels.length - 1);
    this.opts.onBetChange?.(this.currentBet);
    this.updateUI();
  }

  private updateUI(): void {
    if (!this.el) return;

    const betDisplay = this.el.querySelector('[data-role="bet-display"]');
    if (betDisplay) {
      betDisplay.textContent = String(this.currentBet);
    }

    const betDown = this.el.querySelector('[data-action="bet-down"]') as HTMLButtonElement | null;
    const betUp = this.el.querySelector('[data-action="bet-up"]') as HTMLButtonElement | null;
    if (betDown) betDown.disabled = this.spinning || this.betIndex <= 0;
    if (betUp) betUp.disabled = this.spinning || this.betIndex >= this.betLevels.length - 1;

    const turboBtn = this.el.querySelector('[data-action="turbo"]');
    if (turboBtn) {
      turboBtn.classList.toggle('gc-controls-bar__toggle--active', this.turboEnabled);
      turboBtn.setAttribute('aria-pressed', String(this.turboEnabled));
    }

    const autoSelect = this.el.querySelector('[data-role="auto-select"]') as HTMLSelectElement | null;
    const autoCount = this.el.querySelector('[data-role="auto-count"]') as HTMLElement | null;
    if (autoSelect && autoCount) {
      if (this.spinning && this.autoSpinCount > 0) {
        autoSelect.style.display = 'none';
        autoCount.style.display = 'inline';
        autoCount.textContent = `${this.autoSpinCount}`;
      } else {
        autoSelect.style.display = 'inline';
        autoCount.style.display = 'none';
        autoSelect.disabled = this.spinning;
      }
    }
  }

  destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.el?.remove();
    this.el = null;
  }
}
