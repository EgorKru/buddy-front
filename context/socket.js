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

// Алиас для обратной совместимости (используется в комнатах)
// ВАЖНО: Для чатов используйте useStomp() и STOMP API
// Для комнат (video calls) может потребоваться отдельный Socket.IO клиент
export const useSocket = () => {
  // Возвращаем null, чтобы код не падал
  // Комнаты (video calls) требуют Socket.IO, который не настроен
  // TODO: Настроить Socket.IO для комнат или перевести на STOMP
  console.warn('useSocket() is deprecated. Use useStomp() for chat functionality.');
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
      console.log("STOMP: No token, skipping connection");
      return;
    }

    // Логируем информацию о подключении
    console.log("STOMP: Initializing connection...");
    console.log("STOMP: WebSocket URL:", config.stomp.url);
    
    // Проверяем, не отключено ли подключение (для временного решения проблем)
    const disableWebSocket = localStorage.getItem('disable_websocket') === 'true';
    if (disableWebSocket) {
      console.warn("STOMP: WebSocket подключение отключено пользователем");
      console.warn("STOMP: Чтобы включить: localStorage.removeItem('disable_websocket')");
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
    
    console.log(`STOMP: Using SockJS to connect to`, sockJsUrl);
    
    // Опция: передать токен через query параметр (альтернатива connectHeaders)
    // Можно попробовать, если через заголовки не работает
    const useTokenInUrl = process.env.NEXT_PUBLIC_WS_TOKEN_IN_URL === 'true';
    const finalWsUrl = useTokenInUrl ? `${sockJsUrl}?token=${token}` : sockJsUrl;
    
    // Создаем STOMP клиент
    const stompClient = new Client({
      // Для SockJS не используем brokerURL, только webSocketFactory
      webSocketFactory: () => {
        console.log("STOMP: Creating SockJS connection to", finalWsUrl);
        const sock = new SockJS(finalWsUrl);
        
        // Добавляем обработчики для диагностики
        sock.onopen = () => {
          console.log("STOMP: SockJS connection opened successfully");
        };
        
        sock.onclose = (event) => {
          console.log("STOMP: SockJS connection closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
        };
        
        sock.onerror = (error) => {
          console.error("STOMP: SockJS connection error", error);
          // Детальная информация об ошибке
          if (error.target) {
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
        Authorization: `Bearer ${token}`
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
        console.log("✅ STOMP: Connected successfully!", frame);
        setConnected(true);
        
        // Подписываемся на ошибки
        try {
          stompClient.subscribe('/queue/errors', (error) => {
            console.error('WebSocket error:', error.body);
            // Можно добавить уведомление пользователю об ошибке
          });
        } catch (error) {
          console.error('STOMP: Failed to subscribe to errors queue:', error);
        }
      },
      onDisconnect: () => {
        console.log("STOMP: Disconnected");
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error("❌ STOMP: STOMP Error", frame);
        console.error("STOMP: Error details:", {
          command: frame.command,
          headers: frame.headers,
          body: frame.body,
        });
        setConnected(false);
      },
      onWebSocketError: (event) => {
        console.error("❌ STOMP: WebSocket error", event);
        console.error("STOMP: WebSocket error details:", {
          type: event.type,
          target: event.target,
          url: event.target?.url,
          readyState: event.target?.readyState,
        });
        setConnected(false);
      },
      onWebSocketClose: (event) => {
        console.log("STOMP: WebSocket closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
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
