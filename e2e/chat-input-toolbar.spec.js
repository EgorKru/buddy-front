/**
 * UI E2E: панель ввода — кнопка эмодзи видна рядом со скрепкой и микрофоном.
 *
 * npm run test:e2e:setup
 * npm run test:e2e:emoji
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T } = require('./helpers/realtime');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && chatId;

test.describe.configure({ mode: 'serial' });

test.describe('Chat input toolbar (emoji visibility)', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_CHAT_ID in .env.e2e.local');
  test.setTimeout(180_000);

  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await seedAuthContext(context, auth);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await openChat(page, chatId);
    await waitForChatReady(page, { requireStomp: false });
    await expect(page.getByTestId(T.messageInput)).toBeVisible({ timeout: 15_000 });
  });

  test('emoji button is visible in empty chat input', async () => {
    const emoji = page.getByTestId(T.emojiButton);
    const attach = page.getByTestId(T.attachButton);
    const voice = page.getByTestId(T.voiceButton);
    const actions = page.getByTestId(T.inputActions);

    await expect(actions).toBeVisible();
    await expect(emoji).toBeVisible();
    await expect(attach).toBeVisible();
    await expect(voice).toBeVisible();

    const emojiBox = await emoji.boundingBox();
    const attachBox = await attach.boundingBox();
    const voiceBox = await voice.boundingBox();

    expect(emojiBox).toBeTruthy();
    expect(attachBox).toBeTruthy();
    expect(voiceBox).toBeTruthy();

    // Эмодзи слева от скрепки, скрепка слева от микрофона
    expect(emojiBox.x).toBeLessThan(attachBox.x);
    expect(attachBox.x).toBeLessThan(voiceBox.x);
  });

  test('emoji button stays visible when user types text', async () => {
    const input = page.getByTestId(T.messageInput);
    await input.fill('Проверка эмодзи');

    await expect(page.getByTestId(T.emojiButton)).toBeVisible();
    await expect(page.getByTestId(T.attachButton)).toBeHidden();
    await expect(page.getByTestId(T.voiceButton)).toBeHidden();
    await expect(page.getByTestId(T.sendButton)).toBeVisible();
  });

  test('clicking emoji opens picker panel', async () => {
    await page.getByTestId(T.emojiButton).click();
    await expect(page.getByTestId('emoji-picker-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('emoji-picker-tab-emoji')).toBeVisible();
    await expect(page.getByTestId('emoji-picker-standard').first()).toBeVisible();
  });
});
