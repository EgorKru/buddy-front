import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getToken } from "@/utils/api";
import { config } from "@/utils/config";
import { safeJsonParse } from "@/utils/safe";

const StompContext = createContext(null);

export const useStomp = () => {
  const context = useContext(StompContext);
  return context || { client: null, connected: false };
};

export const useSocket = () => {
  return null;
};

const isAuthError = (message) => {
  return message && (
    message.includes('аутентификации') ||
    message.includes('не аутентифицирован') ||
    message.includes('Unauthorized')
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

const withTokenQuery = (url, token) => {
  if (!url || !token) return url;
  const hasQuery = url.includes('?');
  const sep = hasQuery ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
};

const ensureSockJsHttpUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('ws://')) return url.replace('ws://', 'http://');
  if (url.startsWith('wss://')) return url.replace('wss://', 'https://');
  return url;
};

const getTransportPreference = () => {
  const pref = process.env.NEXT_PUBLIC_STOMP_TRANSPORT;
  if (pref === 'native' || pref === 'sockjs') return pref;
  return 'auto';
};

export const StompProvider = (props) => {
  const { children } = props;
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const tokenRef = useRef(null);
  const transportRef = useRef('auto');
  const fallbackTriedRef = useRef(false);

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

    const connect = (token, useFallback = false) => {
      transportRef.current = getTransportPreference();
      fallbackTriedRef.current = useFallback;

      const nativeWsUrl = withTokenQuery(ensureNativeWsUrl(config.stomp.nativeUrl), token);
      const sockJsUrl = withTokenQuery(ensureSockJsHttpUrl(config.stomp.sockjsUrl), token);

      const createFactory = () => {
        const pref = transportRef.current;
        if (pref === 'sockjs') return () => new SockJS(sockJsUrl);
        if (pref === 'native') return () => new WebSocket(nativeWsUrl);
        // auto: try native first, fallback to sockjs if needed
        return () => {
          if (fallbackTriedRef.current) return new SockJS(sockJsUrl);
          return new WebSocket(nativeWsUrl);
        };
      };

      const stompClient = new Client({
        webSocketFactory: createFactory(),
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
          setConnected(true);
          try {
            stompClient.subscribe('/user/queue/errors', (error) => {
              const errorData = safeJsonParse(error.body);
              if (errorData?.message && isAuthError(errorData.message)) {
                handleAuthError();
              }
            });
          } catch (e) {}
        },
        onDisconnect: () => {
          if (destroyed) return;
          setConnected(false);
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
            setConnected(false);
          }
        },
        onWebSocketError: () => {
          if (!destroyed) {
            setConnected(false);
            if (transportRef.current === 'auto' && !fallbackTriedRef.current) {
              fallbackTriedRef.current = true;
              clientRef.current = null;
              try { stompClient.deactivate(); } catch (e) {}
              setTimeout(() => {
                if (!destroyed && !clientRef.current) {
                  connect(token, true);
                }
              }, 100);
            }
          }
        },
        onWebSocketClose: () => {
          if (!destroyed) {
            setConnected(false);
          }
        },
      });

      clientRef.current = stompClient;
      setClient(stompClient);
      stompClient.activate();
    };

    const ensureConnection = () => {
      const disableWebSocket = typeof window !== 'undefined' && localStorage.getItem('disable_websocket') === 'true';
      if (disableWebSocket) {
        disconnect();
        tokenRef.current = getToken();
        return;
      }

      const token = getToken();

      if (!token) {
        tokenRef.current = null;
        disconnect();
        return;
      }

      if (tokenRef.current !== token) {
        tokenRef.current = token;
        fallbackTriedRef.current = false;
        disconnect();
      }

      if (!clientRef.current) {
        connect(tokenRef.current, fallbackTriedRef.current);
      }
    };

    ensureConnection();
    const interval = setInterval(ensureConnection, 1000);

    return () => {
      destroyed = true;
      clearInterval(interval);
      disconnect();
    };
  }, []);

  return (
    <StompContext.Provider value={{ client, connected }}>
      {children}
    </StompContext.Provider>
  );
};
