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

const convertWebSocketUrl = (wsUrl) => {
  if (wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')) {
    return wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
  }
  return wsUrl;
};

export const StompProvider = (props) => {
  const { children } = props;
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const tokenRef = useRef(null);

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
      const wsUrl = config.stomp.url;
      const sockJsUrl = convertWebSocketUrl(wsUrl);
      const finalWsUrl = `${sockJsUrl}?token=${encodeURIComponent(token)}`;

      const stompClient = new Client({
        webSocketFactory: () => new SockJS(finalWsUrl),
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
        disconnect();
      }

      if (!clientRef.current) {
        connect(tokenRef.current);
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
