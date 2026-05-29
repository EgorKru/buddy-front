import { render, screen, fireEvent } from '@testing-library/react';
import ReactionPickerRow from '../ReactionPickerRow';

jest.mock('../index.module.css', () => ({
  reactionsRow: 'reactionsRow',
  reactionBtn: 'reactionBtn',
  reactionBtnActive: 'reactionBtnActive',
  reactionCustomImg: 'reactionCustomImg',
}));

describe('ReactionPickerRow', () => {
  const message = {
    id: 1,
    content: 'hi',
    reactions: [{ emoji: '👍', count: 1, reactedByMe: true }],
  };

  it('renders quick reactions for context menu', () => {
    render(<ReactionPickerRow message={message} activeReactions={message.reactions} />);
    expect(screen.getByTestId('message-context-menu-reactions')).toBeInTheDocument();
    expect(screen.getAllByTestId('reaction-bar-emoji').length).toBeGreaterThan(0);
  });

  it('calls onToggleReaction with emoji', () => {
    const onToggleReaction = jest.fn();
    render(
      <ReactionPickerRow
        message={message}
        activeReactions={[]}
        onToggleReaction={onToggleReaction}
      />
    );
    fireEvent.click(screen.getAllByTestId('reaction-bar-emoji')[0]);
    expect(onToggleReaction).toHaveBeenCalledWith(message, expect.any(String));
  });
});
