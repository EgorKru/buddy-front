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
const groupChatId = process.env.E2E_GROUP_CHAT_ID;

const hasE2eEnv = senderUser && senderPass && groupChatId;

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
    await expect(page.getByText('Настройка перед встречей')).toBeVisible();
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

    await expect(page.getByTestId(T.roomLogo)).toHaveText('Pager Meet');
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
});
