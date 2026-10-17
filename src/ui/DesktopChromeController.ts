/**
 * Desktop-Seitenleisten — sichtbar ab `wide` / `ultrawide` (CSS an `.gc-slot[data-gc-layout]`).
 * Werte stammen aus `SpinResult` / Session-Summen (nur Anzeige, keine Auszahlungslogik).
 */

import type { BonusSessionPayload, SpinResult } from '../config/types';

const STAGE_CLASS = 'gc-slot__desktop-stage';
const CENTER_CLASS = 'gc-slot__center';
const ASIDE_CLASS = 'gc-desktop-chrome';
const SECTION_CLASS = 'gc-desktop-chrome__section';
const LABEL_CLASS = 'gc-desktop-chrome__label';
const VALUE_CLASS = 'gc-desktop-chrome__value';

export interface DesktopSpinSessionStats {
  /** Summe der `winAmount`-Werte aus erfolgreichen Spins (API). */
  sessionWinTotal: number;
  /** Maximum eines Einzel-`winAmount` in dieser Session. */
  biggestWinSession: number;
  /** Anzahl abgeschlossener Spins seit Mount. */
  spinCount?: number;
  /** Text aus `BonusEngine.describeBonus()` — reine Anzeige. */
  bonusDescription?: string;
}

export class DesktopChromeController {
  private stageEl: HTMLDivElement | null = null;
  private centerEl: HTMLDivElement | null = null;

  /**
   * Hängt die Desktop-Zeile unter `parent` ein und liefert den zentralen Mount für `gc-frame`.
   */
  mount(parent: HTMLElement): HTMLElement {
    const stage = document.createElement('div');
    stage.className = STAGE_CLASS;

    const center = document.createElement('div');
    center.className = CENTER_CLASS;
    center.setAttribute('data-gc-center', 'game');

    const left = this.buildAside('left', 'Bonus-Status', [
      { panel: 'active-effects', label: 'Modus', hint: 'Server' },
      { panel: 'bonus-progress', label: 'Bonus-Fortschritt', hint: 'Server' },
      { panel: 'bonus-detail', label: 'Details', hint: 'Server' },
    ]);
    const right = this.buildAside('right', 'Session-Kennzahlen', [
      { panel: 'session-win', label: 'Session-Gewinn', hint: 'Summe' },
      { panel: 'biggest-win', label: 'Bester Treffer', hint: 'Einzelspin' },
      { panel: 'spin-count', label: 'Spins', hint: 'seit Start' },
    ]);
    stage.appendChild(left);
    stage.appendChild(center);
    stage.appendChild(right);

    parent.appendChild(stage);

    this.stageEl = stage;
    this.centerEl = center;
    return center;
  }

  /** Startzustand nach Mount (Zähler 0, keine Bonusdaten). */
  resetPanels(locale?: string): void {
    const fmt = this.mkFmt(locale);
    this.setPanelText('session-win', fmt(0));
    this.setPanelText('biggest-win', fmt(0));
    this.setPanelText('spin-count', '0');
    this.setPanelText('active-effects', 'Basisspiel');
    this.setPanelText('bonus-progress', '—');
    this.setPanelText('bonus-detail', '—');
    this.setBonusAccent(null);
  }

  /**
   * Aktualisiert alle sechs Felder aus dem letzten Spin und den Session-Kennzahlen.
   */
  updateFromSpinResult(
    result: SpinResult,
    stats: DesktopSpinSessionStats,
    locale?: string,
  ): void {
    const fmt = this.mkFmt(locale);
    this.setPanelText('session-win', fmt(stats.sessionWinTotal));
    this.setPanelText('biggest-win', fmt(stats.biggestWinSession));
    if (stats.spinCount != null) {
      this.setPanelText('spin-count', `${stats.spinCount}`);
    }

    const bonus = result.bonus;
    if (!bonus) {
      this.setPanelText('active-effects', 'Basisspiel');
      this.setPanelText('bonus-progress', '—');
      this.setPanelText('bonus-detail', '—');
      this.setBonusAccent(null);
      return;
    }

    this.setPanelText('active-effects', this.bonusTypeLabel(bonus));
    this.setPanelText('bonus-progress', this.bonusProgressText(bonus));
    this.setPanelText('bonus-detail', stats.bonusDescription ?? '—');
    this.setBonusAccent(bonus.type);
  }

