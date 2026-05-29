const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T } = require('./helpers/realtime');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && chatId;

test.describe('Emoji picker UI', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_CHAT_ID in .env.e2e.local');

  test('opens picker with emoji tab', async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await seedAuthContext(context, auth);
    const page = await context.newPage();

    await openChat(page, chatId);
    await waitForChatReady(page);

    await expect(page.getByTestId(T.emojiButton)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(T.emojiButton).click();
    await expect(page.getByTestId('emoji-picker-panel')).toBeVisible();
    await expect(page.getByTestId('emoji-picker-tab-emoji')).toBeVisible();
    await expect(page.getByTestId('emoji-picker-standard').first()).toBeVisible();

    await context.close();
  });

  test('does not close when clicking inside picker', async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    const context = await browser.newContext({ viewport: { width: 420, height: 780 } });
    await seedAuthContext(context, auth);
    const page = await context.newPage();

    await openChat(page, chatId);
    await waitForChatReady(page);

    await page.getByTestId(T.emojiButton).click();
    await expect(page.getByTestId('emoji-picker-panel')).toBeVisible();

    // Click inside the picker (panel should remain visible)
    await page.getByTestId('emoji-picker-panel').click({ position: { x: 40, y: 60 } });
    await expect(page.getByTestId('emoji-picker-panel')).toBeVisible();

    await context.close();
  });

  test('stays open for multiple emoji picks', async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    const context = await browser.newContext({ viewport: { width: 420, height: 780 } });
    await seedAuthContext(context, auth);
    const page = await context.newPage();

    await openChat(page, chatId);
    await waitForChatReady(page);

    await page.getByTestId(T.emojiButton).click();
    const panel = page.getByTestId('emoji-picker-panel');
    await expect(panel).toBeVisible();

    const emoji = page.getByTestId('emoji-picker-standard').first();
    await emoji.click();
    await expect(panel).toBeVisible();
    await emoji.click();
    await expect(panel).toBeVisible();

    await context.close();
  });
});
