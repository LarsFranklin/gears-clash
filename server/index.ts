import express from 'express';
import cors from 'cors';
import { defaultGameConfig } from '../src/config/defaultGameConfig.js';
import { SpinEngine } from './spin-engine.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-Memory Balance für Demo
let demoBalance = 10000;

// Spin Engine Instance
const spinEngine = new SpinEngine();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'gears-clash-dev' });
});

// Balance Endpoint
app.get('/api/balance', (req, res) => {
  res.json({ balance: demoBalance });
});

// Spin Endpoint
app.post('/api/spin', (req, res) => {
  const { bet = 100 } = req.body;

  if (typeof bet !== 'number' || bet <= 0) {
    return res.status(400).json({ error: 'Invalid bet amount' });
  }

  if (bet > demoBalance) {
    return res.status(402).json({
      error: 'Insufficient balance',
      code: 'INSUFFICIENT_FUNDS',
    });
  }

  try {
    const result = spinEngine.generateSpin(
      defaultGameConfig,
      bet,
      demoBalance,
    );

    // Balance aktualisieren
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

// Server starten
app.listen(PORT, () => {
  console.log(`\n🎰 Gears Clash Dev Server running on http://localhost:${PORT}`);
  console.log(`   Spin: POST http://localhost:${PORT}/api/spin`);
  console.log(`   Balance: GET http://localhost:${PORT}/api/balance\n`);
});
