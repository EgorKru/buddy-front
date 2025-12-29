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

  useEffect(() => {
    const token = getToken();
    
    // Если нет токена, не подключаемся
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log("STOMP: No token, skipping connection");
      }
      return;
    }

    // Логируем информацию о подключении только в dev режиме
    if (process.env.NODE_ENV === 'development') {
      console.log("STOMP: Initializing connection...");
      console.log("STOMP: WebSocket URL:", config.stomp.url);
    }
    
    // Проверяем, не отключено ли подключение (для временного решения проблем)
    const disableWebSocket = localStorage.getItem('disable_websocket') === 'true';
    if (disableWebSocket) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("STOMP: WebSocket подключение отключено пользователем");
        console.warn("STOMP: Чтобы включить: localStorage.removeItem('disable_websocket')");
      }
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`STOMP: Using SockJS to connect to`, sockJsUrl);
    }
    
    // Опция: передать токен через query параметр (альтернатива connectHeaders)
    const useTokenInUrl = process.env.NEXT_PUBLIC_WS_TOKEN_IN_URL === 'true';
    const finalWsUrl = useTokenInUrl ? `${sockJsUrl}?token=${token}` : sockJsUrl;
    
    // Создаем STOMP клиент
    const stompClient = new Client({
      webSocketFactory: () => {
        if (process.env.NODE_ENV === 'development') {
          console.log("STOMP: Creating SockJS connection to", finalWsUrl);
        }
        const sock = new SockJS(finalWsUrl);
        
        // Добавляем обработчики для диагностики
        sock.onopen = () => {
          if (process.env.NODE_ENV === 'development') {
            console.log("STOMP: SockJS connection opened successfully");
          }
        };
        
        sock.onclose = (event) => {
          if (process.env.NODE_ENV === 'development') {
            console.log("STOMP: SockJS connection closed", {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
            });
          }
        };
        
        sock.onerror = (error) => {
          console.error("STOMP: SockJS connection error", error);
          if (process.env.NODE_ENV === 'development' && error.target) {
            console.error("STOMP: Error target:", {
              url: error.target.url,
              readyState: error.target.readyState,
              status: error.target.status,
              statusText: error.target.statusText,
            });
          }
        };
        
        return sock;
      },
      // Передача токена через заголовки (основной способ)
      // Если не работает, можно использовать токен в URL (см. выше)
      connectHeaders: useTokenInUrl ? {} : {
        Authorization: `Bearer ${token}`,
        // Некоторые бэкенды могут ожидать токен в другом заголовке
        'X-Authorization': `Bearer ${token}`,
      },
      reconnectDelay: config.stomp.options.reconnectDelay,
      heartbeatIncoming: config.stomp.options.heartbeatIncoming,
      heartbeatOutgoing: config.stomp.options.heartbeatOutgoing,
      debug: (str) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('STOMP:', str);
        }
      },
      onConnect: (frame) => {
        if (process.env.NODE_ENV === 'development') {
          console.log("✅ STOMP: Connected successfully!", frame);
        }
        setConnected(true);
        
        // Подписываемся на ошибки
        try {
          stompClient.subscribe('/user/queue/errors', (error) => {
            const errorData = JSON.parse(error.body);
            console.error('WebSocket error:', errorData);
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
          console.error('STOMP: Failed to subscribe to errors queue:', error);
        }
      },
      onDisconnect: () => {
        if (process.env.NODE_ENV === 'development') {
          console.log("STOMP: Disconnected");
        }
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error("❌ STOMP: STOMP Error", frame);
        if (process.env.NODE_ENV === 'development') {
          console.error("STOMP: Error details:", {
            command: frame.command,
            headers: frame.headers,
            body: frame.body,
          });
        }
        
        // Проверяем, если это ошибка аутентификации
        try {
          const errorBody = JSON.parse(frame.body || '{}');
          if (errorBody.message && (
            errorBody.message.includes('аутентификации') || 
            errorBody.message.includes('не аутентифицирован') ||
            errorBody.message.includes('Unauthorized')
          )) {
            console.error('WebSocket authentication error, redirecting to login');
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
            console.error('WebSocket authentication error (raw), redirecting to login');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
          }
        }
        
        setConnected(false);
      },
      onWebSocketError: (event) => {
        console.error("❌ STOMP: WebSocket error", event);
        if (process.env.NODE_ENV === 'development') {
          console.error("STOMP: WebSocket error details:", {
            type: event.type,
            target: event.target,
            url: event.target?.url,
            readyState: event.target?.readyState,
          });
        }
        setConnected(false);
      },
      onWebSocketClose: (event) => {
        if (process.env.NODE_ENV === 'development') {
          console.log("STOMP: WebSocket closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
        }
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
  }, []);

  return (
    <StompContext.Provider value={{ client, connected }}>
      {children}
    </StompContext.Provider>
  );
};
