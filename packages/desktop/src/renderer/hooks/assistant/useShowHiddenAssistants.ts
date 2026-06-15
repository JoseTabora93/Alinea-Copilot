/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Admin-facing preference controlling whether the default-hidden (entertainment)
 * assistants are shown in the home / Team Leader selectors. Persisted in
 * localStorage and synced across mounted components via a custom event.
 */
const STORAGE_KEY = 'alinea:assistants:showHidden';
const EVENT = 'alinea:assistants:showHidden-changed';

function read(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useShowHiddenAssistants(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribe, read, () => false);
  const setValue = useCallback((next: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(EVENT));
    }
  }, []);
  return [value, setValue];
}
