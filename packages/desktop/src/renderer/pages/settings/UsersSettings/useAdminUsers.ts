/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';
import type { IAdminCreateUserRequest, IAdminUpdateUserRequest, IAdminUser } from '@/common/types/admin/userTypes';

interface UseAdminUsersResult {
  users: IAdminUser[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createUser: (req: IAdminCreateUserRequest) => Promise<IAdminUser>;
  updateUser: (id: string, updates: IAdminUpdateUserRequest) => Promise<void>;
  resetPassword: (id: string, newPassword: string) => Promise<void>;
}

/**
 * Data hook for the admin user-management panel.
 *
 * Wraps the `/api/admin/users` endpoints and keeps a local list in sync.
 * Mutations re-fetch the list so the table always reflects backend state.
 */
export function useAdminUsers(): UseAdminUsersResult {
  const [users, setUsers] = useState<IAdminUser[]>([]);
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
      const list = (await ipcBridge.admin.listUsers.invoke()) ?? [];
      if (mountedRef.current) setUsers(list);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createUser = useCallback(
    async (req: IAdminCreateUserRequest) => {
      const created = await ipcBridge.admin.createUser.invoke(req);
      await reload();
      return created;
    },
    [reload]
  );

  const updateUser = useCallback(
    async (id: string, updates: IAdminUpdateUserRequest) => {
      await ipcBridge.admin.updateUser.invoke({ id, ...updates });
      await reload();
    },
    [reload]
  );

  const resetPassword = useCallback(async (id: string, newPassword: string) => {
    await ipcBridge.admin.resetPassword.invoke({ id, new_password: newPassword });
  }, []);

  return { users, loading, error, reload, createUser, updateUser, resetPassword };
}
