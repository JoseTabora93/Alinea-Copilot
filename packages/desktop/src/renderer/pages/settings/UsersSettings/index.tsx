/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import UsersPanel from './UsersPanel';

/**
 * User administration page (`/settings/users`).
 *
 * Admin-only: non-admin accounts are redirected to `/guid`. Authentication
 * itself is already enforced by the parent `ProtectedLayout`, so here we only
 * gate on the `admin` role.
 */
const UsersSettings: React.FC = () => {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to='/guid' replace />;
  }

  return (
    <SettingsPageWrapper>
      <UsersPanel />
    </SettingsPageWrapper>
  );
};

export default UsersSettings;
