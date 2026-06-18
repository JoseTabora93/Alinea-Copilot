/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Message } from '@arco-design/web-react';
import type { IAdminRole, IAdminUser } from '@/common/types/admin/userTypes';

const { listMock, rolesMock, assignMock, removeMock, createMock, updateMock, resetMock, deleteMock } = vi.hoisted(
  () => ({
    listMock: vi.fn(),
    rolesMock: vi.fn(),
    assignMock: vi.fn(),
    removeMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    resetMock: vi.fn(),
    deleteMock: vi.fn(),
  })
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'system_default_user', username: 'admin' } }),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  // Treat objects flagged as BackendHttpError; surfaces 409 anti-lockout handling.
  isBackendHttpError: (e: unknown) =>
    Boolean(e && typeof e === 'object' && (e as { name?: string }).name === 'BackendHttpError'),
}));

vi.mock('@/renderer/pages/settings/UsersSettings/InviteUserModal', () => ({ default: () => null }));
vi.mock('@/renderer/pages/settings/UsersSettings/PasswordResultModal', () => ({ default: () => null }));
vi.mock('@/renderer/components/base/AionModal', () => ({ default: () => null }));

vi.mock('@/common', () => ({
  ipcBridge: {
    admin: {
      listUsers: { invoke: listMock },
      listRoles: { invoke: rolesMock },
      assignRole: { invoke: assignMock },
      removeRole: { invoke: removeMock },
      createUser: { invoke: createMock },
      updateUser: { invoke: updateMock },
      resetPassword: { invoke: resetMock },
      deleteUser: { invoke: deleteMock },
    },
  },
}));

import UsersPanel from '@/renderer/pages/settings/UsersSettings/UsersPanel';

const CATALOG: IAdminRole[] = [
  { id: 'admin', name: 'admin', label: 'Administrador', created_at: 0 },
  { id: 'gerencia', name: 'gerencia', label: 'Gerencia', created_at: 0 },
  { id: 'tecnica', name: 'tecnica', label: 'Técnica', created_at: 0 },
  { id: 'comercial', name: 'comercial', label: 'Comercial', created_at: 0 },
  { id: 'financiera', name: 'financiera', label: 'Financiera', created_at: 0 },
  { id: 'ingenieria', name: 'ingenieria', label: 'Ingeniería', created_at: 0 },
];

const USERS: IAdminUser[] = [
  { id: 'system_default_user', username: 'admin', roles: ['admin'], is_active: true },
  { id: 'u_1', username: 'maria-lopez', roles: ['gerencia'], is_active: true },
  { id: 'u_2', username: 'john-doe', roles: [], is_active: true },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UsersPanel — multi-role RBAC', () => {
  it('loads users + role catalogue and renders role chips from the catalogue labels', async () => {
    listMock.mockResolvedValue(USERS);
    rolesMock.mockResolvedValue(CATALOG);
    render(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('maria-lopez')).toBeInTheDocument());
    expect(rolesMock).toHaveBeenCalledTimes(1);
    // Chips show the catalogue label, not the raw role key.
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Gerencia')).toBeInTheDocument();
    // User with no roles shows the placeholder.
    expect(screen.getByText('settings.users.noRoles')).toBeInTheDocument();
  });

  it('assigns a role via the editor (POST) and removes one (DELETE)', async () => {
    listMock.mockResolvedValue(USERS);
    rolesMock.mockResolvedValue(CATALOG);
    assignMock.mockResolvedValue({ id: 'u_1', roles: ['gerencia', 'tecnica'] });
    removeMock.mockResolvedValue({ id: 'u_1', roles: [] });
    render(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('maria-lopez')).toBeInTheDocument());

    // Open María's roles editor (2nd "manage roles" button).
    const editButtons = screen.getAllByLabelText('settings.users.manageRoles');
    fireEvent.click(editButtons[1]);

    // Assign 'tecnica' (not yet assigned).
    fireEvent.click(await screen.findByTestId('role-option-u_1-tecnica'));
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith({ id: 'u_1', role: 'tecnica' }));

    // Remove 'gerencia' (assigned).
    fireEvent.click(await screen.findByTestId('role-option-u_1-gerencia'));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith({ id: 'u_1', role: 'gerencia' }));
  });

  it('surfaces the anti-lockout error when removing the last admin (409)', async () => {
    // Arco's Message uses ReactDOM.render (unavailable in jsdom); spy to assert the call.
    const errorSpy = vi.spyOn(Message, 'error').mockReturnValue('' as never);
    listMock.mockResolvedValue(USERS);
    rolesMock.mockResolvedValue(CATALOG);
    removeMock.mockRejectedValue({ name: 'BackendHttpError', status: 409, backendMessage: 'last admin' });
    render(<UsersPanel />);

    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument());

    // Open the admin user's roles editor (1st button) and try to remove 'admin'.
    const editButtons = screen.getAllByLabelText('settings.users.manageRoles');
    fireEvent.click(editButtons[0]);
    fireEvent.click(await screen.findByTestId('role-option-system_default_user-admin'));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith({ id: 'system_default_user', role: 'admin' }));
    expect(errorSpy).toHaveBeenCalledWith('settings.users.lastAdminError');
    errorSpy.mockRestore();
  });

  it('shows an error state when the API fails', async () => {
    listMock.mockRejectedValue(new Error('boom'));
    rolesMock.mockResolvedValue(CATALOG);
    render(<UsersPanel />);
    await waitFor(() => expect(screen.getByText('settings.users.loadFailed')).toBeInTheDocument());
  });
});
