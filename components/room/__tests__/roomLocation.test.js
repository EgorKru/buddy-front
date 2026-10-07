import { parseRoomLocation } from '../roomLocation';

describe('parseRoomLocation', () => {
  it('keeps media preferences when the room route renders before Next router hydration', () => {
    expect(
      parseRoomLocation({ pathname: '/room/TEAM2026', search: '?audio=0&video=1' })
    ).toEqual({
      roomId: 'TEAM2026',
      audio: '0',
      video: '1',
    });
  });

  it('uses undefined preferences when the invite link has no media query', () => {
    expect(parseRoomLocation({ pathname: '/room/TEAM2026', search: '' })).toEqual({
      roomId: 'TEAM2026',
      audio: undefined,
      video: undefined,
    });
  });
});
