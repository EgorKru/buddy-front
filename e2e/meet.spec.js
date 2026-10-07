/**
 * UI E2E: групповой Pager Meet — preview, layout, controls.
 *
 * npm run test:e2e:setup
 * npm run test:e2e:meet
 */
const { test, expect } = require('@playwright/test');
const { loginViaApi, seedAuthContext, openChat, waitForChatReady } = require('./helpers/auth');
const {
  T,
  openMeetPreview,
  confirmMeetPreview,
  cancelMeetPreview,
  waitForRoomPage,
  waitForRoomControls,
  assertConventionalMeetLayout,
} = require('./helpers/meet');

const senderUser = process.env.E2E_SENDER_USERNAME;
const senderPass = process.env.E2E_SENDER_PASSWORD;
const recipientUser = process.env.E2E_RECIPIENT_USERNAME;
const recipientPass = process.env.E2E_RECIPIENT_PASSWORD;
const groupChatId = process.env.E2E_GROUP_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && groupChatId;
const hasAuthEnv = senderUser && senderPass;
const hasMultiUserEnv = hasAuthEnv && recipientUser && recipientPass;

test.describe.configure({ mode: 'serial' });

test.use({
  permissions: ['microphone', 'camera'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('Group meet UI', () => {
  test.skip(!hasE2eEnv, 'Set E2E_SENDER_*, E2E_GROUP_CHAT_ID in .env.e2e.local');
  test.setTimeout(180_000);

  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ['microphone', 'camera'],
    });
    await seedAuthContext(context, auth);
    page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
        configurable: true,
        value: () => navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      });
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await openChat(page, groupChatId);
    await waitForChatReady(page, { requireStomp: true });
  });

  test('meet preview opens from group chat header', async () => {
    await openMeetPreview(page);
    await expect(page.getByTestId(T.meetPreviewConfirm)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Перед входом|Настройка перед встречей/ })
    ).toBeVisible();
  });

  test('cancel closes meet preview without navigation', async () => {
    await openMeetPreview(page);
    await cancelMeetPreview(page);
    await expect(page.getByTestId(T.meetPreviewModal)).toHaveCount(0);
    expect(page.url()).toContain(`/chat/${groupChatId}`);
  });

  test('start meet opens room page with conventional layout', async () => {
    await openMeetPreview(page);
    await confirmMeetPreview(page);

    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomPage(page);
    await waitForRoomControls(page);
    await assertConventionalMeetLayout(page);

    await expect(page.getByTestId(T.roomLogo)).toContainText('Pager Meet');
    await expect(page.getByTestId(T.roomCode)).not.toBeEmpty();
  });

  test('control bar keeps participants left and actions centered', async () => {
    await openMeetPreview(page);
    await confirmMeetPreview(page);
    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomControls(page);

    const left = page.getByTestId(T.roomControlsLeft);
    const center = page.getByTestId(T.roomControlsCenter);
    const leave = page.getByTestId(T.roomLeave);

    await expect(left).toBeVisible();
    await expect(center).toBeVisible();
    await expect(leave).toBeVisible();

    const leaveBox = await leave.boundingBox();
    const centerBox = await center.boundingBox();
    expect(leaveBox.x).toBeGreaterThan(centerBox.x - 50);
  });

  test('participants and device settings stay one click away', async () => {
    await openMeetPreview(page);
    await confirmMeetPreview(page);
    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomControls(page);

    await page.getByTestId(T.roomParticipants).click();
    await expect(page.getByTestId(T.roomParticipantsPanel)).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Найти участника' })).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть список участников' }).click();

    await page.getByTestId(T.roomSettings).click();
    await expect(page.getByTestId(T.roomSettingsPanel)).toBeVisible();
    await expect(page.getByTestId(T.roomCameraSelect)).toBeVisible();
    await expect(page.getByTestId(T.roomMicrophoneSelect)).toBeVisible();
    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByTestId(T.roomSettingsPanel)).toHaveCount(0);
  });

  test('media controls expose state and screen sharing can be stopped', async () => {
    await openMeetPreview(page);
    await confirmMeetPreview(page);
    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomControls(page);

    const mic = page.getByTestId(T.roomMic);
    const video = page.getByTestId(T.roomVideo);
    await mic.click();
    await video.click();
    await expect(mic).toHaveAttribute('aria-pressed', 'false');
    await expect(video).toHaveAttribute('aria-pressed', 'false');

    const screenShare = page.getByTestId(T.roomScreenShare);
    await screenShare.click();
    await expect(page.getByTestId(T.roomScreenPreview)).toBeVisible();
    await expect(screenShare).toHaveAttribute('aria-pressed', 'true');
    await screenShare.click();
    await expect(page.getByTestId(T.roomScreenPreview)).toHaveCount(0);
  });

  test('participant access remains visible on a narrow viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMeetPreview(page);
    await confirmMeetPreview(page);
    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomControls(page);

    await expect(page.getByTestId(T.roomParticipants)).toBeVisible();
    await expect(page.getByTestId(T.roomLeave)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});

