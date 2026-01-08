import { config, getApiUrl } from './config';

export const apiRequest = async (endpoint, options = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const { body, ...fetchOptions } = options;

  try {
    const response = await fetch(getApiUrl(endpoint), {
      ...fetchOptions,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        if (response.status === 500) {
          errorMessage = 'Internal server error';
        } else if (response.status === 404) {
          errorMessage = 'Not found';
        } else if (response.status === 403) {
          errorMessage = 'Forbidden';
        }
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Не удалось подключиться к серверу. Проверьте, что бэкенд запущен.');
    }
    throw error;
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

export const chatAPI = {
  getChats: async () => {
    return apiRequest('/chats');
  },

  getChat: async (chatId) => {
    return apiRequest(`/chats/${chatId}`);
  },

  getDirectChat: async (userId) => {
    return apiRequest(`/chats/direct/${userId}`);
  },

  createChat: async (chatData) => {
    return apiRequest('/chats', {
      method: 'POST',
      body: chatData,
    });
  },

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

  getChatState: async (chatId) => {
    return apiRequest(`/chats/${chatId}/state`);
  },

  getChatUpdates: async (chatId, fromPts, limit = 100) => {
    const params = new URLSearchParams({ fromPts: String(fromPts), limit: String(limit) });
    return apiRequest(`/chats/${chatId}/updates?${params}`);
  },

  getUserState: async () => {
    return apiRequest('/user/state');
  },

  getUserUpdates: async (fromSeq, limit = 100) => {
    const params = new URLSearchParams({ fromSeq: String(fromSeq), limit: String(limit) });
    return apiRequest(`/user/updates?${params}`);
  },

  sendMessage: async (chatId, content, type = 'TEXT', fileUrl = null, replyToMessageId = null) => {
    const body = { 
      type 
    };
    
    if (type === 'IMAGE' || type === 'FILE') {
      if (content && content.trim()) {
        body.content = content.trim();
      }
    } else if (type === 'VOICE') {
    } else {
      body.content = content;
    }
    
    if ((type === 'VOICE' || type === 'IMAGE' || type === 'FILE') && fileUrl) {
      body.fileUrl = fileUrl;
    }
    if (replyToMessageId) {
      body.replyToMessageId = replyToMessageId;
    }
    return apiRequest(`/chats/${chatId}/messages`, {
      method: 'POST',
      body,
    });
  },

  getMessage: async (chatId, messageId) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}`);
  },

  uploadVoiceFile: async (chatId, audioBlob, duration = null) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');
    
    if (duration !== null && duration !== undefined) {
      formData.append('duration', duration.toString());
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const uploadUrl = getApiUrl(`/chats/${chatId}/files/voice`);
    
    if (typeof window !== 'undefined') {
      console.log('[API] Uploading voice file:', { chatId, url: uploadUrl, blobSize: audioBlob.size, blobType: audioBlob.type, duration });
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      if (typeof window !== 'undefined') {
        console.error('[API] Voice upload failed:', { status: response.status, error });
      }
      throw new Error(error.message || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    
    if (typeof window !== 'undefined') {
      console.log('[API] Voice upload successful:', result);
    }
    
    return result;
  },

  uploadImageFile: async (chatId, imageFile, onProgress) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', imageFile);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const uploadUrl = getApiUrl(`/chats/${chatId}/files/image`);
    
    if (typeof window !== 'undefined') {
      console.log('[API] Uploading image file:', { chatId, url: uploadUrl, fileName: imageFile.name, fileSize: imageFile.size, fileType: imageFile.type });
    }

    if (onProgress && typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            requestAnimationFrame(() => {
              onProgress(e.loaded / e.total);
            });
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status === 401) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
            reject(new Error('Unauthorized'));
            return;
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.message || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });
        
        xhr.open('POST', uploadUrl);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });
    }

    // Fallback на fetch если onProgress не передан
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      if (typeof window !== 'undefined') {
        console.error('[API] Image upload failed:', { status: response.status, error });
      }
      throw new Error(error.message || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    
    if (typeof window !== 'undefined') {
      console.log('[API] Image upload successful:', result);
    }
    
    return result;
  },

  uploadFile: async (chatId, file, onProgress) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const uploadUrl = getApiUrl(`/chats/${chatId}/files/file`);
    
    if (typeof window !== 'undefined') {
      console.log('[API] Uploading file:', { chatId, url: uploadUrl, fileName: file.name, fileSize: file.size, fileType: file.type });
    }

    if (onProgress && typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            requestAnimationFrame(() => {
              onProgress(e.loaded / e.total);
            });
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status === 401) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
            reject(new Error('Unauthorized'));
            return;
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.message || `Upload failed with status ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });
        
        xhr.open('POST', uploadUrl);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });
    }

    // Fallback на fetch если onProgress не передан
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      if (typeof window !== 'undefined') {
        console.error('[API] File upload failed:', { status: response.status, error });
      }
      throw new Error(error.message || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    
    if (typeof window !== 'undefined') {
      console.log('[API] File upload successful:', result);
    }
    
    return result;
  },

  sendVoiceMessage: async (chatId, voiceData, voiceMimeType = 'audio/webm') => {
    return apiRequest(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: { type: 'VOICE', voiceData, voiceMimeType },
    });
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
      if (filename) {
        params.append('filename', filename);
      }
    }
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  },

  getFileUrl: (filePath, download = false, filename = null) => {
    if (!filePath) return null;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    let url = getApiUrl(`/chats/files/${cleanPath}`);
    const params = new URLSearchParams();
    if (download) {
      params.append('download', 'true');
      if (filename) {
        params.append('filename', filename);
      }
    }
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  },

  markChatAsRead: async (chatId) => {
    return apiRequest(`/chats/${chatId}/read`, {
      method: 'PUT',
    });
  },

  editMessage: async (chatId, messageId, content) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}`, {
      method: 'PUT',
      body: { content },
    });
  },

  deleteMessage: async (chatId, messageId) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  deleteMessageForMe: async (chatId, messageId) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}/for-me`, {
      method: 'DELETE',
    });
  },

  deleteMessageForAll: async (chatId, messageId) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}/for-all`, {
      method: 'DELETE',
    });
  },

  getPinnedMessages: async (chatId) => {
    return apiRequest(`/chats/${chatId}/pinned-messages`);
  },

  pinMessage: async (chatId, messageId) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}/pin`, {
      method: 'POST',
    });
  },

  unpinMessage: async (chatId, messageId) => {
    return apiRequest(`/chats/${chatId}/messages/${messageId}/pin`, {
      method: 'DELETE',
    });
  },

  forwardMessage: async (fromChatId, toChatId, messageIds, comment = null) => {
    if (!Array.isArray(messageIds)) {
      messageIds = [messageIds];
    }
    
    const queryString = new URLSearchParams({ fromChatId }).toString();
    const body = { messageIds };
    if (comment) {
      body.comment = comment;
    }
    return apiRequest(`/chats/${toChatId}/forward?${queryString}`, {
      method: 'POST',
      body,
    });
  },

  forwardMessages: async (toChatId, fromChatId, messageIds, comment = null) => {
    const queryString = new URLSearchParams({ fromChatId }).toString();
    const body = { messageIds };
    if (comment) {
      body.comment = comment;
    }
    return apiRequest(`/chats/${toChatId}/forward?${queryString}`, {
      method: 'POST',
      body,
    });
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

export const userAPI = {
  searchUsers: async (username) => {
    if (!username || username.trim().length === 0) {
      return [];
    }
    const query = username.trim();
    const url = `/users/search?username=${encodeURIComponent(query)}`;
    return apiRequest(url);
  },
};

export const roomAPI = {
  createRoom: async () => {
    return apiRequest('/rooms', {
      method: 'POST',
    });
  },

  getRoom: async (roomId) => {
    return apiRequest(`/rooms/${roomId}`);
  },

  joinRoom: async (roomId) => {
    return apiRequest(`/rooms/${roomId}/join`, {
      method: 'POST',
    });
  },

  leaveRoom: async (roomId) => {
    return apiRequest(`/rooms/${roomId}/leave`, {
      method: 'POST',
    });
  },
};

export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const notificationAPI = {
  getNotifications: async (page = 0, size = 20) => {
    return apiRequest(`/notifications?page=${page}&size=${size}`);
  },

  getUnreadNotifications: async () => {
    return apiRequest('/notifications/unread');
  },

  getUnreadCount: async () => {
    const response = await apiRequest('/notifications/unread/count');
    return response.count || 0;
  },

  markAsRead: async (notificationId) => {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  deleteNotification: async (notificationId) => {
    return apiRequest(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },
};

export const setCurrentUser = (user, token) => {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('token', token);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }
};

export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
};

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};
