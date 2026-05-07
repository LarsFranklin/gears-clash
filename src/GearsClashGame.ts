import { deepMerge } from './util/deepMerge';
import { defaultGameConfig } from './config/defaultGameConfig';
import {
  defaultAssetManifest,
  resolveManifestPaths,
  type AssetManifest,
} from './config/assetManifest';
import type { GameConfig, GameEventName, HostAdapter } from './config/types';
import type { GameApiAdapter } from './adapters/GameApiAdapter';
import { BonusEngine } from './core/BonusEngine';
import { PayoutEngine } from './core/PayoutEngine';
import { ReelEngine } from './core/ReelEngine';
import { SlotEngine } from './core/SlotEngine';
import { AssetLoader } from './renderer/AssetLoader';
import {
  PixiSlotRenderer,
  type PixiSlotRendererHooks,
} from './renderer/PixiSlotRenderer';
import { BonusOverlayController } from './ui/BonusOverlayController';
import { ButtonController } from './ui/ButtonController';
import { HudController } from './ui/HudController';
import { GameEmitter } from './util/GameEmitter';

/** Sound-Hooks — später echte Audio-Engine anbinden (keine Assets im Package). */
export interface GameSoundAdapter {
  play: (id: string) => void;
}

export interface GearsClashGameOptions {
  container: HTMLElement;
  apiAdapter: GameApiAdapter;
  hostAdapter?: HostAdapter;
  config?: Partial<GameConfig>;
  assetManifest?: AssetManifest;
  spinButton?: HTMLButtonElement;
  /** Standard-Einsatz pro Spin (Social Coins). */
  defaultBet?: number;
  /** z. B. `spin`, `reel_stop`, `win`, `bonus_intro` — rein optional. */
  sound?: GameSoundAdapter;
  /** Kurzform für `config.animation.turbo` — parallele schnelle Reels. */
  turbo?: boolean;
}

const SLOT_CLASS = 'gc-slot';
const CANVAS_WRAP_CLASS = 'gc-canvas-wrap';
const FRAME_CLASS = 'gc-frame';
const FRAME_INNER_CLASS = 'gc-frame__inner';
const SPIN_ROW_CLASS = 'gc-slot__spin-row';

function mergeConfig(patch?: Partial<GameConfig>): GameConfig {
  if (!patch) return structuredClone(defaultGameConfig);
  return deepMerge(
    defaultGameConfig as unknown as Record<string, unknown>,
    patch as unknown as Record<string, unknown>,
  ) as unknown as GameConfig;
}

export class GearsClashGame {
  private readonly config: GameConfig;
  private readonly emitter = new GameEmitter();
  private readonly slotEngine = new SlotEngine();
  private readonly reelEngine: ReelEngine;
  private readonly payoutEngine = new PayoutEngine();
  private readonly bonusEngine = new BonusEngine();
  private renderer: PixiSlotRenderer | null = null;
  private assetLoader: AssetLoader | null = null;
  private hud: HudController | null = null;
  private button: ButtonController | null = null;
  private rootEl: HTMLDivElement | null = null;
  private canvasWrap: HTMLDivElement | null = null;
  private frameInner: HTMLDivElement | null = null;
  private frameEl: HTMLDivElement | null = null;
  private bonusOverlay: BonusOverlayController | null = null;
  private mounted = false;
  private readonly bet: number;

  constructor(private readonly options: GearsClashGameOptions) {
    this.config = mergeConfig(options.config);
    if (options.turbo !== undefined) {
      this.config = {
        ...this.config,
        animation: { ...this.config.animation, turbo: options.turbo },
      };
    }
    this.reelEngine = new ReelEngine(this.config);
    this.bet = options.defaultBet ?? 100;
  }

  on(event: GameEventName, fn: (payload?: unknown) => void): void {
    this.emitter.on(event, fn);
  }

  off(event: GameEventName, fn: (payload?: unknown) => void): void {
    this.emitter.off(event, fn);
  }

  async mount(): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;
    const { container } = this.options;

    this.rootEl = document.createElement('div');
    this.rootEl.className = SLOT_CLASS;

    this.hud = new HudController();
    this.hud.mount(this.rootEl);
    this.hud.setBet(this.bet);
    this.hud.setWin(0);

    const frame = document.createElement('div');
    frame.className = FRAME_CLASS;
    this.frameEl = frame;
    const frameInner = document.createElement('div');
    frameInner.className = FRAME_INNER_CLASS;
    this.frameInner = frameInner;
    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = CANVAS_WRAP_CLASS;
    frameInner.appendChild(this.canvasWrap);
    this.bonusOverlay = new BonusOverlayController();
    this.bonusOverlay.mount(frameInner);
    frame.appendChild(frameInner);
    this.rootEl.appendChild(frame);

