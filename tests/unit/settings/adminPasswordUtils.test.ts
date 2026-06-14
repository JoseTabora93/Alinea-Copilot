/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { generateTempPassword } from '@/renderer/pages/settings/UsersSettings/passwordUtils';

// Backend `validate_password` blacklist (aionui-auth/validation.rs).
const WEAK_PASSWORDS = ['password', '12345678', '123456789', 'qwertyui', 'abcdefgh'];

describe('generateTempPassword', () => {
  it('defaults to a 16-character password', () => {
    expect(generateTempPassword()).toHaveLength(16);
  });

  it('respects a custom length', () => {
    expect(generateTempPassword(24)).toHaveLength(24);
  });

  it('satisfies backend password rules (length 8-128, not weak)', () => {
    for (let i = 0; i < 200; i++) {
      const pwd = generateTempPassword();
      expect(pwd.length).toBeGreaterThanOrEqual(8);
      expect(pwd.length).toBeLessThanOrEqual(128);
      expect(WEAK_PASSWORDS).not.toContain(pwd.toLowerCase());
    }
  });

  it('includes lowercase, uppercase, digit, and symbol', () => {
    for (let i = 0; i < 100; i++) {
      const pwd = generateTempPassword();
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/[0-9]/);
      expect(pwd).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('produces unique values across calls', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTempPassword()));
    expect(set.size).toBe(50);
  });
});
