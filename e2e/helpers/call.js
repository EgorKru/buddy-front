const { expect } = require('@playwright/test');

/** Селекторы UI звонков (data-testid) */
const T = {
  chatCallButton: 'chat-call-button',
  callTypeAudio: 'call-type-audio',
  incomingCall: 'incoming-call-modal',
  incomingAccept: 'incoming-call-accept',
  incomingReject: 'incoming-call-reject',
  outgoingCall: 'outgoing-call-modal',
  outgoingCancel: 'outgoing-call-cancel',
  activeCall: 'active-call-view',
  activeCallEnd: 'active-call-end',
  activeCallTimer: 'active-call-timer',
};

const REALTIME_MS = Number(process.env.E2E_REALTIME_MS || 8000);

async function pollCall(page, checkFn, message) {
  await expect
    .poll(checkFn, {
      timeout: REALTIME_MS,
      intervals: [50, 100, 150, 200, 300],
      message,
    })
    .toBe(true);
}

async function startAudioCall(callerPage) {
  await callerPage.getByTestId(T.chatCallButton).click();
  await callerPage.getByTestId(T.callTypeAudio).click();
}

/** Закрывает висящие модалки звонка между serial-тестами */
async function dismissCallUi(page) {
  if (!page) return;
  const end = page.getByTestId(T.activeCallEnd);
  if (await end.isVisible().catch(() => false)) {
    await end.click({ force: true });
    return;
  }
  const reject = page.getByTestId(T.incomingReject);
  if (await reject.isVisible().catch(() => false)) {
    await reject.click({ force: true });
    return;
  }
  const cancel = page.getByTestId(T.outgoingCancel);
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click({ force: true });
  }
}

module.exports = {
  T,
  REALTIME_MS,
  pollCall,
  startAudioCall,
  dismissCallUi,
};
