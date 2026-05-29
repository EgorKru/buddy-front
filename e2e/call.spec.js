/**
 * UI E2E: 1-on-1 аудиозвонок (STOMP signaling + UI modals).
 *
 * npm run test:e2e:setup
 * npm run test:e2e:call
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T, REALTIME_MS, pollCall, startAudioCall, dismissCallUi } = require('./helpers/call');
const { T: RT, pollRealtime } = require('./helpers/realtime');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;

test.describe.configure({ mode: 'serial' });

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('1-on-1 audio call UI', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID in .env.e2e.local');
  test.setTimeout(180_000);

  let senderContext;
  let recipientContext;
  let senderPage;
  let recipientPage;

  test.beforeAll(async ({ browser }) => {
    const senderAuth = await loginViaApi(senderUser, senderPass);
    const recipientAuth = await loginViaApi(recipientUser, recipientPass);

    senderContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ['microphone'],
    });
    recipientContext = await browser.newContext({
      permissions: ['microphone'],
    });
    await seedAuthContext(senderContext, senderAuth);
    await seedAuthContext(recipientContext, recipientAuth);

    senderPage = await senderContext.newPage();
    recipientPage = await recipientContext.newPage();
  });

  test.afterAll(async () => {
    await senderContext?.close();
    await recipientContext?.close();
  });

  test.beforeEach(async () => {
    await openChat(recipientPage, chatId);
    await openChat(senderPage, chatId);
    await waitForChatReady(recipientPage, { requireStomp: true });
    await waitForChatReady(senderPage, { requireStomp: true });
  });

  test.afterEach(async () => {
    await dismissCallUi(senderPage);
    await dismissCallUi(recipientPage);
  });

  test('caller sees outgoing modal after audio call start', async () => {
    await startAudioCall(senderPage);

    await pollCall(
      senderPage,
      async () => (await senderPage.getByTestId(T.outgoingCall).count()) > 0,
      'outgoing call modal'
    );
    await expect(senderPage.getByTestId(T.outgoingCancel)).toBeVisible();
  });

  test(`recipient sees incoming call within ${REALTIME_MS}ms`, async () => {
    await startAudioCall(senderPage);

    await pollCall(
      recipientPage,
      async () => (await recipientPage.getByTestId(T.incomingCall).count()) > 0,
      'incoming call modal'
    );
    await expect(recipientPage.getByTestId(T.incomingAccept)).toBeVisible();
  });

  test(`accept shows active call UI within ${REALTIME_MS}ms`, async () => {
    await startAudioCall(senderPage);
    await recipientPage
      .getByTestId(T.incomingAccept)
      .waitFor({ state: 'visible', timeout: REALTIME_MS });
    await recipientPage.getByTestId(T.incomingAccept).click({ force: true });

    await pollCall(
      recipientPage,
      async () => (await recipientPage.getByTestId(T.activeCall).count()) > 0,
      'active call on callee'
    );
    await pollCall(
      senderPage,
      async () => (await senderPage.getByTestId(T.activeCall).count()) > 0,
      'active call on caller'
    );
    await expect(senderPage.getByTestId(T.activeCallEnd)).toBeVisible();
  });

  test(`recipient sees caller busy in sidebar during active call within ${REALTIME_MS}ms`, async () => {
    const onlineDot = recipientPage
      .getByTestId(RT.sidebarItem(chatId))
      .getByTestId(RT.sidebarOnline);

    await startAudioCall(senderPage);
    await recipientPage
      .getByTestId(T.incomingAccept)
      .waitFor({ state: 'visible', timeout: REALTIME_MS });
    await recipientPage.getByTestId(T.incomingAccept).click({ force: true });

    await pollCall(
      recipientPage,
      async () => (await recipientPage.getByTestId(T.activeCall).count()) > 0,
      'active call on callee'
    );

    await pollRealtime(
      recipientPage,
      async () => (await onlineDot.getAttribute('data-busy')) === 'true',
      'caller busy in sidebar during call'
    );

    await senderPage.getByTestId(T.activeCallEnd).click({ force: true });
    await expect(senderPage.getByTestId(T.activeCall)).toHaveCount(0, { timeout: 15_000 });
  });

  test('caller can cancel before answer', async () => {
    await startAudioCall(senderPage);
    await senderPage
      .getByTestId(T.outgoingCancel)
      .waitFor({ state: 'visible', timeout: REALTIME_MS });
    await senderPage.getByTestId(T.outgoingCancel).click();

    await pollCall(
      senderPage,
      async () => (await senderPage.getByTestId(T.outgoingCall).count()) === 0,
      'outgoing modal hidden after cancel'
    );
    await pollCall(
      recipientPage,
      async () => (await recipientPage.getByTestId(T.incomingCall).count()) === 0,
      'incoming modal hidden after cancel'
    );
  });

  test('recipient can reject incoming call', async () => {
    await startAudioCall(senderPage);
    await recipientPage
      .getByTestId(T.incomingReject)
      .waitFor({ state: 'visible', timeout: REALTIME_MS });
    await recipientPage.getByTestId(T.incomingReject).click();

    await pollCall(
      recipientPage,
      async () => (await recipientPage.getByTestId(T.incomingCall).count()) === 0,
      'incoming modal hidden after reject'
    );
    await pollCall(
      senderPage,
      async () => (await senderPage.getByTestId(T.outgoingCall).count()) === 0,
      'outgoing modal hidden after reject'
    );
  });
});
