/**
 * UI E2E: реакции через контекстное меню (ПКМ по сообщению).
 *
 * npm run test:e2e:setup
 * npx playwright test e2e/reactions.spec.js
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T, pollRealtime, sendTextAndWaitRest } = require('./helpers/realtime');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;

test.describe.configure({ mode: 'serial' });

test.describe('Message reactions via context menu', () => {
  test.skip(!hasE2eEnv, 'Set E2E_* in .env.e2e.local');
  test.setTimeout(180_000);

  let senderContext;
  let recipientContext;
  let senderPage;
  let recipientPage;

  test.beforeAll(async ({ browser }) => {
    const senderAuth = await loginViaApi(senderUser, senderPass);
    const recipientAuth = await loginViaApi(recipientUser, recipientPass);

    senderContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
    await waitForChatReady(senderPage);
    await waitForChatReady(recipientPage);
  });

  test('context menu shows reaction row on right-click', async () => {
    const text = `reaction-menu-${Date.now()}`;
    await sendTextAndWaitRest(senderPage, chatId, text);

    const body = senderPage.getByTestId(T.messageBody).filter({ hasText: text });
    await expect(body).toBeVisible({ timeout: 10_000 });
    await body.click({ button: 'right' });

    await expect(senderPage.getByTestId('message-context-menu')).toBeVisible({ timeout: 5_000 });
    await expect(senderPage.getByTestId('message-context-menu-reactions')).toBeVisible();
    await expect(senderPage.getByTestId('chat-context-menu-reply')).toBeVisible();
  });

  test('reaction from context menu appears for recipient', async () => {
    const text = `reaction-live-${Date.now()}`;
    await sendTextAndWaitRest(senderPage, chatId, text);

    const body = senderPage.getByTestId(T.messageBody).filter({ hasText: text });
    await body.click({ button: 'right' });
    await expect(senderPage.getByTestId('message-context-menu-reactions')).toBeVisible();
    await senderPage.getByTestId('reaction-bar-emoji').filter({ hasText: '👍' }).click();

    await pollRealtime(
      recipientPage,
      async () => {
        const row = recipientPage.locator(`[data-message-id]`).filter({ hasText: text });
        const chip = row.getByTestId('message-reaction-chip');
        return (await chip.count()) > 0;
      },
      'recipient should see reaction chip under message'
    );
  });
});
