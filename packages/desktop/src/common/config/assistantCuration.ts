/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Assistant curation for the MEP-engineering product.
 *
 * These built-in assistants are entertainment / roleplay / social and are
 * hidden by default from the home and Team Leader selectors. They are NOT
 * removed from the runtime/seed — an admin can re-show them from
 * Settings → Assistants ("Show hidden assistants").
 *
 * IDs mirror the backend builtin preset ids (see migrateAssistants.ts).
 */
export const DEFAULT_HIDDEN_ASSISTANT_IDS: ReadonlySet<string> = new Set([
  'game-3d',
  'story-roleplay',
  'social-job-publisher',
  'moltbook',
]);

/** True when an assistant id is hidden by default in the selectors. */
export function isAssistantHiddenByDefault(id: string | undefined | null): boolean {
  return id != null && DEFAULT_HIDDEN_ASSISTANT_IDS.has(id);
}
