import { resolveMediaUrl } from '../resolveMediaUrl';

jest.mock('@/src/shared/config', () => ({
  getApiUrl: (path) => `http://localhost:8080/api${path}`,
}));

describe('resolveMediaUrl', () => {
  it('resolves system animated emoji path', () => {
    expect(resolveMediaUrl('/system/telegram-animated/emoji-people/125.gif')).toBe(
      'http://localhost:8080/api/system/telegram-animated/emoji-people/125.gif'
    );
  });

  it('resolves chat upload path', () => {
    expect(resolveMediaUrl('uploads/images/x.png')).toBe(
      'http://localhost:8080/api/chats/files/uploads/images/x.png'
    );
  });

  it('passes through absolute http urls', () => {
    expect(resolveMediaUrl('https://cdn.example/a.gif')).toBe('https://cdn.example/a.gif');
  });
});
