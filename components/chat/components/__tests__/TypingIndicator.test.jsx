import { render, screen } from '@testing-library/react';
import TypingIndicator from '../TypingIndicator';

describe('TypingIndicator', () => {
  const participants = [
    { id: 1, displayName: 'Я' },
    { id: 2, displayName: 'Алиса' },
  ];

  it('renders when peer is typing', () => {
    render(<TypingIndicator participants={participants} typingUserIds={['2']} currentUserId={1} />);
    expect(screen.getByTestId('chat-typing-indicator')).toHaveTextContent('Алиса печатает');
  });

  it('hides when typing list is empty', () => {
    render(<TypingIndicator participants={participants} typingUserIds={[]} currentUserId={1} />);
    expect(screen.queryByTestId('chat-typing-indicator')).not.toBeInTheDocument();
  });

  it('hides current user from typing list', () => {
    render(<TypingIndicator participants={participants} typingUserIds={['1']} currentUserId={1} />);
    expect(screen.queryByTestId('chat-typing-indicator')).not.toBeInTheDocument();
  });
});
