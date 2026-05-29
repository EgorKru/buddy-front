const { execSync } = require('child_process');
const path = require('path');
const { request } = require('@playwright/test');
const { assertBackendUp } = require('./helpers/realtime');

module.exports = async function globalSetup() {
  const ctx = await request.newContext();
  try {
    await assertBackendUp(ctx);
  } finally {
    await ctx.dispose();
  }
};
