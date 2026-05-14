import type { GearsClashGame } from '../GearsClashGame';
import {
  DEMO_SPIN_SCENARIO_IDS,
  type DemoSpinScenarioId,
} from '../config/demoSpinPresets';

const BTN_LABELS: Record<DemoSpinScenarioId, string> = {
  demo_near_miss_heist: 'Near-Miss · Heist (2 oben, Jagd)',
  demo_near_miss_gears: 'Near-Miss · Gears Clash',
  demo_near_miss_deadlock: 'Near-Miss · Deadlock',
  demo_bonus_gears_clash: 'Bonus · Gears Clash',
  demo_bonus_heist_run: 'Bonus · Heist Run',
  demo_bonus_deadlock_mode: 'Bonus · Deadlock Mode',
  demo_big_line_win: 'Großer Liniengewinn (Wild-Zeile)',
  demo_gears_vs_symbols: 'VS Gears Symbole (Feature-Trigger)',
};

/**
 * Lokale Vorschau: Schnellzugriff auf Mock-Preset-Spins (`requestVisualTestSpin`).
 */
export function mountDemoVisualTestBar(
  mountEl: HTMLElement,
  game: GearsClashGame,
): { destroy: () => void } {
  const ac = new AbortController();
  const { signal } = ac;

  const root = document.createElement('section');
  root.className = 'gc-demo-vistest';
  root.setAttribute('aria-label', 'Demo visuelle Test-Spins');

  const title = document.createElement('h2');
  title.className = 'gc-demo-vistest__title';
  title.textContent = 'Visuelle Tests (Mock-Presets)';

  const hint = document.createElement('p');
  hint.className = 'gc-demo-vistest__hint';
  hint.textContent =
    'Scatter-Jagd (2 gleiche Bonussymbole im Prefix) wirkt am deutlichsten bei Turbo aus ' +
    '(sequentieller Lauf, linke Walzen stoppen nacheinander). Turbo: letzte Walzen bremsen nach, ' +
    'wenn die Jagd aktiv ist.';

  const grid = document.createElement('div');
  grid.className = 'gc-demo-vistest__grid';

  const buttons: HTMLButtonElement[] = [];

  const setDisabled = (v: boolean): void => {
    for (const b of buttons) {
      b.disabled = v;
      b.setAttribute('aria-busy', v ? 'true' : 'false');
    }
  };

  const rand = document.createElement('button');
  rand.type = 'button';
  rand.className = 'gc-demo-vistest__btn gc-demo-vistest__btn--accent';
  rand.textContent = 'Zufalls-Spin (Mock)';
  rand.addEventListener(
    'click',
    () => {
      game.requestRandomDemoSpin();
    },
    { signal },
  );
  buttons.push(rand);
  grid.appendChild(rand);

  for (const id of DEMO_SPIN_SCENARIO_IDS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gc-demo-vistest__btn';
    btn.textContent = BTN_LABELS[id];
    btn.dataset.scenario = id;
    btn.addEventListener(
      'click',
      () => {
        game.requestVisualTestSpin(id);
      },
      { signal },
    );
    buttons.push(btn);
    grid.appendChild(btn);
  }

  root.append(title, hint, grid);
  mountEl.appendChild(root);

  const onStart = (): void => setDisabled(true);
  const onEnd = (): void => setDisabled(false);
  const onErr = (): void => {
    setDisabled(false);
    queueMicrotask(() => {
      game.resetError();
    });
  };

  game.on('spin:start', onStart);
  game.on('spin:end', onEnd);
  game.on('error', onErr);

  return {
    destroy: () => {
      ac.abort();
      game.off('spin:start', onStart);
      game.off('spin:end', onEnd);
      game.off('error', onErr);
      root.remove();
    },
  };
}
