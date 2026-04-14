const cacheName = 'msalata-v1';
const assets = ['/', '/index.html'];

// تثبيت التطبيق وتخزين الملفات الأساسية
self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

// تشغيل التطبيق وجلب البيانات
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});