/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';
import type { IAdminUser } from '@/common/types/admin/userTypes';
import type { IUsageMe, IUsageSummary } from '@/common/types/admin/usageTypes';

/** Format a USD amount for display (e.g. 12.5 → "$12.50"). */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format an integer token/event count with thousands separators. */
export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return Math.round(value).toLocaleString();
}

interface UseMyUsageResult {
  data: IUsageMe | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Fetches the current user's own consumption + active limit (`GET /api/usage/me`). */
export function useMyUsage(): UseMyUsageResult {
  const [data, setData] = useState<IUsageMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ipcBridge.usage.me.invoke({});
      if (mountedRef.current) setData(res ?? null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** A usage summary row enriched with the user's display name for the admin table. */
export type AdminUsageRow = IUsageSummary & { username: string };

interface UseAdminUsageResult {
  rows: AdminUsageRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Admin overview: `GET /api/admin/usage` joined with `GET /api/admin/users`
 * (the usage endpoint returns `user_id` but not `username`).
 */
export function useAdminUsage(enabled: boolean): UseAdminUsageResult {
  const [rows, setRows] = useState<AdminUsageRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [summaries, users] = await Promise.all([
        ipcBridge.usage.adminList.invoke({}),
        ipcBridge.admin.listUsers.invoke().catch(() => [] as IAdminUser[]),
      ]);
      const nameById = new Map((users ?? []).map((u) => [u.id, u.username]));
      const joined: AdminUsageRow[] = (summaries ?? []).map((s) => ({
        ...s,
        username: nameById.get(s.user_id) ?? s.user_id,
      }));
      if (mountedRef.current) setRows(joined);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}
