/**
 * API чатов и сообщений.
 * FSD: shared/api
 */
import { getApiUrl } from '../config';
import { apiRequest, uploadFileToEndpoint } from './client';

export const chatAPI = {
  getChats: async () => apiRequest('/chats'),
  getChat: async (chatId) => apiRequest(`/chats/${chatId}`),
  getDirectChat: async (userId) => apiRequest(`/chats/direct/${userId}`),
  createChat: async (chatData) => apiRequest('/chats', { method: 'POST', body: chatData }),
  getMessages: async (chatId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/chats/${chatId}/messages${queryString ? `?${queryString}` : ''}`);
  },
  getChatStateFull: async (chatId, messageLimit = 100) => {
    const params = new URLSearchParams({ messageLimit: String(messageLimit) });
    return apiRequest(`/chats/${chatId}/state/full?${params}`);
  },
  getMessagesBefore: async (chatId, beforeId, limit = 100) => {
    const params = new URLSearchParams({ beforeId: String(beforeId), limit: String(limit) });
    return apiRequest(`/chats/${chatId}/messages/before?${params}`);
  },
  getMessagesBeforeDate: async (chatId, beforeDate, limit = 100) => {
    const params = new URLSearchParams({ beforeDate: String(beforeDate), limit: String(limit) });
    return apiRequest(`/chats/${chatId}/messages/before?${params}`);
  },
  getChatState: async (chatId) => apiRequest(`/chats/${chatId}/state`),
  getChatUpdates: async (chatId, fromPts, limit = 100) => {
    const params = new URLSearchParams({ fromPts: String(fromPts), limit: String(limit) });
    return apiRequest(`/chats/${chatId}/updates?${params}`);
  },
  getUserState: async () => apiRequest('/user/state'),
  getUserUpdates: async (fromSeq, limit = 100) => {
    const params = new URLSearchParams({ fromSeq: String(fromSeq), limit: String(limit) });
    return apiRequest(`/user/updates?${params}`);
  },
  sendMessage: async (
    chatId,
    content,
    type = 'TEXT',
    fileUrl = null,
    replyToMessageId = null,
    encryptionVersion = null
  ) => {
    const body = { type };
    if (type === 'IMAGE' || type === 'FILE') {
      if (content && content.trim()) body.content = content.trim();
    } else if (type !== 'VOICE') {
      body.content = content;
    }
    if ((type === 'VOICE' || type === 'IMAGE' || type === 'FILE') && fileUrl)
      body.fileUrl = fileUrl;
    if (replyToMessageId) body.replyToMessageId = replyToMessageId;
    if (encryptionVersion != null && encryptionVersion > 0) {
      body.encryptionVersion = encryptionVersion;
    }
    return apiRequest(`/chats/${chatId}/messages`, { method: 'POST', body });
  },
  getMessage: async (chatId, messageId) => apiRequest(`/chats/${chatId}/messages/${messageId}`),
  getMessageContext: async (chatId, messageId, contextSize = 20) => {
    const params = new URLSearchParams({ contextSize: String(contextSize) });
    return apiRequest(`/chats/${chatId}/messages/${messageId}/context?${params}`);
  },
  uploadVoiceFile: async (chatId, audioBlob, duration = null) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');
    if (duration != null) formData.append('duration', duration.toString());
    return uploadFileToEndpoint(chatId, formData, 'files/voice', null);
  },
  uploadImageFile: async (chatId, imageFile, onProgress) => {
    const formData = new FormData();
    formData.append('file', imageFile);
    return uploadFileToEndpoint(chatId, formData, 'files/image', onProgress ?? null);
  },
  uploadFile: async (chatId, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadFileToEndpoint(chatId, formData, 'files/file', onProgress ?? null);
  },
  getVoiceFileUrl: (filePath) => {
    if (!filePath) return null;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    return getApiUrl(`/chats/files/${cleanPath}`);
  },
  getImageFileUrl: (filePath, download = false, filename = null) => {
    if (!filePath) return null;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    let url = getApiUrl(`/chats/files/${cleanPath}`);
    const params = new URLSearchParams();
    if (download) {
      params.append('download', 'true');
      if (filename) params.append('filename', filename);
    }
    const q = params.toString();
    return q ? `${url}?${q}` : url;
  },
  getFileUrl: (filePath, download = false, filename = null) => {
    if (!filePath) return null;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    let url = getApiUrl(`/chats/files/${cleanPath}`);
    const params = new URLSearchParams();
    if (download) {
      params.append('download', 'true');
      if (filename) params.append('filename', filename);
    }
    const q = params.toString();
    return q ? `${url}?${q}` : url;
  },
  markChatAsRead: async (chatId) => apiRequest(`/chats/${chatId}/read`, { method: 'PUT' }),
  editMessage: async (chatId, messageId, content) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}`, { method: 'PUT', body: { content } }),
  deleteMessage: async (chatId, messageId) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}`, { method: 'DELETE' }),
  deleteMessageForMe: async (chatId, messageId) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}/for-me`, { method: 'DELETE' }),
  deleteMessageForAll: async (chatId, messageId) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}/for-all`, { method: 'DELETE' }),
  getPinnedMessages: async (chatId) => apiRequest(`/chats/${chatId}/pinned-messages`),
  pinMessage: async (chatId, messageId) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}/pin`, { method: 'POST' }),
  unpinMessage: async (chatId, messageId) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}/pin`, { method: 'DELETE' }),
  forwardMessage: async (fromChatId, toChatId, messageIds, comment = null) => {
    if (!Array.isArray(messageIds)) messageIds = [messageIds];
    const queryString = new URLSearchParams({ fromChatId }).toString();
    const body = { messageIds };
    if (comment) body.comment = comment;
    return apiRequest(`/chats/${toChatId}/forward?${queryString}`, { method: 'POST', body });
  },
  searchMessages: async (chatId, searchText, page = 0, size = 50) => {
    const params = new URLSearchParams({
      q: searchText,
      page: page.toString(),
      size: size.toString(),
    });
    return apiRequest(`/chats/${chatId}/messages/search?${params.toString()}`);
  },
};
