/**
 * E2EE: публичные identity-ключи (opaque для сервера).
 */
import { apiRequest } from './client';

export const cryptoAPI = {
  putMyIdentityKey: async (identityKeyPublic) =>
    apiRequest('/crypto/me/identity-key', {
      method: 'PUT',
      body: { identityKeyPublic },
    }),

  getUserIdentityKey: async (userId) => apiRequest(`/crypto/users/${userId}/identity-key`),
};
