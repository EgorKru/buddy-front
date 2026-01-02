const getApiBaseURL = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
};

export const config = {
  api: {
    baseURL: getApiBaseURL(),
    timeout: 30000,
  },
  stomp: {
    nativeUrl: process.env.NEXT_PUBLIC_WS_NATIVE_URL ||
      (process.env.NEXT_PUBLIC_SOCKET_URL ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/ws-native` : null) ||
      (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '/ws-native')) ||
      'wss://pager.website/ws-native',
    sockjsUrl: process.env.NEXT_PUBLIC_WS_SOCKJS_URL ||
      process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_SOCKET_URL ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/ws` : null) ||
      (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '/ws')) ||
      'https://pager.website/ws',
    options: {
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    },
  },
  app: {
    name: 'Pager',
    version: '1.0.0',
  },
};

export const getApiUrl = (endpoint) => {
  const baseURL = config.api.baseURL.endsWith('/')
    ? config.api.baseURL.slice(0, -1)
    : config.api.baseURL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseURL}${path}`;
};

export const isBrowser = typeof window !== 'undefined';

export const getEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

export const isDevelopment = () => {
  return getEnvironment() === 'development';
};

export const isProduction = () => {
  return getEnvironment() === 'production';
};
