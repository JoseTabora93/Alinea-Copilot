/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Alert, Button, Progress } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { formatInt, formatUsd, useMyUsage } from './useUsage';

/** A labelled metric tile used in the token breakdown grid. */
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className='flex flex-col gap-2px px-14px py-12px rd-10px bg-fill-1'>
    <span className='text-12px text-t-tertiary'>{label}</span>
    <span className='text-16px font-600 text-t-primary'>{value}</span>
  </div>
);

/** "My usage" card: spend for the period, limit progress, and token breakdown. */
const MyUsageCard: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useMyUsage();

  const usage = data?.usage;
  const limit = data?.limit ?? null;
  const cost = usage?.cost_usd ?? 0;
  const hard = limit?.hard_usd ?? null;
  const soft = limit?.soft_usd ?? null;

  const overHard = hard !== null && cost >= hard;
  const overSoft = soft !== null && cost >= soft;
  const pct = hard !== null && hard > 0 ? Math.min(100, Math.round((cost / hard) * 100)) : null;
  const progressStatus: 'success' | 'warning' | 'error' = overHard ? 'error' : overSoft ? 'warning' : 'success';

  return (
    <div className='flex flex-col gap-16px'>
      <div className='flex items-start justify-between gap-16px'>
        <div className='flex flex-col gap-4px'>
          <h2 className='text-18px font-600 text-t-primary m-0'>{t('settings.usage.title')}</h2>
          <p className='text-14px text-t-secondary m-0'>{t('settings.usage.subtitle')}</p>
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
        <div className='flex flex-col items-center justify-center gap-12px py-40px rd-12px bg-fill-1'>
          <span className='text-14px text-t-secondary'>{t('settings.usage.loadFailed')}</span>
          <span className='text-12px text-t-tertiary break-all max-w-480px text-center'>{error}</span>
          <Button type='outline' onClick={() => void reload()} style={{ borderRadius: 8 }}>
            {t('settings.usage.retry')}
          </Button>
        </div>
      ) : (
        <>
          <div className='flex flex-col gap-12px p-20px rd-12px bg-fill-1'>
            <span className='text-13px text-t-tertiary'>{t('settings.usage.spendThisPeriod')}</span>
            <div className='flex items-end gap-10px'>
              <span className='text-32px font-700 text-t-primary leading-none'>{formatUsd(cost)}</span>
              {hard !== null && <span className='text-14px text-t-tertiary mb-2px'>/ {formatUsd(hard)}</span>}
            </div>
            {pct !== null && <Progress percent={pct} status={progressStatus} showText={false} />}
            {overHard ? (
              <Alert type='error' content={t('settings.usage.hardReached')} />
            ) : overSoft ? (
              <Alert type='warning' content={t('settings.usage.softReached')} />
            ) : null}
            {limit === null && <span className='text-12px text-t-tertiary'>{t('settings.usage.noLimitSet')}</span>}
          </div>

          <div className='grid grid-cols-2 md:grid-cols-3 gap-10px'>
            <Stat label={t('settings.usage.tokensIn')} value={formatInt(usage?.tokens_in)} />
            <Stat label={t('settings.usage.tokensOut')} value={formatInt(usage?.tokens_out)} />
            <Stat label={t('settings.usage.events')} value={formatInt(usage?.events)} />
            <Stat label={t('settings.usage.cacheRead')} value={formatInt(usage?.cache_read)} />
            <Stat label={t('settings.usage.cacheWrite')} value={formatInt(usage?.cache_write)} />
          </div>

          <p className='text-12px text-t-tertiary m-0'>{t('settings.usage.estimateNote')}</p>
        </>
      )}
    </div>
  );
};

export default MyUsageCard;
