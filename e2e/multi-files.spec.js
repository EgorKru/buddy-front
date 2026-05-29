/**
 * E2E: выбор и отправка нескольких файлов (разные и одинаковые типы).
 *
 * npm run test:e2e:multi-files
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const {
  T,
  FIXTURES,
  attachMultipleFilesInChat,
  expectFilePreviewCount,
} = require('./helpers/files');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;

test.describe.configure({ mode: 'serial' });

test.describe('Multi-file upload', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID in .env.e2e.local');
  test.setTimeout(240_000);

  let senderPage;
  let recipientPage;
  let senderContext;
  let recipientContext;

  test.beforeAll(async ({ browser }) => {
    const senderAuth = await loginViaApi(senderUser, senderPass);
    const recipientAuth = await loginViaApi(recipientUser, recipientPass);

    senderContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    await openChat(senderPage, chatId);
    await openChat(recipientPage, chatId);
    await waitForChatReady(senderPage, { requireStomp: true });
    await waitForChatReady(recipientPage, { requireStomp: true });
  });

  test('preview shows all selected files of mixed types', async () => {
    const files = [
      { ...FIXTURES.txt, name: `multi-${Date.now()}-notes.txt` },
      { ...FIXTURES.png, name: `multi-${Date.now()}-pixel.png` },
      { ...FIXTURES.pdf, name: `multi-${Date.now()}-doc.pdf` },
    ];

    await attachMultipleFilesInChat(senderPage, files);
    await expectFilePreviewCount(senderPage, 3);
    await expect(senderPage.getByTestId('chat-file-preview-list')).toBeVisible();
  });

  test('recipient receives three messages after mixed multi-file send', async () => {
    const stamp = Date.now();
    const caption = `multi-caption-${stamp}`;
    const files = [
      { ...FIXTURES.txt, name: `multi-a-${stamp}.txt` },
      { ...FIXTURES.png, name: `multi-b-${stamp}.png` },
      { ...FIXTURES.pdf, name: `multi-c-${stamp}.pdf` },
    ];

    await attachMultipleFilesInChat(senderPage, files);
    await expectFilePreviewCount(senderPage, 3);

    await senderPage.getByTestId('chat-message-input').fill(caption);
    await senderPage.getByTestId(T.sendButton).click();

    await expect(senderPage.getByTestId('chat-file-preview-list')).toHaveCount(0, {
      timeout: 60_000,
    });

    await expect(
      recipientPage.getByTestId(T.messageImage).filter({ hasText: '' }).last()
    ).toBeVisible({
      timeout: 60_000,
    });

    const recipientFiles = recipientPage.getByTestId(T.messageFile);
    await expect
      .poll(async () => recipientFiles.count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(2);

    await expect(recipientPage.getByTestId(T.messageBody).filter({ hasText: caption })).toBeVisible(
      {
        timeout: 60_000,
      }
    );
  });

  test('two files of same type (txt) produce two file messages', async () => {
    const stamp = Date.now();
    const files = [
      {
        ...FIXTURES.txt,
        name: `same-type-1-${stamp}.txt`,
        buffer: Buffer.from(`first ${stamp}`, 'utf8'),
      },
      {
        ...FIXTURES.txt,
        name: `same-type-2-${stamp}.txt`,
        buffer: Buffer.from(`second ${stamp}`, 'utf8'),
      },
    ];

    await attachMultipleFilesInChat(senderPage, files);
    await expectFilePreviewCount(senderPage, 2);
    await senderPage.getByTestId(T.sendButton).click();

    await expect(senderPage.getByTestId('chat-file-preview-list')).toHaveCount(0, {
      timeout: 60_000,
    });

    await expect
      .poll(async () => recipientPage.getByTestId(T.messageFile).count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(2);
  });
});
