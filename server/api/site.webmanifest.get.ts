import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  () => {
    const nodeEnv = process.env.NODE_ENV
    const nuxtEnv = process.env.NUXT_ENV || nodeEnv

    // Version pour forcer la mise à jour du cache des icônes
    const iconVersion = 'v2' // Incrémenter cette version pour forcer la mise à jour des icônes

    // Déterminer le nom selon l'environnement
    let appName = 'Juggling Convention'
    let shortName = 'JuggConv'
    let themeColor = '#0f172a' // Bleu par défaut

    if (nodeEnv === 'development') {
      appName = 'Juggling Convention DEV'
      shortName = 'JuggConv DEV'
      themeColor = '#ef4444' // Rouge pour dev
    } else if (nuxtEnv === 'release' || process.env.VERCEL_ENV === 'preview') {
      appName = 'Juggling Convention TEST'
      shortName = 'JuggConv TEST'
      themeColor = '#f59e0b' // Orange pour test
    }

    return {
      name: appName,
      short_name: shortName,
      description: 'Plateforme de découverte et gestion de conventions de jonglerie',
      theme_color: themeColor,
      background_color: '#0f172a',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      orientation: 'portrait-primary',
      icons: [
        {
          src: `/favicons/android-chrome-192x192.png?v=${iconVersion}`,
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: `/favicons/android-chrome-512x512.png?v=${iconVersion}`,
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: `/favicons/apple-touch-icon.png?v=${iconVersion}`,
          sizes: '180x180',
          type: 'image/png',
        },
      ],
      categories: ['entertainment', 'lifestyle', 'sports'],
      lang: 'fr',
    }
  },
  { operationName: 'GetWebManifest' }
)
