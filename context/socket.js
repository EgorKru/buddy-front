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
      console.log("STOMP: No token, skipping connection");
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
      console.log("STOMP: Already connected with same token, skipping reconnection");
      return;
    }
    
    // Если нужно переподключиться, сначала отключаем старый клиент
    if (clientRef.current && clientRef.current.connected) {
      console.log("STOMP: Disconnecting old client for reconnection");
      clientRef.current.deactivate();
      setClient(null);
      setConnected(false);
    }

    // Логируем информацию о подключении
    console.log("STOMP: Initializing connection...");
    console.log("STOMP: WebSocket URL:", config.stomp.url);
    console.log("STOMP: Token present:", !!token);
    
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
    
    console.log(`STOMP: Using SockJS to connect to`, sockJsUrl);
    
    // Бэкенд поддерживает токен в query параметре для SockJS handshake
    // Это помогает при первоначальном подключении
    // Также передаем токен в connectHeaders для STOMP
    const finalWsUrl = `${sockJsUrl}?token=${encodeURIComponent(token)}`;
    
    // Создаем STOMP клиент
    const stompClient = new Client({
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
      // Передача токена через заголовки STOMP (основной способ)
      // Бэкенд поддерживает оба заголовка: Authorization и X-Authorization
      // Токен также передается в URL для SockJS handshake
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        // X-Authorization для совместимости
        'X-Authorization': `Bearer ${token}`,
      },
      
      // Добавляем логирование STOMP команд для диагностики
      beforeConnect: () => {
        console.log('🔌 STOMP: Подготовка к подключению...');
        console.log('🔌 STOMP: Connect headers:', {
          Authorization: 'Bearer ***',
          'X-Authorization': 'Bearer ***'
        });
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
        console.log("STOMP: Connection headers:", frame.headers);
        console.log("STOMP: Client state:", stompClient.state);
        // Устанавливаем connected синхронно, чтобы компоненты сразу увидели изменение
        setConnected(true);
        
        // Дополнительная проверка через небольшую задержку
        setTimeout(() => {
          if (stompClient.connected && stompClient.active) {
            console.log("✅ STOMP: Connection verified, ready to send messages");
          } else {
            console.warn("⚠️ STOMP: Connection state mismatch after onConnect");
          }
        }, 100);
        
        // Подписываемся на ошибки
        try {
          const errorSubscription = stompClient.subscribe('/user/queue/errors', (error) => {
            const errorData = JSON.parse(error.body);
            console.error('❌ WebSocket error:', errorData);
            // Если ошибка аутентификации, перенаправляем на логин
            if (errorData.message && errorData.message.includes('аутентификации')) {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }
            }
          });
          console.log("✅ STOMP: Subscribed to /user/queue/errors");
        } catch (error) {
          console.error('❌ STOMP: Failed to subscribe to errors queue:', error);
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
        console.error("STOMP: Error details:", {
          command: frame.command,
          headers: frame.headers,
          body: frame.body,
        });
        
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
        console.error("STOMP: WebSocket error details:", {
          type: event.type,
          target: event.target,
          url: event.target?.url,
          readyState: event.target?.readyState,
        });
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
    console.log("STOMP: Activating connection...");
    stompClient.activate();
    console.log("STOMP: Activation called, waiting for connection...");

    return () => {
      if (stompClient && stompClient.connected) {
        console.log("STOMP: Cleaning up connection");
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
        console.log("STOMP: Token found but not connected, attempting to reconnect...");
        // Деактивируем старый клиент
        hasClient.deactivate();
        // Небольшая задержка перед переподключением
        setTimeout(() => {
          // Эффект выше перезапустится и создаст новое подключение
          // Но для этого нужно, чтобы компонент перемонтировался или мы вручную переподключились
          console.log("STOMP: Ready to reconnect");
        }, 1000);
      }
    };
    
    // Проверяем каждые 2 секунды
    const interval = setInterval(checkTokenAndReconnect, 2000);
    return () => clearInterval(interval);
  }, [connected]);
  
  // Диагностика состояния подключения
  useEffect(() => {
    const interval = setInterval(() => {
      const currentToken = getToken();
      const hasClient = clientRef.current;
      const isConnected = hasClient && hasClient.connected;
      
      console.log('🔍 STOMP Диагностика:', {
        hasToken: !!currentToken,
        hasClient: !!hasClient,
        connected: isConnected,
        clientState: hasClient ? hasClient.state : 'N/A',
        clientActive: hasClient ? hasClient.active : false,
        contextConnected: connected,
      });
    }, 10000); // Каждые 10 секунд
    
    return () => clearInterval(interval);
  }, [connected]);

  return (
    <StompContext.Provider value={{ client, connected }}>
      {children}
    </StompContext.Provider>
  );
};
