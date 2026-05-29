/**
 * UI E2E: быстрый захват камеры/микрофона и фильтры фона.
 *
 * npm run test:e2e:setup
 * npm run test:e2e:media
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { dismissCallUi } = require('./helpers/call');
const {
  MEDIA_T,
  waitForMediaTimings,
  assertMediaSla,
  openMeetPreviewAndWaitVideo,
  startVideoCall,
  CALL_T,
} = require('./helpers/media');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;
const groupChatId = process.env.E2E_GROUP_CHAT_ID;

const hasDirectEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;
const hasGroupEnv = senderUser && senderPass && groupChatId;

test.describe.configure({ mode: 'serial' });

test.use({
  permissions: ['microphone', 'camera'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('Media preview (meet)', () => {
  test.skip(!hasGroupEnv, 'Set E2E_SENDER_*, E2E_GROUP_CHAT_ID in .env.e2e.local');
  test.setTimeout(120_000);

  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    context = await browser.newContext({
      permissions: ['microphone', 'camera'],
    });
    await seedAuthContext(context, auth);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await openChat(page, groupChatId);
    await waitForChatReady(page, { requireStomp: true });
  });

  test('camera and mic ready within SLA on meet preview', async () => {
    await openMeetPreviewAndWaitVideo(page);
    const timings = await waitForMediaTimings(page, { requireCamera: true });
    assertMediaSla(timings, { requireCamera: true });
  });

  test('background blur filter can be toggled', async () => {
    await openMeetPreviewAndWaitVideo(page);
    await page.getByTestId(MEDIA_T.backgroundFilters).waitFor({ state: 'visible' });
    await page.getByTestId(MEDIA_T.backgroundBlur).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('buddy_media_background')))
      .toBe('blur');
    await page.getByTestId(MEDIA_T.backgroundNone).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('buddy_media_background')))
      .toBe('none');
  });
});

test.describe('1-on-1 video call media', () => {
  test.skip(!hasDirectEnv, 'Set E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID');
  test.setTimeout(180_000);

  let senderContext;
  let senderPage;

  test.beforeAll(async ({ browser }) => {
    const senderAuth = await loginViaApi(senderUser, senderPass);
    senderContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
    await seedAuthContext(senderContext, senderAuth);
    senderPage = await senderContext.newPage();
  });

  test.afterAll(async () => {
    await senderContext?.close();
  });

  test.beforeEach(async () => {
    await openChat(senderPage, chatId);
    await waitForChatReady(senderPage, { requireStomp: true });
  });

  test.afterEach(async () => {
    await dismissCallUi(senderPage);
  });

  test('video call acquires camera within SLA', async () => {
    await startVideoCall(senderPage);
    await senderPage
      .getByTestId(CALL_T.outgoingCall)
      .waitFor({ state: 'visible', timeout: 15_000 });
    const timings = await waitForMediaTimings(senderPage, { requireCamera: true });
    assertMediaSla(timings, { requireCamera: true });
    await senderPage.getByTestId(CALL_T.outgoingCancel).click({ force: true });
  });
});
