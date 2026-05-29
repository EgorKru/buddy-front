import {
  messagingReducer,
  messagingActionTypes as AT,
  messagingInitialState,
} from '../messagingReducer';

describe('messagingReducer reply', () => {
  it('REPLACE_OPTIMISTIC keeps replyTo from optimistic when server payload lacks it', () => {
    const state = {
      ...messagingInitialState,
      messageIdsByChatId: { 1: ['temp-1'] },
      messagesById: {
        'temp-1': {
          id: 'temp-1',
          tempId: 'temp-1',
          chatId: 1,
          content: 'Reply',
          isOptimistic: true,
          replyTo: { id: 9, content: 'Parent', senderDisplayName: 'A' },
        },
      },
    };

    const next = messagingReducer(state, {
      type: AT.REPLACE_OPTIMISTIC,
      payload: {
        chatId: 1,
        tempId: 'temp-1',
        status: 'SENT',
        message: {
          id: 100,
          chatId: 1,
          content: 'Reply',
        },
      },
    });

    expect(next.messagesById['100'].replyTo).toEqual({
      id: 9,
      content: 'Parent',
      senderDisplayName: 'A',
    });
  });
});
