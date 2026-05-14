import { defaultGameConfig } from '../config/defaultGameConfig';
import type { GameConfig } from '../config/types';
import {
  runBaseGameMonteCarloBatched,
  type BaseGameMonteCarloResult,
} from '../dev/runBaseGameMonteCarlo';

export interface DemoSimulationPanelOptions {
  /** Standard: `defaultGameConfig` — sollte zur laufenden Demo passen. */
  getConfig?: () => GameConfig;
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

function buildExportDocument(
  summary: BaseGameMonteCarloResult,
): Record<string, unknown> {
  const n = summary.params.iterations;
  const se =
    n > 1 ? summary.stdDevReturnPerBet / Math.sqrt(n) : null;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      disclaimer:
        'Nur Demo-Basis-Spiel: gleiche Logik wie MockGameApiAdapter + evaluateDemoBaseSpin auf der übergebenen effektiven Config. ' +
        'Bonus-Trigger werden gezählt, Bonus-Runden-Gewinne fehlen. Produkt-RTP liefert das Backend.',
      sampleSizeHints: {
        grobeRichtung: '50.000–100.000 Spins: Trend sichtbar, Bandbreite noch groß.',
        engereRtpSchaetzung:
          '500.000–2.000.000+ Spins: üblicher Bereich, bis die geschätzte RTP nahe am Ziel liegt (hängt von Varianz ab).',
        standardfehlerGroessenordnung:
          se !== null
            ? `Bei diesem Lauf: SE(RTP̂) ≈ stdDev(win/bet)/√n ≈ ${se.toExponential(4)} (95 %-Band ca. ±${(1.96 * se).toExponential(4)} um die gemessene RTP).`
            : null,
      },
    },
    summary,
  };
}

/**
 * Nur für die lokale Vorschau (`demo/main.ts`): Monte-Carlo + JSON-Download.
 */
export function mountDemoSimulationPanel(
  mountEl: HTMLElement,
  options?: DemoSimulationPanelOptions,
): { destroy: () => void } {
  const ac = new AbortController();
  const { signal } = ac;
  const getConfig = options?.getConfig ?? (() => defaultGameConfig);

  const root = document.createElement('section');
  root.className = 'gc-demo-sim';
  root.setAttribute('aria-label', 'Demo-Simulation Monte-Carlo');

  const hint = document.createElement('p');
  hint.className = 'gc-demo-sim__hint';
  hint.textContent =
    'Basis-Spiel-Mathe mit derselben effektiven GameConfig wie der laufende Slot (Mock + Renderer). ' +
    'JSON-Export — kein Ersatz für zertifizierte Produkt-RTP.';

  const row = document.createElement('div');
  row.className = 'gc-demo-sim__row';

  const spinsLabel = document.createElement('label');
  spinsLabel.className = 'gc-demo-sim__field';
  spinsLabel.textContent = 'Anzahl Spins';
  const spinsInput = document.createElement('input');
  spinsInput.className = 'gc-demo-sim__input';
  spinsInput.type = 'number';
  spinsInput.min = '1000';
  spinsInput.max = '5000000';
  spinsInput.step = '1000';
  spinsInput.value = '100000';
  spinsInput.setAttribute('aria-label', 'Anzahl Spins');
  spinsLabel.appendChild(spinsInput);

  const betLabel = document.createElement('label');
  betLabel.className = 'gc-demo-sim__field';
  betLabel.textContent = 'Einsatz (Coins)';
  const betInput = document.createElement('input');
  betInput.className = 'gc-demo-sim__input';
  betInput.type = 'number';
  betInput.min = '1';
  betInput.step = '1';
  betInput.value = '100';
  betInput.setAttribute(
    'aria-label',
    'Einsatz pro Spin — 100 entspricht referenceBet in defaultSlotMath',
  );
  betLabel.appendChild(betInput);

  const seedLabel = document.createElement('label');
  seedLabel.className = 'gc-demo-sim__field';
  seedLabel.textContent = 'Seed (optional)';
  const seedInput = document.createElement('input');
  seedInput.className = 'gc-demo-sim__input';
  seedInput.type = 'number';
  seedInput.step = '1';
  seedInput.placeholder = 'leer = nicht reproduzierbar';
  seedInput.setAttribute('aria-label', 'Zufalls-Seed, leer für Math.random');
  seedLabel.appendChild(seedInput);

  row.append(spinsLabel, betLabel, seedLabel);

  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'gc-demo-sim__button';
  runBtn.textContent = 'Simulation starten & JSON speichern';

  const status = document.createElement('div');
  status.className = 'gc-demo-sim__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  root.append(hint, row, runBtn, status);
  mountEl.appendChild(root);

  const setBusy = (busy: boolean): void => {
    runBtn.disabled = busy;
    runBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
  };

  runBtn.addEventListener(
    'click',
    () => {
      void (async () => {
        if (signal.aborted) return;
        const iterations = Math.floor(Number(spinsInput.value) || 0);
        const bet = Math.floor(Number(betInput.value) || 0);
        const seedRaw = seedInput.value.trim();
        let seed: number | undefined;
        if (seedRaw !== '') {
          const s = Math.floor(Number(seedRaw));
          if (!Number.isFinite(s)) {
            status.textContent = 'Seed muss eine ganze Zahl sein.';
            return;
          }
          seed = s;
        }

        if (iterations < 1000 || iterations > 5_000_000) {
          status.textContent =
            'Bitte Spins zwischen 1.000 und 5.000.000 wählen.';
          return;
        }
        if (bet < 1) {
          status.textContent = 'Einsatz mindestens 1.';
          return;
        }

        setBusy(true);
        status.textContent = 'Simulation läuft …';

        try {
          const summary = await runBaseGameMonteCarloBatched(
            {
              config: getConfig(),
              bet,
              iterations,
              ...(seed !== undefined ? { seed } : {}),
            },
            {
              chunkSize: 8000,
              signal,
              onProgress: (done, total) => {
                status.textContent = `Fortschritt: ${done.toLocaleString('de-DE')} / ${total.toLocaleString('de-DE')} Spins`;
              },
            },
          );

          if (signal.aborted) return;

          const doc = buildExportDocument(summary);
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          downloadJson(`gears-clash-monte-carlo-${stamp}.json`, doc);

          status.textContent =
            `Fertig. Basis-RTP̂ ≈ ${(summary.empiricalBaseRtp * 100).toFixed(3)} % ` +
            `(${summary.totalWin.toLocaleString('de-DE')} / ${summary.totalBet.toLocaleString('de-DE')} Coins). ` +
            'JSON wurde heruntergeladen.';
        } catch (e) {
          if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
            status.textContent = 'Abgebrochen.';
            return;
          }
          status.textContent =
            e instanceof Error ? e.message : 'Unbekannter Fehler.';
        } finally {
          if (!signal.aborted) setBusy(false);
        }
      })();
    },
    { signal },
  );

  return {
    destroy: () => {
      ac.abort();
      root.remove();
    },
  };
}
