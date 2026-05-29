import { render, screen } from '@testing-library/react';

jest.mock('@/component/ChatSidebar/index.module.css', () => ({
  chatItem: 'chatItem',
  active: 'active',
  chatAvatarWrapper: 'chatAvatarWrapper',
  chatAvatar: 'chatAvatar',
  onlineIndicator: 'onlineIndicator',
  busyIndicator: 'busyIndicator',
  chatInfo: 'chatInfo',
  chatHeader: 'chatHeader',
  chatName: 'chatName',
  chatTime: 'chatTime',
  lastMessage: 'lastMessage',
  lastMessageText: 'lastMessageText',
  statusIconRead: 'statusIconRead',
  statusIcon: 'statusIcon',
}));

import ChatListItem from '@/component/ChatSidebar/ChatListItem';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => <img alt={props.alt} />,
}));

jest.mock('@/component/ChatSidebar/ChatLastMessagePreview', () => ({
  __esModule: true,
  default: ({ chat }) => <span>{chat?.lastMessage?.content}</span>,
}));

describe('ChatListItem selectors', () => {
  const user = { id: 1, username: 'sender' };
  const chat = {
    id: 4,
    type: 'DIRECT',
    unreadCount: 0,
    participants: [
      { id: 1, online: false },
      { id: 2, online: true },
    ],
    lastMessage: {
      id: 10,
      senderId: 1,
      content: 'Привет',
      createdAt: '2026-05-28T12:00:00.000Z',
    },
  };

  it('renders data-testid for sidebar item, preview, online and read status', () => {
    render(
      <ChatListItem
        chat={chat}
        user={user}
        currentChatId="4"
        readAtByChatIdByUserId={{ 4: { 2: '2026-05-28T12:00:01.000Z' } }}
      />
    );

    expect(screen.getByTestId('chat-sidebar-item-4')).toBeInTheDocument();
    expect(screen.getByTestId('chat-sidebar-last-message')).toHaveTextContent('Привет');
    expect(screen.getByTestId('chat-sidebar-online')).toBeInTheDocument();
    const read = screen.getByTestId('chat-sidebar-read-status');
    expect(read).toHaveAttribute('data-read', 'true');
  });

  it('shows data-read false when message not read', () => {
    render(
      <ChatListItem chat={chat} user={user} currentChatId={null} readAtByChatIdByUserId={{}} />
    );

    expect(screen.getByTestId('chat-sidebar-read-status')).toHaveAttribute('data-read', 'false');
  });

  it('shows busy indicator when peer is online and busy', () => {
    const busyChat = {
      ...chat,
      participants: [
        { id: 1, online: true },
        { id: 2, online: true, busy: true },
      ],
    };

    render(
      <ChatListItem chat={busyChat} user={user} currentChatId={null} readAtByChatIdByUserId={{}} />
    );

    const online = screen.getByTestId('chat-sidebar-online');
    expect(online).toHaveAttribute('data-busy', 'true');
    expect(online).toHaveClass('busyIndicator');
  });
});
