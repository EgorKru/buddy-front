import { act, renderHook } from '@testing-library/react';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  applyPreferences,
  isEnterToSendEnabled,
  loadPreferences,
  savePreferences,
  usePreferences,
} from '..';

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute('data-ui-density');
    document.body.removeAttribute('data-sidebar-position');
    document.body.removeAttribute('data-reduce-motion');
  });

  it('normalizes corrupted values instead of breaking settings', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ density: 'tiny', sidebarPosition: 'top', enterToSend: false })
    );

    expect(loadPreferences()).toMatchObject({
      density: 'comfortable',
      sidebarPosition: 'left',
      enterToSend: false,
    });
  });

  it('persists and immediately applies visual preferences', () => {
    savePreferences({
      ...DEFAULT_PREFERENCES,
      density: 'compact',
      sidebarPosition: 'right',
      reduceMotion: true,
    });

    expect(document.body.dataset.uiDensity).toBe('compact');
    expect(document.body.dataset.sidebarPosition).toBe('right');
    expect(document.body.dataset.reduceMotion).toBe('true');
    expect(localStorage.getItem('chatSidebarPosition')).toBe('right');
  });

  it('updates a single preference without losing the rest', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => result.current.updatePreference('enterToSend', false));

    expect(result.current.preferences.enterToSend).toBe(false);
    expect(isEnterToSendEnabled()).toBe(false);
  });

  it('applies server-safe defaults', () => {
    expect(() => applyPreferences(DEFAULT_PREFERENCES)).not.toThrow();
  });
});
