import { getTypingUserIds, removeTypingUser, setTypingUser } from '../typingUsersState';

describe('typingUsersState', () => {
  it('adds and removes typing user', () => {
    let map = new Map();
    map = setTypingUser(map, 5);
    expect(getTypingUserIds(map)).toEqual(['5']);

    map = removeTypingUser(map, 5);
    expect(getTypingUserIds(map)).toEqual([]);
  });

  it('removeTypingUser returns same map when user absent', () => {
    const map = new Map([['1', 100]]);
    expect(removeTypingUser(map, 99)).toBe(map);
  });
});
