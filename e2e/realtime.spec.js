/**
 * UI E2E: realtime чат + сайдбар (data-testid, два браузера, STOMP).
 *
 * npm run test:e2e:setup
 * npm run test:e2e:realtime
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T, REALTIME_MS, pollRealtime, sendTextAndWaitRest } = require('./helpers/realtime');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;

test.describe.configure({ mode: 'serial' });

test.describe('Realtime UI (WebSocket delivery)', () => {
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
    });
    recipientContext = await browser.newContext();
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

  test('STOMP connected on both clients', async () => {
    await expect
      .poll(async () => {
        const a = await senderPage.evaluate(() => window.__stompConnected === true);
        const b = await recipientPage.evaluate(() => window.__stompConnected === true);
        return a && b;
      })
      .toBe(true);
  });

  test(`recipient sees message in thread within ${REALTIME_MS}ms`, async () => {
    const uniqueText = `e2e-thread-${Date.now()}`;
    const threadMessage = recipientPage
      .locator('[data-testid="chat-message-text"]')
      .filter({ hasText: uniqueText });

    const sentAt = Date.now();
    await sendTextAndWaitRest(senderPage, chatId, uniqueText);

    await pollRealtime(
      recipientPage,
      async () => (await threadMessage.count()) > 0,
      `message "${uniqueText}" in chat thread`
    );

    await expect(
      recipientPage.getByTestId(T.messageBody).filter({ hasText: uniqueText })
    ).toBeVisible();
    expect(Date.now() - sentAt).toBeLessThanOrEqual(REALTIME_MS);
  });

  test(`sidebar preview updates within ${REALTIME_MS}ms`, async () => {
    const uniqueText = `e2e-sidebar-${Date.now()}`;
    const preview = recipientPage
      .getByTestId(T.sidebarItem(chatId))
      .getByTestId(T.sidebarLastMessage);

    const sentAt = Date.now();
    await sendTextAndWaitRest(senderPage, chatId, uniqueText);

    await pollRealtime(
      recipientPage,
      async () => (await preview.textContent())?.includes(uniqueText),
      `sidebar preview "${uniqueText}"`
    );

    expect(Date.now() - sentAt).toBeLessThanOrEqual(REALTIME_MS);
  });

  test('sidebar shows online indicator when partner is connected', async () => {
    const onlineDot = senderPage.getByTestId(T.sidebarItem(chatId)).getByTestId(T.sidebarOnline);

    await expect(onlineDot).toHaveCount(1);
  });

  test(`sidebar read checkmarks (data-read=true) within ${REALTIME_MS}ms after read`, async () => {
    const uniqueText = `e2e-read-${Date.now()}`;
    const readStatus = senderPage
      .getByTestId(T.sidebarItem(chatId))
      .getByTestId(T.sidebarReadStatus);

    await sendTextAndWaitRest(senderPage, chatId, uniqueText);

    await expect(
      recipientPage.getByTestId(T.messageBody).filter({ hasText: uniqueText })
    ).toBeVisible({ timeout: 15_000 });

    const readStart = Date.now();
    await pollRealtime(
      senderPage,
      async () => (await readStatus.getAttribute('data-read')) === 'true',
      'sender sidebar read status'
    );

    expect(Date.now() - readStart).toBeLessThanOrEqual(REALTIME_MS);
  });

  test(`sender sees read after recipient returns to chat within ${REALTIME_MS}ms`, async () => {
    const uniqueText = `e2e-read-return-${Date.now()}`;
    const readStatus = senderPage
      .getByTestId(T.sidebarItem(chatId))
      .getByTestId(T.sidebarReadStatus);

    await recipientPage.goto('/app');
    await recipientPage.waitForURL(/\/app$/, { timeout: 15_000 });

    await sendTextAndWaitRest(senderPage, chatId, uniqueText);

    await openChat(recipientPage, chatId);
    await waitForChatReady(recipientPage, { requireStomp: true });

    await expect(
      recipientPage.getByTestId(T.messageBody).filter({ hasText: uniqueText })
    ).toBeVisible({ timeout: 15_000 });

    const readStart = Date.now();
    await pollRealtime(
      senderPage,
      async () => (await readStatus.getAttribute('data-read')) === 'true',
      'sender sidebar read status after recipient return'
    );

    expect(Date.now() - readStart).toBeLessThanOrEqual(REALTIME_MS);
  });

  test('message persists after recipient reloads chat page', async () => {
    const uniqueText = `e2e-persist-${Date.now()}`;

    await sendTextAndWaitRest(senderPage, chatId, uniqueText);
    await expect(
      recipientPage.getByTestId(T.messageBody).filter({ hasText: uniqueText })
    ).toBeVisible({ timeout: 15_000 });

    await recipientPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForChatReady(recipientPage, { requireStomp: true });

    await expect(
      recipientPage.getByTestId(T.messageBody).filter({ hasText: uniqueText })
    ).toBeVisible({ timeout: 15_000 });
  });
});
