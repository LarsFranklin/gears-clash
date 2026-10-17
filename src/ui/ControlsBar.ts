const DEFAULT_BET_LEVELS = [10, 25, 50, 100, 250];
const AUTO_SPIN_OPTIONS = [0, 10, 25, 50, 100];
const TURBO_STORAGE_KEY = 'gc:turbo';

export interface ControlsBarOptions {
  betLevels?: number[];
  /** Startwert — bestimmt, welche Bet-Stufe beim Mounten aktiv ist. */
  initialBet?: number;
  /** Startzustand des Sound-Toggles (aus `config.sound.enabled`). */
  soundEnabled?: boolean;
  showBetStepper?: boolean;
  showAutoSpin?: boolean;
  showTurboToggle?: boolean;
  showSoundToggle?: boolean;
  showInfoButton?: boolean;
  onBetChange?: (bet: number) => void;
  onAutoSpinChange?: (count: number) => void;
  onTurboChange?: (enabled: boolean) => void;
  onSoundChange?: (enabled: boolean) => void;
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
  private soundEnabled = false;
  private spinning = false;
  private locked = false;
  private opts: ControlsBarOptions;
  private abortController: AbortController | null = null;

  constructor(opts: ControlsBarOptions = {}) {
    this.opts = opts;
    this.betLevels = opts.betLevels ?? DEFAULT_BET_LEVELS;
    this.soundEnabled = opts.soundEnabled ?? false;
    if (opts.initialBet !== undefined) {
      this.betIndex = nearestBetIndex(this.betLevels, opts.initialBet);
    }

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(TURBO_STORAGE_KEY);
      this.turboEnabled = stored === 'true';
    }
  }

  get isSoundEnabled(): boolean {
    return this.soundEnabled;
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
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'gc-controls-bar';
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const {
      showBetStepper = false,
      showAutoSpin = false,
      showTurboToggle = false,
      showSoundToggle = false,
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

    if (showSoundToggle) {
      this.el.appendChild(this.createSoundToggle());
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
    group.className = 'gc-controls-bar__group gc-controls-bar__group--bet';
    group.innerHTML = `
      <button type="button" class="gc-controls-bar__btn" data-action="bet-down" aria-label="Einsatz verringern">−</button>
      <span class="gc-controls-bar__bet">
        <span class="gc-controls-bar__label">Einsatz</span>
        <span class="gc-controls-bar__bet-display" data-role="bet-display" aria-live="polite">${this.currentBet}</span>
      </span>
      <button type="button" class="gc-controls-bar__btn" data-action="bet-up" aria-label="Einsatz erhöhen">+</button>
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
      <span class="gc-controls-bar__auto-count" data-role="auto-count" aria-live="polite" hidden></span>
      <button type="button" class="gc-controls-bar__btn gc-controls-bar__btn--stop" data-action="auto-stop" aria-label="Auto-Spin stoppen" hidden>■</button>
    `;
    return group;
  }

  private createTurboToggle(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gc-controls-bar__toggle';
    btn.dataset.action = 'turbo';
    btn.textContent = 'Turbo';
    btn.setAttribute('aria-label', 'Turbo-Modus');
    btn.setAttribute('aria-pressed', String(this.turboEnabled));
    return btn;
  }

  private createSoundToggle(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gc-controls-bar__toggle gc-controls-bar__toggle--sound';
    btn.dataset.action = 'sound';
    btn.textContent = this.soundEnabled ? '♪' : '✕';
    btn.setAttribute('aria-label', 'Sound an/aus');
    btn.setAttribute('aria-pressed', String(this.soundEnabled));
    return btn;
  }

  private createInfoButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
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
        const target = (e.target as HTMLElement | null)?.closest(
          '[data-action]',
        ) as HTMLElement | null;
        const action = target?.dataset.action;
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
          case 'sound':
            this.toggleSound();
            break;
          case 'auto-stop':
            this.cancelAutoSpin();
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
    if (this.spinning || this.locked) return;
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

  private toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    this.opts.onSoundChange?.(this.soundEnabled);
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

  /** Sperrt alle Bedienelemente außer Info — genutzt während einer Bonus-Session. */
  setLocked(locked: boolean): void {
    this.locked = locked;
    this.updateUI();
  }

  /** Übernimmt einen extern gesetzten Einsatz ohne `onBetChange` erneut zu feuern. */
  setBet(bet: number): void {
    this.betIndex = nearestBetIndex(this.betLevels, bet);
    this.updateUI();
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.updateUI();
  }

  setBetLevels(levels: number[]): void {
    const current = this.currentBet;
    this.betLevels = levels.length > 0 ? levels : DEFAULT_BET_LEVELS;
    this.betIndex = nearestBetIndex(this.betLevels, current);
    this.opts.onBetChange?.(this.currentBet);
    this.updateUI();
  }

  private updateUI(): void {
    if (!this.el) return;
    const busy = this.spinning || this.locked;
    this.el.classList.toggle('gc-controls-bar--locked', this.locked);

    const betDisplay = this.el.querySelector('[data-role="bet-display"]');
    if (betDisplay) {
      betDisplay.textContent = String(this.currentBet);
    }

    const betDown = this.el.querySelector('[data-action="bet-down"]') as HTMLButtonElement | null;
    const betUp = this.el.querySelector('[data-action="bet-up"]') as HTMLButtonElement | null;
    if (betDown) betDown.disabled = busy || this.betIndex <= 0;
    if (betUp) betUp.disabled = busy || this.betIndex >= this.betLevels.length - 1;

    const turboBtn = this.el.querySelector('[data-action="turbo"]');
    if (turboBtn) {
      turboBtn.classList.toggle('gc-controls-bar__toggle--active', this.turboEnabled);
      turboBtn.setAttribute('aria-pressed', String(this.turboEnabled));
    }

    const soundBtn = this.el.querySelector('[data-action="sound"]');
    if (soundBtn) {
      soundBtn.classList.toggle('gc-controls-bar__toggle--active', this.soundEnabled);
      soundBtn.setAttribute('aria-pressed', String(this.soundEnabled));
      soundBtn.textContent = this.soundEnabled ? '♪' : '✕';
    }

    const autoSelect = this.el.querySelector('[data-role="auto-select"]') as HTMLSelectElement | null;
    const autoCount = this.el.querySelector('[data-role="auto-count"]') as HTMLElement | null;
    const autoStop = this.el.querySelector('[data-action="auto-stop"]') as HTMLButtonElement | null;
    if (autoSelect && autoCount && autoStop) {
      const running = this.autoSpinCount > 0;
      autoSelect.hidden = running;
      autoSelect.disabled = busy;
      autoCount.hidden = !running;
      autoStop.hidden = !running;
      autoStop.disabled = this.locked;
      if (running) autoCount.textContent = `${this.autoSpinCount}×`;
    }
  }

  destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.el?.remove();
    this.el = null;
  }
}

function nearestBetIndex(levels: number[], bet: number): number {
  if (levels.length === 0) return 0;
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < levels.length; i++) {
    const delta = Math.abs((levels[i] ?? 0) - bet);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
}
