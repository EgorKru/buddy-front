/**
 * API авторизации и состояние текущего пользователя.
 * FSD: shared/api
 */
import { apiRequest } from './client';

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

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
export const setCurrentUser = (user, token) => {
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('token', token);
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
