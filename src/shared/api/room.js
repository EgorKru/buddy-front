/**
 * API комнат (видеозвонки).
 * FSD: shared/api
 */
import { apiRequest } from './client';

export const roomAPI = {
  createRoom: async (title, chatId, type = 'PUBLIC', options = {}) => {
    const { customRoomId, maxParticipants, waitingRoom, screenShareEnabled, recordingEnabled } =
      options;
    return apiRequest('/rooms', {
      method: 'POST',
      body: {
        ...(title && { title }),
        ...(chatId && { chatId }),
        type,
        ...(customRoomId && { customRoomId }),
        ...(maxParticipants && { maxParticipants }),
        ...(waitingRoom !== undefined && { waitingRoom }),
        ...(screenShareEnabled !== undefined && { screenShareEnabled }),
        ...(recordingEnabled !== undefined && { recordingEnabled }),
      },
    });
  },

  joinRoom: async (roomId) => {
    return apiRequest('/rooms/join', {
      method: 'POST',
      body: { roomId },
    });
  },

  leaveRoom: async (roomId) => {
    return apiRequest(`/rooms/${roomId}/leave`, {
      method: 'POST',
    });
  },

  endRoom: async (roomId) => {
    return apiRequest(`/rooms/${roomId}/end`, {
      method: 'POST',
    });
  },

  getRoom: async (roomId) => {
    return apiRequest(`/rooms/${roomId}`);
  },

  getActiveRooms: async () => {
    return apiRequest('/rooms/active');
  },

  updateMediaState: async (roomId, audioEnabled, videoEnabled) => {
    const params = new URLSearchParams({
      audioEnabled: String(audioEnabled),
      videoEnabled: String(videoEnabled),
    });
    return apiRequest(`/rooms/${roomId}/media?${params}`, {
      method: 'PUT',
    });
  },

  raiseHand: async (roomId, raised = true) => {
    return apiRequest(`/rooms/${roomId}/raise-hand?raised=${raised}`, {
      method: 'POST',
    });
  },

  startScreenShare: async (roomId) => {
    return apiRequest(`/rooms/${roomId}/screen-share/start`, {
      method: 'POST',
    });
  },

  stopScreenShare: async (roomId) => {
    return apiRequest(`/rooms/${roomId}/screen-share/stop`, {
      method: 'POST',
    });
  },

  promoteParticipant: async (roomId, participantId) => {
    return apiRequest(`/rooms/${roomId}/participants/${participantId}/promote`, {
      method: 'POST',
    });
  },

  muteParticipant: async (roomId, participantId) => {
    return apiRequest(`/rooms/${roomId}/participants/${participantId}/mute`, {
      method: 'POST',
    });
  },

  kickParticipant: async (roomId, participantId) => {
    return apiRequest(`/rooms/${roomId}/participants/${participantId}/kick`, {
      method: 'POST',
    });
  },
};
