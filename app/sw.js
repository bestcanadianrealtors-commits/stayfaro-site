/*
 * Faro's service worker — it exists for one job: showing a reminder that
 * Faro Watch sends while the Faro tab is closed (Web Push).
 *
 * It deliberately does NOT cache the app or intercept any request. Faro on the
 * web is always loaded fresh from its server.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const openTabs = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true });

// The app may be published under a folder (stayfaro.app/app): every address
// it is given is relative to the app, so it is prefixed with where this
// worker lives.
const base = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const inApp = p => base + (p || '/today');

self.addEventListener('push', event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; }
  catch { p = { title: 'Faro', body: event.data ? event.data.text() : '' }; }

  event.waitUntil((async () => {
    // An open tab speaks the line and, for "Did you finish?", opens its sheet.
    for (const tab of await openTabs()) tab.postMessage({ source: 'faro-push', payload: p });

    // Browsers require every push to show something; this is the reminder itself.
    await self.registration.showNotification(p.title || 'Faro', {
      body: p.body || '',
      tag: p.tag || 'faro',
      renotify: true,
      requireInteraction: !!p.requireInteraction,
      icon: inApp('/favicon.ico'),
      data: { ...(p.data || {}), url: p.url || '/today', payload: p },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil((async () => {
    const tabs = await openTabs();
    const tab = tabs.find(t => t.visibilityState === 'visible') || tabs[0];
    if (tab) {
      await tab.focus();
      tab.postMessage({ source: 'faro-open', payload: data.payload || { url: data.url, data } });
      return;
    }
    await self.clients.openWindow(inApp(data.url));
  })());
});
