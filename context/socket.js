import { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { getToken } from '@/utils/api';
import { config } from '@/utils/config';
import { safeJsonParse } from '@/utils/safe';

const StompContext = createContext(null);

export const useStomp = () => {
  const context = useContext(StompContext);
  return context || { client: null, connected: false };
};

export const useSocket = () => {
  return null;
};

const isAuthError = (message) => {
  return (
    message &&
    (message.includes('аутентификации') ||
      message.includes('не аутентифицирован') ||
      message.includes('Unauthorized'))
  );
};

const handleAuthError = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
};

const ensureNativeWsUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('ws://') || url.startsWith('wss://')) return url;
  if (url.startsWith('http://')) return url.replace('http://', 'ws://');
  if (url.startsWith('https://')) return url.replace('https://', 'wss://');
  return url;
};

const getTransportPreference = () => {
  const pref = process.env.NEXT_PUBLIC_STOMP_TRANSPORT;
  if (pref === 'native') return pref;
  return 'native';
};

export const StompProvider = (props) => {
  const { children } = props;
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const tokenRef = useRef(null);
  const transportRef = useRef('native');

  useEffect(() => {
    let destroyed = false;

    const disconnect = () => {
      if (clientRef.current) {
        try {
          clientRef.current.deactivate();
        } catch (e) {}
      }
      clientRef.current = null;
      setClient(null);
      setConnected(false);
    };

    const connect = (token) => {
      transportRef.current = getTransportPreference();
      // JWT только в STOMP CONNECT headers — query ?token= блокируется WebSocketAuthInterceptor
      const wsUrl = ensureNativeWsUrl(config.stomp.nativeUrl);
      if (typeof window !== 'undefined') {
        window.__stompBrokerUrl = wsUrl;
      }

      const stompClient = new Client({
        brokerURL: wsUrl,
        connectHeaders: {
          Authorization: `Bearer ${token}`,
          'X-Authorization': `Bearer ${token}`,
        },
        beforeConnect: () => {},
        reconnectDelay: config.stomp.options.reconnectDelay,
        heartbeatIncoming: config.stomp.options.heartbeatIncoming,
        heartbeatOutgoing: config.stomp.options.heartbeatOutgoing,
        debug: () => {},
        onConnect: () => {
          if (destroyed) return;
          setClient(stompClient);
          setConnected(true);
          syncStompDebugFlags();
          try {
            stompClient.subscribe('/user/queue/errors', (error) => {
              const errorData = safeJsonParse(error.body);
              if (errorData?.message && isAuthError(errorData.message)) {
                handleAuthError();
              }
            });

            stompClient.subscribe('/user/queue/state-sync', (message) => {
              const stateData = safeJsonParse(message.body);
              if (stateData && stateData.eventType === 'STATE_SYNC') {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('state-sync', { detail: stateData }));
                }
              }
            });
          } catch (e) {}
        },
        onDisconnect: () => {
          if (destroyed) return;
          setClient(null);
          setConnected(false);
          syncStompDebugFlags();
        },
        onStompError: (frame) => {
          const errorBody = safeJsonParse(frame.body || '{}');
          if (errorBody?.message && isAuthError(errorBody.message)) {
            handleAuthError();
            return;
          }

          if (frame.body && isAuthError(frame.body)) {
            handleAuthError();
          }

          if (!destroyed) {
            setClient(null);
            setConnected(false);
          }
        },
        onWebSocketError: () => {
          if (!destroyed) {
            setClient(null);
            setConnected(false);
          }
        },
        onWebSocketClose: () => {
          if (!destroyed) {
            setClient(null);
            setConnected(false);
          }
        },
      });

      clientRef.current = stompClient;
      stompClient.activate();
    };

    const isClientLive = () => {
      const c = clientRef.current;
      return Boolean(c && c.connected && c.active);
    };

    const syncStompDebugFlags = () => {
      if (typeof window === 'undefined') return;
      const live = isClientLive();
      window.__stompConnected = live;
      window.__stompClient = live ? clientRef.current : null;
    };

    const ensureConnection = () => {
      const disableWebSocket =
        typeof window !== 'undefined' && localStorage.getItem('disable_websocket') === 'true';
      if (disableWebSocket) {
        disconnect();
        tokenRef.current = getToken();
        syncStompDebugFlags();
        return;
      }

      const token = getToken();

      if (!token) {
        tokenRef.current = null;
        disconnect();
        syncStompDebugFlags();
        return;
      }

      if (tokenRef.current !== token) {
        tokenRef.current = token;
        disconnect();
      }

      if (!clientRef.current) {
        connect(tokenRef.current);
      }

      syncStompDebugFlags();
    };

    ensureConnection();

    const onStorage = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        ensureConnection();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }

    return () => {
      destroyed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
      disconnect();
    };
  }, []);

  const stompValue = useMemo(() => ({ client, connected }), [client, connected]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__stompConnected = connected;
    window.__stompClient = connected ? clientRef.current : null;
  }, [connected, client]);

  return <StompContext.Provider value={stompValue}>{children}</StompContext.Provider>;
};
