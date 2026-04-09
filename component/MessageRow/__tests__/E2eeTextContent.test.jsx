import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/shared/lib/e2ee/directTextE2ee', () => ({
  __esModule: true,
  isE2eeEnabled: jest.fn(),
  decryptDirectText: jest.fn(),
}));

import * as directTextE2ee from '@/shared/lib/e2ee/directTextE2ee';
import E2eeTextContent from '../E2eeTextContent';

const styles = { e2eeFailed: 'e2eeFailed', e2eePending: 'e2eePending' };

const directChat = {
  id: 'chat-1',
  type: 'DIRECT',
  participants: [{ id: 1 }, { id: 2 }],
};

describe('E2eeTextContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows raw content when E2EE is disabled', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(false);

    render(
      <E2eeTextContent
        msg={{ id: 'm1', chatId: 'chat-1', senderId: 2, content: 'plain body' }}
        user={{ id: 1 }}
        chats={[directChat]}
        styles={styles}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('plain body')).toBeInTheDocument();
    });
    expect(directTextE2ee.decryptDirectText).not.toHaveBeenCalled();
  });

  it('shows decrypted text when E2EE is enabled', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(true);
    directTextE2ee.decryptDirectText.mockResolvedValue('decrypted hello');

    render(
      <E2eeTextContent
        msg={{ id: 'm2', chatId: 'chat-1', senderId: 2, content: '{"v":1}' }}
        user={{ id: 1 }}
        chats={[directChat]}
        styles={styles}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('decrypted hello')).toBeInTheDocument();
    });
    expect(directTextE2ee.decryptDirectText).toHaveBeenCalledWith(2, '{"v":1}');
  });

  it('uses peer as counterparty when message is outgoing', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(true);
    directTextE2ee.decryptDirectText.mockResolvedValue('ok');

    render(
      <E2eeTextContent
        msg={{ id: 'm3', chatId: 'chat-1', senderId: 1, content: '{}' }}
        user={{ id: 1 }}
        chats={[directChat]}
        styles={styles}
      />
    );

    await waitFor(() => {
      expect(directTextE2ee.decryptDirectText).toHaveBeenCalledWith(2, '{}');
    });
  });

  it('shows failure when peer cannot be resolved', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(true);

    render(
      <E2eeTextContent
        msg={{ id: 'm4', chatId: 'chat-1', senderId: 1, content: '{}' }}
        user={{ id: 1 }}
        chats={[{ id: 'chat-1', type: 'DIRECT', participants: [{ id: 1 }] }]}
        styles={styles}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Не удалось расшифровать/)).toBeInTheDocument();
    });
    expect(directTextE2ee.decryptDirectText).not.toHaveBeenCalled();
  });

  it('shows failure when decrypt throws', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(true);
    directTextE2ee.decryptDirectText.mockRejectedValue(new Error('bad key'));

    render(
      <E2eeTextContent
        msg={{ id: 'm5', chatId: 'chat-1', senderId: 2, content: '{}' }}
        user={{ id: 1 }}
        chats={[directChat]}
        styles={styles}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Не удалось расшифровать/)).toBeInTheDocument();
    });
  });
});
