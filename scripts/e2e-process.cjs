const { spawn, spawnSync } = require('child_process');
const path = require('path');

function createNextServerLaunch(root, port, env = process.env) {
  return {
    command: process.execPath,
    args: [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port],
    options: {
      cwd: root,
      env: { ...env, PORT: port },
      stdio: 'inherit',
      shell: false,
    },
  };
}

function startNextServer(root, port, env = process.env, spawnImpl = spawn) {
  const launch = createNextServerLaunch(root, port, env);
  return spawnImpl(launch.command, launch.args, launch.options);
}

function createNodeCliLaunch(root, relativeCli, args = [], env = process.env) {
  return {
    command: process.execPath,
    args: [path.join(root, ...relativeCli), ...args],
    options: {
      cwd: root,
      env,
      stdio: 'inherit',
      shell: false,
    },
  };
}

function runNextBuild(root, env = process.env, spawnSyncImpl = spawnSync) {
  const launch = createNodeCliLaunch(
    root,
    ['node_modules', 'next', 'dist', 'bin', 'next'],
    ['build'],
    env
  );
  return spawnSyncImpl(launch.command, launch.args, launch.options);
}

function runPlaywright(root, args, env = process.env, spawnSyncImpl = spawnSync) {
  const launch = createNodeCliLaunch(
    root,
    ['node_modules', '@playwright', 'test', 'cli.js'],
    args,
    env
  );
  return spawnSyncImpl(launch.command, launch.args, launch.options);
}

function resolveServerAddress(defaultPort, env = process.env) {
  const configuredBaseUrl = env.E2E_BASE_URL?.replace(/\/$/, '');
  const configuredPort = env.E2E_PORT;

  if (configuredBaseUrl) {
    const parsed = new URL(configuredBaseUrl);
    const baseUrlPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    if (configuredPort && String(configuredPort) !== baseUrlPort) {
      throw new Error(
        `E2E_PORT (${configuredPort}) does not match E2E_BASE_URL (${configuredBaseUrl})`
      );
    }
    return { port: baseUrlPort, baseUrl: configuredBaseUrl };
  }

  const port = String(configuredPort || defaultPort);
  return { port, baseUrl: `http://127.0.0.1:${port}` };
}

function stopProcessTree(child, { platform = process.platform, spawnSyncImpl = spawnSync } = {}) {
  if (!child?.pid) return;

  if (platform === 'win32') {
    spawnSyncImpl('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
    });
    return;
  }

  child.kill('SIGTERM');
}

function manageServer(child) {
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stopProcessTree(child);
  };
  const stopOnSignal = () => {
    stop();
    process.exit(130);
  };

  process.once('SIGINT', stopOnSignal);
  process.once('SIGTERM', stopOnSignal);

  return {
    stop() {
      process.removeListener('SIGINT', stopOnSignal);
      process.removeListener('SIGTERM', stopOnSignal);
      stop();
    },
  };
}

module.exports = {
  createNodeCliLaunch,
  createNextServerLaunch,
  manageServer,
  resolveServerAddress,
  runNextBuild,
  runPlaywright,
  startNextServer,
  stopProcessTree,
};
