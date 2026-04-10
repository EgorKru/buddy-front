/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthTheme, AUTH_THEME_STORAGE_KEY } from '../useAuthTheme';

describe('useAuthTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads light from localStorage after mount', async () => {
    localStorage.setItem(AUTH_THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useAuthTheme());
    await waitFor(() => {
      expect(result.current.theme).toBe('light');
    });
  });

  it('toggleTheme persists and switches', () => {
    const { result } = renderHook(() => useAuthTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(AUTH_THEME_STORAGE_KEY)).toBe('light');
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(AUTH_THEME_STORAGE_KEY)).toBe('dark');
  });

  it('setTheme persists', () => {
    const { result } = renderHook(() => useAuthTheme());
    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(AUTH_THEME_STORAGE_KEY)).toBe('light');
  });
});