  /** Fortschritt in einer Zeile — Zahlen kommen unverändert aus dem Payload. */
  private bonusProgressText(bonus: BonusSessionPayload): string {
    switch (bonus.type) {
      case 'gears_clash': {
        const { gearA, gearB } = bonus.payload;
        return `×${gearA.multiplier} vs ×${gearB.multiplier}`;
      }
      case 'heist_run': {
        const { currentSpin, freeSpinsAwarded } = bonus.payload;
        return currentSpin != null
          ? `${currentSpin} / ${freeSpinsAwarded} FS`
          : `${freeSpinsAwarded} FS`;
      }
      case 'deadlock_mode': {
        const p = bonus.payload;
        const phase = p.phase === 'collection' ? 'Sammlung' : 'Overdrive';
        return p.remainingSpins != null
          ? `${phase} · ${p.remainingSpins} übrig`
          : phase;
      }
      default:
        return '—';
    }
  }

  private setBonusAccent(bonusId: BonusSessionPayload['type'] | null): void {
    const aside = this.stageEl?.querySelector<HTMLElement>(
      `.${ASIDE_CLASS}--left`,
    );
    if (!aside) return;
    if (bonusId) {
      aside.dataset.bonusId = bonusId;
    } else {
      delete aside.dataset.bonusId;
    }
  }

  private bonusTypeLabel(bonus: BonusSessionPayload): string {
    switch (bonus.type) {
      case 'gears_clash':
        return 'Gears Clash';
      case 'heist_run':
        return 'Heist Run';
      case 'deadlock_mode':
        return 'Deadlock';
      default:
        return 'Bonus';
    }
  }

  private mkFmt(locale?: string): (n: number) => string {
    return (n: number) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
        Math.max(0, Math.floor(n)),
      );
  }

  private setPanelText(panelId: string, text: string): void {
    if (!this.stageEl) return;
    const sec = this.stageEl.querySelector(`[data-gc-panel="${panelId}"]`);
    const el = sec?.querySelector(`.${VALUE_CLASS}`) as HTMLElement | null;
    if (!el) return;
    const v = text.trim() === '' ? '—' : text;
    el.textContent = v;
  }

  private buildAside(
    side: 'left' | 'right',
    ariaLabel: string,
    blocks: readonly { panel: string; label: string; hint: string }[],
  ): HTMLElement {
    const aside = document.createElement('aside');
    aside.className = `${ASIDE_CLASS} ${ASIDE_CLASS}--${side}`;
    aside.setAttribute('aria-label', ariaLabel);

    for (const b of blocks) {
      const sec = document.createElement('div');
      sec.className = SECTION_CLASS;
      sec.dataset.gcPanel = b.panel;

      const lab = document.createElement('span');
      lab.className = LABEL_CLASS;
      lab.id = `gc-panel-label-${b.panel}`;
      lab.textContent = b.label;

      const val = document.createElement('span');
      val.className = VALUE_CLASS;
      val.setAttribute('aria-labelledby', `gc-panel-label-${b.panel}`);
      val.setAttribute('aria-describedby', `gc-panel-hint-${b.panel}`);
      val.textContent = '—';

      const hint = document.createElement('span');
      hint.className = 'gc-desktop-chrome__hint';
      hint.id = `gc-panel-hint-${b.panel}`;
      hint.textContent = b.hint;

      sec.appendChild(lab);
      sec.appendChild(val);
      sec.appendChild(hint);
      aside.appendChild(sec);
    }

    return aside;
  }

  destroy(): void {
    this.stageEl?.remove();
    this.stageEl = null;
    this.centerEl = null;
  }
}
