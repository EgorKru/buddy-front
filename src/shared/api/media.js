/**
 * API эмодзи, стикеров, GIF и реакций.
 */
import { apiRequest } from './client';

export const mediaAPI = {
  getEmojiPacks: () => apiRequest('/emoji-packs'),
  getEmojiPack: (packId) => apiRequest(`/emoji-packs/${packId}`),
  createEmojiPack: (body) => apiRequest('/emoji-packs', { method: 'POST', body }),
  deleteEmojiPack: (packId) => apiRequest(`/emoji-packs/${packId}`, { method: 'DELETE' }),
  addCustomEmoji: (packId, body) =>
    apiRequest(`/emoji-packs/${packId}/emojis`, { method: 'POST', body }),
  deleteCustomEmoji: (packId, emojiId) =>
    apiRequest(`/emoji-packs/${packId}/emojis/${emojiId}`, { method: 'DELETE' }),

  getStickerPacks: () => apiRequest('/sticker-packs'),
  createStickerPack: (body) => apiRequest('/sticker-packs', { method: 'POST', body }),
  deleteStickerPack: (packId) => apiRequest(`/sticker-packs/${packId}`, { method: 'DELETE' }),
  addSticker: (packId, body) =>
    apiRequest(`/sticker-packs/${packId}/stickers`, { method: 'POST', body }),

  getGifs: () => apiRequest('/gifs'),
  createGif: (body) => apiRequest('/gifs', { method: 'POST', body }),
  deleteGif: (gifId) => apiRequest(`/gifs/${gifId}`, { method: 'DELETE' }),

  toggleReaction: (chatId, messageId, emoji) =>
    apiRequest(`/chats/${chatId}/messages/${messageId}/reactions`, {
      method: 'POST',
      body: { emoji },
    }),
};
