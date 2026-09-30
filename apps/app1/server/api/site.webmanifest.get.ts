import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  () => {
    const nodeEnv = process.env.NODE_ENV
    const nuxtEnv = process.env.NUXT_ENV || nodeEnv

    // Version pour forcer la mise à jour du cache des icônes
    const iconVersion = 'v3' // Incrémenter cette version pour forcer la mise à jour des icônes

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
      // `any` et non `portrait-primary` : verrouiller l'orientation empêchait de tourner le
      // téléphone une fois l'application installée, alors que plusieurs pages — planning des
      // bénévoles, tableaux de gestion, carte du site — gagnent à être vues en paysage.
      orientation: 'any',
      /*
       * ⚠️ `purpose` EST DÉSORMAIS EXPLICITE, et la distinction n'est pas cosmétique.
       *
       * Android ne dessine pas l'icône telle quelle : il la MASQUE selon la forme choisie par le
       * constructeur — cercle, carré arrondi, goutte. Seul le disque central de 80 % du côté est
       * garanti visible ; tout ce qui déborde est rogné.
       *
       * Les icônes `any` ci-dessous occupent leur carré bord à bord. Leur coller `maskable`
       * amputerait le J et le C de leurs coins, sans que rien ne le signale ailleurs que sur le
       * téléphone. D'où une icône SÉPARÉE, où le même logo est réduit pour tenir dans le disque de
       * sécurité, sur le fond que l'icône utilisait déjà.
       *
       * Sans aucune icône `maskable`, Android se rabat sur l'icône `any` en la posant sur une
       * pastille blanche, d'où l'effet « logo rétréci dans un rond blanc » qu'on voit sur beaucoup
       * d'applications web. C'est aussi ce que Bubblewrap signale au moment de fabriquer le paquet
       * Android du Play Store.
       */
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
      categories: ['entertainment', 'lifestyle', 'sports'],
      lang: 'fr',
    }
  },
  { operationName: 'GetWebManifest' }
)
