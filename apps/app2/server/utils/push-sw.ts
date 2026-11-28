/**
 * La partie « notifications push » du service worker de Flowvent (server/routes/sw.js.ts) : du
 * JavaScript servi tel quel au navigateur.
 *
 * - `push` : affiche la notification que le serveur a envoyée (server/utils/push.ts,
 *   `ContenuPush`) — titre, texte, icône de l'événement, boutons — et prévient les pages ouvertes
 *   (`flowvent:push`), dont la cloche se met à jour sans attendre sa relecture périodique.
 * - `notificationclick` : ouvre la page de la notification (ou celle du bouton touché). Une
 *   fenêtre déjà ouverte sur cette page passe au premier plan au lieu d'en ouvrir une seconde. Sur
 *   un téléphone, une page d'un événement installé s'ouvre dans l'application de cet événement.
 *
 * ⚠️ Ce fichier se suffit à lui-même (aucun import) : un test d'app1 exécute ce code avec un faux
 * `self` (apps/app1/test/unit/utils/flowvent-push-sw.test.ts).
 */
export const BLOC_PUSH_SW = `
// ── Notifications push ─────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch (e) {
    d = { message: event.data ? event.data.text() : '' }
  }
  const actions = Array.isArray(d.actions) ? d.actions : []
  const urls = {}
  for (const a of actions) urls[a.action] = a.url
  const options = {
    body: d.message || '',
    icon: d.icone || '/favicons/android-chrome-192x192.png?v=v1',
    data: { url: d.url || '/', urls: urls },
    actions: actions.map((a) => ({ action: a.action, title: a.titre })),
  }
  if (d.image) options.image = d.image
  if (d.tag) {
    options.tag = d.tag
    options.renotify = true
  }
  const prevenir = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((fenetres) => {
      for (const f of fenetres) f.postMessage({ type: 'flowvent:push', titre: d.titre, url: d.url })
    })
    .catch(() => null)
  event.waitUntil(
    Promise.all([prevenir, self.registration.showNotification(d.titre || 'Flowvent', options)])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const d = event.notification.data || {}
  const chemin = (event.action && d.urls && d.urls[event.action]) || d.url || '/'
  const cible = new URL(chemin, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url === cible && 'focus' in f) return f.focus()
      }
      return self.clients.openWindow(cible)
    })
  )
})
`
