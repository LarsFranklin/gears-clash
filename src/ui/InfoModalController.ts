import type { GameConfig, SlotPaylineDefinition, BonusId } from '../config/types';
import { activePaylines } from '../core/slotEvaluation';

type InfoTab = 'rules' | 'paylines' | 'paytable' | 'bonus';

const TAB_LABELS: Record<InfoTab, string> = {
  rules: 'Spielregeln',
  paylines: 'Gewinnlinien',
  paytable: 'Auszahlungen',
  bonus: 'Bonus-Modi',
};

const BONUS_INFO: Record<BonusId, { title: string; description: string }> = {
  gears_clash: {
    title: 'Gears Clash',
    description:
      'Zwei Zahnräder mit Multiplikatoren treten gegeneinander an. Das Gewinner-Zahnrad verwandelt eine komplette Walze in ein Full-Reel-Wild mit dem Gewinner-Multiplikator.',
  },
  heist_run: {
    title: 'Heist Run',
    description:
      'Free Spins mit Sticky Wilds! Jedes Wild-Symbol, das während der Freispiele landet, bleibt für die restlichen Spins an seiner Position. Sticky Wilds können zusätzliche Multiplikatoren tragen.',
  },
  deadlock_mode: {
    title: 'Deadlock Mode',
    description:
      'Zwei-Phasen-Bonus: In der Collection-Phase sammelst du Symbole und Multiplikatoren. Jeder Treffer setzt deine 3 Leben zurück. In der Overdrive-Phase werden alle gesammelten Werte auf das Grid verteilt.',
  },
};

export class InfoModalController {
  private container: HTMLElement | null = null;
  private config: GameConfig;
  private currentTab: InfoTab = 'rules';
  private abortController: AbortController | null = null;
  private highlightedLine: number = -1;
  private lastFocused: HTMLElement | null = null;

  constructor(config: GameConfig) {
    this.config = config;
  }

