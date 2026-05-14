import type { BonusSessionPayload, SpinRequest, SpinResult } from '../config/types';
import {
  InsufficientBalanceError,
  InvalidResponseError,
  NetworkError,
} from './errors';
import type { GameApiAdapter } from './GameApiAdapter';

const VALID_BONUS_TYPES = ['gears_clash', 'heist_run', 'deadlock_mode'] as const;

export interface HttpGameApiAdapterOptions {
  spinEndpoint: string;
  balanceEndpoint?: string;
  /** Zusätzliche fetch-Optionen (Headers, credentials). */
  fetchInit?: RequestInit;
  /**
   * Timeout pro Request in Millisekunden. Standard: 15000 (15 s).
   * `0` deaktiviert den Timeout — dann gilt nur `fetchInit.signal`.
   */
  timeoutMs?: number;
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
  const bonus = validateBonusPayload(raw.bonus);

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

  const winLines = raw.displayWinLines;
  let displayWinLines: SpinResult['displayWinLines'] = undefined;
  if (Array.isArray(winLines)) {
    const parsed: NonNullable<SpinResult['displayWinLines']> = [];
    for (const line of winLines) {
      if (!isPlain(line) || !Array.isArray(line.points)) continue;
      const amount = Number(line.amount ?? 0);
      if (Number.isNaN(amount) || amount <= 0) continue;
      const points: { reel: number; row: number }[] = [];
      for (const p of line.points) {
        if (!isPlain(p)) continue;
        const reel = Number(p.reel);
        const row = Number(p.row);
        if (Number.isNaN(reel) || Number.isNaN(row)) continue;
        points.push({ reel, row });
      }
      if (points.length < 2) continue;
      parsed.push({
        id: line.id !== undefined ? String(line.id) : undefined,
        points,
        amount,
        label:
          line.label !== undefined && line.label !== null
            ? String(line.label)
            : undefined,
      });
    }
    displayWinLines = parsed;
  }

  return {
    spinId,
    reelStops: stops,
    winAmount,
    balanceAfter,
    bonus,
    ...(displayHighlights && displayHighlights.length > 0
      ? { displayHighlights }
      : {}),
    ...(displayWinLines && displayWinLines.length > 0 ? { displayWinLines } : {}),
  };
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateBonusPayload(bonus: unknown): BonusSessionPayload | null {
  if (bonus === null || bonus === undefined) {
    return null;
  }
  if (!isPlain(bonus)) {
    throw new InvalidResponseError('bonus muss ein Objekt oder null sein.');
  }
  const type = bonus.type;
  if (typeof type !== 'string' || !VALID_BONUS_TYPES.includes(type as typeof VALID_BONUS_TYPES[number])) {
    throw new InvalidResponseError(
      `bonus.type muss einer von ${VALID_BONUS_TYPES.join(', ')} sein, erhielt: ${String(type)}.`,
    );
  }
  const payload = bonus.payload;
  if (!isPlain(payload)) {
    throw new InvalidResponseError('bonus.payload muss ein Objekt sein.');
  }
  return { type, payload } as unknown as BonusSessionPayload;
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
    const timeoutMs = this.options.timeoutMs ?? 15_000;
    const controller = new AbortController();
    let timedOut = false;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs)
        : null;

    const userSignal = init.signal ?? null;
    const onUserAbort = () => controller.abort();
    if (userSignal) {
      if (userSignal.aborted) controller.abort();
      else userSignal.addEventListener('abort', onUserAbort, { once: true });
    }

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e as { name?: string } | null)?.name === 'AbortError';
      if (aborted && timedOut) {
        throw new NetworkError('Timeout beim Request.', {
          cause: e,
          kind: 'timeout',
        });
      }
      throw new NetworkError('Netzwerkfehler beim Request.', {
        cause: e,
        kind: 'transport',
      });
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
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
