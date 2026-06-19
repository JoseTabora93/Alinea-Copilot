/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Usage ledger types (Alinea Fase 2 #3).
 *
 * Mirrors the Core contract (`feat/fase2-03-usage-ledger`). All endpoints use the
 * `{ success, data }` envelope and a rolling 30-day window by default
 * (override with `?since_ms=<epoch_ms>`).
 */

/** Spend thresholds embedded in an admin usage row (no `user_id`). */
export type IUsageLimitInline = Pick<IUsageLimit, 'soft_usd' | 'hard_usd' | 'period' | 'updated_at'>;

/** Aggregated consumption for a single user over the active window. */
export interface IUsageSummary {
  user_id: string;
  tokens_in: number;
  tokens_out: number;
  cache_read: number;
  cache_write: number;
  /** Estimated spend in USD (token counts are exact; cost is an estimate). */
  cost_usd: number;
  events: number;
  /** Active spend thresholds (flattened into the admin usage row); `null` when unset. */
  limit?: IUsageLimitInline | null;
}

/** Per-user spend thresholds. `null` means the threshold is unset. */
export interface IUsageLimit {
  user_id: string;
  soft_usd: number | null;
  hard_usd: number | null;
  period: string;
  updated_at: number;
}

/** Response of `GET /api/usage/me`. */
export interface IUsageMe {
  usage: IUsageSummary;
  limit: IUsageLimit | null;
  since_ms: number;
}

/** Body of `PUT /api/admin/users/{id}/limit`. */
export interface IUsageLimitUpdate {
  soft_usd: number | null;
  hard_usd: number | null;
}
