import type { SpinRequest, SpinResult } from '../config/types';
import {
  InsufficientBalanceError,
  InvalidResponseError,
  NetworkError,
} from './errors';
import type { GameApiAdapter } from './GameApiAdapter';

export interface HttpGameApiAdapterOptions {
  spinEndpoint: string;
  balanceEndpoint?: string;
  /** Zusätzliche fetch-Optionen (Headers, credentials). */
  fetchInit?: RequestInit;
  /**
   * Optional: Mapping von HTTP-Status / API-Code auf InsufficientBalanceError.
   * Beispiel: status 402 oder 409, oder body { code: "INSUFFICIENT_FUNDS" }.
   */
  insufficientBalance?: {
    httpStatuses?: number[];
    bodyCodes?: string[];
    /** JSON-Pfad oder Custom-Extractor — v1: prüft body.code */
    match?: (status: number, body: unknown) => boolean;
  };
  mapSpinResponse?: (raw: unknown) => SpinResult;
}

function defaultMapSpinResponse(raw: unknown): SpinResult {
  if (!isPlain(raw)) {
    throw new InvalidResponseError('Spin-Antwort ist kein JSON-Objekt.');
  }
  const spinId = String(raw.spinId ?? '');
  const reelStops = raw.reelStops;
  const balanceAfter = Number(raw.balanceAfter);
  const winAmount = Number(raw.winAmount ?? 0);
  const bonus = raw.bonus === undefined ? null : raw.bonus;

  if (!spinId || !Array.isArray(reelStops)) {
    throw new InvalidResponseError('Spin-Antwort fehlt spinId oder reelStops.');
  }
  const stops = reelStops.map((col) => {
    if (!Array.isArray(col)) {
      throw new InvalidResponseError('reelStops muss string[][] sein.');
    }
    return col.map((cell) => String(cell));
  });
  if (Number.isNaN(balanceAfter)) {
    throw new InvalidResponseError('balanceAfter ist keine Zahl.');
  }

  const highlights = raw.displayHighlights;
  let displayHighlights: SpinResult['displayHighlights'] = undefined;
  if (Array.isArray(highlights)) {
    displayHighlights = highlights
      .map((h) => {
        if (!isPlain(h)) return null;
        const reel = Number(h.reel);
        const row = Number(h.row);
        if (Number.isNaN(reel) || Number.isNaN(row)) return null;
        return { reel, row };
      })
      .filter((x): x is { reel: number; row: number } => x !== null);
  }

  return {
    spinId,
    reelStops: stops,
    winAmount,
    balanceAfter,
    bonus: bonus as SpinResult['bonus'],
    ...(displayHighlights && displayHighlights.length > 0
      ? { displayHighlights }
      : {}),
  };
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export class HttpGameApiAdapter implements GameApiAdapter {
  constructor(private readonly options: HttpGameApiAdapterOptions) {}

  async getBalance(): Promise<number> {
    const url = this.options.balanceEndpoint;
    if (!url) {
      throw new InvalidResponseError(
        'getBalance: balanceEndpoint ist nicht gesetzt.',
      );
    }
    const res = await this.safeFetch(url, {
      ...this.options.fetchInit,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(this.options.fetchInit?.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      throw new InvalidResponseError(`Balance-Request fehlgeschlagen (${res.status}).`, {
        status: res.status,
      });
    }
    const raw = await this.parseJson(res);
    if (!isPlain(raw) || typeof raw.balance !== 'number') {
      throw new InvalidResponseError(
        'Balance-Antwort erwartet { balance: number }.',
        { status: res.status, bodySnippet: JSON.stringify(raw).slice(0, 200) },
      );
    }
    return raw.balance;
  }

  async spin(request: SpinRequest): Promise<SpinResult> {
    const res = await this.safeFetch(this.options.spinEndpoint, {
      ...this.options.fetchInit,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.options.fetchInit?.headers as Record<string, string>),
      },
      body: JSON.stringify(request),
    });

    const rawText = await res.text();
    let raw: unknown;
    try {
      raw = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      throw new InvalidResponseError('Spin-Antwort ist kein gültiges JSON.', {
        status: res.status,
        bodySnippet: rawText.slice(0, 200),
        cause: e,
      });
    }

    if (!res.ok) {
      if (this.isInsufficientBalance(res.status, raw)) {
        throw new InsufficientBalanceError('Nicht genügend Guthaben.', {
          status: res.status,
          apiCode: isPlain(raw) ? String(raw.code ?? '') : undefined,
        });
      }
      throw new InvalidResponseError(`Spin fehlgeschlagen (${res.status}).`, {
        status: res.status,
        bodySnippet: rawText.slice(0, 400),
      });
    }

    try {
      const mapper = this.options.mapSpinResponse ?? defaultMapSpinResponse;
      return mapper(raw);
    } catch (e) {
      if (e instanceof InvalidResponseError) throw e;
      throw new InvalidResponseError(
        e instanceof Error ? e.message : 'Unbekannter Mapping-Fehler',
        { status: res.status, cause: e },
      );
    }
  }

  private isInsufficientBalance(status: number, body: unknown): boolean {
    const cfg = this.options.insufficientBalance;
    if (cfg?.httpStatuses?.includes(status)) return true;
    if (cfg?.match?.(status, body)) return true;
    if (cfg?.bodyCodes && isPlain(body) && typeof body.code === 'string') {
      return cfg.bodyCodes.includes(body.code);
    }
    return false;
  }

  private async safeFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (e) {
      throw new NetworkError('Netzwerkfehler beim Request.', { cause: e });
    }
  }

  private async parseJson(res: Response): Promise<unknown> {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new InvalidResponseError('Antwort ist kein gültiges JSON.', {
        status: res.status,
        bodySnippet: text.slice(0, 200),
        cause: e,
      });
    }
  }
}
