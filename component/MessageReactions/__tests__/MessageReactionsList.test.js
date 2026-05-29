import { render, screen, fireEvent } from '@testing-library/react';
import MessageReactionsList from '../MessageReactionsList';

describe('MessageReactionsList', () => {
  it('renders reaction chips and toggles on click', () => {
    const onToggle = jest.fn();
    render(
      <MessageReactionsList
        reactions={[
          { emoji: '👍', count: 2, reactedByMe: true },
          { emoji: '🔥', count: 1, reactedByMe: false },
        ]}
        onToggle={onToggle}
      />
    );

    expect(screen.getByTestId('message-reactions-list')).toBeInTheDocument();
    const chips = screen.getAllByTestId('message-reaction-chip');
    expect(chips).toHaveLength(2);
    fireEvent.click(chips[0]);
    expect(onToggle).toHaveBeenCalledWith('👍');
  });

  it('returns null when no reactions', () => {
    const { container } = render(<MessageReactionsList reactions={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
