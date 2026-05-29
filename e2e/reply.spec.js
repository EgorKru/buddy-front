/**
 * UI E2E: плашка «ответ на …» у получателя сразу с текстом сообщения.
 *
 * npm run test:e2e:setup
 * npm run test:e2e:reply
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T, REALTIME_MS, pollRealtime } = require('./helpers/realtime');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;

test.describe.configure({ mode: 'serial' });

test.describe('Reply preview (immediate for recipient)', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID in .env.e2e.local');
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
    await waitForChatReady(recipientPage, { requireStomp: true });
    await waitForChatReady(senderPage, { requireStomp: true });
  });

  test(`recipient sees reply preview with parent text within ${REALTIME_MS}ms`, async () => {
    const parentText = `e2e-parent-${Date.now()}`;
    const replyText = `e2e-reply-${Date.now()}`;

    const input = senderPage.getByTestId(T.messageInput);
    const send = senderPage.getByTestId(T.sendButton);
    await input.fill(parentText);
    const parentPost = senderPage.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes(`/chats/${chatId}/messages`) &&
        res.status() < 400
    );
    await send.click();
    await parentPost;

    await expect(
      recipientPage.getByTestId(T.messageBody).filter({ hasText: parentText })
    ).toBeVisible({ timeout: 15_000 });

    const parentRow = senderPage
      .locator('[data-testid="chat-message-text"]')
      .filter({ hasText: parentText });
    await parentRow.click({ button: 'right' });
    await senderPage.getByTestId('chat-context-menu-reply').click();

    await input.fill(replyText);
    const replyPost = senderPage.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes(`/chats/${chatId}/messages`) &&
        res.status() < 400
    );
    await send.click();
    await replyPost;

    const replyRow = recipientPage
      .locator('[data-testid="chat-message-text"]')
      .filter({ hasText: replyText });

    const sentAt = Date.now();
    await pollRealtime(
      recipientPage,
      async () => {
        if ((await replyRow.count()) === 0) return false;
        const preview = replyRow.locator('[data-testid="message-reply-preview"]');
        if ((await preview.count()) === 0) return false;
        const body = await recipientPage
          .getByTestId(T.messageBody)
          .filter({ hasText: replyText })
          .count();
        if (body === 0) return false;
        const previewText = await preview.first().textContent();
        return previewText?.includes(parentText);
      },
      `reply preview with parent "${parentText}"`
    );

    expect(Date.now() - sentAt).toBeLessThanOrEqual(REALTIME_MS);
    await expect(replyRow.locator('[data-testid="message-reply-preview"]')).toContainText(
      parentText
    );
  });
});
