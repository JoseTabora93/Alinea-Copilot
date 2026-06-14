/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Button, Message, Select, Switch, Table, Tag } from '@arco-design/web-react';
import type { ColumnProps } from '@arco-design/web-react/es/Table';
import { Lock, Plus, Refresh } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
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

/** Admin user-management panel: list, invite, toggle activation, change role, reset password. */
const UsersPanel: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { users, loading, error, reload, createUser, updateUser, resetPassword } = useAdminUsers();

  const [inviteVisible, setInviteVisible] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const setPending = (id: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleActive = async (record: IAdminUser, isActive: boolean) => {
    setPending(record.id, true);
    try {
      await updateUser(record.id, { is_active: isActive });
      Message.success(isActive ? t('settings.users.activatedMsg') : t('settings.users.deactivatedMsg'));
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.updateFailed'));
    } finally {
      setPending(record.id, false);
    }
  };

  const handleChangeRole = async (record: IAdminUser, role: UserRole) => {
    if (role === record.role) return;
    setPending(record.id, true);
    try {
      await updateUser(record.id, { role });
      Message.success(t('settings.users.roleUpdatedMsg'));
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.updateFailed'));
    } finally {
      setPending(record.id, false);
    }
  };

  const handleResetPassword = async (record: IAdminUser) => {
    const newPassword = generateTempPassword();
    setPending(record.id, true);
    try {
      await resetPassword(record.id, newPassword);
      setReveal({
        title: t('settings.users.resetPasswordTitle'),
        description: t('settings.users.resetPasswordDone', { username: record.username }),
        username: record.username,
        password: newPassword,
      });
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.resetFailed'));
    } finally {
      setPending(record.id, false);
    }
  };

  const columns = useMemo<ColumnProps<IAdminUser>[]>(() => {
    return [
      {
        title: t('settings.users.colUser'),
        dataIndex: 'username',
        render: (_col, record) => (
          <div className='flex flex-col'>
            <span className='text-14px font-500 text-t-primary'>{record.username}</span>
            {record.display_name ? <span className='text-12px text-t-tertiary'>{record.display_name}</span> : null}
          </div>
        ),
      },
      {
        title: t('settings.users.colRole'),
        dataIndex: 'role',
        width: 150,
        render: (_col, record) => {
          const isSelf = record.id === currentUser?.id;
          return (
            <Select
              size='small'
              value={record.role}
              disabled={isSelf || pendingIds.has(record.id)}
              onChange={(value) => handleChangeRole(record, value as UserRole)}
              options={[
                { label: t('settings.users.roleAdmin'), value: 'admin' },
                { label: t('settings.users.roleMember'), value: 'member' },
              ]}
              style={{ width: 120 }}
            />
          );
        },
      },
      {
        title: t('settings.users.colStatus'),
        dataIndex: 'is_active',
        width: 140,
        render: (_col, record) => {
          const isSelf = record.id === currentUser?.id;
          return (
            <div className='flex items-center gap-8px'>
              <Switch
                size='small'
                checked={record.is_active}
                disabled={isSelf || pendingIds.has(record.id)}
                onChange={(checked) => handleToggleActive(record, checked)}
              />
              <Tag color={record.is_active ? 'green' : 'gray'} bordered>
                {record.is_active ? t('settings.users.statusActive') : t('settings.users.statusInactive')}
              </Tag>
            </div>
          );
        },
      },
      {
        title: t('settings.users.colLastLogin'),
        dataIndex: 'last_login',
        width: 140,
        render: () => <span className='text-13px text-t-tertiary'>—</span>,
      },
      {
        title: t('settings.users.colActions'),
        dataIndex: 'actions',
        width: 170,
        align: 'right',
        render: (_col, record) => (
          <Button
            size='small'
            type='outline'
            icon={<Lock />}
            loading={pendingIds.has(record.id)}
            onClick={() => handleResetPassword(record)}
            style={{ borderRadius: 8 }}
          >
            {t('settings.users.resetPassword')}
          </Button>
        ),
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
