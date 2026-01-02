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

/**
 * Алиас для обратной совместимости (используется в комнатах для video calls)
 * @deprecated Используйте useStomp() для чатов. Для video calls требуется отдельный Socket.IO клиент
 * @returns {null} Всегда возвращает null, так как Socket.IO не настроен
 */
export const useSocket = () => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('useSocket() is deprecated. Use useStomp() for chat functionality.');
  }
  return null;
};

export const StompProvider = (props) => {
  const { children } = props;
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const tokenRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    // Получаем токен каждый раз при выполнении эффекта
    const token = getToken();
    const previousToken = tokenRef.current;
    tokenRef.current = token;
    
    // Если нет токена, отключаемся если подключены
    if (!token) {
      if (clientRef.current && clientRef.current.connected) {
        clientRef.current.deactivate();
        setClient(null);
        setConnected(false);
      }
      return;
    }
    
    // Если токен изменился или клиент не подключен - переподключаемся
    const needsReconnect = !clientRef.current || 
                          !clientRef.current.connected || 
                          (previousToken !== token && previousToken !== null);
    
    if (!needsReconnect && clientRef.current && clientRef.current.connected) {
      return;
    }
    
    // Если нужно переподключиться, сначала отключаем старый клиент
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.deactivate();
      setClient(null);
      setConnected(false);
    }

    // Проверяем, не отключено ли подключение (для временного решения проблем)
    const disableWebSocket = localStorage.getItem('disable_websocket') === 'true';
    if (disableWebSocket) {
      return;
    }

    const wsUrl = config.stomp.url;
    
    // Согласно документации: ВАЖНО использовать SockJS для подключения
    // Endpoint /ws настроен с .withSockJS()
    const isNativeWebSocket = wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://');
    
    // Если URL начинается с ws:// или wss://, конвертируем в http/https для SockJS
    let sockJsUrl = wsUrl;
    if (isNativeWebSocket) {
      // SockJS требует http/https, не ws/wss
      sockJsUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    }
    
    // Бэкенд поддерживает токен в query параметре для SockJS handshake
    // Это помогает при первоначальном подключении
    // Также передаем токен в connectHeaders для STOMP
    const finalWsUrl = `${sockJsUrl}?token=${encodeURIComponent(token)}`;
    
    // Создаем STOMP клиент
    const stompClient = new Client({
      webSocketFactory: () => {
        const sock = new SockJS(finalWsUrl);
        return sock;
      },
      // Передача токена через заголовки STOMP (основной способ)
      // Бэкенд поддерживает оба заголовка: Authorization и X-Authorization
      // Токен также передается в URL для SockJS handshake
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        // X-Authorization для совместимости
        'X-Authorization': `Bearer ${token}`,
      },
      
      beforeConnect: () => {
        // Подготовка к подключению
      },
      reconnectDelay: config.stomp.options.reconnectDelay,
      heartbeatIncoming: config.stomp.options.heartbeatIncoming,
      heartbeatOutgoing: config.stomp.options.heartbeatOutgoing,
      debug: () => {
        // Логи отключены
      },
      onConnect: () => {
        // Устанавливаем connected синхронно, чтобы компоненты сразу увидели изменение
        setConnected(true);
        
        // Подписываемся на ошибки
        try {
          stompClient.subscribe('/user/queue/errors', (error) => {
            const errorData = JSON.parse(error.body);
            // Если ошибка аутентификации, перенаправляем на логин
            if (errorData.message && errorData.message.includes('аутентификации')) {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }
            }
          });
        } catch (error) {
          // Игнорируем ошибки подписки
        }
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: (frame) => {
        // Проверяем, если это ошибка аутентификации
        try {
          const errorBody = JSON.parse(frame.body || '{}');
          if (errorBody.message && (
            errorBody.message.includes('аутентификации') || 
            errorBody.message.includes('не аутентифицирован') ||
            errorBody.message.includes('Unauthorized')
          )) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
          }
        } catch (e) {
          // Игнорируем ошибки парсинга, но проверяем текст ошибки напрямую
          if (frame.body && (
            frame.body.includes('аутентификации') || 
            frame.body.includes('не аутентифицирован')
          )) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
          }
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
    
    // Активируем подключение
    stompClient.activate();

    return () => {
      if (stompClient && stompClient.connected) {
        stompClient.deactivate();
      }
    };
  }, []); // Запускаем один раз при монтировании, токен получаем внутри через getToken()
  
  // Отдельный эффект для переподключения при появлении токена после логина
  useEffect(() => {
    const checkTokenAndReconnect = () => {
      const currentToken = getToken();
      const hasClient = clientRef.current;
      const isConnected = hasClient && hasClient.connected;
      
      // Если токен есть, но клиент не подключен - переподключаемся
      if (currentToken && !isConnected && hasClient) {
        // Деактивируем старый клиент
        hasClient.deactivate();
      }
    };
    
    // Проверяем каждые 2 секунды
    const interval = setInterval(checkTokenAndReconnect, 2000);
    return () => clearInterval(interval);
  }, [connected]);

  return (
    <StompContext.Provider value={{ client, connected }}>
      {children}
    </StompContext.Provider>
  );
};
