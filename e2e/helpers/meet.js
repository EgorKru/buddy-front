const T = {
  chatMeetButton: 'chat-meet-button',
  meetPreviewModal: 'meet-preview-modal',
  meetPreviewConfirm: 'meet-preview-confirm',
  meetPreviewCancel: 'meet-preview-cancel',
  roomPage: 'room-page',
  roomTopBar: 'room-top-bar',
  roomLogo: 'room-logo',
  roomMeetingInfo: 'room-meeting-info',
  roomTimer: 'room-timer',
  roomCode: 'room-code',
  roomVideoGrid: 'room-video-grid',
  roomControlBar: 'room-control-bar',
  roomControlsLeft: 'room-controls-left',
  roomControlsCenter: 'room-controls-center',
  roomControlsRight: 'room-controls-right',
  roomParticipants: 'room-participants-button',
  roomMic: 'room-mic-toggle',
  roomVideo: 'room-video-toggle',
  roomHand: 'room-hand-toggle',
  roomScreenShare: 'room-screen-share-toggle',
  roomSettings: 'room-settings-button',
  roomLeave: 'room-leave-button',
  roomLoading: 'room-loading',
};

async function openMeetPreview(page) {
  await page.getByTestId(T.chatMeetButton).click();
  await page.getByTestId(T.meetPreviewModal).waitFor({ state: 'visible', timeout: 15_000 });
}

async function confirmMeetPreview(page) {
  await page.getByTestId(T.meetPreviewConfirm).click();
}

async function cancelMeetPreview(page) {
  await page.getByTestId(T.meetPreviewCancel).click();
}

async function waitForRoomPage(page, timeoutMs = 30_000) {
  await page.getByTestId(T.roomPage).waitFor({ state: 'visible', timeout: timeoutMs });
}

async function waitForRoomControls(page, timeoutMs = 45_000) {
  await page.getByTestId(T.roomControlBar).waitFor({ state: 'visible', timeout: timeoutMs });
}

async function assertConventionalMeetLayout(page) {
  const topBar = page.getByTestId(T.roomTopBar);
  const logo = page.getByTestId(T.roomLogo);
  const meetingInfo = page.getByTestId(T.roomMeetingInfo);
  const videoGrid = page.getByTestId(T.roomVideoGrid);
  const controlBar = page.getByTestId(T.roomControlBar);
  const controlsCenter = page.getByTestId(T.roomControlsCenter);
  const controlsLeft = page.getByTestId(T.roomControlsLeft);
  const controlsRight = page.getByTestId(T.roomControlsRight);

  await expect(topBar).toBeVisible();
  await expect(logo).toBeVisible();
  await expect(meetingInfo).toBeVisible();
  await expect(page.getByTestId(T.roomTimer)).toBeVisible();
  await expect(page.getByTestId(T.roomCode)).toBeVisible();
  await expect(videoGrid).toBeVisible();
  await expect(controlBar).toBeVisible();
  await expect(controlsLeft).toBeVisible();
  await expect(controlsCenter).toBeVisible();
  await expect(controlsRight).toBeVisible();

  await expect(page.getByTestId(T.roomParticipants)).toBeVisible();
  await expect(page.getByTestId(T.roomMic)).toBeVisible();
  await expect(page.getByTestId(T.roomVideo)).toBeVisible();
  await expect(page.getByTestId(T.roomHand)).toBeVisible();
  await expect(page.getByTestId(T.roomScreenShare)).toBeVisible();
  await expect(page.getByTestId(T.roomSettings)).toBeVisible();
  await expect(page.getByTestId(T.roomLeave)).toBeVisible();

  const topBarBox = await topBar.boundingBox();
  const controlBarBox = await controlBar.boundingBox();
  const videoGridBox = await videoGrid.boundingBox();

  expect(topBarBox.y).toBeLessThan(videoGridBox.y);
  expect(controlBarBox.y).toBeGreaterThan(videoGridBox.y);

  const centerBox = await controlsCenter.boundingBox();
  const leftBox = await controlsLeft.boundingBox();
  const rightBox = await controlsRight.boundingBox();
  expect(leftBox.x).toBeLessThan(centerBox.x);
  expect(rightBox.x).toBeGreaterThan(centerBox.x);
}

module.exports = {
  T,
  openMeetPreview,
  confirmMeetPreview,
  cancelMeetPreview,
  waitForRoomPage,
  waitForRoomControls,
  assertConventionalMeetLayout,
};
