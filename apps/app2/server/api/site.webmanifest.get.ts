import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * Manifeste web de Flowvent — même construction que celui d'app1 (server/api/site.webmanifest.get.ts).
 *
 * Généré à la volée pour que le nom et la couleur trahissent l'environnement : une application
 * installée depuis dev ou release ne se confond pas avec la prod sur l'écran d'accueil.
 * Les icônes viennent de `npm run favicons` (générateur commun, scripts/favicons/).
 */
export default wrapApiHandler(
  () => {
    const nodeEnv = process.env.NODE_ENV
    const nuxtEnv = process.env.NUXT_ENV || nodeEnv

    // Incrémenter pour forcer la mise à jour des icônes en cache.
    const iconVersion = 'v1'

    let appName = 'Flowvent'
    let shortName = 'Flowvent'
    let themeColor = '#1c1917' // graphite de la marque

    if (nodeEnv === 'development') {
      appName = 'Flowvent DEV'
      shortName = 'Flowvent DEV'
      themeColor = '#ef4444'
    } else if (nuxtEnv === 'release') {
      appName = 'Flowvent TEST'
      shortName = 'Flowvent TEST'
      themeColor = '#f59e0b'
    }

    return {
      name: appName,
      short_name: shortName,
      description: "Plateforme d'organisation d'événements",
      theme_color: themeColor,
      background_color: '#1c1917',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      orientation: 'any',
      // `any` bord à bord d'un côté, `maskable` avec marge de l'autre : Android rogne l'icône
      // selon la forme du constructeur (cf. le commentaire détaillé du manifeste d'app1).
      icons: [
        {
          src: `/favicons/android-chrome-192x192.png?v=${iconVersion}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/favicons/android-chrome-512x512.png?v=${iconVersion}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/favicons/android-chrome-maskable-512x512.png?v=${iconVersion}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: `/favicons/apple-touch-icon.png?v=${iconVersion}`,
          sizes: '180x180',
          type: 'image/png',
          purpose: 'any',
        },
      ],
      lang: 'fr',
    }
  },
  { operationName: 'GetWebManifest' }
)
