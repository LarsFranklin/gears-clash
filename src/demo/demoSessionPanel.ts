import type { GearsClashGame } from '../GearsClashGame';
import type { BonusId, SpinResult } from '../config/types';

const BONUS_OPTIONS: { id: BonusId; label: string }[] = [
  { id: 'gears_clash', label: 'Gears Clash' },
  { id: 'heist_run', label: 'Heist Run' },
  { id: 'deadlock_mode', label: 'Deadlock Mode' },
];

export interface DemoSessionStats {
  spinCount: number;
  winSpins: number;
  sessionWinTotal: number;
  biggestWin: number;
  bonusTriggers: number;
}

/**
 * Demo: Force-Bonus-Dropdown, Session-Statistik und Reset (#36).
 */
export function mountDemoSessionPanel(
  mountEl: HTMLElement,
  game: GearsClashGame,
): { destroy: () => void } {
  const ac = new AbortController();
  const { signal } = ac;

  const stats: DemoSessionStats = {
    spinCount: 0,
    winSpins: 0,
    sessionWinTotal: 0,
    biggestWin: 0,
    bonusTriggers: 0,
  };

  const root = document.createElement('section');
  root.className = 'gc-demo-session';
  root.setAttribute('aria-label', 'Demo Session-Statistik');

  const title = document.createElement('h2');
  title.className = 'gc-demo-session__title';
  title.textContent = 'Session & Force-Bonus';

  const statsGrid = document.createElement('div');
  statsGrid.className = 'gc-demo-session__stats';
  statsGrid.innerHTML = `
    <div class="gc-demo-session__stat"><span class="gc-demo-session__stat-k">Spins</span><span class="gc-demo-session__stat-v" data-role="spins">0</span></div>
    <div class="gc-demo-session__stat"><span class="gc-demo-session__stat-k">Treffer</span><span class="gc-demo-session__stat-v" data-role="hits">0</span></div>
    <div class="gc-demo-session__stat"><span class="gc-demo-session__stat-k">Summe</span><span class="gc-demo-session__stat-v" data-role="total">0</span></div>
    <div class="gc-demo-session__stat"><span class="gc-demo-session__stat-k">Best</span><span class="gc-demo-session__stat-v" data-role="best">0</span></div>
    <div class="gc-demo-session__stat"><span class="gc-demo-session__stat-k">Bonus</span><span class="gc-demo-session__stat-v" data-role="bonus">0</span></div>
  `;

  const forceRow = document.createElement('div');
  forceRow.className = 'gc-demo-session__row';

  const forceLabel = document.createElement('label');
  forceLabel.className = 'gc-demo-session__field';
  forceLabel.textContent = 'Force-Bonus';
  const forceSelect = document.createElement('select');
  forceSelect.className = 'gc-demo-session__select';
  forceSelect.setAttribute('aria-label', 'Bonus erzwingen');
  for (const opt of BONUS_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    forceSelect.appendChild(o);
  }
  forceLabel.appendChild(forceSelect);

  const forceBtn = document.createElement('button');
  forceBtn.type = 'button';
  forceBtn.className = 'gc-demo-session__button';
  forceBtn.textContent = 'Bonus-Spin';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'gc-demo-session__button gc-demo-session__button--ghost';
  resetBtn.textContent = 'Statistik zurücksetzen';

  forceRow.append(forceLabel, forceBtn, resetBtn);
  root.append(title, statsGrid, forceRow);
  mountEl.appendChild(root);

  const fmt = (n: number): string =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n);

  const renderStats = (): void => {
    const spinsEl = root.querySelector('[data-role="spins"]');
    const hitsEl = root.querySelector('[data-role="hits"]');
    const totalEl = root.querySelector('[data-role="total"]');
    const bestEl = root.querySelector('[data-role="best"]');
    const bonusEl = root.querySelector('[data-role="bonus"]');
    const hitRate =
      stats.spinCount > 0
        ? `${stats.winSpins} (${((stats.winSpins / stats.spinCount) * 100).toFixed(1)} %)`
        : '0';
    if (spinsEl) spinsEl.textContent = fmt(stats.spinCount);
    if (hitsEl) hitsEl.textContent = hitRate;
    if (totalEl) totalEl.textContent = fmt(stats.sessionWinTotal);
    if (bestEl) bestEl.textContent = fmt(stats.biggestWin);
    if (bonusEl) bonusEl.textContent = fmt(stats.bonusTriggers);
  };

  const onSpinEnd = (payload?: unknown): void => {
    const result = payload as SpinResult | undefined;
    if (!result) return;
    stats.spinCount += 1;
    const win = Math.max(0, Math.floor(result.winAmount));
    if (win > 0) stats.winSpins += 1;
    stats.sessionWinTotal += win;
    stats.biggestWin = Math.max(stats.biggestWin, win);
    if (result.bonus) stats.bonusTriggers += 1;
    renderStats();
  };

  const setBusy = (busy: boolean): void => {
    forceBtn.disabled = busy;
    resetBtn.disabled = busy;
    forceSelect.disabled = busy;
  };

  const onSpinStart = (): void => setBusy(true);
  const onSpinEndBusy = (): void => setBusy(false);
  const onError = (): void => {
    setBusy(false);
    queueMicrotask(() => game.resetError());
  };

  forceBtn.addEventListener(
    'click',
    () => {
      game.requestForcedBonusSpin(forceSelect.value as BonusId);
    },
    { signal },
  );

  resetBtn.addEventListener(
    'click',
    () => {
      stats.spinCount = 0;
      stats.winSpins = 0;
      stats.sessionWinTotal = 0;
      stats.biggestWin = 0;
      stats.bonusTriggers = 0;
      renderStats();
    },
    { signal },
  );

  game.on('spin:end', onSpinEnd);
  game.on('spin:start', onSpinStart);
  game.on('spin:end', onSpinEndBusy);
  game.on('error', onError);

  renderStats();

  return {
    destroy: () => {
      ac.abort();
      game.off('spin:end', onSpinEnd);
      game.off('spin:start', onSpinStart);
      game.off('spin:end', onSpinEndBusy);
      game.off('error', onError);
      root.remove();
    },
  };
}
