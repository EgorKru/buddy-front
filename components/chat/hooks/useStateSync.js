import { useEffect } from 'react';
import { chatAPI } from '@/utils/api';
import { MESSAGE_STATUS } from '@/utils/messageQueue';

export const useStateSync = ({
  upsertMessage,
  localSeqRef,
  localPtsRef,
  gapRecoveryInProgressRef,
}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStateSync = async (event) => {
      const stateData = event.detail;
      if (!stateData || stateData.eventType !== 'STATE_SYNC') return;

      if (stateData.seq !== undefined && stateData.seq > localSeqRef.current) {
        const oldSeq = localSeqRef.current;
        localSeqRef.current = stateData.seq;

        if (stateData.seq > oldSeq + 1 && oldSeq > 0) {
          try {
            const updates = await chatAPI.getUserUpdates(oldSeq + 1, GAP_RECOVERY_LIMIT);
            if (updates?.updates && Array.isArray(updates.updates)) {
            }
          } catch (error) {}
        }
      }

      if (stateData.chats && Array.isArray(stateData.chats)) {
        for (const chatState of stateData.chats) {
          const chatIdStr = String(chatState.chatId);
          const serverPts = chatState.pts;
          const currentLocalPts = localPtsRef.current.get(chatIdStr) || 0;

          if (serverPts > currentLocalPts + 1) {
            const gapKey = `${chatIdStr}_${currentLocalPts}`;
            if (!gapRecoveryInProgressRef.current.has(gapKey)) {
              gapRecoveryInProgressRef.current.add(gapKey);
              chatAPI
                .getChatUpdates(chatState.chatId, currentLocalPts + 1, GAP_RECOVERY_LIMIT)
                .then((updates) => {
                  if (updates?.updates && Array.isArray(updates.updates)) {
                    updates.updates.forEach((update) => {
                      if (update.eventData?.message) {
                        upsertMessage(
                          {
                            ...update.eventData.message,
                            status: MESSAGE_STATUS.SENT,
                            isOptimistic: false,
                          },
                          { unreadDelta: 0 }
                        );
                      }
                    });

                    if (updates.updates.length > 0) {
                      const lastUpdate = updates.updates[updates.updates.length - 1];
                      localPtsRef.current.set(chatIdStr, lastUpdate.pts);
                    }
                  }
                })
                .catch((_error) => {})
                .finally(() => {
                  gapRecoveryInProgressRef.current.delete(gapKey);
                });
            }
          } else {
            localPtsRef.current.set(chatIdStr, serverPts);
          }
        }
      }
    };

    window.addEventListener('state-sync', handleStateSync);

    return () => {
      window.removeEventListener('state-sync', handleStateSync);
    };
  }, [upsertMessage, localSeqRef, localPtsRef, gapRecoveryInProgressRef]);
};
