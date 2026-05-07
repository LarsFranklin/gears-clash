import '../styles/host-ui.css';
import { GearsClashGame } from '../GearsClashGame';
import { MockGameApiAdapter } from '../adapters/MockGameApiAdapter';

const el = document.getElementById('game');
if (!el) {
  throw new Error('#game fehlt');
}

const game = new GearsClashGame({
  container: el,
  apiAdapter: new MockGameApiAdapter({ seed: 42, initialBalance: 10_000 }),
  defaultBet: 100,
});

game.on('spin:end', (payload) => {
  console.debug('[demo] spin:end', payload);
});
game.on('error', (err) => {
  console.error('[demo] error', err);
});

void game.mount();
