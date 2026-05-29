import { getDirectPeerUserId, decryptMessagePlainText } from '../messageTextPreview';

jest.mock('../directTextE2ee', () => ({
  isE2eeEnabled: jest.fn(),
  decryptDirectText: jest.fn(),
  ensureIdentityKeyPublished: jest.fn(),
  E2EE_LOCAL_KEY_LOST: 'E2EE_LOCAL_KEY_LOST',
}));

import * as directTextE2ee from '../directTextE2ee';

const directChat = {
  id: 1,
  type: 'DIRECT',
  participants: [{ id: 10 }, { id: 20 }],
};

describe('messageTextPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    directTextE2ee.ensureIdentityKeyPublished.mockResolvedValue(undefined);
  });

  it('getDirectPeerUserId returns other participant', () => {
    expect(getDirectPeerUserId(directChat, 10)).toBe(20);
    expect(getDirectPeerUserId(directChat, 20)).toBe(10);
  });

  it('returns plaintext when not encrypted', async () => {
    const msg = { content: 'hello', encryptionVersion: 0, senderId: 20 };
    const { text } = await decryptMessagePlainText(msg, directChat, { id: 10 });
    expect(text).toBe('hello');
    expect(directTextE2ee.decryptDirectText).not.toHaveBeenCalled();
  });

  it('decrypts encrypted text via directTextE2ee', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(true);
    directTextE2ee.decryptDirectText.mockResolvedValue('secret');

    const msg = { content: '{"v":1}', encryptionVersion: 1, senderId: 20 };
    const { text } = await decryptMessagePlainText(msg, directChat, { id: 10 });
    expect(text).toBe('secret');
    expect(directTextE2ee.decryptDirectText).toHaveBeenCalledWith(20, '{"v":1}');
  });

  it('returns local_key_lost when identity key cannot be restored', async () => {
    directTextE2ee.isE2eeEnabled.mockReturnValue(true);
    directTextE2ee.ensureIdentityKeyPublished.mockRejectedValue(new Error('E2EE_LOCAL_KEY_LOST'));

    const msg = { content: '{"v":1}', encryptionVersion: 1, senderId: 20 };
    const { text, reason } = await decryptMessagePlainText(msg, directChat, { id: 10 });
    expect(text).toBeNull();
    expect(reason).toBe('local_key_lost');
  });
});
