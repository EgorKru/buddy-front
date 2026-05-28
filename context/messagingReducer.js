const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const isNewer = (a, b) => {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return ta > tb;
};

const loadReadReceiptsFromStorage = () => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('readReceipts');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  return {};
};

export const messagingInitialState = {
  chatsById: {},
  chatOrder: [],
  messagesById: {},
  messageIdsByChatId: {},
  readAtByChatIdByUserId: loadReadReceiptsFromStorage(),
  activeChatId: null,
};

export const messagingActionTypes = {
  SET_CHATS: 'SET_CHATS',
  UPSERT_CHAT: 'UPSERT_CHAT',
  SET_ACTIVE_CHAT: 'SET_ACTIVE_CHAT',
  UPSERT_MESSAGE: 'UPSERT_MESSAGE',
  REMOVE_MESSAGE: 'REMOVE_MESSAGE',
  ADD_OPTIMISTIC: 'ADD_OPTIMISTIC',
  REPLACE_OPTIMISTIC: 'REPLACE_OPTIMISTIC',
  APPLY_READ_RECEIPT: 'APPLY_READ_RECEIPT',
  SET_READ_RECEIPTS_FOR_CHAT: 'SET_READ_RECEIPTS_FOR_CHAT',
  MARK_CHAT_READ_LOCAL: 'MARK_CHAT_READ_LOCAL',
  UPDATE_PRESENCE: 'UPDATE_PRESENCE',
};

/** @deprecated internal alias */
const actionTypes = messagingActionTypes;

const ensureArray = (v) => (Array.isArray(v) ? v : []);

const upsertOrder = (order, chatId) => {
  const id = String(chatId);
  const filtered = order.filter((x) => String(x) !== id);
  return [id, ...filtered];
};

export const getChatTime = (chat) => {
  const updatedAt = chat?.updatedAt;
  const lastMessageTime = chat?.lastMessage?.createdAt;
  const createdAt = chat?.createdAt;

  let time = null;

  if (updatedAt && lastMessageTime) {
    const updatedDate = new Date(updatedAt);
    const lastMsgDate = new Date(lastMessageTime);
    time = updatedDate.getTime() > lastMsgDate.getTime() ? updatedAt : lastMessageTime;
  } else if (lastMessageTime) {
    time = lastMessageTime;
  } else if (updatedAt) {
    time = updatedAt;
  } else if (createdAt) {
    time = createdAt;
  }

  if (!time) return 0;
  try {
    const date = new Date(time);
    const timestamp = date.getTime();
    if (isNaN(timestamp)) return 0;
    return timestamp;
  } catch {
    return 0;
  }
};

export const sortChatsByTime = (chatsById) => {
  return Object.keys(chatsById).sort((a, b) => {
    const timeA = getChatTime(chatsById[a]);
    const timeB = getChatTime(chatsById[b]);
    return timeB - timeA;
  });
};

