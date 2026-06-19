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
