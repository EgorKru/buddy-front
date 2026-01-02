import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getToken } from "@/utils/api";
import { config } from "@/utils/config";

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
    const token = getToken();
    const previousToken = tokenRef.current;
    tokenRef.current = token;

    if (!token) {
      if (clientRef.current && clientRef.current.connected) {
        clientRef.current.deactivate();
        setClient(null);
        setConnected(false);
      }
      return;
    }

    const needsReconnect = !clientRef.current ||
      !clientRef.current.connected ||
      (previousToken !== token && previousToken !== null);

    if (!needsReconnect && clientRef.current && clientRef.current.connected) {
      return;
    }

    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.deactivate();
      setClient(null);
      setConnected(false);
    }

    const disableWebSocket = localStorage.getItem('disable_websocket') === 'true';
    if (disableWebSocket) {
      return;
    }

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
        setConnected(true);

        try {
          stompClient.subscribe('/user/queue/errors', (error) => {
            try {
              const errorData = JSON.parse(error.body);
              if (errorData.message && isAuthError(errorData.message)) {
                handleAuthError();
              }
            } catch (e) {}
          });
        } catch (error) {}
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: (frame) => {
        try {
          const errorBody = JSON.parse(frame.body || '{}');
          if (errorBody.message && isAuthError(errorBody.message)) {
            handleAuthError();
            return;
          }
        } catch (e) {}

        if (frame.body && isAuthError(frame.body)) {
          handleAuthError();
        }

        setConnected(false);
      },
      onWebSocketError: () => {
        setConnected(false);
      },
      onWebSocketClose: () => {
        setConnected(false);
      },
    });

    clientRef.current = stompClient;
    setClient(stompClient);
    stompClient.activate();

    return () => {
      if (stompClient && stompClient.connected) {
        stompClient.deactivate();
      }
    };
  }, []);

  useEffect(() => {
    const checkTokenAndReconnect = () => {
      const currentToken = getToken();
      const hasClient = clientRef.current;
      const isConnected = hasClient && hasClient.connected;

      if (currentToken && !isConnected && hasClient) {
        hasClient.deactivate();
      }
    };

    const interval = setInterval(checkTokenAndReconnect, 2000);
    return () => clearInterval(interval);
  }, [connected]);

  return (
    <StompContext.Provider value={{ client, connected }}>
      {children}
    </StompContext.Provider>
  );
};
