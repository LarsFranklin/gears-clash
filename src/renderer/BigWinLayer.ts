import { Container, Graphics, Text } from 'pixi.js';
import type { WinTier } from '../util/winTier';

export type { WinTier } from '../util/winTier';
export { getWinTier } from '../util/winTier';

const MAX_COINS = 50;

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  alpha: number;
}

/**
 * Big Win Layer - Shows tier banners and coin rain for big/mega wins.
 */
export class BigWinLayer {
  readonly view = new Container();

  private bannerG = new Graphics();
  private bannerText: Text;
  private amountText: Text;
  private coinsG = new Graphics();
  private flashG = new Graphics();

  private coins: Coin[] = [];
  private isPlaying = false;
  private destroyed = false;
  private currentTier: WinTier | null = null;
  private currentAmount = 0;
  private displayedAmount = 0;
  private animStart = 0;
  private lastFrameTime = 0;
  private gridW = 400;
  private gridH = 400;

  constructor() {
    this.view.eventMode = 'none';
    this.view.zIndex = 30;
    this.view.visible = false;

    this.bannerText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 42,
        fontWeight: '900',
        fill: 0xfff8e0,
        stroke: { color: 0x3a2008, width: 6, join: 'round' },
        dropShadow: {
          color: 0x000000,
          blur: 8,
          alpha: 0.6,
          distance: 4,
          angle: Math.PI / 4,
        },
        letterSpacing: 4,
      },
    });
    this.bannerText.anchor.set(0.5);

    this.amountText = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 32,
        fontWeight: '700',
        fill: 0xffd860,
        stroke: { color: 0x2a1808, width: 4, join: 'round' },
        dropShadow: {
          color: 0x000000,
          blur: 4,
          alpha: 0.5,
          distance: 2,
          angle: Math.PI / 4,
        },
      },
    });
    this.amountText.anchor.set(0.5);

    this.view.addChild(this.flashG, this.coinsG, this.bannerG, this.bannerText, this.amountText);
  }

  layout(gridW: number, gridH: number): void {
    this.gridW = gridW;
    this.gridH = gridH;
    this.bannerText.position.set(gridW / 2, gridH / 2 - 20);
    this.amountText.position.set(gridW / 2, gridH / 2 + 35);

    const fontSize = Math.max(24, Math.floor(gridW * 0.08));
    this.bannerText.style.fontSize = fontSize;
    this.amountText.style.fontSize = Math.floor(fontSize * 0.75);
  }

  /**
   * Kompakter Auto-Toast für mittlere Gewinne (5–15× Einsatz) — kurz einblenden, von selbst weg.
   * Optional per Klick beenden: `cancel()` bzw. Pointer auf Canvas (Renderer).
   */
  async showWinToast(tier: WinTier, amount: number, durationMs = 1750): Promise<void> {
    if (tier !== 'medium' || this.destroyed) return;

    this.currentTier = tier;
    this.currentAmount = amount;
    this.displayedAmount = 0;
    this.isPlaying = true;
    this.animStart = performance.now();
    this.lastFrameTime = this.animStart;
    this.view.visible = true;

    this.bannerText.text = 'SOLID WIN';
    this.bannerText.style.fill = 0xd8f0ff;
    this.amountText.text = '0';
    this.coins = [];
    this.spawnCoinRain(8);

    await new Promise<void>((resolve) => {
      const step = () => {
        if (this.destroyed) {
          resolve();
          return;
        }
        if (!this.isPlaying) {
          this.hide();
          resolve();
          return;
        }
        const now = performance.now();
        const dtSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        const T = now - this.animStart;
        this.paintToast(T, durationMs, dtSec);

        if (T >= durationMs) {
          this.hide();
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  async showBigWin(tier: WinTier, amount: number, durationMs = 3000): Promise<void> {
    if ((tier !== 'big' && tier !== 'mega') || this.destroyed) return;

    this.currentTier = tier;
    this.currentAmount = amount;
    this.displayedAmount = 0;
    this.isPlaying = true;
    this.animStart = performance.now();
    this.lastFrameTime = this.animStart;
    this.view.visible = true;

    this.bannerText.text = tier === 'mega' ? 'MEGA WIN' : 'BIG WIN';
    this.bannerText.style.fill = tier === 'mega' ? 0xff80c0 : 0xfff8e0;
    this.amountText.text = '0';

    this.coins = [];
    if (tier === 'mega') {
      this.spawnCoinRain(40);
    } else {
      this.spawnCoinRain(20);
    }

    await new Promise<void>((resolve) => {
      const step = () => {
        if (this.destroyed) {
          resolve();
          return;
        }
        if (!this.isPlaying) {
          this.hide();
          resolve();
          return;
        }
        const now = performance.now();
        const dtSec = Math.min(0.1, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        const T = now - this.animStart;
        this.paint(T, durationMs, dtSec);

        if (T >= durationMs) {
          this.hide();
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private spawnCoinRain(count: number): void {
    for (let i = 0; i < Math.min(count, MAX_COINS); i++) {
      this.coins.push({
        x: Math.random() * this.gridW,
        y: -20 - Math.random() * this.gridH * 0.5,
        vx: (Math.random() - 0.5) * 40,
        vy: 100 + Math.random() * 150,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        size: 8 + Math.random() * 6,
        alpha: 0.7 + Math.random() * 0.3,
      });
    }
  }

  private paint(T: number, duration: number, dtSec: number): void {
    const u = Math.min(1, T / duration);

    this.paintFlash(u);
    this.paintCoins(dtSec, u);
    this.paintBanner(u, { softIntro: true });
    this.updateAmount(u);
  }

  private paintFlash(u: number): void {
    this.flashG.clear();
    if (u < 0.1) {
      const flashAlpha = (1 - u / 0.1) * 0.28;
      this.flashG.rect(0, 0, this.gridW, this.gridH);
      this.flashG.fill({ color: 0xfff8e0, alpha: flashAlpha });
    }
  }

  private paintCoins(dtSec: number, u: number): void {
    this.coinsG.clear();

    for (const coin of this.coins) {
      coin.vy += 200 * dtSec;
      coin.y += coin.vy * dtSec;
      coin.x += coin.vx * dtSec;
      coin.rotation += coin.rotSpeed * dtSec;

      if (coin.y > this.gridH + 30) {
        coin.y = -20;
        coin.vy = 100 + Math.random() * 100;
      }

      const fadeOut = u > 0.8 ? (1 - u) / 0.2 : 1;
      this.drawCoin(coin, fadeOut);
    }
  }

  private drawCoin(coin: Coin, fadeOut: number): void {
    const g = this.coinsG;
    const { x, y, size, rotation, alpha } = coin;
    const finalAlpha = alpha * fadeOut;

    g.circle(x, y, size);
    g.fill({ color: 0xc9a227, alpha: finalAlpha });

    g.circle(x, y, size * 0.7);
    g.fill({ color: 0xf0d060, alpha: finalAlpha * 0.8 });

    const specX = x - size * 0.25 * Math.cos(rotation);
    const specY = y - size * 0.25 * Math.sin(rotation);
    g.circle(specX, specY, size * 0.25);
    g.fill({ color: 0xfff8e0, alpha: finalAlpha * 0.6 });
  }

  private paintToast(T: number, duration: number, dtSec: number): void {
    const u = Math.min(1, T / duration);
    this.paintFlash(u * 0.85);
    this.paintCoins(dtSec, u);
    this.paintBanner(u, { softIntro: true, compact: true });
    this.updateAmount(u);
  }

  private paintBanner(
    u: number,
    opts?: { softIntro?: boolean; compact?: boolean },
  ): void {
    this.bannerG.clear();

    let scaleIn = 1;
    const introWindow = opts?.softIntro ? 0.18 : 0.15;
    if (u < introWindow) {
      const t = u / introWindow;
      scaleIn = opts?.softIntro ? 0.78 + 0.22 * easeOutCubic(t) : 0.5 + 0.5 * easeOutBack(t);
    }
    let fadeOut = 1;
    if (u > 0.85) {
      fadeOut = 1 - (u - 0.85) / 0.15;
    }

    this.bannerText.scale.set(scaleIn);
    this.bannerText.alpha = fadeOut;
    this.amountText.scale.set(scaleIn * 0.9);
    this.amountText.alpha = fadeOut;

    const bw = this.gridW * (opts?.compact ? 0.72 : 0.85);
    const bh = opts?.compact ? 72 : 90;
    const bx = (this.gridW - bw) / 2;
    const by = this.gridH / 2 - bh / 2 - 10;

    this.bannerG.roundRect(bx, by, bw, bh, 12);
    this.bannerG.fill({ color: 0x1a1208, alpha: 0.85 * fadeOut });
    this.bannerG.stroke({ width: 3, color: 0xc9a227, alpha: 0.7 * fadeOut });
  }

  private updateAmount(u: number): void {
    const countUp = Math.min(1, u / 0.7);
    this.displayedAmount = Math.floor(this.currentAmount * easeOutQuart(countUp));
    this.amountText.text = `+${formatNumber(this.displayedAmount)}`;
  }

  cancel(): void {
    this.isPlaying = false;
  }

  private hide(): void {
    this.view.visible = false;
    this.isPlaying = false;
    this.coins = [];
    this.coinsG.clear();
    this.flashG.clear();
    this.bannerG.clear();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancel();
    this.view.removeChildren();
    this.bannerG.destroy();
    this.coinsG.destroy();
    this.flashG.destroy();
    this.bannerText.destroy();
    this.amountText.destroy();
  }
}

function easeOutCubic(t: number): number {
  const x = 1 - Math.max(0, Math.min(1, t));
  return 1 - x * x * x;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}
