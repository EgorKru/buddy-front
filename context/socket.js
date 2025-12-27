import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getToken } from "@/utils/api";

const SocketContext = createContext(null);

export const useSocket = () => {
    const socket = useContext(SocketContext)
    return socket
}

export const SocketProvider = (props) => {
  const { children } = props;
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Получаем URL для Socket.io из переменных окружения или используем API URL
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
                     process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 
                     'http://localhost:8080';
    
    const token = getToken();
    
    // Если нет токена, не подключаемся к Socket.IO
    if (!token) {
      console.log("Socket: No token, skipping connection");
      return;
    }
    
    // Настройки подключения Socket.io
    // Начинаем с polling (работает через HTTP), потом пробуем websocket
    const connection = io(socketUrl, {
      auth: { token },
      extraHeaders: {
        'Authorization': `Bearer ${token}`
      },
      transports: ['polling', 'websocket'], 
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    
    console.log("Socket connecting to:", socketUrl);
    setSocket(connection);

    connection.on('connect', () => {
      console.log("Socket connected:", connection.id);
    });

    connection.on('connect_error', (err) => {
      console.error("Socket connection error:", err);
      // Можно добавить уведомление пользователю о проблеме с подключением
    });

    connection.on('disconnect', (reason) => {
      console.log("Socket disconnected:", reason);
    });

    connection.on('reconnect', (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
    });

    return () => {
      connection.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
