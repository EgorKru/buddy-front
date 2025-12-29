import { config, getApiUrl } from './config';

/**
 * Базовый метод для выполнения API запросов
 * @param {string} endpoint - Путь к API endpoint (например, '/chats')
 * @param {Object} options - Опции запроса (method, body, headers)
 * @returns {Promise<any>} Ответ от сервера
 * @throws {Error} Ошибка при выполнении запроса
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Убираем body из options, если он уже в headers
  const { body, ...fetchOptions } = options;
  
    try {
      const response = await fetch(getApiUrl(endpoint), {
      ...fetchOptions,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    
    if (response.status === 401) {
      // Токен истек или невалидный
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `Request failed with status ${response.status}`);
    }
    
    // Если ответ пустой, возвращаем null
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

/**
 * API методы для аутентификации
 */
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

/**
 * API методы для работы с чатами и сообщениями
 */
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
  
  sendMessage: async (chatId, content, type = 'TEXT') => {
    return apiRequest(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: { content, type },
    });
  },
};

/**
 * API методы для работы с пользователями
 */
export const userAPI = {
  /**
   * Поиск пользователей по username
   * @param {string} username - Часть username для поиска
   * @returns {Promise<Array>} Список найденных пользователей
   */
  searchUsers: async (username) => {
    if (!username || username.trim().length === 0) {
      return [];
    }
    return apiRequest(`/users/search?username=${encodeURIComponent(username.trim())}`);
  },
};

/**
 * API методы для работы с video комнатами
 */
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

/**
 * Получить текущего авторизованного пользователя из localStorage
 * @returns {Object|null} Данные пользователя или null
 */
export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * Сохранить данные пользователя и токен в localStorage
 * @param {Object} user - Данные пользователя
 * @param {string} token - JWT токен
 */
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

/**
 * Проверить, авторизован ли пользователь
 * @returns {boolean} true если есть токен в localStorage
 */
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
};

/**
 * Получить JWT токен из localStorage
 * @returns {string|null} Токен или null
 */
export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

