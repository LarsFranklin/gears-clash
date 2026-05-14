import type { BonusId } from '../config/types';

const ROOT = 'gc-bonus-overlay';

interface BonusTheme {
  title: string;
  subtitle: string;
  accentHtml: string;
}

const THEMES: Record<BonusId, BonusTheme> = {
  gears_clash: {
    title: 'Gears Clash',
    subtitle: 'Multiplier Battle',
    accentHtml: `
      <div class="gc-bonus-accent gc-bonus-accent--gears">
        <div class="gc-bonus-gear gc-bonus-gear--left"></div>
        <div class="gc-bonus-gear gc-bonus-gear--right"></div>
        <div class="gc-bonus-sparks"></div>
      </div>
    `,
  },
  heist_run: {
    title: 'Heist Run',
    subtitle: 'Sticky Wilds Active',
    accentHtml: `
      <div class="gc-bonus-accent gc-bonus-accent--heist">
        <div class="gc-bonus-wild-star"></div>
      </div>
    `,
  },
  deadlock_mode: {
    title: 'Deadlock Mode',
    subtitle: 'Collect & Overdrive',
    accentHtml: `
      <div class="gc-bonus-accent gc-bonus-accent--deadlock">
        <div class="gc-bonus-phases">
          <div class="gc-bonus-phase gc-bonus-phase--active" data-phase="1">
            <span class="gc-bonus-phase__label">Phase 1</span>
            <span class="gc-bonus-phase__name">Collection</span>
          </div>
          <div class="gc-bonus-phase-connector"></div>
          <div class="gc-bonus-phase" data-phase="2">
            <span class="gc-bonus-phase__label">Phase 2</span>
            <span class="gc-bonus-phase__name">Overdrive</span>
          </div>
        </div>
      </div>
    `,
  },
};

/**
 * Bonus-Intro v2: Theme-spezifische Overlays mit Pixi-Akzenten und CSS-Animationen.
 */
export class BonusOverlayController {
  private el: HTMLDivElement | null = null;
  private currentBonusId: BonusId | null = null;
  private showCallId = 0;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private showTimerResolve: (() => void) | null = null;

  private cancelShowDelay(): void {
    if (this.showTimer !== null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    const r = this.showTimerResolve;
    if (r) {
      this.showTimerResolve = null;
      r();
    }
  }

  mount(parent: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = ROOT;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="gc-bonus-overlay__dim"></div>
      <div class="gc-bonus-overlay__card">
        <div class="gc-bonus-overlay__accent-slot" data-role="accent"></div>
        <h2 class="gc-bonus-overlay__title" data-role="title">Bonus</h2>
        <p class="gc-bonus-overlay__subtitle" data-role="subtitle"></p>
      </div>
    `;
    parent.appendChild(this.el);
  }

  async show(bonusType: BonusId, durationMs = 1800): Promise<void> {
    if (!this.el) return;

    const myId = ++this.showCallId;
    this.cancelShowDelay();

    const theme = THEMES[bonusType];
    this.currentBonusId = bonusType;

    const card = this.el.querySelector('.gc-bonus-overlay__card') as HTMLElement | null;
    if (card) {
      card.dataset.bonusId = bonusType;
    }

    const title = this.el.querySelector('[data-role="title"]');
    const subtitle = this.el.querySelector('[data-role="subtitle"]');
    const accentSlot = this.el.querySelector('[data-role="accent"]');

    if (title) title.textContent = theme.title;
    if (subtitle) subtitle.textContent = theme.subtitle;
    if (accentSlot) accentSlot.innerHTML = theme.accentHtml;

    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('gc-bonus-overlay--visible');

    await new Promise<void>((resolve) => {
      this.showTimerResolve = resolve;
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        this.showTimerResolve = null;
        resolve();
      }, durationMs);
    });

    if (!this.el || myId !== this.showCallId) return;
    this.hide();
  }

  /**
   * Aktualisiert die Phasen-Markierung im Intro-Kartenlayout (nur bei `deadlock_mode`-Theme im DOM).
   * Läuft auch nach `show()`/`hide()`, solange die Akzent-HTML noch die Phase-Elemente enthält.
   */
  setDeadlockPhase(phase: 1 | 2): void {
    if (!this.el) return;
    const phases = this.el.querySelectorAll('.gc-bonus-phase');
    if (phases.length === 0) return;
    phases.forEach((el) => {
      const phaseNum = parseInt((el as HTMLElement).dataset.phase ?? '0', 10);
      el.classList.toggle('gc-bonus-phase--active', phaseNum === phase);
    });
  }

  private hide(): void {
    if (!this.el) return;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.classList.remove('gc-bonus-overlay--visible');
    this.currentBonusId = null;
  }

  destroy(): void {
    this.showCallId++;
    this.cancelShowDelay();
    this.el?.remove();
    this.el = null;
    this.currentBonusId = null;
  }
}
