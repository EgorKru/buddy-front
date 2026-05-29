const { expect } = require('@playwright/test');
const { T: MEET_T, openMeetPreview } = require('./meet');
const { T: CALL_T } = require('./call');

const MEDIA_T = {
  previewVideo: 'media-preview-video',
  backgroundFilters: 'media-background-filters',
  backgroundNone: 'media-background-none',
  backgroundBlur: 'media-background-blur',
  callLocalVideo: 'call-local-video',
  callTypeVideo: 'call-type-video',
};

const MIC_SLA_MS = 300;
const CAMERA_SLA_MS = 1500;

async function readMediaTimings(page) {
  return page.evaluate(() => window.__lastMediaAcquisition || null);
}

async function waitForMediaTimings(page, { requireCamera = true } = {}) {
  await expect
    .poll(
      async () => {
        const t = await readMediaTimings(page);
        if (!t) return false;
        if (requireCamera && t.cameraReadyMs == null) return false;
        return true;
      },
      { timeout: 15_000, message: 'media acquisition timings' }
    )
    .toBe(true);
  return readMediaTimings(page);
}

function assertMediaSla(timings, { requireCamera = true } = {}) {
  expect(timings).toBeTruthy();
  if (timings.micReadyMs != null) {
    expect(timings.micReadyMs, 'microphone SLA').toBeLessThanOrEqual(MIC_SLA_MS);
  }
  if (requireCamera) {
    expect(timings.cameraReadyMs, 'camera SLA').toBeLessThanOrEqual(CAMERA_SLA_MS);
    expect(timings.micReadyMs, 'mic before camera').toBeLessThanOrEqual(timings.cameraReadyMs);
  }
}

async function openMeetPreviewAndWaitVideo(page) {
  await openMeetPreview(page);
  await page.getByTestId(MEDIA_T.previewVideo).waitFor({ state: 'visible', timeout: 15_000 });
}

async function startVideoCall(callerPage) {
  await callerPage.getByTestId(CALL_T.chatCallButton).click();
  await callerPage.getByTestId(CALL_T.callTypeVideo).click();
}

module.exports = {
  MEDIA_T,
  MIC_SLA_MS,
  CAMERA_SLA_MS,
  readMediaTimings,
  waitForMediaTimings,
  assertMediaSla,
  openMeetPreviewAndWaitVideo,
  startVideoCall,
  MEET_T,
  CALL_T,
};
