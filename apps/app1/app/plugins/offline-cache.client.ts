import {
  classifyRequest,
  OFFLINE_CACHES,
  serviceWorkerUrl,
  shouldPrecachePage,
} from '~~/shared/utils/offline-cache'

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

  /**
   * S'assure qu'une version de la liste des éditions est conservée.
   *
   * Sur un premier affichage, cette liste arrive avec le rendu serveur : le navigateur ne la
   * demande jamais, donc le worker ne la voit pas passer et n'a rien à garder. À la réouverture
   * hors ligne, l'accueil s'affichait alors sur une erreur réseau.
   *
   * Une seule requête suffit, quels que soient ses filtres : la recherche dans le cache tolère
   * des paramètres différents.
   */
  const keepEditionList = async () => {
    try {
      const cache = await caches.open(OFFLINE_CACHES.mapData)
      const existing = await cache.match('/api/editions', { ignoreSearch: true })
      if (existing) return
      await cache.add('/api/editions?page=1&limit=12')
    } catch (error) {
      warn('liste des éditions non conservée :', error)
    }
  }

  /**
   * Attend que le worker contrôle réellement cette page.
   *
   * `ready` ne l'assure pas : sur la toute première visite, le worker s'active alors que la page
   * est déjà chargée, et ne la contrôle qu'une fois `clients.claim()` passé. Tout ce qu'on
   * demande avant lui échappe, et n'entre donc jamais dans le cache.
   */
  const whenControlled = () =>
    new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) return resolve()
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      // Ne pas rester suspendu si le contrôle n'arrive jamais : le reste doit continuer.
      setTimeout(resolve, 5000)
    })

  /**
   * Conserve les ressources durables que la page a réellement chargées.
   *
   * Le tri revient à `classifyRequest`, celui-là même dont le worker se sert. Filtrer ici sur un
   * préfixe écrit à la main a déjà échoué : je ne retenais que le dossier des fichiers de build,
   * si bien que les traductions — servies depuis un chemin à part — n'étaient jamais conservées
   * et que l'interface revenait hors ligne avec ses clés à la place des libellés.
   *
   * Relire ce que la page a effectivement demandé, et le trier avec la règle du worker : deux
   * listes qui ne peuvent plus diverger.
   */
  const keepPageAssets = async () => {
    try {
      const cache = await caches.open(OFFLINE_CACHES.assets)
      const origin = window.location.origin
      const urls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => classifyRequest(url, 'script', origin) === 'asset')

      await Promise.all(
        [...new Set(urls)].map(async (url) => {
          if (await cache.match(url)) return
          await cache.add(url).catch(() => undefined)
        })
      )
    } catch (error) {
      warn('fichiers de build non conservés :', error)
    }
  }

  const start = async () => {
    // Hors ligne, tout ce qui suit échoue — et échoue lentement. Chaque mise de côté devient une
    // requête vouée à expirer, multipliée par le nombre de ressources de la page : c'est ce qui
    // rendait l'affichage hors ligne plus lent qu'en ligne, exactement l'inverse du but.
    if (navigator.onLine === false) return

    try {
      await navigator.serviceWorker.register(serviceWorkerUrl(useRuntimeConfig().app.buildId))
      await navigator.serviceWorker.ready
    } catch (error) {
      warn('enregistrement impossible :', error)
      return
    }

    await whenControlled()

    await keepPage(window.location.pathname)
    await keepEditionList()
    await keepPageAssets()

    // Les navigations suivantes se font sans rechargement : le worker ne les voit pas passer.
    useRouter().afterEach((to) => {
      if (navigator.onLine === false) return
      keepPage(to.path)
      // Une navigation charge de nouveaux morceaux : les capturer aussi.
      setTimeout(keepPageAssets, 1500)
    })
  }

  // Différé après le chargement : le cache ne doit pas disputer sa bande passante au premier
  // affichage, précisément sur les connexions lentes qu'il vise à soulager.
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', () => start(), { once: true })
})
