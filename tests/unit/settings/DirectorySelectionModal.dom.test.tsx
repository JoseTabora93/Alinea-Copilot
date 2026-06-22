/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DirectorySelectionModal from '@/renderer/components/settings/DirectorySelectionModal';

// t returns the provided defaultValue (so we can assert on real English copy).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  getBaseUrl: () => '',
}));

vi.mock('@/common/config/constants', () => ({
  CSRF_COOKIE_NAME: 'aionui-csrf-token',
}));

vi.mock('@/renderer/utils/file/fileSelection', () => ({
  stripWindowsVerbatimPrefix: (p: string) => p,
}));

const okEnvelope = (items: Array<{ name: string; path: string; isDirectory: boolean }>, canGoUp = false) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data: { items, can_go_up: canGoUp } }),
});

const errResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => ({ error: `HTTP ${status}` }),
});

describe('DirectorySelectionModal — per-user file segregation handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the restricted tree returned at the user root (no "up" when canGoUp is false)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        okEnvelope([{ name: 'conversations', path: '/data/users/u1/conversations', isDirectory: true }], false)
      ) as unknown as typeof fetch;

    render(<DirectorySelectionModal visible onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByText('conversations')).toBeTruthy();
    // At the user's root the backend reports can_go_up=false → no ".." entry.
    expect(screen.queryByText('..')).toBeNull();
  });

  it('shows an access-denied message + "go to my folder" on 403', async () => {
    global.fetch = vi.fn().mockResolvedValue(errResponse(403)) as unknown as typeof fetch;

    render(<DirectorySelectionModal visible onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByText("You don't have access to this folder.")).toBeTruthy();
    expect(screen.getByText('Go to my folder')).toBeTruthy();
  });

  it('shows a not-found message on 404 and "go to my folder" reloads the root', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errResponse(404))
      .mockResolvedValue(okEnvelope([{ name: 'projects', path: '/data/users/u1/projects', isDirectory: true }], false));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DirectorySelectionModal visible onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const goHome = await screen.findByText('Go to my folder');
    expect(screen.getByText('This folder no longer exists.')).toBeTruthy();

    fireEvent.click(goHome);

    // After "go to my folder" it re-browses the user root ('') and shows its contents.
    expect(await screen.findByText('projects')).toBeTruthy();
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('/api/fs/browse?path=&');
    });
  });
});
