/**
 * API авторизации и состояние текущего пользователя.
 * FSD: shared/api
 */
import { apiRequest } from './client';

export const clearAuthSession = async () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenExpiresAt');
  localStorage.removeItem('user');

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    registrations.forEach((registration) => {
      registration.active?.postMessage({ type: 'CLEAR_CACHE' });
    });
  }
};

export const authAPI = {
  login: async (username, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  },

  register: async (userData) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: userData,
    });
  },

  sendVerificationCode: async (email) => {
    return apiRequest('/auth/send-verification-code', {
      method: 'POST',
      body: { email },
    });
  },

  logout: async () => {
    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    try {
      if (refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
          skipAuthRefresh: true,
        });
      }
    } catch {
      // Local logout must still succeed when the token is expired or the API is offline.
    } finally {
      await clearAuthSession();
    }
  },

  getProfile: async () => {
    return apiRequest('/auth/profile');
  },
};

/**
 * Возвращает текущего пользователя из localStorage (только в браузере).
 * @returns {object|null}
 */
export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * Сохраняет пользователя и токен в localStorage (только в браузере).
 * @param {object|null} user
 * @param {string|null} token
 */
export const setCurrentUser = (user, token, refreshToken = null, expiresIn = null) => {
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (expiresIn) {
      localStorage.setItem('tokenExpiresAt', String(Date.now() + Number(expiresIn) * 1000));
    }
    if (user) localStorage.setItem('user', JSON.stringify(user));
  }
};

/**
 * @returns {boolean} true, если в localStorage есть токен (только в браузере).
 */
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
};

/**
 * @returns {string|null} токен из localStorage (только в браузере).
 */
export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};
