/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid='navigate'>{to}</div>,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='wrapper'>{children}</div>,
}));

vi.mock('@/renderer/pages/settings/UsersSettings/UsersPanel', () => ({
  default: () => <div data-testid='users-panel'>panel</div>,
}));

import UsersSettings from '@/renderer/pages/settings/UsersSettings';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UsersSettings admin gate', () => {
  it('redirects non-admin (member) to /guid', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u_1', username: 'bob', role: 'member' } });
    render(<UsersSettings />);
    expect(screen.getByTestId('navigate')).toHaveTextContent('/guid');
    expect(screen.queryByTestId('users-panel')).not.toBeInTheDocument();
  });

  it('redirects when there is no user', () => {
    useAuthMock.mockReturnValue({ user: null });
    render(<UsersSettings />);
    expect(screen.getByTestId('navigate')).toHaveTextContent('/guid');
  });

  it('renders the panel for an admin', () => {
    useAuthMock.mockReturnValue({ user: { id: 'admin_1', username: 'admin', role: 'admin' } });
    render(<UsersSettings />);
    expect(screen.getByTestId('users-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });
});
