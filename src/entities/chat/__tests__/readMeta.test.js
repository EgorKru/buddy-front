import {
  getLastMessageReadMeta,
  getOtherParticipantOnline,
  getOtherParticipantPresence,
} from '@/entities/chat';

describe('getLastMessageReadMeta', () => {
  const user = { id: 1 };
  const chat = {
    id: 4,
    participants: [{ id: 1 }, { id: 2 }],
    lastMessage: {
      id: 10,
      senderId: 1,
      createdAt: '2026-05-28T12:00:00.000Z',
      content: 'hi',
    },
  };

  it('isRead when other participant readAt is after message time', () => {
    const meta = getLastMessageReadMeta(chat, user, {
      4: { 2: '2026-05-28T12:00:01.000Z' },
    });
    expect(meta.isRead).toBe(true);
    expect(meta.readCount).toBe(1);
  });

  it('not isRead when readAt is before message', () => {
    const meta = getLastMessageReadMeta(chat, user, {
      4: { 2: '2026-05-28T11:00:00.000Z' },
    });
    expect(meta.isRead).toBe(false);
  });
});

describe('getOtherParticipantOnline', () => {
  it('returns online for direct chat peer', () => {
    expect(
      getOtherParticipantOnline(
        {
          type: 'DIRECT',
          participants: [
            { id: 1, online: false },
            { id: 2, online: true },
          ],
        },
        { id: 1 }
      )
    ).toBe(true);
  });
});

describe('getOtherParticipantPresence', () => {
  it('returns busy when peer is online and busy', () => {
    expect(
      getOtherParticipantPresence(
        {
          type: 'DIRECT',
          participants: [
            { id: 1, online: true },
            { id: 2, online: true, busy: true },
          ],
        },
        { id: 1 }
      )
    ).toEqual({ online: true, busy: true });
  });

  it('returns not busy when peer is offline even if busy flag set', () => {
    expect(
      getOtherParticipantPresence(
        {
          type: 'DIRECT',
          participants: [
            { id: 1, online: true },
            { id: 2, online: false, busy: true },
          ],
        },
        { id: 1 }
      )
    ).toEqual({ online: false, busy: false });
  });
});
