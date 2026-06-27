import { getSocketUrl } from './socket';

describe('getSocketUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to the local backend when no URL is provided', () => {
    delete process.env.REACT_APP_SOCKET_URL;
    process.env.NODE_ENV = 'development';

    expect(getSocketUrl()).toBe('http://localhost:7777');
  });

  it('uses a configured URL when one is provided', () => {
    process.env.REACT_APP_SOCKET_URL = 'https://example.com';

    expect(getSocketUrl()).toBe('https://example.com');
  });
});
