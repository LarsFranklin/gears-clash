import { GearsClashGame, MockGameApiAdapter, HttpGameApiAdapter } from '../index';
import type { GameApiAdapter } from '../adapters/GameApiAdapter';
import { defaultGameConfig } from '../config/defaultGameConfig';
import { defaultAssetManifest } from '../config/assetManifest';
import { mountDemoVisualTestBar } from './demoVisualTestBar';
import { mountDemoSimulationPanel } from './simulationPanel';
import '../styles/host-ui.css';

// Wähle Adapter basierend auf URL-Parameter
const params = new URLSearchParams(window.location.search);
const useHttpAdapter = params.get('http') === '1';
const seedParam = params.get('seed');
const mockSeed =
  seedParam !== null && seedParam !== '' && !Number.isNaN(Number(seedParam))
    ? Number(seedParam)
    : undefined;

let apiAdapter: GameApiAdapter;

if (useHttpAdapter) {
  console.log('🌐 Using HTTP API Adapter (Real Server)');
  apiAdapter = new HttpGameApiAdapter({
    spinEndpoint: 'http://localhost:3001/api/spin',
    balanceEndpoint: 'http://localhost:3001/api/balance',
    timeoutMs: 15000,
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
if (!useHttpAdapter) {
  const vistestHost = document.getElementById('gc-demo-vistest-host');
  const simHost = document.getElementById('gc-demo-sim-host');
  
  if (vistestHost) {
    const testBar = mountDemoVisualTestBar(vistestHost, game);
  }
  
  if (simHost) {
    const simPanel = mountDemoSimulationPanel(simHost, { getConfig: () => defaultGameConfig });
  }
}

// Info in Console
console.log(`
🎰 Gears Clash Demo

Adapter-Modus wechseln:
  - Mock (Client):  ${window.location.origin}${window.location.pathname}
  - HTTP (Server):  ${window.location.origin}${window.location.pathname}?http=1
  - Mock mit Seed:  …?seed=4242  (reproduzierbare Spins; ohne seed = zufällig)

Server starten: npm run dev:server
`);
