# Frontend Integration Guide

## Содержание

1. [Статус бэкенда](#статус-бэкенда)
2. [Базовые настройки](#базовые-настройки)
3. [Аутентификация](#аутентификация)
4. [REST API](#rest-api)
5. [WebSocket](#websocket)
6. [Чаты и сообщения](#чаты-и-сообщения)
7. [Файлы и медиа](#файлы-и-медиа)
8. [Звонки (WebRTC)](#звонки-webrtc)
9. [Комнаты (видеоконференции)](#комнаты-видеоконференции)
10. [E2EE (будущее)](#e2ee-будущее)

---

## Статус бэкенда

### Что реализовано ✅

| Функционал | Статус | API |
|------------|--------|-----|
| Регистрация/Логин | ✅ Готово | `/api/auth/*` |
| JWT токены | ✅ Готово | Header `Authorization: Bearer <token>` |
| Чаты (личные/группы) | ✅ Готово | `/api/chats/*` |
| Сообщения (CRUD) | ✅ Готово | `/api/chats/{id}/messages` |
| WebSocket real-time | ✅ Готово | `/ws` (STOMP) |
| Файлы/картинки/голосовые | ✅ Готово | `/api/chats/{id}/messages/*` |
| Typing indicator | ✅ Готово | WebSocket |
| Online/offline статус | ✅ Готово | WebSocket + Redis |
| Звонки 1:1 (signaling) | ✅ Готово | WebSocket `/app/call.signal` |
| TURN credentials | ✅ Готово | `/api/turn/credentials` |
| Комнаты (signaling) | ✅ Готово | WebSocket `/app/room.signal` |
| Rate limiting | ✅ Готово | 100 req/min |
| Swagger UI | ✅ Готово | `/swagger-ui.html` |

### Что НЕ реализовано на бэкенде ❌

| Функционал | Статус | Комментарий |
|------------|--------|-------------|
| E2EE шифрование | ⚠️ API готов | Клиент должен шифровать |
| SFU сервер | ❌ Нет | Нужен Mediasoup/Janus |
| Push notifications | ❌ Нет | Нужен Firebase/APNs |
| CDN для файлов | ❌ Нет | Файлы локальные |

---

## Базовые настройки

### URLs

```javascript
const CONFIG = {
  // Production
  API_URL: 'https://pager.website',
  WS_URL: 'wss://pager.website/ws',
  
  // Development
  // API_URL: 'http://localhost:8080',
  // WS_URL: 'ws://localhost:8080/ws',
};
```

### Headers для всех запросов

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
};
```

---

## Аутентификация

### Регистрация

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "displayName": "John Doe"
}
```

**Ответ:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "type": "Bearer",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "avatarUrl": null
  }
}
```

### Логин

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securePassword123"
}
```

### Хранение токена

```javascript
// После успешного логина
localStorage.setItem('token', response.token);
localStorage.setItem('user', JSON.stringify(response.user));

// При запросах
const token = localStorage.getItem('token');
```

### Проверка токена

```http
GET /api/users/me
Authorization: Bearer <token>
```

Если 401 — токен истёк, нужен re-login.

---

## REST API

### Пользователи

```javascript
// Текущий пользователь
GET /api/users/me

// Поиск пользователей
GET /api/users/search?query=john

// Пользователь по ID
GET /api/users/{id}

// Обновить профиль
PUT /api/users/me
{
  "displayName": "New Name",
  "avatarUrl": "https://..."
}
```

### Чаты

```javascript
// Список чатов
GET /api/chats

// Создать личный чат
POST /api/chats
{
  "type": "DIRECT",
  "participantIds": [2]
}

// Создать группу
POST /api/chats
{
  "type": "GROUP",
  "name": "Моя группа",
  "participantIds": [2, 3, 4]
}

// Получить чат
GET /api/chats/{chatId}

// Удалить чат (выйти)
DELETE /api/chats/{chatId}
```

### Сообщения

```javascript
// История сообщений (с пагинацией)
GET /api/chats/{chatId}/messages?page=0&size=50

// Отправить текст (REST, но лучше WebSocket)
POST /api/chats/{chatId}/messages
{
  "content": "Привет!",
  "type": "TEXT"
}

// Редактировать
PUT /api/chats/{chatId}/messages/{messageId}
{
  "content": "Отредактированное сообщение"
}

// Удалить
DELETE /api/chats/{chatId}/messages/{messageId}?forAll=true
```

---

## WebSocket

### Подключение (STOMP + SockJS)

```javascript
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const client = new Client({
  webSocketFactory: () => new SockJS(`${API_URL}/ws`),
  connectHeaders: {
    Authorization: `Bearer ${token}`,
  },
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
});

client.onConnect = () => {
  console.log('WebSocket connected');
  
  // Подписка на личные сообщения
  client.subscribe('/user/queue/messages', (message) => {
    const event = JSON.parse(message.body);
    handleEvent(event);
  });
  
  // Подписка на ошибки
  client.subscribe('/user/queue/errors', (message) => {
    console.error('WS Error:', message.body);
  });
  
  // Подписка на подтверждения отправки
  client.subscribe('/user/queue/message-sent', (message) => {
    const confirmation = JSON.parse(message.body);
    handleSentConfirmation(confirmation);
  });
};

client.onDisconnect = () => {
  console.log('WebSocket disconnected');
};

client.activate();
```

### Подписка на чат

```javascript
function subscribeToChat(chatId) {
  client.subscribe(`/topic/chat/${chatId}`, (message) => {
    const event = JSON.parse(message.body);
    handleChatEvent(chatId, event);
  });
}
```

### Отправка сообщения

```javascript
function sendMessage(chatId, content, type = 'TEXT') {
  client.publish({
    destination: '/app/chat.sendMessage',
    body: JSON.stringify({
      chatId,
      content,
      type,
    }),
  });
}
```

### Typing indicator

```javascript
function sendTyping(chatId, isTyping) {
  client.publish({
    destination: '/app/chat.typing',
    body: JSON.stringify({
      chatId,
      typing: isTyping,
    }),
  });
}
```

### Mark as read

```javascript
function markAsRead(chatId, lastReadMessageId) {
  client.publish({
    destination: '/app/chat.markRead',
    body: JSON.stringify({
      chatId,
      lastReadMessageId,
    }),
  });
}
```

### Обработка событий

```javascript
function handleEvent(event) {
  switch (event.type) {
    case 'MESSAGE_NEW':
      addMessage(event.chatId, event.message);
      break;
      
    case 'MESSAGE_EDITED':
      updateMessage(event.chatId, event.messageId, event.newContent);
      break;
      
    case 'MESSAGE_DELETED':
      removeMessage(event.chatId, event.messageId);
      break;
      
    case 'TYPING_STARTED':
      showTypingIndicator(event.chatId, event.userId);
      break;
      
    case 'TYPING_STOPPED':
      hideTypingIndicator(event.chatId, event.userId);
      break;
      
    case 'CHAT_READ':
      updateReadStatus(event.chatId, event.userId, event.lastReadMessageId);
      break;
      
    case 'PRESENCE_ONLINE':
      setUserOnline(event.userId);
      break;
      
    case 'PRESENCE_OFFLINE':
      setUserOffline(event.userId, event.lastSeen);
      break;
  }
}
```

---

## Чаты и сообщения

### Типы сообщений

```typescript
enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  SYSTEM = 'SYSTEM',
}
```

### Структура сообщения

```typescript
interface Message {
  id: number;
  chatId: number;
  content: string;
  type: MessageType;
  senderId: number;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  createdAt: string;         // ISO 8601
  editedAt?: string;
  edited: boolean;
  
  // Для файлов
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  
  // Для голосовых/видео
  duration?: number;         // секунды
  
  // Reply
  replyTo?: {
    id: number;
    content: string;
    senderUsername: string;
  };
  
  // Синхронизация
  seq: number;
  pts: number;
}
```

### Отправка с reply

```javascript
client.publish({
  destination: '/app/chat.sendMessage',
  body: JSON.stringify({
    chatId: 123,
    content: 'Ответ на сообщение',
    type: 'TEXT',
    replyToMessageId: 456,
  }),
});
```

---

## Файлы и медиа

### Загрузка файла

```javascript
async function uploadFile(chatId, file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/api/chats/${chatId}/messages/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
  // { messageId: 123, fileUrl: "...", message: {...} }
}
```

### Загрузка картинки

```javascript
async function uploadImage(chatId, imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch(`${API_URL}/api/chats/${chatId}/messages/upload-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
}
```

### Загрузка голосового

```javascript
async function uploadVoice(chatId, audioBlob, duration) {
  const formData = new FormData();
  formData.append('voice', audioBlob, 'voice.webm');
  formData.append('duration', duration.toString());
  
  const response = await fetch(`${API_URL}/api/chats/${chatId}/messages/upload-voice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
}
```

### Отображение файлов

```javascript
// URL для скачивания файла
const fileUrl = `${API_URL}${message.fileUrl}`;

// Картинки можно показывать напрямую
<img src={fileUrl} alt={message.fileName} />

// Для аудио
<audio src={fileUrl} controls />
```

---

## Звонки (WebRTC)

### Получить TURN credentials

```javascript
async function getTurnCredentials() {
  const response = await fetch(`${API_URL}/api/turn/credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
  // { urls: [...], username: "...", credential: "...", ttl: 86400 }
}
```

### Настройка RTCPeerConnection

```javascript
async function createPeerConnection() {
  const turnCreds = await getTurnCredentials();
  
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: turnCreds.urls,
        username: turnCreds.username,
        credential: turnCreds.credential,
      },
    ],
  };
  
  return new RTCPeerConnection(config);
}
```

### Инициировать звонок

```javascript
// 1. Подписка на сигналы
client.subscribe('/user/queue/call-signal', handleCallSignal);
client.subscribe('/user/queue/call-events', handleCallEvent);

// 2. Отправить CALL_INITIATE
function initiateCall(targetUserId, callType = 'AUDIO') {
  client.publish({
    destination: '/app/call.signal',
    body: JSON.stringify({
      type: 'CALL_INITIATE',
      targetUserId,
      callType, // 'AUDIO' или 'VIDEO'
    }),
  });
}
```

### Обработка входящего звонка

```javascript
function handleCallEvent(message) {
  const event = JSON.parse(message.body);
  
  switch (event.eventType) {
    case 'INCOMING_CALL':
      showIncomingCallUI(event.call, event.fromUserId);
      break;
      
    case 'CALL_ACCEPTED':
      startWebRTCConnection(event.callId);
      break;
      
    case 'CALL_ENDED':
      closeCall(event.callId);
      break;
  }
}
```

### WebRTC signaling

```javascript
// Отправить SDP Offer
function sendOffer(callId, sdp) {
  client.publish({
    destination: '/app/call.signal',
    body: JSON.stringify({
      type: 'CALL_OFFER',
      callId,
      sdp,
    }),
  });
}

// Отправить SDP Answer
function sendAnswer(callId, sdp) {
  client.publish({
    destination: '/app/call.signal',
    body: JSON.stringify({
      type: 'CALL_ANSWER',
      callId,
      sdp,
    }),
  });
}

// Отправить ICE Candidate
function sendIceCandidate(callId, candidate) {
  client.publish({
    destination: '/app/call.signal',
    body: JSON.stringify({
      type: 'CALL_ICE_CANDIDATE',
      callId,
      iceCandidate: candidate.candidate,
      iceCandidateSdpMid: candidate.sdpMid,
      iceCandidateSdpMLineIndex: candidate.sdpMLineIndex,
    }),
  });
}
```

### Полный пример звонка

```javascript
class CallManager {
  constructor(stompClient) {
    this.client = stompClient;
    this.peerConnection = null;
    this.localStream = null;
    this.currentCallId = null;
  }
  
  async startCall(targetUserId, withVideo = false) {
    // 1. Получить локальный медиа-поток
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo,
    });
    
    // 2. Создать peer connection
    this.peerConnection = await this.createPeerConnection();
    
    // 3. Добавить треки
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });
    
    // 4. Инициировать звонок
    this.client.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({
        type: 'CALL_INITIATE',
        targetUserId,
        callType: withVideo ? 'VIDEO' : 'AUDIO',
      }),
    });
  }
  
  async handleCallAccepted(callId) {
    this.currentCallId = callId;
    
    // Создать и отправить offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    this.client.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({
        type: 'CALL_OFFER',
        callId,
        sdp: offer.sdp,
      }),
    });
  }
  
  async handleOffer(callId, sdp) {
    await this.peerConnection.setRemoteDescription({
      type: 'offer',
      sdp,
    });
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    this.client.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({
        type: 'CALL_ANSWER',
        callId,
        sdp: answer.sdp,
      }),
    });
  }
  
  endCall() {
    this.client.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({
        type: 'CALL_END',
        callId: this.currentCallId,
      }),
    });
    
    this.cleanup();
  }
  
  cleanup() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream = null;
    this.currentCallId = null;
  }
}
```

---

## Комнаты (видеоконференции)

### Создать комнату

```http
POST /api/rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Встреча команды",
  "type": "PUBLIC",
  "maxParticipants": 50,
  "waitingRoom": false,
  "screenShareEnabled": true
}
```

**Ответ:**
```json
{
  "id": 1,
  "roomId": "abc123xyz",
  "title": "Встреча команды",
  "host": { "id": 1, "username": "host" },
  "participants": [...],
  "status": "WAITING"
}
```

### Присоединиться к комнате

```javascript
// REST
POST /api/rooms/join
{ "roomId": "abc123xyz" }

