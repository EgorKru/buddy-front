import { fireEvent, render, screen } from '@testing-library/react';

import ParticipantsModal from '../index';

const participants = [
  {
    id: 1,
    role: 'HOST',
    audioEnabled: true,
    videoEnabled: true,
    user: { id: 10, displayName: 'Егор Крутов' },
  },
  {
    id: 2,
    role: 'PARTICIPANT',
    audioEnabled: false,
    videoEnabled: false,
    user: { id: 20, displayName: 'Анна Смирнова' },
  },
];

describe('ParticipantsModal', () => {
  it('renders participants with roles and current-user context', () => {
    render(
      <ParticipantsModal
        isOpen
        onClose={jest.fn()}
        participants={participants}
        currentUserId={10}
        isHost
      />
    );

    expect(screen.getByText('Егор Крутов')).toBeVisible();
    expect(screen.getByText('(Вы)')).toBeVisible();
    expect(screen.getByText('Анна Смирнова')).toBeVisible();
    expect(screen.getByText('Организатор')).toBeVisible();
  });

  it('filters participants by name', () => {
    render(
      <ParticipantsModal
        isOpen
        onClose={jest.fn()}
        participants={participants}
        currentUserId={10}
      />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти участника' }), {
      target: { value: 'Анна' },
    });

    expect(screen.getByText('Анна Смирнова')).toBeVisible();
    expect(screen.queryByText('Егор Крутов')).not.toBeInTheDocument();
  });

  it('closes from the header action', () => {
    const onClose = jest.fn();
    render(
      <ParticipantsModal isOpen onClose={onClose} participants={participants} currentUserId={10} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть список участников' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