  mount(parent: HTMLElement): void {
    if (this.container) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.container = document.createElement('div');
    this.container.className = 'gc-info-modal';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-labelledby', 'gc-info-title');
    this.container.setAttribute('aria-hidden', 'true');

    this.render();
    parent.appendChild(this.container);

    this.container.addEventListener('click', (e) => this.handleBackdropClick(e), { signal });
    document.addEventListener('keydown', (e) => this.handleKeyDown(e), { signal });
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="gc-info-modal__backdrop"></div>
      <div class="gc-info-modal__panel">
        <header class="gc-info-modal__header">
          <h2 id="gc-info-title" class="gc-info-modal__title">Gears Clash</h2>
          <button class="gc-info-modal__close" aria-label="Schließen">&times;</button>
        </header>
        <nav class="gc-info-modal__tabs" role="tablist">
          ${this.renderTabs()}
        </nav>
        <div class="gc-info-modal__content">
          ${this.renderContent()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderTabs(): string {
    return (Object.keys(TAB_LABELS) as InfoTab[])
      .map(
        (tab) => `
        <button
          class="gc-info-modal__tab${this.currentTab === tab ? ' gc-info-modal__tab--active' : ''}"
          data-tab="${tab}"
          role="tab"
          aria-selected="${this.currentTab === tab}"
        >${TAB_LABELS[tab]}</button>
      `,
      )
      .join('');
  }

  private renderContent(): string {
    switch (this.currentTab) {
      case 'rules':
        return this.renderRules();
      case 'paylines':
        return this.renderPaylines();
      case 'paytable':
        return this.renderPaytable();
      case 'bonus':
        return this.renderBonus();
      default:
        return '';
    }
  }

  private renderRules(): string {
    const { grid, slotMath } = this.config;
    const lineCount = this.activePaylines().length || (slotMath ? 0 : 20);

    return [
      this.renderRuleSection('Wie man spielt', [
        `Gears Clash ist ein ${grid.reels}×${grid.rows} Video-Slot mit ${lineCount} Gewinnlinien.`,
        'Gewinne werden von links nach rechts auf aktiven Gewinnlinien ausgewertet.',
        `Mindestens ${slotMath?.minMatchLength ?? 3} gleiche Symbole in Folge ergeben einen Gewinn.`,
        'Wild-Symbole (Overdrive Gear) ersetzen alle regulären Symbole.',
        'Nur der höchste Gewinn pro Linie wird ausgezahlt.',
        'Gleichzeitige Gewinne auf verschiedenen Linien werden addiert.',
      ]),
      this.renderRuleSection('Scatter & Bonus', [
        `${slotMath?.scatterMinBonus ?? 3}+ Bonus-Symbole auf dem Grid lösen einen Bonus-Modus aus.`,
        'Es gibt 3 verschiedene Bonus-Symbole, die jeweils einen eigenen Modus aktivieren.',
        'Bei mehreren Bonus-Typen mit gleicher Anzahl: Gears Clash > Heist Run > Deadlock Mode.',
      ]),
      this.renderRuleSection('Einsatz & Auszahlung', [
        `Der Gesamteinsatz wird auf alle ${lineCount} Linien verteilt.`,
        'Auszahlungen werden mit dem Linieneinsatz multipliziert.',
        `Der maximale Gewinn ist auf ${this.config.maxWin.toLocaleString('de-DE')} Münzen begrenzt.`,
      ]),
    ].join('');
  }

  private renderRuleSection(title: string, items: string[]): string {
    const list = items
      .map((text) => `<li class="gc-info-section__item">${text}</li>`)
      .join('');
    return `
      <section class="gc-info-section">
        <h3 class="gc-info-section__title">${title}</h3>
        <ul class="gc-info-section__list">${list}</ul>
      </section>
    `;
  }

  private renderPaylines(): string {
    const paylines = this.activePaylines();
    const { rows } = this.config.grid;

    return `
      <section class="gc-info-section">
        <h3 class="gc-info-section__title">${paylines.length} Gewinnlinien</h3>
        <p class="gc-info-section__hint">Klicke auf eine Linie, um sie im Grid hervorzuheben.</p>
        <div class="gc-info-paylines">
          <div class="gc-info-paylines__grid" data-rows="${rows}">
            ${this.renderPaylineGrid(paylines)}
          </div>
          <div class="gc-info-paylines__list">
            ${this.renderPaylineList(paylines)}
          </div>
        </div>
      </section>
    `;
  }

  private renderPaylineGrid(paylines: readonly SlotPaylineDefinition[]): string {
    const { reels, rows } = this.config.grid;
    let cells = '';

    for (let row = 0; row < rows; row++) {
      for (let reel = 0; reel < reels; reel++) {
        const pos = row * reels + reel + 1;
        cells += `<div class="gc-info-grid__cell" data-pos="${pos}" data-reel="${reel}" data-row="${row}">
          <span class="gc-info-grid__pos">${pos.toString().padStart(2, '0')}</span>
        </div>`;
      }
    }

    return cells;
  }

  private renderPaylineList(paylines: readonly SlotPaylineDefinition[]): string {
    return paylines
      .map(
        (line, idx) => `
        <button
          class="gc-info-payline${this.highlightedLine === idx ? ' gc-info-payline--active' : ''}"
          data-line-idx="${idx}"
          data-line-type="${line.type ?? 'straight'}"
        >
          <span class="gc-info-payline__id">${line.id}</span>
          <span class="gc-info-payline__name">${line.name ?? `Linie ${idx + 1}`}</span>
          <span class="gc-info-payline__type">${line.type ?? 'straight'}</span>
        </button>
      `,
      )
      .join('');
  }

  private renderPaytable(): string {
    const math = this.config.slotMath;
    if (!math) {
      return '<p class="gc-info-section__hint">Keine Auszahlungstabelle verfügbar.</p>';
    }

    const symbols = this.config.symbols.filter(
      (s) => s.kind !== 'bonus' && math.lineMultipliersBySymbolId[s.id],
    );

    const tiers = {
      high: symbols.filter((s) => ['overdrive_core', 'quantum_chamber', 'wild_gear'].includes(s.id)),
      mid: symbols.filter((s) => ['steam_piston', 'fuel_canister', 'reactor_pipe'].includes(s.id)),
      low: symbols.filter(
        (s) => !['overdrive_core', 'quantum_chamber', 'wild_gear', 'steam_piston', 'fuel_canister', 'reactor_pipe'].includes(s.id) && s.kind !== 'bonus',
      ),
    };

    return `
      <section class="gc-info-section">
        <h3 class="gc-info-section__title">Auszahlungstabelle</h3>
        <p class="gc-info-section__hint">Multiplikatoren basieren auf dem Linieneinsatz (Gesamteinsatz / 20).</p>
        ${this.renderPaytableTier('High Tier', tiers.high, math)}
        ${this.renderPaytableTier('Mid Tier', tiers.mid, math)}
        ${this.renderPaytableTier('Low Tier', tiers.low, math)}
      </section>
      <section class="gc-info-section">
        <h3 class="gc-info-section__title">Bonus-Symbole</h3>
        <div class="gc-info-paytable__bonus">
          ${this.config.symbols
            .filter((s) => s.kind === 'bonus')
            .map(
              (s) => `
              <div class="gc-info-paytable__bonus-item">
                <span class="gc-info-paytable__symbol gc-info-paytable__symbol--bonus">${s.label}</span>
                <span class="gc-info-paytable__bonus-info">${math.scatterMinBonus}+ = Bonus aktivieren</span>
              </div>
            `,
            )
            .join('')}
        </div>
      </section>
    `;
  }

  private renderPaytableTier(
    title: string,
    symbols: typeof this.config.symbols,
    math: NonNullable<GameConfig['slotMath']>,
  ): string {
    if (symbols.length === 0) return '';

    return `
      <div class="gc-info-paytable__tier">
        <h4 class="gc-info-paytable__tier-title">${title}</h4>
        <table class="gc-info-paytable__table">
          <thead>
            <tr class="gc-info-paytable__row gc-info-paytable__row--head">
              <th class="gc-info-paytable__head">Symbol</th>
              <th class="gc-info-paytable__head">3×</th>
              <th class="gc-info-paytable__head">4×</th>
              <th class="gc-info-paytable__head">5×</th>
            </tr>
          </thead>
          <tbody>
            ${symbols
              .map((s) => {
                const mults = math.lineMultipliersBySymbolId[s.id] ?? [0, 0, 0];
                const cells = mults
                  .slice(0, 3)
                  .map(
                    (m) =>
                      `<td class="gc-info-paytable__cell">${this.formatMultiplier(m)}</td>`,
                  )
                  .join('');
                return `
                  <tr class="gc-info-paytable__row">
                    <td class="gc-info-paytable__cell gc-info-paytable__symbol">${s.label}</td>
                    ${cells}
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private formatMultiplier(val: number | undefined): string {
    if (val === undefined || val === 0) return '-';
    return `${val.toFixed(2)}×`;
  }

  private renderBonus(): string {
    return `
      <section class="gc-info-section">
        <h3 class="gc-info-section__title">Bonus-Modi</h3>
        <p class="gc-info-section__hint">
          Sammle ${this.config.slotMath?.scatterMinBonus ?? 3}+ gleiche Bonus-Symbole, um den entsprechenden Modus zu aktivieren.
        </p>
        ${(Object.keys(BONUS_INFO) as BonusId[])
          .map(
            (id) => `
            <article class="gc-info-bonus" data-bonus-id="${id}">
              <h4 class="gc-info-bonus__title">${BONUS_INFO[id].title}</h4>
              <p class="gc-info-bonus__desc">${BONUS_INFO[id].description}</p>
            </article>
          `,
          )
          .join('')}
      </section>
    `;
  }

  private attachEventListeners(): void {
    if (!this.container || !this.abortController) return;
    const { signal } = this.abortController;

    const closeBtn = this.container.querySelector('.gc-info-modal__close');
    closeBtn?.addEventListener('click', () => this.hide(), { signal });

    const tabs = this.container.querySelectorAll('.gc-info-modal__tab');
    tabs.forEach((tab) => {
      tab.addEventListener(
        'click',
        () => {
          const t = tab.getAttribute('data-tab') as InfoTab | null;
          if (t) this.switchTab(t);
        },
        { signal },
      );
    });

    const lineButtons = this.container.querySelectorAll('.gc-info-payline');
    lineButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const idx = parseInt(btn.getAttribute('data-line-idx') ?? '-1', 10);
          this.highlightLine(idx);
        },
        { signal },
      );
    });
  }

  private switchTab(tab: InfoTab): void {
    this.currentTab = tab;
    this.highlightedLine = -1;
    this.render();
    // `render()` ersetzt das Markup — der Fokus muss zurück auf den aktiven Tab.
    this.container
      ?.querySelector<HTMLElement>(`.gc-info-modal__tab[data-tab="${tab}"]`)
      ?.focus();
  }

  /** Deaktivierte Linien (`enabled: false`) tauchen in der Info nicht auf. */
  private activePaylines(): readonly SlotPaylineDefinition[] {
    const math = this.config.slotMath;
    return math ? activePaylines(math) : [];
  }

  private highlightLine(idx: number): void {
    if (!this.container) return;

    const paylines = this.activePaylines();
    const { reels } = this.config.grid;

    this.container.querySelectorAll('.gc-info-grid__cell--highlighted').forEach((cell) => {
      cell.classList.remove('gc-info-grid__cell--highlighted');
    });

    this.container.querySelectorAll('.gc-info-payline--active').forEach((btn) => {
      btn.classList.remove('gc-info-payline--active');
    });

    if (this.highlightedLine === idx) {
      this.highlightedLine = -1;
      return;
    }

    this.highlightedLine = idx;
    const line = paylines[idx];
    if (!line) return;

    const activeBtn = this.container.querySelector(`[data-line-idx="${idx}"]`);
    activeBtn?.classList.add('gc-info-payline--active');

    line.rows.forEach((row, reel) => {
      const pos = row * reels + reel + 1;
      const cell = this.container!.querySelector(`[data-pos="${pos}"]`);
      cell?.classList.add('gc-info-grid__cell--highlighted');
    });
  }

  private handleBackdropClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.classList.contains('gc-info-modal__backdrop')) {
      this.hide();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible()) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.hide();
      return;
    }
    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  /** Fokus bleibt im Dialog — Tab am Ende springt an den Anfang und umgekehrt. */
  private trapFocus(e: KeyboardEvent): void {
    const focusables = this.focusableElements();
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey && (active === first || !this.container?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private focusableElements(): HTMLElement[] {
    if (!this.container) return [];
    return Array.from(
      this.container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  show(): void {
    if (!this.container || this.isVisible()) return;
    this.lastFocused = document.activeElement as HTMLElement | null;
    this.container.classList.add('gc-info-modal--visible');
    this.container.setAttribute('aria-hidden', 'false');
    const closeBtn = this.container.querySelector<HTMLElement>('.gc-info-modal__close');
    closeBtn?.focus();
  }

  hide(): void {
    if (!this.container) return;
    const wasVisible = this.isVisible();
    this.container.classList.remove('gc-info-modal--visible');
    this.container.setAttribute('aria-hidden', 'true');
    if (wasVisible && this.lastFocused?.isConnected) {
      this.lastFocused.focus();
    }
    this.lastFocused = null;
  }

  isVisible(): boolean {
    return this.container?.classList.contains('gc-info-modal--visible') ?? false;
  }

  toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  updateConfig(config: GameConfig): void {
    this.config = config;
    if (this.container) {
      this.render();
    }
  }

  destroy(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.container?.remove();
    this.container = null;
  }
}