    const spinRow = document.createElement('div');
    spinRow.className = SPIN_ROW_CLASS;
    this.rootEl.appendChild(spinRow);

    this.button = new ButtonController({
      externalButton: this.options.spinButton,
      label: 'Spin',
      spinStyle: !this.options.spinButton,
    });
    this.button.mount(spinRow);

    container.appendChild(this.rootEl);

    const manifest = resolveManifestPaths(
      this.options.assetManifest ?? defaultAssetManifest,
      this.config,
    );
    this.assetLoader = new AssetLoader(manifest);

    this.renderer = new PixiSlotRenderer(this.config);
    await this.renderer.init(this.canvasWrap);

    const bal = await this.options.apiAdapter.getBalance().catch(() => 0);
    this.hud.setBalance(bal);

    const onSpin = () => void this.runSpin();
    this.button.onClick(onSpin);

    this.options.hostAdapter?.onReady?.();
    this.emitter.emit('ready');
  }

  /** Nach Fehlerzustand zurück auf idle (State Machine). */
  resetError(): void {
    this.slotEngine.resetError();
  }

  async destroy(): Promise<void> {
    this.button?.destroy();
    this.hud?.destroy();
    this.bonusOverlay?.destroy();
    this.renderer?.destroy();
    this.assetLoader = null;
    this.rootEl?.remove();
    this.button = null;
    this.hud = null;
    this.bonusOverlay = null;
    this.renderer = null;
    this.rootEl = null;
    this.canvasWrap = null;
    this.frameInner = null;
    this.frameEl = null;
    this.mounted = false;
    this.emitter.removeAllListeners();
  }

  private async runSpin(): Promise<void> {
    const host = this.options.hostAdapter;
    if (!this.slotEngine.canSpin(host?.disabled)) return;
    if (!this.slotEngine.beginSpin()) return;

    this.emitter.emit('spin:start');
    this.options.sound?.play('spin');
    this.hud?.setWin(0);
    this.button?.setDisabled(true);

    const pixiHooks: PixiSlotRendererHooks = {
      onSound: (id) => this.options.sound?.play(id),
      onShake: (kind) => this.triggerShake(kind),
    };

    try {
      const result = await this.options.apiAdapter.spin({
        bet: this.bet,
        currency: host?.currency ?? 'COINS',
        mode: 'base',
        meta: host?.userMeta,
      });

      if (!this.reelEngine.validateStops(result.reelStops)) {
        throw new Error('reelStops passen nicht zur konfigurierten Grid-Größe.');
      }

      await this.renderer?.playSpinAnimation(result.reelStops, pixiHooks);
      this.slotEngine.enterResolving();
      void this.payoutEngine.formatWinLine(result);

      await this.renderer?.showWinFeedback(
        result.displayHighlights ?? [],
        result.winAmount,
        pixiHooks,
      );

      if (result.bonus) {
        this.slotEngine.enterBonus();
        this.emitter.emit('bonus:start', result.bonus);
        this.options.sound?.play('bonus_intro');
        this.renderer?.setFrozen(true);
        await this.bonusOverlay?.show(result.bonus.type);
        this.renderer?.setFrozen(false);
        this.emitter.emit('bonus:end', result.bonus);
        void this.bonusEngine.describeBonus(result);
      }

      this.slotEngine.finishRound();

      this.hud?.setBalanceAnimated(result.balanceAfter);
      this.hud?.setWinAnimated(result.winAmount);
      this.emitter.emit('balance:update', result.balanceAfter);
      host?.onBalanceUpdate?.(result.balanceAfter);
      this.emitter.emit('spin:end', result);
    } catch (e) {
      this.slotEngine.setError();
      this.emitter.emit('error', e);
      host?.onError?.(e);
    } finally {
      this.button?.setDisabled(!!host?.disabled);
      this.slotEngine.resetError();
    }
  }

  private triggerShake(kind: 'light' | 'medium'): void {
    const el = this.frameEl;
    if (!el) return;
    el.classList.remove('gc-frame--shake', 'gc-frame--shake-medium');
    void el.offsetWidth;
    el.classList.add(
      kind === 'medium' ? 'gc-frame--shake-medium' : 'gc-frame--shake',
    );
    window.setTimeout(() => {
      el.classList.remove('gc-frame--shake', 'gc-frame--shake-medium');
    }, 420);
  }
}
