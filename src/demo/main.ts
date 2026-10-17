import { GearsClashGame, MockGameApiAdapter, HttpGameApiAdapter } from '../index';
import type { GameApiAdapter } from '../adapters/GameApiAdapter';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { defaultAssetManifest } from '../config/assetManifest';
import { mountDemoVisualTestBar } from './demoVisualTestBar';
import { mountDemoSimulationPanel } from './simulationPanel';
import { mountDemoSessionPanel } from './demoSessionPanel';
import '../styles/host-ui.css';

// Wähle Adapter basierend auf URL-Parameter oder Vite-Env
const params = new URLSearchParams(window.location.search);
const toolsSurface = import.meta.env.MODE === 'tools' || params.get('tools') === '1';
document.body.classList.toggle('gc-demo-page--player', !toolsSurface);
document.body.classList.toggle('gc-demo-page--tools', toolsSurface);
const viteSpinUrl = import.meta.env.VITE_SPIN_URL as string | undefined;
const viteBalanceUrl = import.meta.env.VITE_BALANCE_URL as string | undefined;
const useHttpAdapter =
  params.get('http') === '1' || Boolean(viteSpinUrl?.trim());
const seedParam = params.get('seed');
const mockSeed =
  seedParam !== null && seedParam !== '' && !Number.isNaN(Number(seedParam))
    ? Number(seedParam)
    : undefined;

let apiAdapter: GameApiAdapter;

if (useHttpAdapter) {
  const spinEndpoint =
    viteSpinUrl?.trim() || 'http://localhost:3001/api/spin';
  const balanceEndpoint =
    viteBalanceUrl?.trim() || 'http://localhost:3001/api/balance';
  console.log('🌐 Using HTTP API Adapter (Real Server)', {
    spinEndpoint,
    balanceEndpoint,
  });
  apiAdapter = new HttpGameApiAdapter({
    spinEndpoint,
    balanceEndpoint,
    timeoutMs: 15_000,
  });
} else {
  console.log('🎲 Using Mock API Adapter (Client-Side)');
  apiAdapter = new MockGameApiAdapter(
    mockSeed !== undefined ? { seed: mockSeed } : {},
  );
}

const root = document.getElementById('game');
if (!root) throw new Error('#game element fehlt.');

const game = new GearsClashGame({
  container: root,
  apiAdapter,
  assetManifest: defaultAssetManifest,
  hostAdapter: {
    currency: 'COINS',
    locale: 'de-DE',
    onReady: () => console.log('Game ready!'),
    onError: (err) => console.error('Game error:', err),
  },
});

await game.mount();

// Demo-UI nur im Mock-Modus
if (toolsSurface && !useHttpAdapter) {
  const sessionHost = document.getElementById('gc-demo-session-host');
  const vistestHost = document.getElementById('gc-demo-vistest-host');
  const simHost = document.getElementById('gc-demo-sim-host');

  if (sessionHost) {
    mountDemoSessionPanel(sessionHost, game);
  }

  if (vistestHost) {
    mountDemoVisualTestBar(vistestHost, game);
  }

  if (simHost) {
    mountDemoSimulationPanel(simHost, { getConfig: () => defaultGameConfig });
  }
}

// Info in Console
console.log(`
🎰 Gears Clash Demo

Adapter-Modus wechseln:
  - Mock (Client):  ${window.location.origin}${window.location.pathname}
  - HTTP (Server):  ${window.location.origin}${window.location.pathname}?http=1
  - HTTP via Env:   VITE_SPIN_URL + optional VITE_BALANCE_URL (.env.local)
  - Mock mit Seed:  …?seed=4242  (reproduzierbare Spins; ohne seed = zufällig)

Server starten: npm run dev:server
`);
