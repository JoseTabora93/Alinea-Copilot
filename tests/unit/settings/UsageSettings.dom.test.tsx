/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Message } from '@arco-design/web-react';
import type { IUsageMe, IUsageSummary } from '@/common/types/admin/usageTypes';

const { meMock, adminListMock, getLimitMock, setLimitMock, listUsersMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  adminListMock: vi.fn(),
  getLimitMock: vi.fn(),
  setLimitMock: vi.fn(),
  listUsersMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

// Lightweight AionModal that renders content + footer inline so we can interact.
vi.mock('@/renderer/components/base/AionModal', () => ({
  default: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <div data-testid='modal'>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    usage: {
      me: { invoke: meMock },
      adminList: { invoke: adminListMock },
      getLimit: { invoke: getLimitMock },
      setLimit: { invoke: setLimitMock },
    },
    admin: {
      listUsers: { invoke: listUsersMock },
    },
  },
}));

import MyUsageCard from '@/renderer/pages/settings/UsageSettings/MyUsageCard';
import AdminUsageTable from '@/renderer/pages/settings/UsageSettings/AdminUsageTable';
import LimitEditorModal from '@/renderer/pages/settings/UsageSettings/LimitEditorModal';

const baseUsage = {
  user_id: 'u_1',
  tokens_in: 1200,
  tokens_out: 800,
  cache_read: 300,
  cache_write: 100,
  cost_usd: 30,
  events: 7,
};
const meWith = (overrides: Partial<IUsageMe>): IUsageMe => ({
  usage: baseUsage,
  limit: null,
  since_ms: Date.now(),
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MyUsageCard', () => {
  it('renders spend, token breakdown, and a soft-limit warning', async () => {
    meMock.mockResolvedValue(
      meWith({ limit: { user_id: 'u_1', soft_usd: 25, hard_usd: 50, period: 'monthly', updated_at: 0 } })
    );
    render(<MyUsageCard />);

    await waitFor(() => expect(screen.getByText('$30.00')).toBeInTheDocument());
    // cost 30 >= soft 25 but < hard 50 → soft warning, not hard.
    expect(screen.getByText('settings.usage.softReached')).toBeInTheDocument();
    expect(screen.queryByText('settings.usage.hardReached')).not.toBeInTheDocument();
    // Token breakdown values present.
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
  });

  it('shows the hard-limit block message when over the hard limit', async () => {
    meMock.mockResolvedValue(
      meWith({
        usage: { ...baseUsage, cost_usd: 60 },
        limit: { user_id: 'u_1', soft_usd: 25, hard_usd: 50, period: 'monthly', updated_at: 0 },
      })
    );
    render(<MyUsageCard />);
    await waitFor(() => expect(screen.getByText('settings.usage.hardReached')).toBeInTheDocument());
  });

  it('indicates when no limit is set', async () => {
    meMock.mockResolvedValue(meWith({ limit: null }));
    render(<MyUsageCard />);
    await waitFor(() => expect(screen.getByText('settings.usage.noLimitSet')).toBeInTheDocument());
  });
});

describe('AdminUsageTable', () => {
  it('joins usage rows with usernames from the admin users list', async () => {
    const rows: IUsageSummary[] = [
      {
        user_id: 'u_1',
        tokens_in: 10,
        tokens_out: 5,
        cache_read: 0,
        cache_write: 0,
        cost_usd: 12,
        events: 2,
        limit: { soft_usd: 25, hard_usd: 50, period: 'monthly', updated_at: 0 },
      },
      {
        user_id: 'u_2',
        tokens_in: 1,
        tokens_out: 1,
        cache_read: 0,
        cache_write: 0,
        cost_usd: 99,
        events: 1,
        limit: null,
      },
    ];
    adminListMock.mockResolvedValue(rows);
    listUsersMock.mockResolvedValue([
      { id: 'u_1', username: 'maria-lopez' },
      { id: 'u_2', username: 'john-doe' },
    ]);
    render(<AdminUsageTable />);

    await waitFor(() => expect(screen.getByText('maria-lopez')).toBeInTheDocument());
    expect(screen.getByText('john-doe')).toBeInTheDocument();
    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.getByText('$99.00')).toBeInTheDocument();
    // Flattened limit shown as "soft / hard".
    expect(screen.getByText('$25.00 / $50.00')).toBeInTheDocument();
  });
});

describe('LimitEditorModal', () => {
  it('prefills from GET .../limit and saves the thresholds via PUT', async () => {
    const successSpy = vi.spyOn(Message, 'success').mockReturnValue('' as never);
    getLimitMock.mockResolvedValue({ user_id: 'u_1', soft_usd: 10, hard_usd: 50, period: 'monthly', updated_at: 1 });
    setLimitMock.mockResolvedValue({ user_id: 'u_1', soft_usd: 10, hard_usd: 50, period: 'monthly', updated_at: 2 });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<LimitEditorModal visible userId='u_1' username='maria-lopez' onClose={onClose} onSaved={onSaved} />);

    // Reads the authoritative limit on open, then the inputs render.
    await waitFor(() => expect(getLimitMock).toHaveBeenCalledWith({ id: 'u_1' }));
    await waitFor(() => expect(screen.getByText('settings.usage.softLabel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('settings.usage.limitSave'));
    await waitFor(() => expect(setLimitMock).toHaveBeenCalledWith({ id: 'u_1', soft_usd: 10, hard_usd: 50 }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    successSpy.mockRestore();
  });

  it('sends null thresholds when the user has no limit', async () => {
    const successSpy = vi.spyOn(Message, 'success').mockReturnValue('' as never);
    getLimitMock.mockResolvedValue(null);
    setLimitMock.mockResolvedValue({
      user_id: 'u_1',
      soft_usd: null,
      hard_usd: null,
      period: 'monthly',
      updated_at: 1,
    });
    render(<LimitEditorModal visible userId='u_1' username='maria-lopez' onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('settings.usage.softLabel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('settings.usage.limitSave'));
    await waitFor(() => expect(setLimitMock).toHaveBeenCalledWith({ id: 'u_1', soft_usd: null, hard_usd: null }));
    successSpy.mockRestore();
  });
});
