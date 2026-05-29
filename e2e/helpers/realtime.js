const { expect } = require('@playwright/test');

/** Селекторы UI realtime (data-testid) — единый источник для E2E */
const T = {
  messageInput: 'chat-message-input',
  sendButton: 'chat-send-button',
  messageBody: 'chat-message-text-body',
  sidebarItem: (chatId) => `chat-sidebar-item-${chatId}`,
  sidebarLastMessage: 'chat-sidebar-last-message',
  sidebarOnline: 'chat-sidebar-online',
  sidebarReadStatus: 'chat-sidebar-read-status',
};

/** SLA доставки в UI (мс) */
const REALTIME_MS = Number(process.env.E2E_REALTIME_MS || 2000);
const REALTIME_INTERVALS = [30, 50, 80, 100, 150, 200];

/**
 * @param {import('@playwright/test').APIRequestContext} request
 */
async function assertBackendUp(request) {
  const api = (process.env.E2E_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');
  const healthUrl = `${api}/actuator/health`;
  try {
    const res = await request.get(healthUrl);
    if (!res.ok()) {
      throw new Error(`Backend health ${res.status()} at ${healthUrl}`);
    }
  } catch (e) {
    throw new Error(
      `Backend недоступен (${healthUrl}). Запустите buddy с профилем local-dev.\n${e.message}`
    );
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} message
 */
async function pollRealtime(page, checkFn, message) {
  const { expect } = require('@playwright/test');
  await expect
    .poll(checkFn, {
      timeout: REALTIME_MS,
      intervals: REALTIME_INTERVALS,
      message,
    })
    .toBe(true);
}

/**
 * @param {import('@playwright/test').Page} senderPage
 * @param {string|number} chatId
 */
async function sendTextAndWaitRest(senderPage, chatId, text) {
  const api =
    process.env.NEXT_PUBLIC_API_URL || process.env.E2E_API_URL || 'http://localhost:8080/api';
  const input = senderPage.getByTestId(T.messageInput);
  const send = senderPage.getByTestId(T.sendButton);
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(text);
  await expect(send).toBeVisible({ timeout: 10_000 });
  const responsePromise = senderPage.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      res.url().includes(`/chats/${chatId}/messages`) &&
      res.status() < 400
  );
  await send.click();
  await responsePromise;
}

module.exports = {
  T,
  REALTIME_MS,
  REALTIME_INTERVALS,
  assertBackendUp,
  pollRealtime,
  sendTextAndWaitRest,
};
