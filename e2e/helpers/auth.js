const API_URL = process.env.E2E_API_URL || 'http://localhost:8080/api';

/**
 * @param {string} username
 * @param {string} password
 */
export async function loginViaApi(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || `Login failed: ${res.status}`);
  }
  return body;
}

/**
 * Токен в localStorage до первой загрузки страницы (обход SSR без auth в _app).
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ token: string, user: object }} auth
 */
export async function seedAuthContext(context, auth) {
  await context.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.removeItem('disable_websocket');
    },
    { token: auth.token, user: auth.user }
  );
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} password
 */
export async function loginViaUi(page, username, password) {
  const auth = await loginViaApi(username, password);
  await seedAuthContext(page.context(), auth);
  await page.goto('/app');
  await page.waitForURL(/\/app/, { timeout: 20_000 });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string|number} chatId
 */
async function pageHasNextCompileError(page) {
  const body =
    (await page
      .locator('body')
      .innerText()
      .catch(() => '')) || '';
  return (
    body.includes('Server Error') ||
    body.includes('missing required error components') ||
    body.includes('middleware-manifest.json') ||
    body.includes('vendor-chunks')
  );
}

export async function openChat(page, chatId) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!localStorage.getItem('token'), null, { timeout: 10_000 });
    await page.goto(`/chat/${chatId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), null, {
      timeout: 15_000,
    });
    const is404 = await page
      .getByRole('heading', { name: '404' })
      .isVisible()
      .catch(() => false);
    if (!(await pageHasNextCompileError(page)) && !is404) {
      break;
    }
    await page.waitForTimeout(2000);
  }
  await page.getByTestId('chat-message-input').waitFor({ state: 'visible', timeout: 60_000 });
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function waitForStompConnected(page) {
  await page.waitForFunction(() => window.__stompConnected === true, null, { timeout: 60_000 });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ requireStomp?: boolean }} [options]
 */
export async function waitForChatReady(page, options = {}) {
  const { requireStomp = false } = options;
  const input = page.getByTestId('chat-message-input');
  await input.waitFor({ state: 'visible', timeout: 45_000 });
  await expectEnabled(input, 15_000);
  if (requireStomp) {
    await waitForStompConnected(page);
  } else {
    try {
      await waitForStompConnected(page);
    } catch {
      // без requireStomp — допускаем REST-only fallback
    }
  }
}

async function expectEnabled(locator, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(100);
  }
  throw new Error('chat-message-input did not become enabled in time');
}
