const {
  createTrustedOrigins,
  isExternalHttpUrl,
  isTrustedUrl,
  selectDisplaySource,
} = require('../security.cjs');

describe('desktop security policy', () => {
  const trusted = createTrustedOrigins(['https://pager.website', 'http://localhost:3000']);

  it('allows permissions only for an exact trusted origin', () => {
    expect(isTrustedUrl('https://pager.website/room/ABC123', trusted)).toBe(true);
    expect(isTrustedUrl('https://pager.website.attacker.example/room/ABC123', trusted)).toBe(false);
    expect(isTrustedUrl('not a url', trusted)).toBe(false);
  });

  it('opens only http links in the external browser', () => {
    expect(isExternalHttpUrl('https://example.com/docs')).toBe(true);
    expect(isExternalHttpUrl('file:///C:/secret.txt')).toBe(false);
    expect(isExternalHttpUrl('javascript:alert(1)')).toBe(false);
  });

  it('prefers a full display for the screen-share action', () => {
    const windowSource = { id: 'window:1:0', name: 'Editor' };
    const screenSource = { id: 'screen:0:0', name: 'Entire screen' };
    expect(selectDisplaySource([windowSource, screenSource])).toBe(screenSource);
  });
});
