const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('pagerDesktop', {
  platform: process.platform,
  isDesktop: true,
});
