import type { BonusId } from '../config/types';

const ROOT = 'gc-bonus-session';

export interface BonusSessionStat {
  key: string;
  value: string;
}

/**
 * Gemeinsames Grundgerüst der drei Bonus-Session-Overlays.
 *
 * Aufgeteilt in zwei Ebenen, damit während laufender Freispiele das Raster sichtbar bleibt:
 * - **Banner** (oben, `pointer-events: none`) — Restspins, Bonusbank, modusspezifische Werte.
 * - **Dialog** (mittig, abdunkelnd) — Phasenwechsel, Retrigger-Hinweis und Abschluss-Summary.
 */
export abstract class BonusSessionOverlay {
  protected el: HTMLDivElement | null = null;
  private abort = new AbortController();

  protected abstract readonly bonusId: BonusId;
  protected abstract readonly title: string;

  mount(parent: HTMLElement): void {
    if (this.el) return;
    const el = document.createElement('div');
    el.className = ROOT;
    el.dataset.bonus = this.bonusId;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="${ROOT}__banner" data-role="banner">
        <span class="${ROOT}__banner-title">${this.title}</span>
        <ul class="${ROOT}__stats" data-role="stats"></ul>
      </div>
      <div class="${ROOT}__dialog" data-role="dialog" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="${ROOT}__card">
          <h2 class="${ROOT}__card-title" data-role="dialog-title">${this.title}</h2>
          <p class="${ROOT}__card-text" data-role="dialog-text"></p>
          <div class="${ROOT}__card-extra" data-role="dialog-extra"></div>
          <button type="button" class="${ROOT}__action" data-role="dialog-action">
            Weiter
          </button>
        </div>
      </div>
    `;
    parent.appendChild(el);
    this.el = el;
  }

  destroy(): void {
    this.abort.abort();
    this.el?.remove();
    this.el = null;
    this.abort = new AbortController();
  }

  protected get signal(): AbortSignal {
    return this.abort.signal;
  }

  protected show(): void {
    if (!this.el) return;
    this.el.classList.add(`${ROOT}--visible`);
    this.el.setAttribute('aria-hidden', 'false');
  }

  protected hide(): void {
    if (!this.el) return;
    this.el.classList.remove(`${ROOT}--visible`);
    this.el.setAttribute('aria-hidden', 'true');
    this.hideDialog();
  }

  protected role<T extends HTMLElement>(name: string): T | null {
    return (this.el?.querySelector(`[data-role="${name}"]`) as T | null) ?? null;
  }

  /** Kopfzeile mit den Kennzahlen der Session — ersetzt bei jedem Update den Inhalt. */
  protected renderStats(stats: BonusSessionStat[]): void {
    const list = this.role<HTMLUListElement>('stats');
    if (!list) return;
    list.replaceChildren();
    for (const stat of stats) {
      const li = document.createElement('li');
      li.className = `${ROOT}__stat`;
      const k = document.createElement('span');
      k.className = `${ROOT}__stat-k`;
      k.textContent = stat.key;
      const v = document.createElement('span');
      v.className = `${ROOT}__stat-v`;
      v.textContent = stat.value;
      li.append(k, v);
      list.appendChild(li);
    }
  }

  /** Kurzer Hinweis ohne Klick — z. B. Retrigger oder Phasenwechsel. */
  protected async flashDialog(
    title: string,
    text: string,
    ms = 1400,
  ): Promise<void> {
    this.openDialog(title, text, { withAction: false });
    await this.delay(ms);
    this.hideDialog();
  }

  /** Abschluss-Overlay ohne Auto-Timer — bleibt bis zum Klick stehen (heist-run.md §8.4). */
  protected async awaitDialog(
    title: string,
    text: string,
    actionLabel = 'Weiter',
  ): Promise<void> {
    const btn = this.openDialog(title, text, { withAction: true, actionLabel });
    if (btn) await this.waitClick(btn);
    this.hideDialog();
  }

  protected openDialog(
    title: string,
    text: string,
    options: { withAction: boolean; actionLabel?: string },
  ): HTMLButtonElement | null {
    const dialog = this.role<HTMLElement>('dialog');
    const titleEl = this.role<HTMLElement>('dialog-title');
    const textEl = this.role<HTMLElement>('dialog-text');
    const btn = this.role<HTMLButtonElement>('dialog-action');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (btn) {
      btn.hidden = !options.withAction;
      btn.textContent = options.actionLabel ?? 'Weiter';
    }
    if (dialog) {
      dialog.classList.add(`${ROOT}__dialog--visible`);
      dialog.setAttribute('aria-hidden', 'false');
    }
    if (options.withAction) btn?.focus();
    return options.withAction ? btn : null;
  }

  protected hideDialog(): void {
    const dialog = this.role<HTMLElement>('dialog');
    const extra = this.role<HTMLElement>('dialog-extra');
    if (extra) extra.replaceChildren();
    if (dialog) {
      dialog.classList.remove(`${ROOT}__dialog--visible`);
      dialog.setAttribute('aria-hidden', 'true');
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.signal.aborted) {
        resolve();
        return;
      }
      const t = window.setTimeout(resolve, ms);
      this.signal.addEventListener(
        'abort',
        () => {
          window.clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });
  }

  /** Wartet auf Klick, Enter oder Escape — der Dialog darf niemanden festhalten. */
  protected waitClick(btn: HTMLButtonElement): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.signal.aborted) {
        resolve(false);
        return;
      }
      const cleanup = (): void => {
        btn.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey, true);
        this.signal.removeEventListener('abort', onAbort);
      };
      const onClick = (): void => {
        cleanup();
        resolve(true);
      };
      const onKey = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape' && e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(true);
      };
      const onAbort = (): void => {
        cleanup();
        resolve(false);
      };
      btn.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey, true);
      this.signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export const BONUS_SESSION_ROOT_CLASS = ROOT;
