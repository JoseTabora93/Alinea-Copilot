/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Button, Dropdown, Menu, Message, Spin, Table, Tag } from '@arco-design/web-react';
import type { ColumnProps } from '@arco-design/web-react/es/Table';
import { Check, Edit, More, Plus, Refresh } from '@icon-park/react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import AionModal from '@/renderer/components/base/AionModal';
import type { IAdminRole, IAdminUser, UserRole } from '@/common/types/admin/userTypes';
import { useAdminUsers } from './useAdminUsers';
import { generateTempPassword } from './passwordUtils';
import InviteUserModal from './InviteUserModal';
import PasswordResultModal from './PasswordResultModal';
import LimitEditorModal from '../UsageSettings/LimitEditorModal';

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

const ROLE_TAG_COLOR = (role: string): string => (role === 'admin' ? 'arcoblue' : 'green');

/** Roles cell: chips for assigned roles + a dropdown editor to toggle roles (multi-role RBAC). */
const UserRolesCell: React.FC<{
  user: IAdminUser;
  catalog: IAdminRole[];
  onAssign: (id: string, role: UserRole) => Promise<UserRole[]>;
  onRemove: (id: string, role: UserRole) => Promise<UserRole[]>;
}> = ({ user, catalog, onAssign, onRemove }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const roles = user.roles ?? [];
  const labelOf = (name: string): string => catalog.find((r) => r.name === name)?.label ?? name;
  // Fall back to the assigned roles if the catalogue failed to load.
  const options: IAdminRole[] =
    catalog.length > 0 ? catalog : roles.map((r) => ({ id: r, name: r, label: r, created_at: 0 }));

  const toggle = async (role: UserRole) => {
    if (busyRole) return;
    setBusyRole(role);
    try {
      if (roles.includes(role)) await onRemove(user.id, role);
      else await onAssign(user.id, role);
    } catch (err) {
      if (isBackendHttpError(err) && err.status === 409) {
        Message.error(t('settings.users.lastAdminError'));
      } else {
        const backendMsg = isBackendHttpError(err) ? err.backendMessage : undefined;
        Message.error(backendMsg || (err instanceof Error ? err.message : t('settings.users.roleUpdateFailed')));
      }
    } finally {
      setBusyRole(null);
    }
  };

  const droplist = (
    <div className='py-4px min-w-200px rd-8px bg-base shadow-md border border-solid border-[var(--color-border-2)]'>
      {options.map((role) => {
        const assigned = roles.includes(role.name as UserRole);
        return (
          <div
            key={role.id || role.name}
            data-testid={`role-option-${user.id}-${role.name}`}
            className='flex items-center justify-between gap-8px px-12px py-7px text-13px cursor-pointer hover:bg-fill-2'
            onClick={() => void toggle(role.name as UserRole)}
          >
            <span className='text-t-primary'>{role.label}</span>
            {busyRole === role.name ? (
              <Spin size={12} />
            ) : assigned ? (
              <Check theme='outline' size='14' fill='var(--brand)' />
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className='flex items-center gap-6px flex-wrap'>
      {roles.length === 0 ? (
        <span className='text-12px text-t-tertiary'>{t('settings.users.noRoles')}</span>
      ) : (
        roles.map((r) => (
          <Tag key={r} color={ROLE_TAG_COLOR(r)} bordered size='small'>
            {labelOf(r)}
          </Tag>
        ))
      )}
      <Dropdown trigger='click' popupVisible={open} onVisibleChange={setOpen} droplist={droplist} position='bl'>
        <Button
          type='text'
          size='mini'
          icon={<Edit theme='outline' size='13' />}
          aria-label={t('settings.users.manageRoles')}
        />
      </Dropdown>
    </div>
  );
};

/** Admin user-management panel: list, invite, manage roles, activate/deactivate, reset password. */
const UsersPanel: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const {
    users,
    roleCatalog,
    loading,
    error,
    reload,
    createUser,
    updateUser,
    resetPassword,
    deleteUser,
    assignRole,
    removeRole,
  } = useAdminUsers();

  const [inviteVisible, setInviteVisible] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [resetTarget, setResetTarget] = useState<IAdminUser | null>(null);
  const [resetting, setResetting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IAdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [limitTarget, setLimitTarget] = useState<IAdminUser | null>(null);
  // Last-known limits per user (the API has no per-user limit read endpoint;
  // we cache values returned by PUT so reopening the editor prefills them).
  const [knownLimits, setKnownLimits] = useState<Record<string, { soft: number | null; hard: number | null }>>({});
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const record = deleteTarget;
    setDeleting(true);
    try {
      await deleteUser(record.id);
      setDeleteTarget(null);
      Message.success(t('settings.users.deletedMsg'));
    } catch (err) {
      Message.error(err instanceof Error ? err.message : t('settings.users.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const renderActions = (record: IAdminUser) => {
    const isSelf = record.id === currentUser?.id;
    const busy = pendingIds.has(record.id);
    // Self-protection (also enforced by the backend): an admin cannot
    // deactivate their own account.
    const disableDeactivate = isSelf && record.is_active;
    // The current admin and the seeded system account cannot be deleted.
    const disableDelete = isSelf || record.id === 'system_default_user';

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
        <Menu.Item key='set-limit' disabled={busy} onClick={() => setLimitTarget(record)}>
          {t('settings.usage.setLimit')}
        </Menu.Item>
        <Menu.Item key='reset-password' disabled={busy} onClick={() => setResetTarget(record)}>
          {t('settings.users.resetPassword')}
        </Menu.Item>
        <Menu.Item
          key='delete'
          disabled={busy || disableDelete}
          title={disableDelete ? t('settings.users.selfDeleteHint') : undefined}
          className='text-danger'
          onClick={() => setDeleteTarget(record)}
        >
          {t('settings.users.actionDelete')}
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
        title: t('settings.users.colRoles'),
        dataIndex: 'roles',
        width: 260,
        render: (_col, record) => (
          <UserRolesCell user={record} catalog={roleCatalog} onAssign={assignRole} onRemove={removeRole} />
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
  }, [t, currentUser?.id, pendingIds, roleCatalog, assignRole, removeRole]);

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

      <AionModal
        visible={Boolean(deleteTarget)}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
        maskClosable={false}
        style={{ width: 440, borderRadius: 16 }}
        contentStyle={{ background: 'var(--dialog-fill-0)', borderRadius: 16, padding: '20px 24px 16px' }}
        header={{ title: t('settings.users.deleteConfirmTitle'), showClose: true }}
        footer={
          <div className='flex justify-end gap-10px mt-10px'>
            <Button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className='px-20px min-w-80px'
              style={{ borderRadius: 8 }}
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type='primary'
              status='danger'
              loading={deleting}
              onClick={() => void handleConfirmDelete()}
              className='px-20px min-w-80px'
              style={{ borderRadius: 8 }}
            >
              {t('settings.users.deleteConfirmOk')}
            </Button>
          </div>
        }
      >
        <p className='text-14px text-t-secondary m-0'>
          {deleteTarget ? t('settings.users.deleteConfirmContent', { username: deleteTarget.username }) : ''}
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

      {limitTarget && (
        <LimitEditorModal
          visible={Boolean(limitTarget)}
          userId={limitTarget.id}
          username={limitTarget.username}
          initialSoft={knownLimits[limitTarget.id]?.soft ?? null}
          initialHard={knownLimits[limitTarget.id]?.hard ?? null}
          onClose={() => setLimitTarget(null)}
          onSaved={(limit) =>
            setKnownLimits((prev) => ({ ...prev, [limit.user_id]: { soft: limit.soft_usd, hard: limit.hard_usd } }))
          }
        />
      )}
    </div>
  );
};

export default UsersPanel;
