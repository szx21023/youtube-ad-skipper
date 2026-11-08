(() => {
  'use strict';
  const log = (...a) => console.log('[AdSkipper]', ...a);

  // SKIP_SELECTORS 來自 selectors.js（manifest 中排在本檔之前載入）

  // 記住廣告前的狀態，廣告結束後還原
  let adActive = false;
  let savedMuted = false;
  let savedRate = 1;
  let lastClickRequest = 0;

  const visibleSkipButton = () =>
    [...document.querySelectorAll(SKIP_SELECTORS)].find((b) => b.getBoundingClientRect().width > 0);

  // 只觀察播放器的 class 變化（ad-showing 的出現與消失），
  // 不監看整個頁面的 DOM，避免 YouTube 頻繁的 DOM 變動不斷觸發 handleAds。
  const observer = new MutationObserver(() => handleAds());
  let observedPlayer = null;

  function watchPlayer(player) {
    if (player === observedPlayer) return;
    observer.disconnect();
    observer.observe(player, { attributes: true, attributeFilter: ['class'] });
    observedPlayer = player;
  }

  function handleAds() {
    // 優先找主播放器；不能用 '#movie_player, .html5-video-player'，
    // 那會回傳 DOM 中第一個符合的元素，可能是排在前面的預覽播放器
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (!player) return;
    watchPlayer(player); // 播放器出現或被替換時，改為觀察新的播放器
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

  // 定時檢查：負責找到播放器並掛上觀察，也處理略過按鈕延遲出現
  // （按鈕出現時播放器的 class 不一定會變，所以不能只靠 observer）
  setInterval(handleAds, 300);
  handleAds();
  log('已啟動');
})();