// Или через WebSocket
client.publish({
  destination: '/app/room.signal',
  body: JSON.stringify({
    type: 'ROOM_JOIN',
    roomId: 'abc123xyz',
  }),
});
```

### Room WebSocket события

```javascript
client.subscribe('/user/queue/room-signal', handleRoomSignal);

function handleRoomSignal(message) {
  const event = JSON.parse(message.body);
  
  switch (event.type) {
    case 'ROOM_JOIN':
      // Успешно присоединились
      break;
    case 'ROOM_OFFER':
      // Получен WebRTC offer от другого участника
      break;
    case 'ROOM_ANSWER':
      // Получен WebRTC answer
      break;
    case 'ROOM_ICE_CANDIDATE':
      // Получен ICE candidate
      break;
  }
}
```

### Модерация

```javascript
// Замутить участника (host only)
client.publish({
  destination: '/app/room.signal',
  body: JSON.stringify({
    type: 'ROOM_MUTE_PARTICIPANT',
    roomId: 'abc123xyz',
    targetUserId: 123,
  }),
});

// Выгнать участника
client.publish({
  destination: '/app/room.signal',
  body: JSON.stringify({
    type: 'ROOM_KICK_PARTICIPANT',
    roomId: 'abc123xyz',
    targetUserId: 123,
  }),
});
```

---

## E2EE (будущее)

> ⚠️ E2EE API готов на бэкенде, но **шифрование должно происходить на клиенте**.

### API для ключей

```http
# Регистрация ключей устройства
POST /api/keys/register
{
  "deviceId": "device-uuid",
  "identityKey": "base64...",
  "signedPreKey": {
    "keyId": 1,
    "publicKey": "base64...",
    "signature": "base64..."
  },
  "oneTimePreKeys": [
    { "keyId": 1, "publicKey": "base64..." },
    { "keyId": 2, "publicKey": "base64..." }
  ]
}

# Получить ключи для установления сессии
GET /api/keys/bundle?userId=123&deviceId=device-uuid

# Список устройств пользователя
GET /api/keys/devices?userId=123
```

### Библиотека для клиента

Рекомендуется использовать `libsignal-protocol-javascript`:
```bash
npm install @pager/libsignal-protocol
```

---

## Ошибки

### HTTP коды

| Код | Значение |
|-----|----------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (валидация) |
| 401 | Unauthorized (токен) |
| 403 | Forbidden (нет доступа) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

### Формат ошибки

```json
{
  "timestamp": "2026-01-30T12:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Username already exists",
  "path": "/api/auth/register"
}
```

---

## Проверка здоровья

```http
GET /actuator/health
```

```json
{
  "status": "UP",
  "groups": ["liveness", "readiness"]
}
```

---

## Swagger UI

Полная документация API:
```
https://pager.website/swagger-ui.html
```
