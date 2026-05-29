const { expect } = require('@playwright/test');

const T = {
  attachInput: 'chat-attach-input',
  sendButton: 'chat-send-button',
  messageFile: 'chat-message-file',
  messageImage: 'chat-message-image',
  fileVideo: 'chat-message-file-video',
  fileCard: 'chat-message-file-card',
  fileViewerModal: 'chat-file-viewer-modal',
  fileViewerText: 'chat-file-viewer-text',
  fileViewerPdf: 'chat-file-viewer-pdf',
  fileViewerOffice: 'chat-file-viewer-office',
};

/** 1×1 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const FIXTURES = {
  txt: {
    name: 'e2e-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('E2E file preview text', 'utf8'),
    previewKind: 'text',
  },
  png: {
    name: 'e2e-pixel.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
    kind: 'image',
  },
  pdf: {
    name: 'e2e-doc.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8'),
    previewKind: 'pdf',
  },
  mp4: {
    name: 'e2e-clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]),
    previewKind: 'video',
  },
  docx: {
    name: 'e2e-report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('PK\x03\x04docx-placeholder', 'utf8'),
    previewKind: 'office',
  },
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, mimeType: string, buffer: Buffer }} file
 */
async function attachFileInChat(page, file) {
  await page.getByTestId(T.attachInput).setInputFiles({
    name: file.name,
    mimeType: file.mimeType,
    buffer: file.buffer,
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {Array<{ name: string, mimeType: string, buffer: Buffer }>} files
 */
async function attachMultipleFilesInChat(page, files) {
  await page.getByTestId(T.attachInput).setInputFiles(
    files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      buffer: file.buffer,
    }))
  );
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function expectFilePreviewCount(page, count) {
  await expect(page.getByTestId('chat-file-preview-item')).toHaveCount(count);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'txt'|'png'|'pdf'|'mp4'|'docx'} kind
 */
async function sendFixtureAndWait(page, kind) {
  const fixture = FIXTURES[kind];
  await attachFileInChat(page, fixture);
  await page.getByTestId(T.sendButton).click();

  if (fixture.kind === 'image') {
    await expect(page.getByTestId(T.messageImage).last()).toBeVisible({ timeout: 30_000 });
    return;
  }

  const fileRow = page.getByTestId(T.messageFile).last();
  await expect(fileRow).toBeVisible({ timeout: 30_000 });
  await expect(fileRow).toHaveAttribute('data-preview-kind', fixture.previewKind);
}

module.exports = {
  T,
  FIXTURES,
  attachFileInChat,
  attachMultipleFilesInChat,
  expectFilePreviewCount,
  sendFixtureAndWait,
};
