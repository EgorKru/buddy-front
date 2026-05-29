import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/shared/lib/e2ee/messageTextPreview', () => ({
  decryptMessagePlainText: jest.fn(),
}));

import { decryptMessagePlainText } from '@/shared/lib/e2ee/messageTextPreview';
import E2eeTextContent from '../E2eeTextContent';

const styles = { e2eeFailed: 'e2eeFailed', e2eePending: 'e2eePending' };

const directChat = {
  id: 'chat-1',
  type: 'DIRECT',
  participants: [{ id: 1 }, { id: 2 }],
};

const e2eeMsg = (overrides) => ({
  id: 'm1',
  chatId: 'chat-1',
  senderId: 2,
  content: '{"v":1}',
  encryptionVersion: 1,
  ...overrides,
});

describe('E2eeTextContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows decrypted text when decryption succeeds', async () => {
    decryptMessagePlainText.mockResolvedValue({ text: 'decrypted hello' });

    render(
      <E2eeTextContent msg={e2eeMsg()} user={{ id: 1 }} chats={[directChat]} styles={styles} />
    );

    await waitFor(() => {
      expect(screen.getByText('decrypted hello')).toBeInTheDocument();
    });
    expect(decryptMessagePlainText).toHaveBeenCalled();
  });

  it('shows failure when peer cannot be resolved', async () => {
    decryptMessagePlainText.mockResolvedValue({ text: null, reason: 'no_peer' });

    render(
      <E2eeTextContent
        msg={e2eeMsg({ senderId: 1 })}
        user={{ id: 1 }}
        chats={[{ id: 'chat-1', type: 'DIRECT', participants: [{ id: 1 }] }]}
        styles={styles}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/собеседника для расшифровки/)).toBeInTheDocument();
    });
  });

  it('shows failure when decrypt fails', async () => {
    decryptMessagePlainText.mockResolvedValue({ text: null, reason: 'decrypt_failed' });

    render(
      <E2eeTextContent msg={e2eeMsg()} user={{ id: 1 }} chats={[directChat]} styles={styles} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Не удалось загрузить сообщение/)).toBeInTheDocument();
    });
  });

  it('shows key-lost message when local E2EE key is missing', async () => {
    decryptMessagePlainText.mockResolvedValue({ text: null, reason: 'local_key_lost' });

    render(
      <E2eeTextContent msg={e2eeMsg()} user={{ id: 1 }} chats={[directChat]} styles={styles} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Ключ шифрования недоступен/)).toBeInTheDocument();
    });
  });
});
