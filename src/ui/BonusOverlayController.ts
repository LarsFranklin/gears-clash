const ROOT = 'gc-bonus-overlay';
const DIM = 'gc-bonus-overlay__dim';
const CARD = 'gc-bonus-overlay__card';
const TITLE = 'gc-bonus-overlay__title';

const TITLES: Record<string, string> = {
  gears_clash: 'Gears Clash',
  heist_run: 'Heist Run',
  deadlock_mode: 'Deadlock Mode',
};

/**
 * Bonus-Intro: Dim + Titel — Sound über GearsClashGameOptions.sound.
 */
export class BonusOverlayController {
  private el: HTMLDivElement | null = null;

  mount(parent: HTMLElement): void {
    this.el = document.createElement('div');
    this.el.className = ROOT;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="${DIM}"></div>
      <div class="${CARD}">
        <h2 class="${TITLE}" data-role="title">Bonus</h2>
      </div>
    `;
    parent.appendChild(this.el);
    this.el.classList.remove('gc-bonus-overlay--visible');
  }

  async show(bonusType: string): Promise<void> {
    if (!this.el) return;
    const title = this.el.querySelector(`[data-role="title"]`);
    if (title) title.textContent = TITLES[bonusType] ?? bonusType;
    this.el.setAttribute('aria-hidden', 'false');
    this.el.classList.add('gc-bonus-overlay--visible');
    await new Promise<void>((r) => {
      window.setTimeout(r, 1650);
    });
    this.hide();
  }

  private hide(): void {
    if (!this.el) return;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.classList.remove('gc-bonus-overlay--visible');
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}
