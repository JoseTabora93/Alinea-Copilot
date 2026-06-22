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

/**
 * User roles recognized by the backend (multi-role RBAC, Fase 2 #5).
 * A user can hold several of these at once.
 */
export type UserRole = 'admin' | 'gerencia' | 'tecnica' | 'comercial' | 'financiera' | 'ingenieria';

/** Role catalogue row from `GET /api/admin/roles` (source of truth for the chips). */
export interface IAdminRole {
  id: string;
  /** Stable role key, e.g. `gerencia`. */
  name: string;
  /** Human label, e.g. `Gerencia`. */
  label: string;
  created_at: number;
}

/**
 * Public user info returned by the backend. Mirrors the production `User`
 * payload. Never includes password hashes or secrets.
 */
export interface IAdminUser {
  id: string;
  username: string;
  /** Multi-role RBAC: the roles assigned to this user (Fase 2 #5). */
  roles?: UserRole[];
  email?: string | null;
  /** ISO string or epoch (ms/seconds); absent/null when the user never logged in. */
  last_login?: string | number | null;
  created_at?: string | number | null;
  /** @deprecated legacy single-role / status fields (pre-Fase 2). Optional for back-compat. */
  role?: UserRole;
  is_active?: boolean;
  display_name?: string | null;
}

/** Request body for `POST /api/admin/users`. */
export interface IAdminCreateUserRequest {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
  /** @deprecated roles are assigned after creation via the roles endpoints (multi-role RBAC). */
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
