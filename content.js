(() => {
  'use strict';
  const log = (...a) => console.log('[AdSkipper]', ...a);

  const SKIP_SELECTORS = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    'button[id^="skip-button"]',
  ].join(',');

  // 記住廣告前的狀態，廣告結束後還原
  let adActive = false;
  let savedMuted = false;
  let savedRate = 1;
  let lastClickRequest = 0;

  const visibleSkipButton = () =>
    [...document.querySelectorAll(SKIP_SELECTORS)].find((b) => b.getBoundingClientRect().width > 0);

  function handleAds() {
    const player = document.querySelector('#movie_player, .html5-video-player');
    if (!player) return;
    const video = player.querySelector('video');
    const isAd = player.classList.contains('ad-showing');

    if (isAd && video) {
      if (!adActive) {
        adActive = true;
        savedMuted = video.muted;
        savedRate = video.playbackRate;
        log('偵測到廣告');
      }
      // 不能略過的廣告：靜音並加速播完（不跳轉，跳轉會讓下一支廣告卡住）
      video.muted = true;
      video.playbackRate = 16;

      // 可以略過的廣告：請背景程式送出真實點擊
      if (visibleSkipButton() && Date.now() - lastClickRequest > 2500) {
        lastClickRequest = Date.now();
        log('出現略過按鈕，送出點擊');
        chrome.runtime.sendMessage({ type: 'trustedClick' });
      }
    } else if (!isAd && adActive) {
      adActive = false;
      log('廣告結束，還原設定');
      if (video) {
        video.muted = savedMuted;
        video.playbackRate = savedRate;
      }
    }
  }

  const observer = new MutationObserver(handleAds);
  const start = () => {
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
    });
    handleAds();
    log('已啟動');
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);

  // 保險機制：每 300ms 檢查一次
  setInterval(handleAds, 300);
})();
