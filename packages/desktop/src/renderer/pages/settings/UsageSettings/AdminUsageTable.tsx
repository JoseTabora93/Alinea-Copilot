/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Button, Table } from '@arco-design/web-react';
import type { ColumnProps } from '@arco-design/web-react/es/Table';
import { Refresh } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { type AdminUsageRow, formatInt, formatUsd, useAdminUsage } from './useUsage';

/** Admin-only overview: consumption per user over the active window. */
const AdminUsageTable: React.FC = () => {
  const { t } = useTranslation();
  const { rows, loading, error, reload } = useAdminUsage(true);

  // Highest spenders first.
  const sorted = useMemo(() => [...rows].toSorted((a, b) => b.cost_usd - a.cost_usd), [rows]);

  const columns = useMemo<ColumnProps<AdminUsageRow>[]>(
    () => [
      {
        title: t('settings.usage.colUser'),
        dataIndex: 'username',
        render: (_c, r) => <span className='text-14px font-500 text-t-primary'>{r.username}</span>,
      },
      {
        title: t('settings.usage.colCost'),
        dataIndex: 'cost_usd',
        width: 120,
        align: 'right',
        render: (_c, r) => formatUsd(r.cost_usd),
      },
      {
        title: t('settings.usage.colLimit'),
        dataIndex: 'limit',
        width: 140,
        align: 'right',
        render: (_c, r) => {
          const lim = r.limit;
          if (!lim || (lim.soft_usd === null && lim.hard_usd === null))
            return <span className='text-t-tertiary'>—</span>;
          return (
            <span className='text-13px text-t-secondary'>
              {formatUsd(lim.soft_usd)} / {formatUsd(lim.hard_usd)}
            </span>
          );
        },
      },
      {
        title: t('settings.usage.tokensIn'),
        dataIndex: 'tokens_in',
        width: 120,
        align: 'right',
        render: (_c, r) => formatInt(r.tokens_in),
      },
      {
        title: t('settings.usage.tokensOut'),
        dataIndex: 'tokens_out',
        width: 120,
        align: 'right',
        render: (_c, r) => formatInt(r.tokens_out),
      },
      {
        title: t('settings.usage.events'),
        dataIndex: 'events',
        width: 100,
        align: 'right',
        render: (_c, r) => formatInt(r.events),
      },
    ],
    [t]
  );

  return (
    <div className='flex flex-col gap-12px'>
      <div className='flex items-center justify-between gap-16px'>
        <div className='flex flex-col gap-4px'>
          <h3 className='text-16px font-600 text-t-primary m-0'>{t('settings.usage.adminTitle')}</h3>
          <p className='text-13px text-t-secondary m-0'>{t('settings.usage.adminSubtitle')}</p>
        </div>
        <Button
          type='text'
          icon={<Refresh />}
          onClick={() => void reload()}
          loading={loading}
          title={t('settings.usage.refresh')}
        />
      </div>

      {error ? (
        <div className='flex flex-col items-center justify-center gap-12px py-32px rd-12px bg-fill-1'>
          <span className='text-13px text-t-tertiary break-all max-w-480px text-center'>{error}</span>
          <Button type='outline' onClick={() => void reload()} style={{ borderRadius: 8 }}>
            {t('settings.usage.retry')}
          </Button>
        </div>
      ) : (
        <Table<AdminUsageRow>
          rowKey='user_id'
          columns={columns}
          data={sorted}
          loading={loading}
          pagination={sorted.length > 20 ? { pageSize: 20, sizeCanChange: false } : false}
          border={{ wrapper: true, cell: false }}
          noDataElement={t('settings.usage.empty')}
        />
      )}
    </div>
  );
};

export default AdminUsageTable;
