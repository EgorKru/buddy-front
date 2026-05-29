import { formatChatListTime, formatLastSeen, getOnlineStatus, parseServerDate } from '../date';

describe('parseServerDate', () => {
  it('parses ISO instant in UTC as local client time', () => {
    const date = parseServerDate('2026-05-28T11:30:00.000Z');
    expect(date).not.toBeNull();
    expect(date.getTime()).toBe(Date.parse('2026-05-28T11:30:00.000Z'));
  });

  it('parses legacy fake-Z LocalDateTime as local civil time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 28, 17, 35, 0));

    const legacy = parseServerDate('2026-05-28T17:30:00.000Z');
    expect(legacy).not.toBeNull();
    expect(legacy.getHours()).toBe(17);
    expect(legacy.getMinutes()).toBe(30);

    jest.useRealTimers();
  });

  it('parses Jackson array as local civil time', () => {
    const date = parseServerDate([2026, 5, 28, 14, 15, 0, 0]);
    expect(date).not.toBeNull();
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(28);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(15);
  });
});

describe('formatChatListTime', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows clock time for today instead of negative relative text', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 28, 17, 35, 0));

    const label = formatChatListTime('2026-05-28T17:30:00.000Z');
    expect(label).toMatch(/\d{2}:\d{2}/);
    expect(label).not.toContain('undefined');
    expect(label).not.toContain('-1');

    jest.useRealTimers();
  });

  it('never renders undefined plural forms for near-future legacy timestamps', () => {
    jest.useFakeTimers();
    const now = new Date(2026, 4, 28, 10, 0, 0);
    jest.setSystemTime(now);

    const label = formatChatListTime('2026-05-28T10:30:00.000Z');
    expect(label).not.toContain('undefined');

    jest.useRealTimers();
  });
});

describe('formatLastSeen', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not render undefined for slightly future legacy timestamps', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 28, 12, 0, 0));

    const label = formatLastSeen('2026-05-28T12:30:00.000Z');
    expect(label).not.toContain('undefined');
    expect(label).toBe('только что');

    jest.useRealTimers();
  });
});

describe('getOnlineStatus', () => {
  it('returns busy text when participant is online and busy', () => {
    expect(getOnlineStatus({ id: 2, online: true, busy: true }, 1)).toEqual({
      text: 'занят',
      online: true,
      busy: true,
    });
  });

  it('returns online text when participant is online and not busy', () => {
    expect(getOnlineStatus({ id: 2, online: true, busy: false }, 1)).toEqual({
      text: 'онлайн',
      online: true,
      busy: false,
    });
  });
});
