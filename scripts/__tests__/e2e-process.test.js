const path = require('path');
const {
  createNextServerLaunch,
  createNodeCliLaunch,
  resolveServerAddress,
  stopProcessTree,
} = require('../e2e-process.cjs');

describe('E2E server process management', () => {
  it('starts Next directly without a shell wrapper that can orphan the server', () => {
    const root = path.join('C:', 'workspace', 'pager');
    const launch = createNextServerLaunch(root, '3010', { TEST_ENV: 'yes' });

    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual([
      path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '-p',
      '3010',
    ]);
    expect(launch.options).toMatchObject({
      cwd: root,
      shell: false,
      env: { TEST_ENV: 'yes', PORT: '3010' },
    });
  });

  it('runs build and Playwright CLIs through Node without shell argument concatenation', () => {
    const root = path.join('C:', 'workspace', 'pager');
    const launch = createNodeCliLaunch(
      root,
      ['node_modules', '@playwright', 'test', 'cli.js'],
      ['test', 'e2e/media.spec.js'],
      { TEST_ENV: 'yes' }
    );

    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual([
      path.join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      'e2e/media.spec.js',
    ]);
    expect(launch.options).toMatchObject({
      cwd: root,
      shell: false,
      env: { TEST_ENV: 'yes' },
    });
  });

  it('terminates the whole server process tree on Windows', () => {
    const spawnSyncImpl = jest.fn();

    stopProcessTree({ pid: 4242 }, { platform: 'win32', spawnSyncImpl });

    expect(spawnSyncImpl).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
    });
  });

  it('uses the port from E2E_BASE_URL so the health check matches the server', () => {
    expect(resolveServerAddress('3003', { E2E_BASE_URL: 'http://localhost:3002/' })).toEqual({
      port: '3002',
      baseUrl: 'http://localhost:3002',
    });
  });

  it('rejects conflicting explicit E2E port settings', () => {
    expect(() =>
      resolveServerAddress('3003', {
        E2E_BASE_URL: 'http://localhost:3002',
        E2E_PORT: '3003',
      })
    ).toThrow('does not match');
  });
});
