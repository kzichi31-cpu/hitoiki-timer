/* file://のMac版はそのまま動作。HTTPS/localhostでのみPWA機能を有効化。 */
(function () {
  'use strict';
  if (!['https:', 'http:'].includes(location.protocol) || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(error => {
      // PWAの準備に失敗しても、計測とブラウザ保存はそのまま利用できる。
      console.info('オフライン機能を準備できませんでした。通常のタイマーは利用できます。', error);
    });
  });
})();
