import express from 'express';
import cors from 'cors';
import { defaultGameConfig } from '../src/config/defaultGameConfig.js';
import { SpinEngine } from './spin-engine.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

/** In-Memory-Zustand — nur Entwicklung, kein persistenter Kontostand. */
let demoBalance = 10_000;
const spinEngine = new SpinEngine(defaultGameConfig);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'gears-clash-dev',
    activeBonus: spinEngine.activeBonusId(),
  });
});

app.get('/api/balance', (_req, res) => {
  res.json({ balance: demoBalance });
});

app.post('/api/spin', (req, res) => {
  const { bet = 100, mode = 'base' } = req.body ?? {};

  if (typeof bet !== 'number' || !Number.isFinite(bet) || bet <= 0) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  const isSessionRound = spinEngine.hasActiveSession() && mode !== 'base';

  /**
   * Freispiele kosten keinen Einsatz — nur Base-Spins prüfen das Guthaben
   * (docs/bonuses/heist-run.md §6).
   */
  if (!isSessionRound && bet > demoBalance) {
    return res.status(402).json({
      error: 'Insufficient balance',
      code: 'INSUFFICIENT_FUNDS',
    });
  }

  try {
    const result = spinEngine.generateSpin({
      bet,
      balanceBefore: demoBalance,
      mode,
    });
    demoBalance = result.balanceAfter;
    res.json(result);
  } catch (error) {
    console.error('Spin error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎰 Gears Clash Dev Server running on http://localhost:${PORT}`);
  console.log(`   Spin: POST http://localhost:${PORT}/api/spin`);
  console.log(`   Balance: GET http://localhost:${PORT}/api/balance\n`);
});
