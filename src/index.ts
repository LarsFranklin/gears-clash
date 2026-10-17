/**
 * Öffentliche API — Hosts sollen nur aus diesem Entry importieren
 * (`import { GearsClashGame, ... } from "gears-clash-game"`).
 */
import './styles/host-ui.css';

export { GearsClashGame } from './GearsClashGame';
export type {
  ControlsVisibilityOptions,
  GameSoundAdapter,
  GearsClashGameOptions,
} from './GearsClashGame';

export type { GcFxQuality, GcLayoutMode } from './util/layoutMode';
export {
  defaultFxQualityForLayout,
  resolveGcLayoutMode,
} from './util/layoutMode';

export type {
  AssetManifest,
} from './config/assetManifest';
export {
  defaultAssetManifest,
  resolveManifestPaths,
} from './config/assetManifest';

export { defaultGameConfig } from './config/defaultGameConfig';
export type { DemoSpinScenarioId } from './config/demoSpinPresets';
export {
  DEMO_SPIN_SCENARIO_IDS,
  buildDemoReelStops,
  isDemoSpinScenarioId,
} from './config/demoSpinPresets';
export { mergeGameConfig } from './config/mergeGameConfig';
export type { MergeGameConfigOptions } from './config/mergeGameConfig';
export {
  validateGameConfig,
  GameConfigValidationError,
} from './config/validateGameConfig';
export { defaultSlotMath } from './config/defaultSlotMath';
export type {
  AnimationConfig,
  BonusId,
  BonusRetriggerEvent,
  BonusSessionMeta,
  BonusSessionPayload,
  BonusSummaryEvent,
  DeadlockCollectedSymbol,
  DeadlockModePayload,
  DeadlockPhase,
  GameConfig,
  GameEventName,
  GearsClashPayload,
  GridConfig,
  HeistRunPayload,
  HeistRunStickyWild,
  HostAdapter,
  PaylineType,
  SlotMathConfig,
  SlotPaylineDefinition,
  SoundConfig,
  SpinDisplayHighlight,
  SpinDisplayWinLine,
  SpinRequest,
  SpinResult,
  SymbolDef,
  SymbolKind,
} from './config/types';
export type { DemoSpinEvaluation } from './core/slotEvaluation';
export { activePaylines, evaluateDemoBaseSpin } from './core/slotEvaluation';

export type { WinTier } from './renderer/BigWinLayer';
export { getWinTier } from './renderer/BigWinLayer';

export {
  countBonusScatterOfTypeForColumnPrefix,
  countBonusScatterOfTypeFullGrid,
} from './core/scatterAnticipation';

export type { GameApiAdapter } from './adapters/GameApiAdapter';
export { HttpGameApiAdapter } from './adapters/HttpGameApiAdapter';
export type { HttpGameApiAdapterOptions } from './adapters/HttpGameApiAdapter';
export { MockGameApiAdapter } from './adapters/MockGameApiAdapter';
export type { MockGameApiAdapterOptions } from './adapters/MockGameApiAdapter';

export type { NetworkErrorKind } from './adapters/errors';
export {
  NetworkError,
  InvalidResponseError,
  InsufficientBalanceError,
} from './adapters/errors';

export { InfoModalController } from './ui/InfoModalController';

/**
 * Für IIFE-Konsumenten landet der gesamte Public-API-Surface unter dem
 * globalen `GearsClash`-Objekt (siehe `vite.config.ts` → `lib.name` und
 * `output.exports: 'named'`). ESM-Konsumenten nutzen wie üblich named imports.
 */
