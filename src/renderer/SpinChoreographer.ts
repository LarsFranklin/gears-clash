import { columnPrefixTriggersScatterHuntVisual } from '../core/scatterAnticipation';
import type { SpinAnimationParams } from './AnimationController';
import { bounceOffset, easeOutQuart } from './easing';
import { ROW_GAP } from './ReelColumn';
import type { PixiSlotRendererHooks, RendererStage } from './rendererStage';

/**
 * Walzenchoreografie: Anticipation, Turbo- und Sequenz-Roll, Einrasten, Near-Miss.
 *
 * Reine Darstellung — die Zielsymbole kommen fertig vom Server, hier wird nur
 * entschieden, wie sie ins Bild kommen.
 */
export class SpinChoreographer {
  /** Sanftes Hochfahren des Scatter-Jagd-Idle-Multiplikators (pro Spin). */
  private idleScrollMulSmoothed = 1;
  /** Zuletzt gemeldete Near-Miss-Stufe (Index der letzten gestoppten Walze). */
  private nearMissStage = -1;

  constructor(private readonly stage: RendererStage) {}

  async play(
    reelStops: string[][],
    params: SpinAnimationParams,
    token: number,
    hooks?: PixiSlotRendererHooks,
  ): Promise<void> {
    if (params.turbo) {
      await this.playTurbo(reelStops, hooks, token, params);
    } else {
      await this.playSequential(reelStops, hooks, token, params);
    }
  }

  clearNearMiss(): void {
    this.nearMissStage = -1;
    this.stage.effects?.clearScatterAnticipation();
  }

  /**
   * Nach Walzenstillstand links→rechts: wenn mindestens 2 gleiche Scatter schon gelandet sind,
   * alle noch kommenden Walzen gold + Funken beschleunigen (nur Darstellung).
   */
  private syncScatterAnticipation(
    lastStoppedInclusive: number,
    reelStops: string[][],
    hooks?: PixiSlotRendererHooks,
  ): void {
    const { config, effects } = this.stage;
    const reelsN = config.grid.reels;
    if (lastStoppedInclusive >= reelsN - 1) {
      this.clearNearMiss();
      return;
    }
    const pending: number[] = [];
    for (let j = lastStoppedInclusive + 1; j < reelsN; j++) {
      pending.push(j);
    }
    if (
      !columnPrefixTriggersScatterHuntVisual(reelStops, lastStoppedInclusive, config)
    ) {
      this.clearNearMiss();
      return;
    }
    effects?.setScatterAnticipationReels(pending);
    /**
     * Near-Miss: pro noch wartender Walze genau einmal Rumble + Stinger — sonst
     * würde jeder Walzenstopp den Effekt erneut auslösen.
     */
    if (this.nearMissStage !== lastStoppedInclusive) {
      this.nearMissStage = lastStoppedInclusive;
      hooks?.onSound?.('scatter_anticipation');
      hooks?.onShake?.('light');
    }
  }

