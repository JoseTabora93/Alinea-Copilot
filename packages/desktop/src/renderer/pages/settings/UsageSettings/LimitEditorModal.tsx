/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Button, InputNumber, Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import AionModal from '@/renderer/components/base/AionModal';
import type { IUsageLimit } from '@/common/types/admin/usageTypes';

interface LimitEditorModalProps {
  visible: boolean;
  userId: string;
  username: string;
  /** Last-known thresholds to prefill (the API has no per-user limit read endpoint). */
  initialSoft: number | null;
  initialHard: number | null;
  onClose: () => void;
  onSaved: (limit: IUsageLimit) => void;
}

/** Admin modal to set a user's soft/hard USD spend thresholds (`PUT .../limit`). */
const LimitEditorModal: React.FC<LimitEditorModalProps> = ({
  visible,
  userId,
  username,
  initialSoft,
  initialHard,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [soft, setSoft] = useState<number | null>(initialSoft);
  const [hard, setHard] = useState<number | null>(initialHard);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSoft(initialSoft);
      setHard(initialHard);
    }
  }, [visible, initialSoft, initialHard]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const limit = await ipcBridge.usage.setLimit.invoke({
        id: userId,
        soft_usd: soft ?? null,
        hard_usd: hard ?? null,
      });
      Message.success(t('settings.usage.limitSaved'));
      onSaved(limit);
      onClose();
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.usage.limitSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={() => (saving ? undefined : onClose())}
      maskClosable={false}
      style={{ width: 460, borderRadius: 16 }}
      contentStyle={{ background: 'var(--dialog-fill-0)', borderRadius: 16, padding: '20px 24px 16px' }}
      header={{ title: t('settings.usage.limitTitle', { username }), showClose: true }}
      footer={
        <div className='flex justify-end gap-10px mt-10px'>
          <Button onClick={onClose} disabled={saving} className='px-20px min-w-80px' style={{ borderRadius: 8 }}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type='primary'
            loading={saving}
            onClick={() => void handleSave()}
            className='px-20px min-w-80px'
            style={{ borderRadius: 8 }}
          >
            {t('settings.usage.limitSave')}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col gap-16px'>
        <p className='text-13px text-t-tertiary m-0'>{t('settings.usage.limitHint')}</p>
        <div className='flex flex-col gap-6px'>
          <span className='text-13px text-t-secondary'>{t('settings.usage.softLabel')}</span>
          <InputNumber
            value={soft ?? undefined}
            onChange={(v) => setSoft(typeof v === 'number' ? v : null)}
            min={0}
            precision={2}
            step={1}
            placeholder={t('settings.usage.thresholdPlaceholder')}
            prefix='$'
            style={{ width: '100%' }}
          />
        </div>
        <div className='flex flex-col gap-6px'>
          <span className='text-13px text-t-secondary'>{t('settings.usage.hardLabel')}</span>
          <InputNumber
            value={hard ?? undefined}
            onChange={(v) => setHard(typeof v === 'number' ? v : null)}
            min={0}
            precision={2}
            step={1}
            placeholder={t('settings.usage.thresholdPlaceholder')}
            prefix='$'
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </AionModal>
  );
};

export default LimitEditorModal;
