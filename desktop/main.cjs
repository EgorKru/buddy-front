const { app, BrowserWindow, session, shell } = require('electron');
const path = require('node:path');

const productionUrl = process.env.PAGER_APP_URL || 'https://pager.website';
const appUrl = process.env.PAGER_DESKTOP_DEV_URL || productionUrl;
const trustedOrigins = new Set([new URL(appUrl).origin, new URL(productionUrl).origin]);

function isTrustedUrl(value) {
  try {
    return trustedOrigins.has(new URL(value).origin);
  } catch {
    return false;
  }
}

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
      callback(isTrustedUrl(requestingUrl) && allowedPermissions.has(permission));
    }
  );
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
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault();
      if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
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
