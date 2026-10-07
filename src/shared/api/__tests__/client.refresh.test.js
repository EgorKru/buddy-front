import { apiRequest, uploadFileToEndpoint } from '../client';

const jsonResponse = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: jest.fn().mockResolvedValue(body),
});

describe('file upload refresh rotation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'expired-access');
    localStorage.setItem('refreshToken', 'refresh-1');
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('refreshes and retries a failed upload once', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token: 'fresh-access',
          refreshToken: 'refresh-2',
          expiresIn: 900,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { fileUrl: 'files/1/1/example.txt' }));

    const result = await uploadFileToEndpoint(1, new FormData(), 'files/file');

    expect(result).toEqual({ fileUrl: 'files/1/1/example.txt' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toContain('/auth/refresh');
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh-access');
  });
});

describe('apiRequest refresh rotation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'expired-access');
    localStorage.setItem('refreshToken', 'refresh-1');
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token: 'fresh-access',
          refreshToken: 'refresh-2',
          expiresIn: 900,
          user: { id: 1, username: 'alice' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { id: 1, username: 'alice' }));
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('rotates once and retries the original request with the new access token', async () => {
    const result = await apiRequest('/users/me');

    expect(result).toEqual({ id: 1, username: 'alice' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toContain('/auth/refresh');
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh-access');
    expect(localStorage.getItem('token')).toBe('fresh-access');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-2');
  });
});
