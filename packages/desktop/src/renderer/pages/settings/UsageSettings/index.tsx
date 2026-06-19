/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Divider } from '@arco-design/web-react';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import MyUsageCard from './MyUsageCard';
import AdminUsageTable from './AdminUsageTable';

/**
 * Usage page (`/settings/usage`).
 *
 * Available to any authenticated user (own consumption). Admins additionally
 * see a per-user consumption overview. Authentication is enforced by the parent
 * `ProtectedLayout`.
 */
const UsageSettings: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-24px'>
        <MyUsageCard />
        {isAdmin && (
          <>
            <Divider style={{ margin: 0 }} />
            <AdminUsageTable />
          </>
        )}
      </div>
    </SettingsPageWrapper>
  );
};

export default UsageSettings;
