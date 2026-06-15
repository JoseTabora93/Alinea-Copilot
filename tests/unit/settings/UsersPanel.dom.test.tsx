/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { IAdminUser } from '@/common/types/admin/userTypes';

const { listMock, createMock, updateMock, resetMock, deleteMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  resetMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'system_default_user', username: 'admin', role: 'admin' } }),
}));

// Stub the modals so the test focuses on the table/data wiring.
vi.mock('@/renderer/pages/settings/UsersSettings/InviteUserModal', () => ({
  default: () => null,
}));
vi.mock('@/renderer/pages/settings/UsersSettings/PasswordResultModal', () => ({
  default: () => null,
}));
vi.mock('@/renderer/components/base/AionModal', () => ({
  default: () => null,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    admin: {
      listUsers: { invoke: listMock },
      createUser: { invoke: createMock },
      updateUser: { invoke: updateMock },
      resetPassword: { invoke: resetMock },
      deleteUser: { invoke: deleteMock },
    },
  },
}));

import UsersPanel from '@/renderer/pages/settings/UsersSettings/UsersPanel';

const USERS: IAdminUser[] = [
  { id: 'system_default_user', username: 'admin', role: 'admin', is_active: true, display_name: 'Site Admin' },
  { id: 'u_1', username: 'maria-lopez', role: 'member', is_active: true, display_name: 'María López' },
  { id: 'u_2', username: 'john-doe', role: 'member', is_active: false, display_name: null },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UsersPanel', () => {
  it('loads users from the admin API and renders a row per user', async () => {
    listMock.mockResolvedValue(USERS);
    render(<UsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('maria-lopez')).toBeInTheDocument();
    expect(screen.getByText('john-doe')).toBeInTheDocument();
    // Invite action available
    expect(screen.getByText('settings.users.invite')).toBeInTheDocument();
  });

  it('renders role and status badges', async () => {
    listMock.mockResolvedValue(USERS);
    render(<UsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('maria-lopez')).toBeInTheDocument();
    });
    // Active + Inactive statuses both present
    expect(screen.getAllByText('settings.users.statusActive').length).toBeGreaterThan(0);
    expect(screen.getByText('settings.users.statusInactive')).toBeInTheDocument();
    // Admin + Member roles present
    expect(screen.getByText('settings.users.roleAdmin')).toBeInTheDocument();
    expect(screen.getAllByText('settings.users.roleMember').length).toBeGreaterThan(0);
  });

  it('shows an error state when the API fails', async () => {
    listMock.mockRejectedValue(new Error('boom'));
    render(<UsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('settings.users.loadFailed')).toBeInTheDocument();
    });
  });
});
