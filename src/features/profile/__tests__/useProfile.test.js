import { act, renderHook, waitFor } from '@testing-library/react';
import { useProfile } from '..';
import { getToken, setCurrentUser, userAPI } from '@/shared/api';

jest.mock('@/shared/api', () => ({
  userAPI: { updateProfile: jest.fn() },
  setCurrentUser: jest.fn(),
  getToken: jest.fn(() => 'access-token'),
}));

describe('useProfile', () => {
  const user = {
    id: 7,
    username: 'demo',
    email: 'demo@example.com',
    displayName: 'Demo User',
    avatarUrl: '',
  };

  beforeEach(() => jest.clearAllMocks());

  it('keeps the user on settings after save and updates the dirty state', async () => {
    userAPI.updateProfile.mockResolvedValue({ ...user, displayName: 'Команда Pager' });
    const { result } = renderHook(() => useProfile(user));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleChange({ target: { name: 'displayName', value: 'Команда Pager' } });
    });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() });
    });

    expect(userAPI.updateProfile).toHaveBeenCalledWith({ displayName: 'Команда Pager' });
    expect(setCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Команда Pager' }),
      getToken()
    );
    expect(result.current.success).toBe('Профиль успешно обновлён!');
    expect(result.current.dirty).toBe(false);
  });

  it('restores unsaved changes', async () => {
    const { result } = renderHook(() => useProfile(user));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleChange({ target: { name: 'displayName', value: 'Черновик' } });
      result.current.resetForm();
    });

    expect(result.current.formData.displayName).toBe('Demo User');
    expect(result.current.dirty).toBe(false);
  });

  it('stabilizes when auth returns an equivalent new user object on every render', async () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useProfile({ ...user });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => Promise.resolve());

    expect(renderCount).toBeLessThan(8);
    expect(result.current.formData.displayName).toBe('Demo User');
  });
});
