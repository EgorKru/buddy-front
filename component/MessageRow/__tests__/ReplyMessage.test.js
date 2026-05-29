import { render, screen } from '@testing-library/react';
import ReplyMessage from '../ReplyMessage';

jest.mock('@/styles/chat.module.css', () => ({
  messageReply: 'messageReply',
  messageReplyContent: 'messageReplyContent',
  messageReplyAuthor: 'messageReplyAuthor',
  messageReplyText: 'messageReplyText',
}));

jest.mock('@/hooks/useMessageTextPreview', () => ({
  useMessageTextPreview: (replyTo) => replyTo?.content ?? '',
}));

describe('ReplyMessage', () => {
  it('renders reply preview with parent content', () => {
    render(
      <ReplyMessage
        replyTo={{
          id: 1,
          senderDisplayName: 'Alice',
          content: 'Original question',
          type: 'TEXT',
        }}
      />
    );

    expect(screen.getByTestId('message-reply-preview')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Original question')).toBeInTheDocument();
  });
});
