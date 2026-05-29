import { renderHook, waitFor } from '@testing-library/react';
import { useMessageTextPreview } from '../useMessageTextPreview';

jest.mock('@/shared/lib/e2ee/messageTextPreview', () => ({
  decryptMessagePlainText: jest.fn(),
}));

import { decryptMessagePlainText } from '@/shared/lib/e2ee/messageTextPreview';

const chat = { id: 1, type: 'DIRECT', participants: [{ id: 1 }, { id: 2 }] };

describe('useMessageTextPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sync preview for plaintext', () => {
    const message = { type: 'TEXT', content: 'Hello world', encryptionVersion: 0 };
    const { result } = renderHook(() => useMessageTextPreview(message, chat, { id: 1 }));
    expect(result.current).toBe('Hello world');
  });

  it('returns decrypted preview for E2EE messages', async () => {
    decryptMessagePlainText.mockResolvedValue({ text: 'Привет из чата' });
    const message = {
      id: 5,
      type: 'TEXT',
      content: '{"v":1}',
      encryptionVersion: 1,
      senderId: 2,
    };
    const { result } = renderHook(() => useMessageTextPreview(message, chat, { id: 1 }));

    await waitFor(() => {
      expect(result.current).toBe('Привет из чата');
    });
  });
});
