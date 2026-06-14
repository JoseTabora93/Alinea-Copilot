/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Temporary-password generation for admin-created accounts.
 *
 * The backend create/reset endpoints require the caller to supply the password
 * (`AdminCreateUserRequest.password`, `AdminResetPasswordRequest.new_password`).
 * The admin UI generates a strong random temporary password, sends it, and then
 * reveals it once so the admin can hand it to the new user.
 *
 * Backend `validate_password` rules (aionui-auth): length 8-128 and not in a
 * small weak-password blacklist. The generated value below is 16 chars drawn
 * from all four character classes, so it always passes.
 */

// Ambiguous characters (O/0, l/1/I) are excluded to make the password easy to
// read aloud / transcribe when handing it to a new user.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*?-_';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

const TEMP_PASSWORD_LENGTH = 16;

function randomInt(maxExclusive: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    // Reject-sample to avoid modulo bias.
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    let value = 0;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

/** Generate a strong temporary password guaranteed to satisfy backend validation. */
export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(pick(ALL));
  }
  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the required chars aren't always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
