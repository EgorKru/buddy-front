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
const hasSenderEnv = senderUser && senderPass;

test.describe.configure({ mode: 'serial' });

test.use({
  permissions: ['microphone', 'camera'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('Settings center', () => {
  test.skip(!hasSenderEnv, 'Set E2E_SENDER_USERNAME and E2E_SENDER_PASSWORD');
  test.setTimeout(120_000);

  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    context = await browser.newContext({ permissions: ['microphone', 'camera'] });
    await seedAuthContext(context, auth);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  });

  test('interface and notification preferences apply immediately and survive reload', async () => {
    await page.getByRole('button', { name: /Интерфейс/ }).click();
    await expect(page.getByText('Плотность')).toHaveCount(0);
    await expect(page.getByText('Панель чатов')).toHaveCount(0);
    await page.getByRole('switch', { name: /Уменьшить анимацию/ }).click();
    await expect(page.locator('body')).toHaveAttribute('data-reduce-motion', 'true');

    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-reduce-motion', 'true');

    await page.getByRole('button', { name: /Уведомления/ }).click();
    const sound = page.getByRole('switch', { name: /Звук новых сообщений/ });
    await sound.click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('disable_notification_sound')))
      .toBe('true');
    await sound.click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('disable_notification_sound')))
      .toBeNull();
  });

  test('back to workspace replaces the settings screen', async () => {
    await page.getByRole('link', { name: 'Рабочее пространство' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: 'Настройки' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /команда уже рядом/i })).toBeVisible();
  });

  test('saved media devices can be previewed and released', async () => {
    await page.getByRole('button', { name: /Устройства/ }).click();
    await page.getByRole('button', { name: 'Проверить устройства' }).click();
    const preview = page.locator('video');
    await expect(preview).toBeVisible();
    await expect
      .poll(() => preview.evaluate((video) => video.srcObject?.getTracks().length || 0))
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Остановить' }).click();
    await expect(preview).toHaveCount(0);
  });

  test('mobile settings have no horizontal overflow and keep every section one tap away', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);

    for (const section of ['Профиль', 'Интерфейс', 'Уведомления', 'Устройства']) {
      await expect(page.getByRole('button', { name: new RegExp(section) })).toBeVisible();
    }
  });
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

test.describe('Rich chat composer', () => {
  test.skip(!hasDirectEnv, 'Set E2E_SENDER_*, E2E_RECIPIENT_*, E2E_CHAT_ID');
  test.setTimeout(180_000);

  let senderContext;
  let recipientContext;
  let senderPage;
  let recipientPage;

  test.beforeAll(async ({ browser }) => {
    const senderAuth = await loginViaApi(senderUser, senderPass);
    const recipientAuth = await loginViaApi(recipientUser, recipientPass);
    senderContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
    recipientContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
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

  test('local SVG emoji picker sends an animated emoji message', async () => {
    await senderPage.getByRole('button', { name: 'Открыть эмодзи' }).click();
    const picker = senderPage.getByTestId('emoji-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('searchbox', { name: 'Поиск эмодзи' }).fill('огонь');
    const fire = picker.getByRole('button', { name: 'Добавить 🔥' });
    await expect(fire.locator('img')).toHaveAttribute('src', /\/emoji\/twemoji\/1f525\.svg$/);
    expect(await fire.locator('img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    await fire.click();
    await senderPage.getByTestId('chat-send-button').click();

    const receivedEmoji = recipientPage
      .locator('[data-testid="chat-message-text-body"][data-emoji-count="1"]')
      .filter({ has: recipientPage.locator('img[src$="/emoji/twemoji/1f525.svg"]') })
      .last();
    await expect(receivedEmoji).toBeVisible({ timeout: 15_000 });
  });

  test('records, uploads and delivers a circular video note', async () => {
    await senderPage.getByRole('button', { name: 'Записать видеокружок' }).click();
    await expect(senderPage.getByTestId('video-note-composer')).toBeVisible();
    await senderPage.waitForTimeout(700);

    const upload = senderPage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/chats/${chatId}/files/file`) &&
        response.status() < 400
    );
    await senderPage.getByRole('button', { name: 'Отправить видеокружок' }).click();
    await upload;

    const recipientNote = recipientPage.getByTestId('chat-video-note').last();
    await expect(recipientNote).toBeVisible({ timeout: 20_000 });
    await expect(
      recipientNote.getByRole('button', { name: 'Воспроизвести видеокружок' })
    ).toBeVisible();
  });
});
