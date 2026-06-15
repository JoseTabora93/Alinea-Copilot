/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Multi-user admin types.
 *
 * Mirrors the backend `aionui-api-types` auth contract for the admin user
 * management endpoints (`/api/admin/users`). Field names use snake_case to
 * match the JSON the Rust backend serializes/deserializes.
 */

/** User roles recognized by the backend. */
export type UserRole = 'admin' | 'member';

/**
 * Public user info returned by the backend. Mirrors the production `User`
 * payload. Never includes password hashes or secrets.
 */
export interface IAdminUser {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  display_name: string | null;
  email?: string | null;
  /** ISO string or epoch (ms/seconds); absent/null when the user never logged in. */
  last_login?: string | number | null;
  created_at?: string | number | null;
}

/** Request body for `POST /api/admin/users`. */
export interface IAdminCreateUserRequest {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
  /** Defaults to `member` on the backend when absent. */
  role?: UserRole;
}

/** Request body for `PATCH /api/admin/users/:id`. Only present fields are updated. */
export interface IAdminUpdateUserRequest {
  is_active?: boolean;
  role?: UserRole;
  display_name?: string;
}

/** Request body for `POST /api/admin/users/:id/reset-password`. */
export interface IAdminResetPasswordRequest {
  new_password: string;
}
