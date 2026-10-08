import { useCallback, useEffect, useState } from 'react';

export const PREFERENCES_STORAGE_KEY = 'pager.preferences.v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  density: 'comfortable',
  sidebarPosition: 'left',
  reduceMotion: false,
  enterToSend: true,
  desktopNotifications: false,
  cameraDeviceId: '',
  microphoneDeviceId: '',
});

const allowedDensity = new Set(['comfortable', 'compact']);
const allowedSidebarPositions = new Set(['left', 'right']);

function normalizePreferences(value = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    density: allowedDensity.has(value.density) ? value.density : DEFAULT_PREFERENCES.density,
    sidebarPosition: allowedSidebarPositions.has(value.sidebarPosition)
      ? value.sidebarPosition
      : DEFAULT_PREFERENCES.sidebarPosition,
    reduceMotion: value.reduceMotion === true,
    enterToSend: value.enterToSend !== false,
    desktopNotifications: value.desktopNotifications === true,
    cameraDeviceId: typeof value.cameraDeviceId === 'string' ? value.cameraDeviceId : '',
    microphoneDeviceId:
      typeof value.microphoneDeviceId === 'string' ? value.microphoneDeviceId : '',
  };
}

export function loadPreferences() {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };

  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) || '{}');
    const legacySidebarPosition = window.localStorage.getItem('chatSidebarPosition');
    return normalizePreferences({
      ...stored,
      sidebarPosition: stored.sidebarPosition || legacySidebarPosition,
    });
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function applyPreferences(preferences) {
  if (typeof document === 'undefined') return;
  const normalized = normalizePreferences(preferences);

  document.body.dataset.uiDensity = normalized.density;
  document.body.dataset.sidebarPosition = normalized.sidebarPosition;
  document.body.dataset.reduceMotion = String(normalized.reduceMotion);
}

export function savePreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  if (typeof window === 'undefined') return normalized;

  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.setItem('chatSidebarPosition', normalized.sidebarPosition);
  } catch {
    // Настройки продолжают работать в текущей вкладке даже без localStorage.
  }

  applyPreferences(normalized);
  window.dispatchEvent(new CustomEvent('pager:preferences-changed', { detail: normalized }));
  return normalized;
}

export function updateStoredPreference(key, value) {
  return savePreferences({ ...loadPreferences(), [key]: value });
}

export function isEnterToSendEnabled() {
  return loadPreferences().enterToSend;
}

export function isDesktopNotificationsEnabled() {
  return loadPreferences().desktopNotifications;
}

export function usePreferences() {
  const [preferences, setPreferencesState] = useState(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadPreferences();
    setPreferencesState(stored);
    applyPreferences(stored);
    setReady(true);

    const sync = (event) => {
      const next = event.type === 'storage' ? loadPreferences() : event.detail;
      setPreferencesState(normalizePreferences(next));
    };

    window.addEventListener('storage', sync);
    window.addEventListener('pager:preferences-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pager:preferences-changed', sync);
    };
  }, []);

  const updatePreference = useCallback((key, value) => {
    setPreferencesState((current) => savePreferences({ ...current, [key]: value }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(savePreferences(DEFAULT_PREFERENCES));
  }, []);

  return { preferences, ready, updatePreference, resetPreferences };
}
