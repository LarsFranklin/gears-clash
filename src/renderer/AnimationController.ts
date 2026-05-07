import type { GameConfig } from '../config/types';

export interface SpinAnimationParams {
  spinDurationMs: number;
  reelStopStaggerMs: number;
  turbo: boolean;
  reelSequentialDurationMs: number;
  reelApproachExtraRows: number;
  reelIdleScrollRowsPerSec: number;
}

export class AnimationController {
  constructor(private readonly config: GameConfig) {}

  getParams(): SpinAnimationParams {
    const a = this.config.animation;
    return {
      spinDurationMs: a.spinDurationMs,
      reelStopStaggerMs: a.reelStopStaggerMs,
      turbo: a.turbo === true,
      reelSequentialDurationMs: a.reelSequentialDurationMs ?? 760,
      reelApproachExtraRows: a.reelApproachExtraRows ?? 5,
      reelIdleScrollRowsPerSec: a.reelIdleScrollRowsPerSec ?? 6,
    };
  }
}
