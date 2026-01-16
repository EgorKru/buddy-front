import { useCallback, useEffect, useRef } from 'react';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';
import { NEW_MESSAGE_ID_REMOVE_DELAY, CHECK_BOTTOM_DEFAULT_THRESHOLD } from '../constants/chat';

export const useVoiceMessageHandling = ({
  audioBlob,
  user,
  sending,
  chatId,
  sendMessageHook,
  addOptimistic,
  convertToBase64,
  recordingTime,
  checkIsAtBottom,
  scrollHeightBeforeMessageRef,
  wasAtBottomBeforeMessageRef,
  shouldAutoScrollRef,
  messagesContainerRef,
  newMessageIdsRef,
  resetVoice,
  sentAudioBlobRef,
  isRecording,
  isLocked,
  voiceError,
  cancelRecording
}) => {
  const audioBlobRef = useRef(audioBlob);
  useEffect(() => {
    audioBlobRef.current = audioBlob;
  }, [audioBlob]);

  const handleVoiceSendSimple = useCallback(async (blobToSend = null) => {
    const currentBlob = blobToSend || audioBlobRef.current || audioBlob;
    if (!currentBlob || !user || sending) return;

    if (messagesContainerRef?.current) {
      scrollHeightBeforeMessageRef.current = messagesContainerRef.current.scrollHeight;
      const wasAtBottom = checkIsAtBottom(CHECK_BOTTOM_DEFAULT_THRESHOLD);
      wasAtBottomBeforeMessageRef.current = wasAtBottom;
      shouldAutoScrollRef.current = wasAtBottom;
    }

    try {
      let fileUrl = null;
      let finalDuration = recordingTime > 0 ? recordingTime : null;

      try {
        const duration = recordingTime > 0 ? recordingTime : null;
        const uploadResponse = await chatAPI.uploadVoiceFile(chatId, currentBlob, duration);
        fileUrl = uploadResponse?.fileUrl;
        finalDuration = uploadResponse?.duration || duration;
      } catch (uploadError) {
        const base64 = await convertToBase64(currentBlob);
        const mimeType = currentBlob.type || 'audio/webm';
        const duration = recordingTime > 0 ? recordingTime : null;
        
        const result = await sendMessageHook(null, 'VOICE', null, base64, mimeType, duration);

        if (result?.serverMessage) {
          const messageId = result.serverMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, NEW_MESSAGE_ID_REMOVE_DELAY);
          }
          addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
        } else if (result?.optimisticMessage) {
          const messageId = result.optimisticMessage.id;
          if (messageId) {
            newMessageIdsRef.current.add(String(messageId));
            setTimeout(() => {
              newMessageIdsRef.current.delete(String(messageId));
            }, NEW_MESSAGE_ID_REMOVE_DELAY);
          }
          addOptimistic(chatId, result.optimisticMessage);
        }

        resetVoice();
        sentAudioBlobRef.current = null;
        return;
      }

      if (!fileUrl) {
        throw new Error('Failed to upload voice file: no fileUrl returned from server');
      }

      const result = await sendMessageHook(null, 'VOICE', fileUrl, null, null, finalDuration);

      if (result?.serverMessage) {
        const messageId = result.serverMessage.id;
        if (messageId) {
          newMessageIdsRef.current.add(String(messageId));
          setTimeout(() => {
            newMessageIdsRef.current.delete(String(messageId));
          }, NEW_MESSAGE_ID_REMOVE_DELAY);
        }
        addOptimistic(chatId, { ...result.serverMessage, status: MESSAGE_STATUS.SENT, isOptimistic: false });
      } else if (result?.optimisticMessage) {
        const messageId = result.optimisticMessage.id;
        if (messageId) {
          newMessageIdsRef.current.add(String(messageId));
          setTimeout(() => {
            newMessageIdsRef.current.delete(String(messageId));
          }, NEW_MESSAGE_ID_REMOVE_DELAY);
        }
        addOptimistic(chatId, result.optimisticMessage);
      }

      resetVoice();
      sentAudioBlobRef.current = null;
    } catch (error) {
      resetVoice();
      sentAudioBlobRef.current = null;
    }
  }, [audioBlob, user, sending, recordingTime, convertToBase64, sendMessageHook, chatId, addOptimistic, resetVoice, checkIsAtBottom, scrollHeightBeforeMessageRef, wasAtBottomBeforeMessageRef, shouldAutoScrollRef, messagesContainerRef, newMessageIdsRef, sentAudioBlobRef]);

  const handleVoiceSend = useCallback(async () => {
    if (!audioBlob || !user) {
      return;
    }
    
    if (sending) {
      return;
    }

    try {
      await handleVoiceSendSimple();
    } catch (error) {
      resetVoice();
      sentAudioBlobRef.current = null;
    }
  }, [audioBlob, user, sending, handleVoiceSendSimple, resetVoice, sentAudioBlobRef]);

  const handleVoiceCancel = useCallback(() => {
    if (cancelRecording) {
      cancelRecording();
    }
    resetVoice();
    sentAudioBlobRef.current = null;
  }, [cancelRecording, resetVoice, sentAudioBlobRef]);

  return { handleVoiceSendSimple, handleVoiceSend, handleVoiceCancel };
};

