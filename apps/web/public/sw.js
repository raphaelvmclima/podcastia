const CACHE_NAME = 'podcastia-v3';

const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/dashboard/fontes',
  '/dashboard/resumos',
  '/dashboard/noticias',
  '/dashboard/configuracoes',
  '/login',
  '/register'
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PodcastIA - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0b14;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .container { text-align: center; max-width: 420px; }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.7; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #f1f5f9; }
    p { font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; line-height: 1.6; }
    .cached-pages { font-size: 0.875rem; color: #64748b; margin-bottom: 2rem; }
    .cached-pages a { color: #7c5cfc; text-decoration: none; display: block; margin: 4px 0; }
    .cached-pages a:hover { text-decoration: underline; }
    button { background: #7c5cfc; color: #fff; border: none; padding: 0.75rem 2rem; border-radius: 0.5rem; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.1s; }
    button:hover { background: #6d4de6; }
    button:active { transform: scale(0.97); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#128268;</div>
    <h1>Sem conex\u00e3o</h1>
    <p>Verifique sua internet e tente novamente.</p>
    <div class="cached-pages">
      <p>P\u00e1ginas dispon\u00edveis offline:</p>
      <a href="/dashboard">Dashboard</a>
      <a href="/dashboard/resumos">Resumos</a>
      <a href="/dashboard/fontes">Fontes</a>
    </div>
    <button onclick="location.reload()">Tentar novamente</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(request, 5000));
    return;
  }
  if (url.pathname.match(/\.(mp3|ogg|wav|m4a|opus)(\?.*)?$/i)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PodcastIA';
  const options = {
    body: data.body || 'Novo conteudo disponivel!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'podcastia-notification',
    data: { url: data.url || '/dashboard' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending') event.waitUntil(Promise.resolve());
});

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)(\?.*)?$/i.test(pathname);
}

async function networkFirstWithTimeout(request, timeoutMs) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) { const cache = await caches.open(CACHE_NAME); cache.put(request, response.clone()); }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return offlineResponse();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) { const cache = await caches.open(CACHE_NAME); cache.put(request, response.clone()); }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || offlineResponse();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) { const cache = await caches.open(CACHE_NAME); cache.put(request, response.clone()); }
    return response;
  } catch (err) { return offlineResponse(); }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) { fetchPromise; return cached; }
  const networkResponse = await fetchPromise;
  return networkResponse || offlineResponse();
}

function offlineResponse() {
  return new Response(OFFLINE_HTML, { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
