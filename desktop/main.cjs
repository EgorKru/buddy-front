const { app, BrowserWindow, desktopCapturer, session, shell } = require('electron');
const path = require('node:path');
const {
  createTrustedOrigins,
  isExternalHttpUrl,
  isTrustedUrl,
  selectDisplaySource,
} = require('./security.cjs');

const productionUrl = process.env.PAGER_APP_URL || 'https://pager.website';
const appUrl = process.env.PAGER_DESKTOP_DEV_URL || productionUrl;
const trustedOrigins = createTrustedOrigins([appUrl, productionUrl]);

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || webContents.getURL();
      const allowedPermissions = new Set([
        'media',
        'display-capture',
        'notifications',
        'fullscreen',
      ]);
      callback(isTrustedUrl(requestingUrl, trustedOrigins) && allowedPermissions.has(permission));
    }
  );

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isTrustedUrl(request.securityOrigin, trustedOrigins) || !request.videoRequested) {
      callback({});
      return;
    }

    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    const source = selectDisplaySource(sources);
    callback(source ? { video: source } : {});
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url, trustedOrigins)) {
      event.preventDefault();
      if (isExternalHttpUrl(url)) void shell.openExternal(url);
    }
  });

  void window.loadURL(appUrl);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(() => {
    configurePermissions();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
