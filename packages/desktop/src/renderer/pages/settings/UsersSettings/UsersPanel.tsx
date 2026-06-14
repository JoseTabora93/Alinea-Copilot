/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Button, Dropdown, Menu, Message, Table, Tag } from '@arco-design/web-react';
import type { ColumnProps } from '@arco-design/web-react/es/Table';
import { More, Plus, Refresh } from '@icon-park/react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import AionModal from '@/renderer/components/base/AionModal';
import type { IAdminUser, UserRole } from '@/common/types/admin/userTypes';
import { useAdminUsers } from './useAdminUsers';
import { generateTempPassword } from './passwordUtils';
import InviteUserModal from './InviteUserModal';
import PasswordResultModal from './PasswordResultModal';

interface RevealState {
  title: string;
  description: string;
  username: string;
  password: string;
}

/** Format the `last_login` value (ISO string or epoch ms/seconds) for display. */
function formatLastLogin(value: IAdminUser['last_login']): string | null {
  if (value === null || value === undefined || value === '') return null;
  let input: string | number = value;
  if (typeof value === 'number' && value < 1e12) {
    // Heuristic: a 10-digit value is epoch seconds, not milliseconds.
    input = value * 1000;
  }
  const d = dayjs(input);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : null;
}

/** Admin user-management panel: list, invite, activate/deactivate, change role, reset password. */
const UsersPanel: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { users, loading, error, reload, createUser, updateUser, resetPassword } = useAdminUsers();

  const [inviteVisible, setInviteVisible] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [resetTarget, setResetTarget] = useState<IAdminUser | null>(null);
  const [resetting, setResetting] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const setPending = (id: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleActive = async (record: IAdminUser) => {
    const nextActive = !record.is_active;
    setPending(record.id, true);
    try {
      await updateUser(record.id, { is_active: nextActive });
      Message.success(nextActive ? t('settings.users.activatedMsg') : t('settings.users.deactivatedMsg'));
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.updateFailed'));
    } finally {
      setPending(record.id, false);
    }
  };

  const handleToggleRole = async (record: IAdminUser) => {
    const nextRole: UserRole = record.role === 'admin' ? 'member' : 'admin';
    setPending(record.id, true);
    try {
      await updateUser(record.id, { role: nextRole });
      Message.success(t('settings.users.roleUpdatedMsg'));
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.updateFailed'));
    } finally {
      setPending(record.id, false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    const record = resetTarget;
    const newPassword = generateTempPassword();
    setResetting(true);
    try {
      await resetPassword(record.id, newPassword);
      setResetTarget(null);
      setReveal({
        title: t('settings.users.resetPasswordTitle'),
        description: t('settings.users.resetPasswordDone', { username: record.username }),
        username: record.username,
        password: newPassword,
      });
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.resetFailed'));
    } finally {
      setResetting(false);
    }
  };

  const renderActions = (record: IAdminUser) => {
    const isSelf = record.id === currentUser?.id;
    const busy = pendingIds.has(record.id);
    // Self-protection (also enforced by the backend): an admin cannot
    // deactivate their own account nor demote their own admin role.
    const disableDeactivate = isSelf && record.is_active;
    const disableDemote = isSelf && record.role === 'admin';

    const droplist = (
      <Menu>
        <Menu.Item
          key='toggle-active'
          disabled={busy || disableDeactivate}
          title={disableDeactivate ? t('settings.users.selfDeactivateHint') : undefined}
          onClick={() => void handleToggleActive(record)}
        >
          {record.is_active ? t('settings.users.actionDeactivate') : t('settings.users.actionActivate')}
        </Menu.Item>
        <Menu.Item
          key='toggle-role'
          disabled={busy || disableDemote}
          title={disableDemote ? t('settings.users.selfDemoteHint') : undefined}
          onClick={() => void handleToggleRole(record)}
        >
          {record.role === 'admin' ? t('settings.users.actionMakeMember') : t('settings.users.actionMakeAdmin')}
        </Menu.Item>
        <Menu.Item key='reset-password' disabled={busy} onClick={() => setResetTarget(record)}>
          {t('settings.users.resetPassword')}
        </Menu.Item>
      </Menu>
    );

    return (
      <Dropdown droplist={droplist} trigger='click' position='br'>
        <Button type='text' size='small' icon={<More />} loading={busy} aria-label={t('settings.users.colActions')} />
      </Dropdown>
    );
  };

  const columns = useMemo<ColumnProps<IAdminUser>[]>(() => {
    return [
      {
        title: t('settings.users.colUser'),
        dataIndex: 'username',
        render: (_col, record) => <span className='text-14px font-500 text-t-primary'>{record.username}</span>,
      },
      {
        title: t('settings.users.colName'),
        dataIndex: 'display_name',
        render: (_col, record) => <span className='text-14px text-t-secondary'>{record.display_name || '—'}</span>,
      },
      {
        title: t('settings.users.colRole'),
        dataIndex: 'role',
        width: 120,
        render: (_col, record) => (
          <Tag color={record.role === 'admin' ? 'arcoblue' : 'gray'} bordered>
            {record.role === 'admin' ? t('settings.users.roleAdmin') : t('settings.users.roleMember')}
          </Tag>
        ),
      },
      {
        title: t('settings.users.colStatus'),
        dataIndex: 'is_active',
        width: 120,
        render: (_col, record) => (
          <Tag color={record.is_active ? 'green' : 'gray'} bordered>
            {record.is_active ? t('settings.users.statusActive') : t('settings.users.statusInactive')}
          </Tag>
        ),
      },
      {
        title: t('settings.users.colLastLogin'),
        dataIndex: 'last_login',
        width: 160,
        render: (_col, record) => {
          const formatted = formatLastLogin(record.last_login);
          return <span className='text-13px text-t-tertiary'>{formatted ?? t('settings.users.neverLoggedIn')}</span>;
        },
      },
      {
        title: t('settings.users.colActions'),
        dataIndex: 'actions',
        width: 90,
        align: 'right',
        render: (_col, record) => renderActions(record),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, currentUser?.id, pendingIds]);

  return (
    <div className='flex flex-col gap-16px'>
      <div className='flex items-start justify-between gap-16px'>
        <div className='flex flex-col gap-4px'>
          <h2 className='text-18px font-600 text-t-primary m-0'>{t('settings.users.title')}</h2>
          <p className='text-14px text-t-secondary m-0'>{t('settings.users.subtitle')}</p>
        </div>
        <div className='flex items-center gap-8px shrink-0'>
          <Button
            type='text'
            icon={<Refresh />}
            onClick={() => void reload()}
            loading={loading}
            title={t('settings.users.refresh')}
          />
          <Button type='primary' icon={<Plus />} onClick={() => setInviteVisible(true)} style={{ borderRadius: 8 }}>
            {t('settings.users.invite')}
          </Button>
        </div>
      </div>

      {error ? (
        <div className='flex flex-col items-center justify-center gap-12px py-48px rd-12px bg-fill-1'>
          <span className='text-14px text-t-secondary'>{t('settings.users.loadFailed')}</span>
          <span className='text-12px text-t-tertiary break-all max-w-480px text-center'>{error}</span>
          <Button type='outline' onClick={() => void reload()} style={{ borderRadius: 8 }}>
            {t('settings.users.retry')}
          </Button>
        </div>
      ) : (
        <Table<IAdminUser>
          rowKey='id'
          columns={columns}
          data={users}
          loading={loading}
          pagination={users.length > 20 ? { pageSize: 20, sizeCanChange: false } : false}
          border={{ wrapper: true, cell: false }}
          noDataElement={t('settings.users.empty')}
        />
      )}

      <InviteUserModal
        visible={inviteVisible}
        onCancel={() => setInviteVisible(false)}
        onCreate={async (req) => {
          await createUser(req);
        }}
        onSuccess={(username, password) => {
          setInviteVisible(false);
          setReveal({
            title: t('settings.users.createdTitle'),
            description: t('settings.users.createdDone', { username }),
            username,
            password,
          });
        }}
      />

      <AionModal
        visible={Boolean(resetTarget)}
        onCancel={() => (resetting ? undefined : setResetTarget(null))}
        maskClosable={false}
        style={{ width: 440, borderRadius: 16 }}
        contentStyle={{ background: 'var(--dialog-fill-0)', borderRadius: 16, padding: '20px 24px 16px' }}
        header={{ title: t('settings.users.resetConfirmTitle'), showClose: true }}
        footer={
          <div className='flex justify-end gap-10px mt-10px'>
            <Button
              onClick={() => setResetTarget(null)}
              disabled={resetting}
              className='px-20px min-w-80px'
              style={{ borderRadius: 8 }}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type='primary'
              status='warning'
              loading={resetting}
              onClick={() => void handleConfirmReset()}
              className='px-20px min-w-80px'
              style={{ borderRadius: 8 }}
            >
              {t('settings.users.resetConfirmOk')}
            </Button>
          </div>
        }
      >
        <p className='text-14px text-t-secondary m-0'>
          {resetTarget ? t('settings.users.resetConfirmContent', { username: resetTarget.username }) : ''}
        </p>
      </AionModal>

      <PasswordResultModal
        visible={Boolean(reveal)}
        title={reveal?.title ?? ''}
        description={reveal?.description ?? ''}
        username={reveal?.username ?? ''}
        password={reveal?.password ?? ''}
        onClose={() => setReveal(null)}
      />
    </div>
  );
};

export default UsersPanel;