test.describe('Workspace meet journey', () => {
  test.skip(!hasAuthEnv, 'Set E2E_SENDER_USERNAME and E2E_SENDER_PASSWORD');
  test.setTimeout(180_000);

  let appContext;
  let appPage;

  test.beforeAll(async ({ browser }) => {
    const auth = await loginViaApi(senderUser, senderPass);
    appContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ['microphone', 'camera'],
    });
    await seedAuthContext(appContext, auth);
    appPage = await appContext.newPage();
    await appPage.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
        configurable: true,
        value: () => navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      });
    });
  });

  test.afterAll(async () => {
    await appContext?.close();
  });

  test('creates and controls a responsive meeting from the workspace', async () => {
    await appPage.goto('/app');
    await appPage.getByRole('button', { name: 'Создать комнату', exact: true }).click();
    await expect(appPage.getByTestId(T.meetPreviewModal)).toBeVisible();
    await confirmMeetPreview(appPage);
    await appPage.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomPage(appPage);
    await waitForRoomControls(appPage);
    await assertConventionalMeetLayout(appPage);

    await appPage.getByTestId(T.roomParticipants).click();
    await expect(appPage.getByTestId(T.roomParticipantsPanel)).toBeVisible();
    await appPage.getByRole('button', { name: 'Закрыть список участников' }).click();

    await appPage.getByTestId(T.roomSettings).click();
    await expect(appPage.getByTestId(T.roomCameraSelect)).toBeVisible();
    await expect(appPage.getByTestId(T.roomMicrophoneSelect)).toBeVisible();
    await appPage.getByRole('button', { name: 'Готово' }).click();

    const screenShare = appPage.getByTestId(T.roomScreenShare);
    await screenShare.click();
    await expect(appPage.getByTestId(T.roomScreenPreview)).toBeVisible();
    await expect(screenShare).toHaveAttribute('aria-pressed', 'true');
    await screenShare.click();
    await expect(appPage.getByTestId(T.roomScreenPreview)).toHaveCount(0);

    await appPage.setViewportSize({ width: 390, height: 844 });
    await expect(appPage.getByTestId(T.roomParticipants)).toBeVisible();
    await expect(appPage.getByTestId(T.roomLeave)).toBeVisible();
  });
});

test.describe('Two participant meeting', () => {
  test.skip(!hasMultiUserEnv, 'Set E2E sender and recipient credentials');
  test.setTimeout(180_000);

  let hostContext;
  let guestContext;
  let hostPage;
  let guestPage;

  test.beforeAll(async ({ browser }) => {
    const [hostAuth, guestAuth] = await Promise.all([
      loginViaApi(senderUser, senderPass),
      loginViaApi(recipientUser, recipientPass),
    ]);
    hostContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ['microphone', 'camera'],
    });
    guestContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ['microphone', 'camera'],
    });
    await seedAuthContext(hostContext, hostAuth);
    await seedAuthContext(guestContext, guestAuth);
    hostPage = await hostContext.newPage();
    guestPage = await guestContext.newPage();

    for (const page of [hostPage, guestPage]) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
          configurable: true,
          value: () => navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
        });
      });
    }
  });

  test.afterAll(async () => {
    await Promise.all([hostContext?.close(), guestContext?.close()]);
  });

  test('keeps both participants synchronized and forwards a presentation', async () => {
    await hostPage.goto('/app');
    await hostPage.getByRole('button', { name: 'Создать комнату', exact: true }).click();
    await confirmMeetPreview(hostPage);
    await hostPage.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45_000 });
    await waitForRoomControls(hostPage);

    await guestPage.goto(hostPage.url());
    await waitForRoomPage(guestPage);
    await waitForRoomControls(guestPage);

    await expect(hostPage.getByTestId(T.roomParticipants)).toHaveAccessibleName('Участники: 2', {
      timeout: 30_000,
    });
    await expect(guestPage.getByTestId(T.roomParticipants)).toHaveAccessibleName('Участники: 2', {
      timeout: 30_000,
    });
    await expect(hostPage.getByTestId(T.roomVideoGrid)).toHaveAttribute(
      'data-participant-count',
      '2'
    );
    await expect(guestPage.getByTestId(T.roomVideoGrid)).toHaveAttribute(
      'data-participant-count',
      '2'
    );

    await hostPage.getByTestId(T.roomScreenShare).click();
    await expect(hostPage.getByTestId(T.roomScreenPreview)).toBeVisible();
    await expect(guestPage.locator('[data-presentation-stream="true"]')).toBeVisible({
      timeout: 30_000,
    });
    await hostPage.getByTestId(T.roomScreenShare).click();
    await expect(guestPage.locator('[data-presentation-stream="true"]')).toHaveCount(0, {
      timeout: 30_000,
    });
  });
});
