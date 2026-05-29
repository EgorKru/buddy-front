/**
 * E2E: просмотр вложений в чате (txt, pdf, png, mp4, docx).
 *
 * npm run test:e2e:files
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const { T, sendFixtureAndWait } = require('./helpers/files');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const chatId = process.env.E2E_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && recipientUser && recipientPass && chatId;

test.describe.configure({ mode: 'serial' });

test.describe('Chat file previews', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID in .env.e2e.local');
  test.setTimeout(180_000);

  let senderPage;
  let recipientPage;
  let senderContext;
  let recipientContext;

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
    await openChat(senderPage, chatId);
    await openChat(recipientPage, chatId);
    await waitForChatReady(senderPage, { requireStomp: true });
    await waitForChatReady(recipientPage, { requireStomp: true });
  });

  test('PNG image is visible inline in chat', async () => {
    await sendFixtureAndWait(senderPage, 'png');
    await expect(recipientPage.getByTestId(T.messageImage).last()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('TXT opens in viewer modal with text', async () => {
    await sendFixtureAndWait(senderPage, 'txt');
    const fileRow = senderPage.getByTestId(T.messageFile).last();
    await fileRow.getByTestId('chat-message-file-card').click();

    const modal = senderPage.getByTestId(T.fileViewerModal);
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('data-preview-kind', 'text');
    await expect(senderPage.getByTestId(T.fileViewerText)).toContainText('E2E file preview text', {
      timeout: 15_000,
    });
  });

  test('PDF opens in viewer with pdf iframe', async () => {
    await sendFixtureAndWait(senderPage, 'pdf');
    const fileRow = senderPage.getByTestId(T.messageFile).last();
    await fileRow.getByTestId('chat-message-file-card').click();

    const modal = senderPage.getByTestId(T.fileViewerModal);
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('data-preview-kind', 'pdf');
    await expect(senderPage.getByTestId(T.fileViewerPdf)).toBeVisible({ timeout: 15_000 });
  });

  test('MP4 attachment is delivered as video file in chat', async () => {
    await sendFixtureAndWait(senderPage, 'mp4');
    await expect(recipientPage.getByTestId(T.messageFile).last()).toHaveAttribute(
      'data-preview-kind',
      'video'
    );
  });

  test('DOCX opens office hint in viewer', async () => {
    await sendFixtureAndWait(senderPage, 'docx');
    const fileRow = senderPage.getByTestId(T.messageFile).last();
    await fileRow.getByTestId('chat-message-file-card').click();

    const modal = senderPage.getByTestId(T.fileViewerModal);
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('data-preview-kind', 'office');
    await expect(senderPage.getByTestId(T.fileViewerOffice)).toBeVisible();
  });
});
