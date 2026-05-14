/**
 * Desktop-Seitenleisten — sichtbar ab `wide` / `ultrawide` (CSS an `.gc-slot[data-gc-layout]`).
 * Werte stammen aus `SpinResult` / Session-Summen (nur Anzeige, keine Auszahlungslogik).
 */

import type { BonusSessionPayload, SpinResult } from '../config/types';

const STAGE_CLASS = 'gc-slot__desktop-stage';
const CENTER_CLASS = 'gc-slot__center';
/** Wieder `true`, wenn die Seitenleisten neu designt und produktiv geschaltet werden. */
const SHOW_DESKTOP_SIDE_PANELS = false;
const ASIDE_CLASS = 'gc-desktop-chrome';
const SECTION_CLASS = 'gc-desktop-chrome__section';
const LABEL_CLASS = 'gc-desktop-chrome__label';
const VALUE_CLASS = 'gc-desktop-chrome__value';

export interface DesktopSpinSessionStats {
  /** Summe der `winAmount`-Werte aus erfolgreichen Spins (API). */
  sessionWinTotal: number;
  /** Maximum eines Einzel-`winAmount` in dieser Session. */
  biggestWinSession: number;
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

    if (SHOW_DESKTOP_SIDE_PANELS) {
      const left = this.buildAside(
        'left',
        'Maschinen- und Bonus-Status',
        [
          { panel: 'reactor-status', label: 'Reaktor-Status', hint: 'API' },
          { panel: 'bonus-progress', label: 'Bonus-Fortschritt', hint: 'API' },
          { panel: 'overheat-level', label: 'Überhitzung', hint: 'API' },
        ],
      );
      const right = this.buildAside(
        'right',
        'Session und Effekte',
        [
          { panel: 'session-win', label: 'Session-Gewinn', hint: 'Summe API' },
          { panel: 'biggest-win', label: 'Bester Treffer', hint: 'API' },
          { panel: 'active-effects', label: 'Aktive Effekte', hint: 'API' },
        ],
      );
      stage.appendChild(left);
      stage.appendChild(center);
      stage.appendChild(right);
    } else {
      stage.appendChild(center);
    }

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
    this.setPanelText('active-effects', 'Basis');
    this.setPanelText('reactor-status', 'Bereit');
    this.setPanelText('bonus-progress', '—');
    this.setPanelText('overheat-level', 'Normal');
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

    const bonus = result.bonus;
    if (!bonus) {
      this.setPanelText('active-effects', 'Basis');
      this.setPanelText('reactor-status', 'Bereit');
      this.setPanelText('bonus-progress', '—');
      this.setPanelText('overheat-level', 'Normal');
      return;
    }

    this.setPanelText('active-effects', this.bonusTypeLabel(bonus));
    this.fillBonusSidePanels(bonus);
  }

  private fillBonusSidePanels(bonus: BonusSessionPayload): void {
    switch (bonus.type) {
      case 'gears_clash': {
        const { gearA, gearB, winnerReel, winnerMultiplier } = bonus.payload;
        this.setPanelText(
          'reactor-status',
          `×${gearA.multiplier} · ×${gearB.multiplier}`,
        );
        this.setPanelText('bonus-progress', 'Gears Clash');
        if (winnerMultiplier != null && winnerReel != null) {
          this.setPanelText(
            'overheat-level',
            `Walze ${winnerReel + 1} · ×${winnerMultiplier}`,
          );
        } else if (winnerMultiplier != null) {
          this.setPanelText('overheat-level', `Gewinn ×${winnerMultiplier}`);
        } else {
          this.setPanelText('overheat-level', 'Duel');
        }
        break;
      }
      case 'heist_run': {
        const p = bonus.payload;
        const cur = p.currentSpin;
        const max = p.freeSpinsAwarded;
        const spinTxt =
          cur != null ? `${cur} / ${max}` : `${max} FS`;
        this.setPanelText('reactor-status', 'Freispiele');
        this.setPanelText('bonus-progress', spinTxt);
        const n = p.stickyWilds?.length ?? 0;
        this.setPanelText('overheat-level', `Sticky ${n}`);
        break;
      }
      case 'deadlock_mode': {
        const p = bonus.payload;
        const phaseDe = p.phase === 'collection' ? 'Sammlung' : 'Overdrive';
        const lives = p.lives;
        this.setPanelText(
          'reactor-status',
          lives != null ? `Leben ${lives}` : 'Deadlock',
        );
        this.setPanelText('bonus-progress', phaseDe);
        const c = p.collectedSymbols?.length ?? 0;
        this.setPanelText('overheat-level', `Speicher ${c}`);
        break;
      }
      default:
        this.setPanelText('reactor-status', 'Bonus');
        this.setPanelText('bonus-progress', '—');
        this.setPanelText('overheat-level', '—');
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
