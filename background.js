// 用 Chrome DevTools Protocol 送出「真實」的滑鼠點擊（YouTube 會忽略程式產生的點擊）
const log = (...a) => console.log('[AdSkipper]', ...a);
const withTimeout = (p, ms, name) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(name + ' timeout')), ms))]);
const busy = new Set();

// 在頁面中量略過按鈕的位置。必須在 attach 之後量，
// 因為 attach 會讓 Chrome 顯示偵錯提示列，把整個網頁往下推。
const RECT_EXPR = `(() => {
  const b = [...document.querySelectorAll('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button[id^="skip-button"]')]
    .find((e) => e.getBoundingClientRect().width > 0);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
})()`;

async function trustedClick(tabId) {
  const target = { tabId };
  await withTimeout(chrome.debugger.attach(target, '1.3'), 3000, 'attach');
  try {
    await new Promise((r) => setTimeout(r, 300)); // 等提示列出現、版面穩定
    const res = await withTimeout(
      chrome.debugger.sendCommand(target, 'Runtime.evaluate', { expression: RECT_EXPR, returnByValue: true }),
      3000, 'evaluate');
    const pos = res?.result?.value ? JSON.parse(res.result.value) : null;
    if (!pos) return log('按鈕已不在，略過點擊');
    const ev = { x: pos.x, y: pos.y, button: 'left', clickCount: 1 };
    await withTimeout(chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mousePressed', ...ev }), 3000, 'press');
    await withTimeout(chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mouseReleased', ...ev }), 3000, 'release');
    log('已點擊略過按鈕', pos);
  } finally {
    await withTimeout(chrome.debugger.detach(target), 3000, 'detach').catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (msg?.type !== 'trustedClick' || tabId == null || busy.has(tabId)) return;
  busy.add(tabId);
  trustedClick(tabId)
    .catch((e) => log('點擊失敗:', e.message))
    .finally(() => busy.delete(tabId));
});
