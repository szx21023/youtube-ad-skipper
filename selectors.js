// 略過按鈕的選擇器，content.js 和 background.js 共用。
// YouTube 改版導致略過失效時，只需要改這裡。
const SKIP_SELECTORS = [
  '.ytp-skip-ad-button',
  '.ytp-ad-skip-button',
  '.ytp-ad-skip-button-modern',
  'button[id^="skip-button"]',
].join(',');
