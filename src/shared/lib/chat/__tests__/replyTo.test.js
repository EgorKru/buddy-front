import { enrichMessageWithReply, messageToReplyToDto } from '../replyTo';

describe('replyTo', () => {
  const parent = {
    id: 10,
    senderId: 2,
    senderUsername: 'alice',
    senderDisplayName: 'Alice',
    content: 'Original',
    type: 'TEXT',
    createdAt: '2026-01-01T10:00:00.000Z',
  };

  it('messageToReplyToDto maps fields for reply preview', () => {
    expect(messageToReplyToDto(parent)).toEqual({
      id: 10,
      senderId: 2,
      senderUsername: 'alice',
      senderDisplayName: 'Alice',
      content: 'Original',
      type: 'TEXT',
      createdAt: '2026-01-01T10:00:00.000Z',
      edited: false,
      encryptionVersion: null,
    });
  });

  it('enrichMessageWithReply fills replyTo from messagesById before display', () => {
    const incoming = {
      id: 11,
      chatId: 1,
      content: 'Reply text',
      replyToMessageId: 10,
    };
    const enriched = enrichMessageWithReply(incoming, { 10: parent });
    expect(enriched.replyTo).toEqual(messageToReplyToDto(parent));
  });

  it('enrichMessageWithReply keeps existing replyTo', () => {
    const existing = messageToReplyToDto(parent);
    const msg = { id: 11, replyTo: existing, replyToMessageId: 10 };
    expect(enrichMessageWithReply(msg, {})).toBe(msg);
  });
});
