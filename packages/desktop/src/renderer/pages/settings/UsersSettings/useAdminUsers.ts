/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';
import type {
  IAdminCreateUserRequest,
  IAdminRole,
  IAdminUpdateUserRequest,
  IAdminUser,
  UserRole,
} from '@/common/types/admin/userTypes';

interface UseAdminUsersResult {
  users: IAdminUser[];
  roleCatalog: IAdminRole[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createUser: (req: IAdminCreateUserRequest) => Promise<IAdminUser>;
  updateUser: (id: string, updates: IAdminUpdateUserRequest) => Promise<void>;
  resetPassword: (id: string, newPassword: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  /** Assign a role to a user (multi-role RBAC). Returns the user's updated roles. */
  assignRole: (id: string, role: UserRole) => Promise<UserRole[]>;
  /** Remove a role from a user. Returns the user's updated roles. */
  removeRole: (id: string, role: UserRole) => Promise<UserRole[]>;
}

/**
 * Data hook for the admin user-management panel.
 *
 * Wraps the `/api/admin/users` endpoints and keeps a local list in sync.
 * Mutations re-fetch the list so the table always reflects backend state.
 */
export function useAdminUsers(): UseAdminUsersResult {
  const [users, setUsers] = useState<IAdminUser[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<IAdminRole[]>([]);
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
      // Fetch users + the role catalogue together; the catalogue drives the chips.
      const [list, roles] = await Promise.all([
        ipcBridge.admin.listUsers.invoke(),
        ipcBridge.admin.listRoles.invoke().catch(() => [] as IAdminRole[]),
      ]);
      if (mountedRef.current) {
        setUsers(list ?? []);
        setRoleCatalog(roles ?? []);
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Patch a single user's roles in place (avoids a full re-fetch after assign/remove).
  const applyRoles = useCallback((id: string, roles: UserRole[]) => {
    if (!mountedRef.current) return;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, roles } : u)));
  }, []);

  const assignRole = useCallback(
    async (id: string, role: UserRole) => {
      const res = await ipcBridge.admin.assignRole.invoke({ id, role });
      const roles = (res?.roles ?? []) as UserRole[];
      applyRoles(id, roles);
      return roles;
    },
    [applyRoles]
  );

  const removeRole = useCallback(
    async (id: string, role: UserRole) => {
      const res = await ipcBridge.admin.removeRole.invoke({ id, role });
      const roles = (res?.roles ?? []) as UserRole[];
      applyRoles(id, roles);
      return roles;
    },
    [applyRoles]
  );

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

  const deleteUser = useCallback(
    async (id: string) => {
      await ipcBridge.admin.deleteUser.invoke({ id });
      await reload();
    },
    [reload]
  );

  return {
    users,
    roleCatalog,
    loading,
    error,
    reload,
    createUser,
    updateUser,
    resetPassword,
    deleteUser,
    assignRole,
    removeRole,
  };
}
