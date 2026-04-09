/**
 * API пользователей.
 * FSD: shared/api
 */
import { apiRequest } from './client';

export const userAPI = {
  searchUsers: async (query) => {
    if (!query || query.trim().length === 0) return [];
    return apiRequest(`/users/search?query=${encodeURIComponent(query.trim())}`);
  },
  getUser: async (userId) => apiRequest(`/users/${userId}`),
  updateProfile: async (profileData) =>
    apiRequest('/users/me', { method: 'PUT', body: profileData }),
};
