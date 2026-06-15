/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Button, Message } from '@arco-design/web-react';
import { Copy } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import AionModal from '@/renderer/components/base/AionModal';
import { copyText } from '@/renderer/utils/ui/clipboard';

interface PasswordResultModalProps {
  visible: boolean;
  /** Modal title (e.g. "User created" / "Password reset"). */
  title: string;
  /** Short explanation shown above the credentials. */
  description: string;
  username: string;
  password: string;
  onClose: () => void;
}

/**
 * Reveals a freshly generated temporary password exactly once, with a copy
 * button. Shared by the invite flow and the per-row reset-password action —
 * the backend only ever returns the bcrypt hash afterwards, so this is the
 * single chance for the admin to capture the plaintext value.
 */
const PasswordResultModal: React.FC<PasswordResultModalProps> = ({
  visible,
  title,
  description,
  username,
  password,
  onClose,
}) => {
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await copyText(password);
      Message.success(t('settings.users.passwordCopied'));
    } catch {
      Message.error(t('common.copyFailed', { defaultValue: 'Failed to copy' }));
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={onClose}
      maskClosable={false}
      style={{ width: 460, borderRadius: 16 }}
      contentStyle={{ background: 'var(--dialog-fill-0)', borderRadius: 16, padding: '20px 24px 16px' }}
      header={{ title, showClose: true }}
      footer={
        <div className='flex justify-end mt-10px'>
          <Button type='primary' onClick={onClose} className='px-20px min-w-80px' style={{ borderRadius: 8 }}>
            {t('settings.users.done')}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col gap-16px'>
        <p className='text-14px text-t-secondary m-0'>{description}</p>

        <div className='flex flex-col gap-4px'>
          <span className='text-12px text-t-tertiary'>{t('settings.users.fieldUsername')}</span>
          <span className='text-14px font-500 text-t-primary'>{username}</span>
        </div>

        <div className='flex flex-col gap-4px'>
          <span className='text-12px text-t-tertiary'>{t('settings.users.temporaryPassword')}</span>
          <div className='flex items-center gap-8px'>
            <code className='flex-1 px-12px py-8px rd-8px bg-fill-2 text-14px font-mono text-t-primary break-all select-all'>
              {password}
            </code>
            <Button type='outline' icon={<Copy />} onClick={handleCopy} style={{ borderRadius: 8 }}>
              {t('common.copy', { defaultValue: 'Copy' })}
            </Button>
          </div>
        </div>

        <p className='text-12px text-t-tertiary m-0'>{t('settings.users.passwordRevealHint')}</p>
      </div>
    </AionModal>
  );
};

export default PasswordResultModal;
