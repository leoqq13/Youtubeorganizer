const CACHE = 'tubeflow-v3'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE).map(n => caches.delete(n))
    ))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE).map(n => caches.delete(n))
    )).then(() => clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = e.request.url
  // Never cache auth or API requests
  if (url.includes('supabase') || url.includes('/auth/') || url.includes('/rest/') || url.includes('token')) return
  // Only cache static assets
  if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.png') || url.endsWith('.html') || url.endsWith('.json') || url.endsWith('.woff2')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request))
    )
  }
})
