/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Message } from '@arco-design/web-react';
import { Copy, Refresh } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import AionModal from '@/renderer/components/base/AionModal';
import { copyText } from '@/renderer/utils/ui/clipboard';
import type { IAdminCreateUserRequest } from '@/common/types/admin/userTypes';
import { generateTempPassword } from './passwordUtils';

const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;

interface InviteUserModalProps {
  visible: boolean;
  onCancel: () => void;
  /** Resolves to the created user's temp password so the parent can reveal it. */
  onCreate: (req: IAdminCreateUserRequest) => Promise<void>;
  onSuccess: (username: string, password: string) => void;
}

interface InviteFormValues {
  username: string;
  display_name?: string;
  email?: string;
}

/** Modal for inviting (creating) a new user with an auto-generated temp password. */
const InviteUserModal: React.FC<InviteUserModalProps> = ({ visible, onCancel, onCreate, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<InviteFormValues>();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Generate a fresh temp password whenever the modal opens.
  useEffect(() => {
    if (visible) {
      setPassword(generateTempPassword());
      form.resetFields();
    }
  }, [visible, form]);

  const handleCopyPassword = async () => {
    try {
      await copyText(password);
      Message.success(t('settings.users.passwordCopied'));
    } catch {
      Message.error(t('common.copyFailed', { defaultValue: 'Failed to copy' }));
    }
  };

  const handleSubmit = async () => {
    let values: InviteFormValues;
    try {
      values = await form.validate();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const req: IAdminCreateUserRequest = {
        username: values.username.trim(),
        password,
      };
      const displayName = values.display_name?.trim();
      const email = values.email?.trim();
      if (displayName) req.display_name = displayName;
      if (email) req.email = email;

      await onCreate(req);
      onSuccess(req.username, password);
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={onCancel}
      maskClosable={false}
      style={{ width: 520, borderRadius: 16 }}
      contentStyle={{ background: 'var(--dialog-fill-0)', borderRadius: 16, padding: '20px 24px 16px' }}
      header={{ title: t('settings.users.inviteTitle'), showClose: true }}
      footer={
        <div className='flex justify-end gap-10px mt-10px'>
          <Button onClick={onCancel} className='px-20px min-w-80px' style={{ borderRadius: 8 }}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type='primary'
            loading={submitting}
            onClick={handleSubmit}
            className='px-20px min-w-80px'
            style={{ borderRadius: 8 }}
          >
            {t('settings.users.createUser')}
          </Button>
        </div>
      }
    >
      <Form form={form} layout='vertical' requiredSymbol={false}>
        <Form.Item
          label={t('settings.users.fieldUsername')}
          field='username'
          rules={[
            { required: true, message: t('settings.users.usernameRequired') },
            { minLength: 3, maxLength: 32, message: t('settings.users.usernameLength') },
            { match: USERNAME_PATTERN, message: t('settings.users.usernameFormat') },
          ]}
        >
          <Input placeholder={t('settings.users.usernamePlaceholder')} autoComplete='off' />
        </Form.Item>

        <Form.Item label={t('settings.users.fieldDisplayName')} field='display_name'>
          <Input placeholder={t('settings.users.displayNamePlaceholder')} autoComplete='off' />
        </Form.Item>

        <Form.Item
          label={t('settings.users.fieldEmail')}
          field='email'
          rules={[{ type: 'email', message: t('settings.users.emailInvalid') }]}
        >
          <Input placeholder={t('settings.users.emailPlaceholder')} autoComplete='off' />
        </Form.Item>

        <p className='text-12px text-t-tertiary mt-0 mb-12px'>
          {t('settings.users.rolesAfterCreateHint', { defaultValue: 'Assign roles after creating the user.' })}
        </p>

        <Form.Item label={t('settings.users.temporaryPassword')}>
          <div className='flex items-center gap-8px'>
            <code className='flex-1 px-12px py-8px rd-8px bg-fill-2 text-14px font-mono text-t-primary break-all select-all'>
              {password}
            </code>
            <Button
              type='text'
              icon={<Refresh />}
              onClick={() => setPassword(generateTempPassword())}
              title={t('settings.users.regeneratePassword')}
            />
            <Button
              type='text'
              icon={<Copy />}
              onClick={handleCopyPassword}
              title={t('common.copy', { defaultValue: 'Copy' })}
            />
          </div>
          <p className='text-12px text-t-tertiary mt-4px mb-0'>{t('settings.users.invitePasswordHint')}</p>
        </Form.Item>
      </Form>
    </AionModal>
  );
};

export default InviteUserModal;
