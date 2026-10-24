'use strict';
// アプリのコードを変更したリリースでは、この番号を更新する。
const CACHE_PREFIX = 'worktimer-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const ASSETS = [
  './index.html', './style.css', './categories.js', './core.js', './app.js',
  './pwa.js', './manifest.webmanifest', './icons/icon-192.png',
  './icons/icon-512.png', './icons/apple-touch-icon.png'
];
const assetURLs = ASSETS.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  // 全ファイルが揃ってから利用可能にする。計測中に強制更新しない。
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assetURLs)));
});
self.addEventListener('activate', event => {
  // 自分のアプリの古い画面キャッシュだけを整理。記録データには触れない。
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // アプリ本体だけを対象にし、JSONバックアップや外部通信はキャッシュしない。
  const href = url.href === self.registration.scope ? new URL('./index.html', self.registration.scope).href : url.href;
  if (!assetURLs.includes(href)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const saved = await cache.match(href);
    return saved || fetch(event.request);
  }));
});
