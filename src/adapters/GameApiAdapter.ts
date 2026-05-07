import type { SpinRequest, SpinResult } from '../config/types';

/** Reine Server-/Mock-Schnittstelle — keine Host-UI. */
export interface GameApiAdapter {
  spin(request: SpinRequest): Promise<SpinResult>;
  getBalance(): Promise<number>;
}