  /** Alle Spalten parallel, gestaffeltes Stop. */
  private async playTurbo(
    reelStops: string[][],
    hooks: PixiSlotRendererHooks | undefined,
    token: number,
    params: SpinAnimationParams,
  ): Promise<void> {
    const { config, reels, effects } = this.stage;
    const reelsN = config.grid.reels;
    const baseStop = params.spinDurationMs * 0.55;
    const pitch = this.stage.cellSize + ROW_GAP;
    const extraRows = params.reelApproachExtraRows;

    await this.playAnticipation(token, 80, 6);
    if (token !== this.stage.spinToken) return;
    this.clearNearMiss();
    this.idleScrollMulSmoothed = 1;

    const prep: { y0: number; y1: number; focusEnd: number; tStop: number }[] = [];

    for (let c = 0; c < reelsN; c++) {
      const col = reelStops[c] ?? reelStops[0]!;
      const reel = reels[c]!;
      /**
       * Idle-Scroll und Anticipation-Versatz zurücksetzen, bevor die Ziel-Koordinate
       * berechnet wird — sonst springt die Walze im ersten Frame sichtbar.
       */
      reel.resetIdleScrollBeforePrepare();
      const p = reel.prepareSpinTargets(col, { turbo: true });
      const y0 = Math.max(
        reel.minStripY,
        Math.min(reel.stripY, p.y1 - extraRows * pitch),
      );
      prep.push({
        y0,
        y1: p.y1,
        focusEnd: p.focusEnd,
        tStop: baseStop + c * params.reelStopStaggerMs,
      });
    }

    if (reelsN > 2 && columnPrefixTriggersScatterHuntVisual(reelStops, 1, config)) {
      const extraBase = config.animation.scatterAnticipationTurboExtraStopMs ?? 620;
      for (let c = 2; c < reelsN; c++) {
        prep[c]!.tStop += extraBase * (0.55 + (c - 2) * 0.28);
      }
    }

    const maxStop = Math.max(...prep.map((p) => p.tStop));
    const bounceWindow = 320;
    const squashMs = 140;
    const t0 = performance.now();
    const stopped = new Array<boolean>(reelsN).fill(false);
    const squashStart = new Array<number>(reelsN).fill(0);

    for (let c = 0; c < reelsN; c++) {
      effects?.startSpeedLines(c, 1.0);
    }

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.stage.spinToken) {
          effects?.clearScatterAnticipation();
          effects?.stopAllSpeedLines();
          resolve();
          return;
        }
        const T = performance.now() - t0;
        for (let c = 0; c < reelsN; c++) {
          const p = prep[c]!;
          const col = reels[c]!;
          if (T < p.tStop) {
            const u = easeInCubicEarly(T / p.tStop);
            col.setStripY(p.y0 + (p.y1 - p.y0) * easeOutQuart(u));
            effects?.startSpeedLines(c, u < 0.55 ? 1.0 - u / 0.55 : 0);
          } else {
            if (!stopped[c]) {
              stopped[c] = true;
              squashStart[c] = T;
              hooks?.onSound?.('reel_stop');
              effects?.stopSpeedLines(c);
              effects?.triggerReelFlash(c);
              let lastContiguous = -1;
              for (let i = 0; i < reelsN; i++) {
                if (stopped[i]) lastContiguous = i;
                else break;
              }
              if (lastContiguous >= 0) {
                this.syncScatterAnticipation(lastContiguous, reelStops, hooks);
              }
            }
            const bounce = bounceOffset(
              T - p.tStop,
              this.stage.cellSize * 0.038,
              0.017,
              0.0055,
            );
            col.setStripY(p.y1 + bounce);

            const squashT = T - squashStart[c]!;
            col.view.scale.y =
              squashT < squashMs ? computeSquash(squashT, squashMs) : 1;
          }
        }
        if (T >= maxStop + bounceWindow) {
          for (let c = 0; c < reelsN; c++) {
            const p = prep[c]!;
            reels[c]!.setStripY(p.y1);
            reels[c]!.commitFocus(p.focusEnd);
            reels[c]!.view.scale.y = 1;
          }
          this.clearNearMiss();
          effects?.stopAllSpeedLines();
          this.stage.setGridFromStops(reelStops);
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** Spalten nacheinander, längere Fahrt + „von oben“ vor dem Einrasten. */
  private async playSequential(
    reelStops: string[][],
    hooks: PixiSlotRendererHooks | undefined,
    token: number,
    params: SpinAnimationParams,
  ): Promise<void> {
    const { config, reels, effects } = this.stage;
    const reelsN = config.grid.reels;
    const pitch = this.stage.cellSize + ROW_GAP;
    const tStop = params.reelSequentialDurationMs;
    const bounceWindow = 300;
    const extraRows = params.reelApproachExtraRows;
    const idleRowsPerSec = params.reelIdleScrollRowsPerSec;
    const squashMs = 140;

    await this.playAnticipation(token, 100, 8);
    if (token !== this.stage.spinToken) return;
    this.clearNearMiss();
    this.idleScrollMulSmoothed = 1;

    for (let i = 0; i < reelsN; i++) {
      reels[i]!.resetIdleScrollBeforePrepare();
      effects?.startSpeedLines(i, 0.7);
    }

    for (let c = 0; c < reelsN; c++) {
      if (token !== this.stage.spinToken) {
        effects?.clearScatterAnticipation();
        effects?.stopAllSpeedLines();
        return;
      }
      const colStops = reelStops[c] ?? reelStops[0]!;
      const reel = reels[c]!;
      const p = reel.prepareSpinTargets(colStops, { turbo: false });
      const y1 = p.y1;
      const y0 = Math.max(
        reel.minStripY,
        Math.min(reel.stripY, y1 - extraRows * pitch),
      );
      const scatterHuntHeavy =
        c >= 2 && columnPrefixTriggersScatterHuntVisual(reelStops, c - 1, config);
      let reelStopDuration = c === 0 ? tStop * 1.22 : tStop;
      if (scatterHuntHeavy) {
        reelStopDuration *=
          config.animation.scatterAnticipationSequentialStopStretch ?? 1.18;
      }
      const terminalSlow =
        config.animation.scatterAnticipationTerminalSlowFraction ?? 0.2;

      await this.springOneReel({
        reelIndex: c,
        y0,
        y1,
        focusEnd: p.focusEnd,
        tStop: reelStopDuration,
        bounceWindow,
        token,
        hooks,
        bounceCellFactor: 0.042,
        reelsN,
        idleRowsPerSec,
        squashMs,
        scatterHuntHeavy,
        terminalSlowFrac: terminalSlow,
      });

      if (token !== this.stage.spinToken) {
        effects?.clearScatterAnticipation();
        effects?.stopAllSpeedLines();
        return;
      }
      this.syncScatterAnticipation(c, reelStops, hooks);
    }
    this.clearNearMiss();
    effects?.stopAllSpeedLines();
    this.stage.setGridFromStops(reelStops);
  }

  private reelStripEase(u: number, huntHeavy: boolean, terminalSlow: number): number {
    const tf = Math.min(0.34, Math.max(0.1, terminalSlow));
    if (!huntHeavy) {
      return easeOutQuart(easeInCubicEarly(u));
    }
    const bodyMax = 0.86;
    if (u <= 1 - tf) {
      const v = u / (1 - tf);
      return bodyMax * easeOutQuart(easeInCubicEarly(v));
    }
    const v = (u - (1 - tf)) / tf;
    return bodyMax + (1 - bodyMax) * (v * v * (3 - 2 * v));
  }

  private async springOneReel(opts: {
    reelIndex: number;
    y0: number;
    y1: number;
    focusEnd: number;
    tStop: number;
    bounceWindow: number;
    token: number;
    hooks: PixiSlotRendererHooks | undefined;
    bounceCellFactor: number;
    reelsN: number;
    idleRowsPerSec: number;
    squashMs: number;
    scatterHuntHeavy: boolean;
    terminalSlowFrac: number;
  }): Promise<void> {
    const { reels, effects, config } = this.stage;
    const { reelIndex: c, y0, y1, token, hooks } = opts;
    const col = reels[c]!;
    col.setStripY(y0);
    let reelStopped = false;
    let squashStart = 0;
    const t0 = performance.now();
    let prev = t0;

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.stage.spinToken) {
          col.view.scale.y = 1;
          effects?.clearScatterAnticipation();
          effects?.stopAllSpeedLines();
          resolve();
          return;
        }
        const now = performance.now();
        const dt = Math.min(64, Math.max(0, now - prev));
        prev = now;

        const huntMul =
          config.animation.scatterAnticipationPendingReelSpeedMul ?? 1.48;
        const targetIdleMul =
          effects?.scatterAnticipationActive() === true ? huntMul : 1;
        const rampMs = config.animation.scatterAnticipationIdleRampMs ?? 420;
        const k = 1 - Math.exp(-dt / Math.max(72, rampMs));
        this.idleScrollMulSmoothed +=
          (targetIdleMul - this.idleScrollMulSmoothed) * k;
        for (let j = c + 1; j < opts.reelsN; j++) {
          reels[j]!.advanceIdleScroll(
            dt,
            opts.idleRowsPerSec * this.idleScrollMulSmoothed,
          );
        }

        const T = now - t0;
        if (T < opts.tStop) {
          const tu = Math.min(1, T / opts.tStop);
          const pos = this.reelStripEase(
            tu,
            opts.scatterHuntHeavy,
            opts.terminalSlowFrac,
          );
          col.setStripY(y0 + (y1 - y0) * pos);
          effects?.startSpeedLines(
            c,
            tu < 0.6 ? 0.7 * (1 - tu / 0.6) * (opts.scatterHuntHeavy ? 0.85 : 1) : 0,
          );
        } else {
          if (!reelStopped) {
            reelStopped = true;
            squashStart = T;
            hooks?.onSound?.('reel_stop');
            effects?.stopSpeedLines(c);
            effects?.triggerReelFlash(c);
          }
          const bounce = bounceOffset(
            T - opts.tStop,
            this.stage.cellSize * opts.bounceCellFactor,
            0.017,
            0.0055,
          );
          col.setStripY(y1 + bounce);

          const squashT = T - squashStart;
          col.view.scale.y =
            squashT < opts.squashMs ? computeSquash(squashT, opts.squashMs) : 1;
        }
        if (T >= opts.tStop + opts.bounceWindow) {
          col.setStripY(y1);
          col.commitFocus(opts.focusEnd);
          col.view.scale.y = 1;
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private async playAnticipation(
    token: number,
    durationMs: number,
    pullPx: number,
  ): Promise<void> {
    const { config, reels } = this.stage;
    const reelsN = config.grid.reels;
    const startY: number[] = [];
    for (let c = 0; c < reelsN; c++) {
      startY.push(reels[c]!.stripY);
    }
    const t0 = performance.now();

    await new Promise<void>((resolve) => {
      const step = () => {
        if (token !== this.stage.spinToken) {
          resolve();
          return;
        }
        const T = performance.now() - t0;
        const u = Math.min(1, T / durationMs);
        const ease = Math.sin(u * Math.PI * 0.5);
        for (let c = 0; c < reelsN; c++) {
          reels[c]!.setStripY(startY[c]! - pullPx * ease);
        }
        if (u >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}

function computeSquash(t: number, duration: number): number {
  const u = Math.min(1, t / duration);
  if (u < 0.3) {
    return 1 - 0.035 * (u / 0.3);
  }
  if (u < 0.6) {
    return 0.965 + 0.05 * ((u - 0.3) / 0.3);
  }
  return 1.015 - 0.015 * ((u - 0.6) / 0.4);
}

/** Früh leicht beschleunigen, dann ausrollen. */
function easeInCubicEarly(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.12) return (u / 0.12) * 0.08;
  return 0.08 + (u - 0.12) * (0.92 / 0.88);
}
