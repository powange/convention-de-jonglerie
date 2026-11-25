// Configuration Nuxt de Flowvent (app2) : plateforme SaaS d'organisation d'événements.
// App autonome, base MySQL via Prisma (adapter mariadb), auth via nuxt-auth-utils.

/**
 * Répertoire des fichiers de build nommé d'après le commit : `/_nuxt-<12 caractères du sha>/`.
 * Même règle qu'app1 (apps/app1/shared/utils/repertoire-de-build.ts, où les raisons sont
 * détaillées) : deux builds ne partagent aucune URL, donc un CDN ne peut pas servir le fichier de
 * l'un à la place de l'autre ; et le commit servi se lit dans la page, ce qui permet au skill
 * `/deploy-flowvent` de vérifier qu'une bascule a eu lieu. `NUXT_BUILD_SHA` vient de la CI
 * (build-arg `BUILD_SHA`) ; absent en dev, on garde `/_nuxt/`.
 */
const empreinte = (process.env.NUXT_BUILD_SHA ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12)
const buildAssetsDir = empreinte ? `/_nuxt-${empreinte}/` : '/_nuxt/'

export default defineNuxtConfig({
  compatibilityDate: '2026-03-02',
  devtools: { enabled: true },

  // Réutilise le layer d'authentification partagé (email/mot de passe + OAuth Google).
  // Le layer résout Prisma/utils/i18n via l'app hôte (apps/app2).
  // Layers partagés avec app1, dans le même ordre :
  // - `ui` : mécanismes d'interface sans métier (le layer bénévoles s'en sert : pastilles du menu) ;
  // - `core` : utilitaires techniques (helpers d'API, validation, erreurs…) ;
  // - `auth` : authentification ;
  // - `volunteers` : gestion des bénévoles — son serveur tourne sur le contrat d'hôte de Flowvent
  //   (server/volunteers/ports/registry.ts…). Cf. docs/flowvent-benevoles.md.
  extends: ['../../layers/ui', '../../layers/core', '../../layers/auth', '../../layers/volunteers'],

  hooks: {
    /*
     * Pages du layer bénévoles montées sous les adresses de Flowvent : `/editions/:id/…` (celles
     * d'app1, inchangées là-bas) devient `/events/:id/…`. Les pages de GESTION reçoivent en plus le
     * middleware `subscription` : dans Flowvent, l'abonnement débloque l'organisation. Les pages du
     * BÉNÉVOLE (candidater, ses créneaux, échanges) restent ouvertes — un bénévole n'est pas abonné.
     */
    'pages:extend'(pages) {
      const renommer = (liste: typeof pages) => {
        for (const page of liste) {
          if (page.file?.includes('/layers/volunteers/')) {
            page.path = page.path.replace(/^\/editions\//, '/events/')
            if (page.name) page.name = page.name.replace(/^editions-/, 'events-')
            if (page.path.includes('/gestion/')) {
              const actuels = page.meta?.middleware
              const liste2 = Array.isArray(actuels) ? actuels : actuels ? [actuels] : []
              page.meta = { ...page.meta, middleware: [...liste2, 'subscription'] }
            }
          }
          if (page.children?.length) renommer(page.children)
        }
      }
      renommer(pages)
    },
  },

  // `nuxt-qrcode` : le layer bénévoles affiche le QR code d'un bénévole (composant `Qrcode`).
  modules: ['@nuxt/ui', 'nuxt-auth-utils', '@pinia/nuxt', '@nuxtjs/i18n', 'nuxt-qrcode'],

  css: ['~/assets/css/main.css'],

  // Icônes : même déclaration qu'app1. Les PNG et l'ICO sortent de `npm run favicons` (générateur
  // commun, scripts/favicons/) ; `favicon.svg`, tiré d'AppLogo, suit le mode sombre du navigateur.
  // Le manifeste est dynamique (server/api/site.webmanifest.get.ts). `?v=` : Cloudflare garde les
  // fichiers publics 4 h, l'incrémenter après une régénération.
  app: {
    buildAssetsDir,

    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=2' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32x32.png?v=2' },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '192x192',
          href: '/favicons/favicon-192x192.png?v=2',
        },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/favicon-180x180.png?v=2' },
        { rel: 'manifest', href: '/api/site.webmanifest?v=2' },
        { rel: 'alternate icon', href: '/favicon.ico?v=2' },
      ],
    },
  },

  // Enregistre les helpers de session nuxt-auth-utils pour l'alias `#imports`
  // utilisé par le code serveur du layer d'auth.
  imports: {
    imports: [
      { from: 'nuxt-auth-utils', name: 'getUserSession' },
      { from: 'nuxt-auth-utils', name: 'requireUserSession' },
      { from: 'nuxt-auth-utils', name: 'setUserSession' },
      { from: 'nuxt-auth-utils', name: 'clearUserSession' },
    ],
  },

  // app2 est en français uniquement. Fichiers chargés dans l'ordre, chacun l'emportant sur les
  // précédents :
  // 1. les libellés du layer bénévoles, tels qu'app1 les sert (chemins relatifs à i18n/locales/) ;
  // 2. `benevoles.json` : les clés que le layer emprunte aux fichiers communs d'app1 (common,
  //    public, gestion…), copiées une fois, et les libellés reformulés pour Flowvent
  //    (« événement » et non « édition »). Un test garantit que chaque clé employée se résout ;
  // 3. `fr.json` : les libellés propres à Flowvent, dont ceux du layer d'auth.
  i18n: {
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    locales: [
      {
        code: 'fr',
        language: 'fr-FR',
        files: [
          '../../../../layers/volunteers/i18n/locales/fr/volunteers.json',
          '../../../../layers/volunteers/i18n/locales/fr/gestion-volunteers.json',
          'benevoles.json',
          'fr.json',
        ],
      },
    ],
  },

  // Après vérification d'email, le layer redirige vers /welcome/categories ; app2 n'a
  // pas d'étape « catégories » → on renvoie directement vers le tableau de bord.
  routeRules: {
    '/welcome/categories': { redirect: '/dashboard' },
    // Le layer bénévoles écrit des liens en dur vers les adresses d'app1 (notifications, rappels,
    // boutons) : ils mènent ici aux pages équivalentes de Flowvent.
    '/editions/**': { redirect: '/events/**' },
    // Les pages de gestion du layer bénévoles ne déclarent pas de layout : c'est l'app qui habille
    // toute sa zone de gestion, comme app1. Rendu client seul, comme app1 aussi (pages derrière
    // une session, rien à indexer).
    '/events/*/gestion/**': { appLayout: 'edition-dashboard', ssr: false },
    // Pages bénévole du layer : centrées, comme sous le layout par défaut d'app1.
    '/events/*/volunteers': { appLayout: 'evenement' },
    '/events/*/volunteers/**': { appLayout: 'evenement' },
  },

  runtimeConfig: {
    session: {
      // Mot de passe de chiffrement des cookies de session (NUXT_SESSION_PASSWORD).
      password: process.env.NUXT_SESSION_PASSWORD || '',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    },
    public: {
      // URL publique du site (liens des courriels). Surchargée à l'exécution par
      // NUXT_PUBLIC_SITE_URL : https://dev.flowvent.org, https://test.flowvent.org, https://flowvent.org.
      siteUrl: '',
      // Adresse affichée sur la politique de confidentialité (NUXT_PUBLIC_CONTACT_EMAIL), comme app1.
      contactEmail: 'contact@flowvent.org',
    },
  },

  // Serveur de dev (Vite) : autoriser l'hôte de NUXT_PUBLIC_SITE_URL (ex. dev.flowvent.org),
  // comme app1 — le domaine vit dans l'environnement, jamais dans le code. N'affecte QUE `nuxt dev`.
  vite: {
    server: {
      allowedHosts: (() => {
        const siteUrl = process.env.NUXT_PUBLIC_SITE_URL
        if (!siteUrl) return []
        try {
          return [new URL(siteUrl).hostname]
        } catch {
          return []
        }
      })(),
    },
  },
})
