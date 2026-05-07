/**
 * Öffentliche API — Hosts sollen nur aus diesem Entry importieren
 * (`import { GearsClashGame, ... } from "gears-clash-game"`).
 */
import './styles/host-ui.css';

export { GearsClashGame } from './GearsClashGame';
export type { GearsClashGameOptions, GameSoundAdapter } from './GearsClashGame';

export type {
  AssetManifest,
} from './config/assetManifest';
export {
  defaultAssetManifest,
  resolveManifestPaths,
} from './config/assetManifest';

export { defaultGameConfig } from './config/defaultGameConfig';
export type {
  BonusId,
  BonusSessionPayload,
  GameConfig,
  GameEventName,
  HostAdapter,
  SpinDisplayHighlight,
  SpinRequest,
  SpinResult,
  SymbolDef,
  SymbolKind,
} from './config/types';

export type { GameApiAdapter } from './adapters/GameApiAdapter';
export { HttpGameApiAdapter } from './adapters/HttpGameApiAdapter';
export type { HttpGameApiAdapterOptions } from './adapters/HttpGameApiAdapter';
export { MockGameApiAdapter } from './adapters/MockGameApiAdapter';
export type { MockGameApiAdapterOptions } from './adapters/MockGameApiAdapter';

export {
  NetworkError,
  InvalidResponseError,
  InsufficientBalanceError,
} from './adapters/errors';

import { GearsClashGame as GearsClashGameCtor } from './GearsClashGame';
import { HttpGameApiAdapter as HttpGameApiAdapterCtor } from './adapters/HttpGameApiAdapter';
import { MockGameApiAdapter as MockGameApiAdapterCtor } from './adapters/MockGameApiAdapter';
import { defaultGameConfig as defaultGameConfigValue } from './config/defaultGameConfig';
import {
  defaultAssetManifest as defaultAssetManifestValue,
  resolveManifestPaths as resolveManifestPathsFn,
} from './config/assetManifest';

/** Für `<script>`-IIFE: ein Objekt am globalen `GearsClash`. */
const GearsClash = {
  GearsClashGame: GearsClashGameCtor,
  MockGameApiAdapter: MockGameApiAdapterCtor,
  HttpGameApiAdapter: HttpGameApiAdapterCtor,
  defaultGameConfig: defaultGameConfigValue,
  defaultAssetManifest: defaultAssetManifestValue,
  resolveManifestPaths: resolveManifestPathsFn,
};

export default GearsClash;