export const messagingReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_CHATS: {
      const list = ensureArray(action.payload?.chats);
      const chatsById = {};

      for (const c of list) {
        if (!c?.id) continue;
        const id = String(c.id);
        const existingChat = state.chatsById[id];

        const newLastMessageValid = c.lastMessage && c.lastMessage.id && c.lastMessage.createdAt;

        const normalizedChat = {
          ...c,
          updatedAt: c.updatedAt ?? c.lastMessage?.createdAt ?? c.createdAt,
          lastMessage: newLastMessageValid ? c.lastMessage : existingChat?.lastMessage || null,
        };
        chatsById[id] = normalizedChat;
      }

      const chatOrder = sortChatsByTime(chatsById);

      return { ...state, chatsById, chatOrder };
    }

    case actionTypes.UPSERT_CHAT: {
      const chat = action.payload?.chat;
      if (!chat?.id) return state;
      const id = String(chat.id);
      const existing = state.chatsById[id] || {};

      const newLastMessageValid =
        chat.lastMessage && chat.lastMessage.id && chat.lastMessage.createdAt;

      const merged = {
        ...existing,
        ...chat,
        lastMessage: newLastMessageValid ? chat.lastMessage : existing.lastMessage || null,
        updatedAt: chat.updatedAt || existing.updatedAt || null,
      };
      const updatedChatsById = { ...state.chatsById, [id]: merged };

      const chatOrder = sortChatsByTime(updatedChatsById);

      return {
        ...state,
        chatsById: updatedChatsById,
        chatOrder,
      };
    }

    case actionTypes.SET_ACTIVE_CHAT: {
      const newActiveChatId = action.payload?.chatId ? String(action.payload.chatId) : null;
      const chatsById = { ...state.chatsById };

      if (newActiveChatId && chatsById[newActiveChatId]) {
        chatsById[newActiveChatId] = {
          ...chatsById[newActiveChatId],
          unreadCount: 0,
        };
      }

      return {
        ...state,
        activeChatId: newActiveChatId,
        chatsById,
      };
    }

    case actionTypes.UPSERT_MESSAGE: {
      const message = action.payload?.message;
      const chatId = message?.chatId ?? action.payload?.chatId;
      if (!message?.id || !chatId) return state;
      const cid = String(chatId);
      const mid = String(message.id);

      const existingMessage = state.messagesById[mid];
      const mergedMessage = existingMessage ? { ...existingMessage, ...message } : message;
      const messagesById = { ...state.messagesById, [mid]: mergedMessage };
      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const has = existingIds.some((x) => String(x) === mid);
      const nextIds = has ? existingIds : [...existingIds, mid];
      nextIds.sort((a, b) => {
        const ma = messagesById[String(a)];
        const mb = messagesById[String(b)];
        return new Date(ma?.createdAt).getTime() - new Date(mb?.createdAt).getTime();
      });

      const chatsById = { ...state.chatsById };
      const chat = chatsById[cid];
      const isActiveChat = state.activeChatId && String(state.activeChatId) === cid;
      const isVisible = typeof window !== 'undefined' && document.visibilityState === 'visible';
      const shouldResetUnread = isActiveChat && isVisible;

      if (chat) {
        const last = chat?.lastMessage;
        const isLastMessage = last?.id && String(last.id) === mid;
        if (!last?.createdAt || isNewer(message.createdAt, last.createdAt) || isLastMessage) {
          const newUnreadCount = shouldResetUnread
            ? 0
            : action.payload?.unreadDelta != null
              ? Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta))
              : chat.unreadCount;

          chatsById[cid] = {
            ...chat,
            lastMessage: message,
            updatedAt: toIso(message.createdAt) ?? chat.updatedAt ?? new Date().toISOString(),
            unreadCount: newUnreadCount,
          };
        } else if (action.payload?.unreadDelta != null) {
          const newUnreadCount = shouldResetUnread
            ? 0
            : Math.max(0, Number(chat.unreadCount || 0) + Number(action.payload.unreadDelta));

          chatsById[cid] = {
            ...chat,
            unreadCount: newUnreadCount,
          };
        } else if (shouldResetUnread && chat.unreadCount > 0) {
          chatsById[cid] = {
            ...chat,
            unreadCount: 0,
          };
        }
      }

      const chatOrder = sortChatsByTime(chatsById);

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder,
      };
    }

    case actionTypes.REMOVE_MESSAGE: {
      const messageId = action.payload?.messageId;
      const chatId = action.payload?.chatId;
      if (!messageId || !chatId) return state;
      const cid = String(chatId);
      const mid = String(messageId);

      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const nextIds = existingIds.filter((id) => String(id) !== mid);
      const messageIdsByChatId = { ...state.messageIdsByChatId, [cid]: nextIds };

      const messagesById = { ...state.messagesById };
      const existingMessage = messagesById[mid];
      if (existingMessage) {
        messagesById[mid] = {
          ...existingMessage,
          deletedForMe: action.payload.deletedForMe ?? existingMessage.deletedForMe,
          deletedForAll: action.payload.deletedForAll ?? existingMessage.deletedForAll,
        };
      }

      return { ...state, messagesById, messageIdsByChatId };
    }

    case actionTypes.ADD_OPTIMISTIC: {
      const { chatId, message } = action.payload || {};
      if (!chatId || !message?.id) return state;
      const cid = String(chatId);
      const mid = String(message.id);
      const messagesById = { ...state.messagesById, [mid]: message };
      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const nextIds = existingIds.some((x) => String(x) === mid)
        ? existingIds
        : [...existingIds, mid];

      const chatsById = { ...state.chatsById };
      const chat = chatsById[cid];
      if (chat) {
        chatsById[cid] = {
          ...chat,
          lastMessage: message,
          updatedAt: toIso(message.createdAt) ?? chat.updatedAt ?? new Date().toISOString(),
        };
      }

      const chatOrder = sortChatsByTime(chatsById);

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: nextIds },
        chatsById,
        chatOrder,
      };
    }

    case actionTypes.REPLACE_OPTIMISTIC: {
      const { chatId, tempId, message, status } = action.payload || {};
      if (!chatId || !tempId || !message?.id) return state;
      const cid = String(chatId);
      const tid = String(tempId);
      const mid = String(message.id);

      const existingIds = ensureArray(state.messageIdsByChatId[cid]);
      const idx = existingIds.findIndex((x) => String(x) === tid);
      const idsWithoutTemp = existingIds.filter((x) => String(x) !== tid);
      const withReal = idsWithoutTemp.some((x) => String(x) === mid)
        ? idsWithoutTemp
        : idx === -1
          ? [...idsWithoutTemp, mid]
          : [...idsWithoutTemp.slice(0, idx), mid, ...idsWithoutTemp.slice(idx)];

      const messagesById = { ...state.messagesById };
      const optimisticMsg = messagesById[tid];
      delete messagesById[tid];

      const finalMessage = { ...message, status, isOptimistic: false };
      if (optimisticMsg) {
        if (!finalMessage.fileSize && optimisticMsg.fileSize) {
          finalMessage.fileSize = optimisticMsg.fileSize;
        }
        if (!finalMessage.mimeType && optimisticMsg.mimeType) {
          finalMessage.mimeType = optimisticMsg.mimeType;
        }
        if (!finalMessage.fileName && optimisticMsg.fileName) {
          finalMessage.fileName = optimisticMsg.fileName;
        }
      }
      messagesById[mid] = finalMessage;

      withReal.sort((a, b) => {
        const ma = messagesById[String(a)];
        const mb = messagesById[String(b)];
        return new Date(ma?.createdAt).getTime() - new Date(mb?.createdAt).getTime();
      });

      const chatsById = { ...state.chatsById };
      const chat = chatsById[cid];
      if (chat?.lastMessage?.id && String(chat.lastMessage.id) === tid) {
        chatsById[cid] = {
          ...chat,
          lastMessage: messagesById[mid],
          updatedAt:
            toIso(messagesById[mid]?.createdAt) ?? chat.updatedAt ?? new Date().toISOString(),
        };
      }

      const currentChatOrder = state.chatOrder;
      const currentFirstChatId = currentChatOrder[0];
      const chatTime = getChatTime(chatsById[cid]);
      const firstChatTime = currentFirstChatId ? getChatTime(chatsById[currentFirstChatId]) : 0;

      let chatOrder = currentChatOrder;
      if (String(currentFirstChatId) !== cid && chatTime > firstChatTime) {
        chatOrder = sortChatsByTime(chatsById);
      } else if (String(currentFirstChatId) === cid) {
        chatOrder = currentChatOrder;
      }

      return {
        ...state,
        messagesById,
        messageIdsByChatId: { ...state.messageIdsByChatId, [cid]: withReal },
        chatsById,
        chatOrder,
      };
    }

    case actionTypes.APPLY_READ_RECEIPT: {
      const { chatId, readerId, readAt } = action.payload || {};
      if (!chatId || !readerId || !readAt) return state;
      const cid = String(chatId);
      const rid = String(readerId);
      const iso = toIso(readAt);
      if (!iso) return state;
      const current = state.readAtByChatIdByUserId[cid]?.[rid];
      if (current && !isNewer(iso, current)) return state;

      const newReadAtByChatIdByUserId = {
        ...state.readAtByChatIdByUserId,
        [cid]: {
          ...(state.readAtByChatIdByUserId[cid] || {}),
          [rid]: iso,
        },
      };

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('readReceipts', JSON.stringify(newReadAtByChatIdByUserId));
        } catch (e) {}
      }

      return {
        ...state,
        readAtByChatIdByUserId: newReadAtByChatIdByUserId,
      };
    }

    case actionTypes.SET_READ_RECEIPTS_FOR_CHAT: {
      const { chatId, readReceipts } = action.payload || {};
      if (!chatId || !readReceipts) return state;
      const cid = String(chatId);
      const newReadAtByChatIdByUserId = {
        ...state.readAtByChatIdByUserId,
        [cid]: {},
      };

      for (const [readerId, readAt] of Object.entries(readReceipts)) {
        if (!readerId || !readAt) continue;
        const rid = String(readerId);
        const iso = toIso(readAt);
        if (!iso) continue;
        const current = newReadAtByChatIdByUserId[cid]?.[rid];
        if (!current || isNewer(iso, current)) {
          newReadAtByChatIdByUserId[cid][rid] = iso;
        }
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('readReceipts', JSON.stringify(newReadAtByChatIdByUserId));
        } catch (e) {}
      }

      return {
        ...state,
        readAtByChatIdByUserId: newReadAtByChatIdByUserId,
      };
    }

    case actionTypes.MARK_CHAT_READ_LOCAL: {
      const cid = action.payload?.chatId ? String(action.payload.chatId) : null;
      if (!cid) return state;
      const chat = state.chatsById[cid];
      if (!chat) return state;
      return {
        ...state,
        chatsById: {
          ...state.chatsById,
          [cid]: { ...chat, unreadCount: 0 },
        },
      };
    }

    case actionTypes.UPDATE_PRESENCE: {
      const { userId, online, lastSeenAt } = action.payload || {};
      if (!userId) return state;
      const uid = String(userId);
      const chatsById = { ...state.chatsById };
      let updated = false;

      for (const [cid, chat] of Object.entries(chatsById)) {
        if (!chat?.participants) continue;
        const participants = chat.participants.map((p) => {
          if (String(p.id) !== uid) return p;
          return {
            ...p,
            online: online ?? p.online,
            lastSeenAt: lastSeenAt ?? p.lastSeenAt,
          };
        });
        if (
          participants.some(
            (p, i) =>
              p.online !== chat.participants[i]?.online ||
              p.lastSeenAt !== chat.participants[i]?.lastSeenAt
          )
        ) {
          chatsById[cid] = { ...chat, participants };
          updated = true;
        }
      }

      return updated ? { ...state, chatsById } : state;
    }

    default:
      return state;
  }
};
