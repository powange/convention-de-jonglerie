import { OFFLINE_CACHES, shouldPrecachePage } from '~~/shared/utils/offline-cache'

/**
 * Enregistre le service worker pour tous les visiteurs, et met de côté les pages qui servent
 * sur place.
 *
 * Il n'était jusqu'ici enregistré qu'au moment d'activer les notifications push, ce qui laissait
 * sans cache l'immense majorité des visiteurs — dont ceux qui, en convention, consultent la carte
 * du site avec un réseau défaillant.
 *
 * La mise en cache explicite des pages n'est pas un luxe : la toute première visite d'une page
 * n'est jamais contrôlée par le worker, qui s'installe après elle. Sans cela, il faudrait deux
 * visites en ligne pour qu'une page soit disponible hors ligne — vérifié en navigateur, le cache
 * des pages restait vide après une visite complète.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  const warn = (message: string, error: unknown) => {
    // Un échec n'a pas à se voir : le site fonctionne sans cache, simplement sans hors ligne.
    if (import.meta.dev) console.warn(`[sw] ${message}`, error)
  }

  /** Demande la page si elle n'est pas déjà gardée, pour ne pas doubler chaque affichage. */
  const keepPage = async (pathname: string) => {
    if (!shouldPrecachePage(pathname)) return
    try {
      const cache = await caches.open(OFFLINE_CACHES.pages)
      if (await cache.match(pathname)) return
      await cache.add(pathname)
    } catch (error) {
      warn('page non conservée :', error)
    }
  }

  const start = async () => {
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      await navigator.serviceWorker.ready
    } catch (error) {
      warn('enregistrement impossible :', error)
      return
    }

    await keepPage(window.location.pathname)

    // Les navigations suivantes se font sans rechargement : le worker ne les voit pas passer.
    useRouter().afterEach((to) => {
      keepPage(to.path)
    })
  }

  // Différé après le chargement : le cache ne doit pas disputer sa bande passante au premier
  // affichage, précisément sur les connexions lentes qu'il vise à soulager.
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', () => start(), { once: true })
})
