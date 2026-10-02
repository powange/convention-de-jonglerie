import vue from '@vitejs/plugin-vue'
import { version as nuxtVersion } from 'nuxt/package.json'

import { repertoireDeBuild } from './shared/utils/repertoire-de-build'

/**
 * Réception d'un fichier de sauvegarde : archive complète (dump + images), donc bien
 * au-delà de la limite par défaut de nuxt-security. Partagé par la restauration et
 * l'import simple — une route de sauvegarde qui reçoit un fichier sans cette règle
 * répond 413 dès quelques dizaines de Mo.
 */
/**
 * Le répertoire des fichiers de build, propre à chaque construction en production.
 *
 * Le pourquoi — un fichier périmé servi par le CDN sous un nom réutilisé — est écrit en entier
 * dans `shared/utils/repertoire-de-build.ts`, avec les mesures qui l'ont établi.
 */
const buildAssetsDir = repertoireDeBuild(process.env.NUXT_BUILD_SHA)

const backupUploadSecurity = {
  security: {
    requestSizeLimiter: {
      maxRequestSizeInBytes: 2_000_000_000,
      maxUploadFileRequestInBytes: 2_000_000_000,
      throwError: true,
    },
  },
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  hooks: {
    /**
     * Injection CSRF dans le `$fetch` global (Double Submit Cookie).
     *
     * Nuxt 4.5+ génère `#build/fetch` avec `export const $fetch = globalThis.$fetch`
     * (capture à l'évaluation du module) et l'entrée client l'importe AVANT d'exécuter
     * les plugins. Impossible donc d'intercepter `$fetch` via un plugin client.
     * On patche le template généré pour wrapper l'instance avec l'intercepteur qui
     * ajoute le header `x-csrf-token` depuis le cookie (cf. server/utils/csrf.ts).
     */
    'app:templates'(app) {
      const tpl = app.templates.find((t) => t.filename === 'fetch.mjs')
      if (!tpl || typeof tpl.getContents !== 'function') return

      // `app:templates` se déclenche à CHAQUE régénération des templates — typiquement quand on
      // ajoute une page en développement. Sans ce garde, chaque passage capturait le
      // `getContents` déjà enveloppé du tour précédent et réinjectait le bloc CSRF : au deuxième
      // tour, `const __CSRF_SAFE` était déclaré deux fois dans le même module, ce qui produisait
      // l'erreur « virtual:nuxt:.nuxt/fetch.mjs — oxc transform error » et exigeait un
      // redémarrage complet du serveur de dev.
      const patched = tpl as typeof tpl & { __csrfPatched?: boolean }
      if (patched.__csrfPatched) return
      patched.__csrfPatched = true

      const original = tpl.getContents
      tpl.getContents = async (data: unknown) => {
        const code: string = await (original as (d: unknown) => string | Promise<string>).call(
          tpl,
          data
        )
        const csrfWrap = [
          "const __CSRF_SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])",
          'function __readCsrfToken() {',
          "  if (typeof document === 'undefined') return null",
          '  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)',
          '  return m ? decodeURIComponent(m[1]) : null',
          '}',
          'if (globalThis.$fetch && !globalThis.$fetch.__csrfWrapped) {',
          '  globalThis.$fetch = globalThis.$fetch.create({',
          '    onRequest({ options }) {',
          "      const method = (options.method || 'GET').toString().toUpperCase()",
          '      if (__CSRF_SAFE.has(method)) return',
          '      const token = __readCsrfToken()',
          '      if (!token) return',
          '      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers || {})',
          "      if (!headers.has('x-csrf-token')) headers.set('x-csrf-token', token)",
          '      options.headers = headers',
          '    },',
          '  })',
          '  globalThis.$fetch.__csrfWrapped = true',
          '}',
        ].join('\n')
        // Seconde sécurité, indépendante du garde ci-dessus : si le bloc est déjà présent,
        // ne rien réinjecter. Une double déclaration de `__CSRF_SAFE` casserait le module.
        if (code.includes('__CSRF_SAFE')) return code

        return code.replace(
          'export const $fetch = globalThis.$fetch',
          `${csrfWrap}\nexport const $fetch = globalThis.$fetch`
        )
      }
    },
  },

  // Layers modulaires (étape 2) — bénévole, repas, tâches, FAQ, objets trouvés, ateliers, covoiturage
  // Monorepo : les layers sont partagés à la racine (../../layers), pas dans l'app.
  extends: [
    // Mécanismes d'interface sans métier — pastilles de compteur du menu, pour l'instant.
    // Placé en tête : ce dont les autres peuvent dépendre, jamais l'inverse.
    '../../layers/ui',
    '../../layers/volunteers',
    '../../layers/meals',
    '../../layers/tasks',
    '../../layers/faq',
    '../../layers/lost-found',
    '../../layers/workshops',
    '../../layers/carpool',
    '../../layers/stock',
    '../../layers/artists',
    '../../layers/ticketing',
    '../../layers/auth',
  ],

  compatibilityDate: '2026-03-02',

  // Préparer la migration vers Nuxt 5
  future: {
    compatibilityVersion: 5,
    typescriptBundlerResolution: true,
  },

  // Configuration SEO du site
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://juggling-convention.com',
    name: 'Juggling Convention',
    description:
      'Find and manage your favorite juggling conventions. Collaborative platform for jugglers and event organizers.',
    defaultLocale: 'en',
  },

  app: {
    buildAssetsDir,

    head: {
      titleTemplate: '%s | Juggling Convention',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logos/logo-jc.svg?v=4' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32x32.png?v=4' },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '192x192',
          href: '/favicons/favicon-192x192.png?v=4',
        },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/favicon-180x180.png?v=4' },
        { rel: 'manifest', href: '/api/site.webmanifest?v=4' },
        { rel: 'alternate icon', href: '/favicon.ico?v=4' },
      ],
    },
  },
  // Active en dev uniquement
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  // Enregistre explicitement les helpers de session pour l'alias #imports (utile en environnement de test)
  imports: {
    imports: [
      { from: 'nuxt-auth-utils', name: 'getUserSession' },
      { from: 'nuxt-auth-utils', name: 'requireUserSession' },
      { from: 'nuxt-auth-utils', name: 'setUserSession' },
      { from: 'nuxt-auth-utils', name: 'clearUserSession' },
    ],
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/scripts',
    // Activer le module de test-utils sur tous les environnements non-production (incl. test)
    process.env.NODE_ENV !== 'production' ? '@nuxt/test-utils/module' : undefined,
    '@nuxt/ui',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    'nuxt-security',
    '@nuxtjs/i18n',
    '@vueuse/nuxt',
    'nuxt-file-storage',
    '@nuxtjs/seo',
    'nuxt-qrcode',
  ].filter(Boolean),

  // Optimisation des images (WebP/AVIF avec qualité 80)
  image: {
    quality: 80,
    format: ['webp', 'avif'],
  },

  // Destructuration réactive des props dans <script setup>
  vue: {
    propsDestructure: true,
    // L'Options API de Vue reste compilée dans le bundle client. Nuxt 4.5.2 la retire par défaut
    // dès `compatibilityVersion: 5` (option `vue.optionsApi`, qui fixe `__VUE_OPTIONS_API__`) ;
    // or le composant Vue de FullCalendar est écrit avec elle (`data()`, `methods`). Sans elle,
    // son `data()` est ignoré et tous les calendriers plantent au rendu — agenda de l'accueil,
    // plannings des bénévoles — sans que le typage, les tests unitaires ni les tests Nuxt ne le
    // voient : seul Playwright l'a montré.
    optionsApi: true,
  },

  // Restreindre les collections d'icônes empaquetées côté serveur
  icon: {
    // Utiliser le mode `remote` pour éviter d'empaqueter les collections locales volumineuses
    // et ne récupérer que les icônes utilisées à l'exécution (taille serveur fortement réduite)
    serverBundle: 'remote',
  },
  // Sécurité HTTP — CSP + headers de protection
  security: {
    nonce: true,
    sri: true,
    headers: {
      contentSecurityPolicy: {
        'script-src': [
          "'self'",
          "'strict-dynamic'",
          "'nonce-{{nonce}}'",
          'https:',
          "'unsafe-inline'",
        ],
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https:', 'data:'],
        'connect-src': [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'wss://*.firebaseio.com',
          'https://fcm.googleapis.com',
          'https://api.stripe.com',
          'https://www.google.com',
          // Geocoding OSM utilisé pour l'autocomplétion d'adresses
          'https://nominatim.openstreetmap.org',
          // Nuxt Icon en mode `serverBundle: 'remote'` : fetch direct
          // des collections d'icônes depuis le CDN iconify côté client.
          'https://api.iconify.design',
          // Leaflet (carte) chargé dynamiquement depuis unpkg : autorise le
          // fetch des source maps (.js.map) déclenché quand le devtools est ouvert.
          'https://unpkg.com',
          // WebSocket pour le HMR Vite en dev (ws:) et la production HTTPS (wss:)
          ...(process.env.NODE_ENV === 'production' ? ['wss:'] : ['ws:', 'wss:']),
        ],
        'frame-src': [
          'https://js.stripe.com',
          'https://hooks.stripe.com',
          'https://www.google.com/recaptcha/',
          'https://recaptcha.google.com',
          // Lecteur YouTube intégré (candidatures artistes, etc.)
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          // Lecteur Vimeo intégré (candidatures artistes, etc.)
          'https://player.vimeo.com',
          // Carte Google My Maps d'une édition, intégrée sur /editions/:id/map quand
          // l'organisateur en a déjà réalisé une. Chemin restreint à My Maps : le reste de
          // google.com n'a pas à pouvoir être encadré dans le site.
          'https://www.google.com/maps/d/',
          // L'interface de Nuxt DevTools est une iframe servie par l'application elle-même
          // (/__nuxt_devtools__/client/). Sans `'self'`, la CSP du site bloque son propre outil
          // de développement — constaté en console : « Framing … violates … frame-src ».
          //
          // En développement UNIQUEMENT : `'self'` en production autoriserait le site à
          // s'encadrer lui-même, ce qui rouvre la porte au détournement de clic que
          // `frame-ancestors` et X-Frame-Options ferment par ailleurs.
          ...(process.env.NODE_ENV === 'production' ? [] : ["'self'"]),
        ],
        'base-uri': ["'none'"],
        'object-src': ["'none'"],
        'script-src-attr': ["'none'"],
        'upgrade-insecure-requests': true,
      },
      crossOriginEmbedderPolicy: false,
      // Le navigateur envoie l'URL complète (avec le path) en `Referer` pour les
      // requêtes same-origin, mais seulement l'origine vers les destinations
      // cross-origin. Permet de tracer la page d'origine des appels API dans les
      // logs d'erreur (cf. ApiErrorLog.referer) sans fuiter d'URL vers des tiers.
      // Surcharge le défaut de nuxt-security (`no-referrer`).
      referrerPolicy: 'strict-origin-when-cross-origin',
      // nuxt-security interdit ces capacités par défaut, y compris à l'application elle-même :
      // il faut ré-autoriser explicitement celles dont on se sert.
      permissionsPolicy: {
        // Scan des QR codes (billetterie, contrôle d'accès).
        camera: ['self'],
        // Détection de l'édition où se trouve l'utilisateur. Sans cette ligne, le navigateur
        // refuse la demande avant même de l'afficher — « Geolocation has been disabled in this
        // document by permissions policy » — quel que soit le consentement de l'utilisateur.
        geolocation: ['self'],
      },
    },
    rateLimiter: false,
    xssValidator: false,
    removeLoggers: false,
  },

  nitro: {
    // Preset explicite pour builds déterministes en Docker
    preset: 'node-server',
    ignore: ['**/*.spec.ts', '**/*.test.ts', 'test/**', '__tests__/**', 'scripts/**'],
    /*
     * ⚠️ DÉCLARÉE À LA MAIN, et non posée par le nom d'un fichier dans `server/routes/`.
     *
     * Cette route devrait s'appeler `server/routes/.well-known/assetlinks.json.get.ts`. Le dossier
     * commencerait alors par un POINT, et sauter les dossiers cachés est un comportement banal
     * d'un scan de système de fichiers. Le serveur de développement la sert bien — mais dev et
     * build ne font pas tourner le même code, et son absence après construction ne produirait
     * AUCUNE erreur : un 404, donc la barre d'adresse de Chrome au-dessus de l'application
     * Android, donc rien dans les journaux.
     *
     * Le fichier vit dans `server/handlers/`, qui n'est pas un dossier scanné par Nitro : la route
     * n'existe que par cette ligne, et ne peut pas être enregistrée deux fois.
     */
    handlers: [
      {
        route: '/.well-known/assetlinks.json',
        handler: '~~/server/handlers/assetlinks',
      },
    ],
    // Routes avec timeout étendu pour les appels IA longs
    routeRules: {
      '/api/admin/generate-import-json': {
        // Headers pour indiquer au client que la requête peut être longue
        headers: { 'X-Accel-Buffering': 'no' },
      },
    },
    externals: {
      external: ['@prisma/client'],
    },
    // `false` explicite — la valeur par défaut de Nitro 2, donc sans effet en production — pour
    // que les DevTools v4 ne le posent pas elles-mêmes. Elles y mettent un TABLEAU (la forme de
    // Nitro 3 : « embarquer ces chemins-là »), que Nitro 2 lit comme un simple booléen vrai : il
    // empaquetait alors TOUTES les dépendances serveur, échouait sur un paquet optionnel de
    // `sharp` (`@img/sharp-wasm32`, « externals are not allowed ») et le serveur de dev ne
    // démarrait plus. Les DevTools ne touchent `noExternals` que s'il n'est pas défini.
    noExternals: false,
    experimental: {
      tasks: true,
    },
    rollupConfig: {
      plugins: [vue()],
    },
    esbuild: {
      options: {
        target: 'es2020', // Support pour BigInt et autres fonctionnalités modernes
      },
    },
    // Compression des assets statiques (gzip et brotli)
    compressPublicAssets: {
      gzip: true,
      brotli: true,
    },
    // Configuration du cache pour les assets statiques
    publicAssets: [
      {
        // Assets statiques dans /public avec cache de 1 mois
        dir: '../public',
        maxAge: 60 * 60 * 24 * 30, // 30 jours
      },
    ],
  },
  i18n: {
    lazy: true, // Activer le lazy loading
    defaultLocale: 'en',
    locales: [
      {
        code: 'cs',
        language: 'cs',
        name: 'Čeština',
        files: [
          'cs/common.json',
          'cs/notifications.json',
          'cs/components.json',
          'cs/app.json',
          'cs/public.json',
          'cs/feedback.json',
        ],
      },
      {
        code: 'da',
        language: 'da',
        name: 'Dansk',
        files: [
          'da/common.json',
          'da/notifications.json',
          'da/components.json',
          'da/app.json',
          'da/public.json',
          'da/feedback.json',
        ],
      },
      {
        code: 'de',
        language: 'de',
        name: 'Deutsch',
        files: [
          'de/common.json',
          'de/notifications.json',
          'de/components.json',
          'de/app.json',
          'de/public.json',
          'de/feedback.json',
        ],
      },
      {
        code: 'en',
        language: 'en',
        name: 'English',
        files: [
          'en/common.json',
          'en/notifications.json',
          'en/components.json',
          'en/app.json',
          'en/public.json',
          'en/feedback.json',
        ],
      },
      {
        code: 'es',
        language: 'es',
        name: 'Español',
        files: [
          'es/common.json',
          'es/notifications.json',
          'es/components.json',
          'es/app.json',
          'es/public.json',
          'es/feedback.json',
        ],
      },
      {
        code: 'fr',
        language: 'fr',
        name: 'Français',
        files: [
          'fr/common.json',
          'fr/notifications.json',
          'fr/components.json',
          'fr/app.json',
          'fr/public.json',
          'fr/feedback.json',
          'fr/gestion.json',
        ],
      },
      {
        code: 'it',
        language: 'it',
        name: 'Italiano',
        files: [
          'it/common.json',
          'it/notifications.json',
          'it/components.json',
          'it/app.json',
          'it/public.json',
          'it/feedback.json',
        ],
      },
      {
        code: 'nl',
        language: 'nl',
        name: 'Nederlands',
        files: [
          'nl/common.json',
          'nl/notifications.json',
          'nl/components.json',
          'nl/app.json',
          'nl/public.json',
          'nl/feedback.json',
        ],
      },
      {
        code: 'pl',
        language: 'pl',
        name: 'Polski',
        files: [
          'pl/common.json',
          'pl/notifications.json',
          'pl/components.json',
          'pl/app.json',
          'pl/public.json',
          'pl/feedback.json',
        ],
      },
      {
        code: 'pt',
        language: 'pt',
        name: 'Português',
        files: [
          'pt/common.json',
          'pt/notifications.json',
          'pt/components.json',
          'pt/app.json',
          'pt/public.json',
          'pt/feedback.json',
        ],
      },
      {
        code: 'ru',
        language: 'ru',
        name: 'Русский',
        files: [
          'ru/common.json',
          'ru/notifications.json',
          'ru/components.json',
          'ru/app.json',
          'ru/public.json',
          'ru/feedback.json',
        ],
      },
      {
        code: 'sv',
        language: 'sv',
        name: 'Svenska',
        files: [
          'sv/common.json',
          'sv/notifications.json',
          'sv/components.json',
          'sv/app.json',
          'sv/public.json',
          'sv/feedback.json',
        ],
      },
      {
        code: 'uk',
        language: 'uk',
        name: 'Українська',
        files: [
          'uk/common.json',
          'uk/notifications.json',
          'uk/components.json',
          'uk/app.json',
          'uk/public.json',
          'uk/feedback.json',
        ],
      },
    ],
    langDir: 'locales/',
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      cookieDomain: null,
      cookieSecure: false,
      cookieCrossOrigin: false,
      /*
       * 'all' plutôt que 'root', et il faut dire ce que cela change RÉELLEMENT : rien, aujourd'hui.
       *
       * ⚠️ MESURÉ, et contraire à ce qu'on attendait. Avec `redirectOn: 'root'` — la valeur
       * précédente, rechargée pour de bon (Nitro reconstruit) — une page PROFONDE demandée sans
       * cookie répond déjà dans la langue du navigateur : « Politique de confidentialité » en
       * `Accept-Language: fr`, « Privacy Policy » en `en`. La détection n'était donc PAS limitée
       * à « / ».
       *
       * C'est cohérent avec `strategy: 'no_prefix'` : `redirectOn` gouverne quand une REDIRECTION
       * de langue a lieu, et sans préfixe d'URL il n'y a aucune redirection à restreindre — la
       * locale est simplement choisie au rendu, à chaque requête.
       *
       * Pourquoi le changer quand même : c'est la valeur documentée pour « détecter partout », et
       * le guide de migration de @nuxtjs/i18n prévient que les combinaisons stratégie/redirectOn
       * ont été resserrées sur leur comportement documenté. Un futur resserrement pourrait rendre
       * 'root' effectif ici — et le défaut apparaîtrait alors sans qu'on ait rien changé.
       *
       * ⚠️ Ce n'est donc PAS ce réglage qui protège le comportement : c'est
       * `test/e2e/playwright/public/langue-du-navigateur.spec.ts`, qui le mesure sur un vrai
       * navigateur, avec un témoin anglophone.
       */
      redirectOn: 'all',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
    // Optimiser les traductions pour réduire la taille des bundles
    bundle: {
      compositionOnly: true,
      runtimeOnly: false,
      fullInstall: false,
      // Garder le compilateur de messages même en prod pour éviter les erreurs SSR (intlify)
      dropMessageCompiler: false,
    },
    vueI18n: './i18n/i18n.config.ts',
  },
  // flag-icons a été retiré : sa feuille embarquait les ~250 pays du monde dans entry.css, soit
  // 77 ko compressés (69 % de la feuille principale) téléchargés par chaque visiteur, drapeau
  // affiché ou non. Les drapeaux passent par la collection Iconify `flag`, comme les autres
  // icônes : seuls ceux réellement rendus produisent du CSS. Cf. app/components/FlagIcon.vue.
  css: ['~/assets/css/main.css'],
  // Configuration pour nuxt-file-storage
  fileStorage: {
    mount: process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads',
  },

  runtimeConfig: {
    // Version Nuxt (injectée au build)
    nuxtVersion,
    // Private keys that are only available on the server
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      /**
       * Pas de `maxAge` : l'échéance n'appartient plus à h3.
       *
       * Elle valait 30 jours ici, et « se souvenir de moi » en passait 90 à la seule ÉCRITURE de
       * la session. Toutes les lectures repassant par cette valeur, h3 rejetait la session au
       * bout de 30 jours — en silence, puis en réécrivant le cookie. Pire : son compte à rebours
       * partait du `createdAt`, posé à la première visite même anonyme, et que rien ne rajeunit.
       *
       * La session porte désormais sa propre échéance (`expireAt`), repoussée à chaque visite par
       * `server/utils/session-helpers.ts`. C'est ce qui la rend glissante — on reste connecté
       * tant qu'on revient — et c'était impossible tant que h3 tranchait.
       *
       * ⚠️ Conséquence à connaître : sans `maxAge`, le sceau du cookie n'a plus de durée de vie
       * propre. `expireAt` devient la seule barrière — elle est À L'INTÉRIEUR du scellé, donc
       * inaltérable côté client, mais toute lecture doit passer par `getAuthSession`.
       */
    },
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
    emailEnabled: process.env.SEND_EMAILS || 'false', // Enable/disable real email sending
    smtpUser: process.env.SMTP_USER || '', // SMTP username for email sending
    smtpPass: process.env.SMTP_PASS || '', // SMTP password for email sending
    smtpFrom: process.env.SMTP_FROM || '', // Adresse d'expéditeur (alias Gmail, ex: notifications@juggling-convention.com)
    smtpBcc: process.env.SMTP_BCC || '', // Copie cachée de tous les emails envoyés (archivage). Plusieurs adresses possibles, séparées par des virgules
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '', // Anthropic Claude API key for AI features
    // Configuration du provider IA (anthropic, ollama ou lmstudio)
    aiProvider: process.env.AI_PROVIDER || 'anthropic', // Provider IA à utiliser (anthropic par défaut)
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434', // URL de base d'Ollama
    ollamaModel: process.env.OLLAMA_MODEL || 'llava', // Modèle Ollama avec vision
    // Browserless pour le scraping de pages web (JavaScript rendu)
    browserlessUrl: process.env.BROWSERLESS_URL || '', // URL du service browserless (ex: http://192.168.0.13:3001)
    // Supporte aussi la convention Nuxt NUXT_*
    recaptchaSecretKey: process.env.NUXT_RECAPTCHA_SECRET_KEY || '', // reCAPTCHA secret key for server-side verification
    recaptchaMinScore: Number(process.env.NUXT_RECAPTCHA_MIN_SCORE || '0.5'), // seuil configurable pour v3
    recaptchaExpectedHostname: process.env.NUXT_RECAPTCHA_EXPECTED_HOSTNAME || '', // optionnel: valider le hostname retourné par Google
    recaptchaDevBypass:
      process.env.NUXT_RECAPTCHA_DEV_BYPASS === 'true' || process.env.NODE_ENV !== 'production', // bypass en dev par défaut
    stripeCoffeeProductName: process.env.STRIPE_COFFEE_PRODUCT_NAME || 'Un café pour le projet', // Nom du produit affiché sur Stripe
    public: {
      // Plafond du flux SSE de génération d'import IA, côté client (ms). À garder supérieur à
      // AI_TIMEOUT_LLM : un modèle local lent doit expirer côté serveur, qui explique alors ce
      // qui s'est passé, plutôt que côté client, qui ne peut afficher qu'un « Timeout » sec.
      aiGenerationTimeout: process.env.NUXT_PUBLIC_AI_GENERATION_TIMEOUT || '',
      // Public keys that are available on both client and server
      // Supporte aussi la convention Nuxt NUXT_PUBLIC_*
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY || '', // reCAPTCHA site key for client-side widget
      firebaseVapidKey: process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY || '', // Firebase VAPID public key for FCM
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '', // Base URL of the site
      // Firebase configuration (varies by environment)
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '',
    },
  },
  vite: {
    // Pas de suppression des console.* au build : oxc n'offre pas d'équivalent à `pure_funcs`
    // (seulement `dropConsole`, qui emporterait aussi error/warn). Les traces de débogage sont
    // donc conditionnées à `import.meta.dev` directement dans le code — voir `logDebug`.
    css: {
      devSourcemap: true,
    },
    build: {
      chunkSizeWarningLimit: 800, // Seuil optimal pour les performances
      // Optimisation des imports
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [/node_modules/],
      },
    },
    // Configuration Vite pour le hot reload dans Docker sur Windows
    server: {
      // Écouter sur toutes les adresses, et pas seulement la boucle locale.
      //
      // Ce n'est pas pour le serveur Nuxt — Nitro écoute déjà sur 0.0.0.0 via NUXT_HOST. C'est
      // pour le serveur RPC de Vite DevTools, dont l'hôte est déduit de cette valeur :
      //
      //   const host = config.server.host === true ? "0.0.0.0" : config.server.host || "localhost"
      //
      // Sans cette ligne il retombait sur "localhost" et se liait à `::1` À L'INTÉRIEUR du
      // conteneur, donc injoignable même depuis la machine hôte : le navigateur tentait
      // `ws://localhost:7812` et échouait, l'autorisation n'était jamais demandée, et aucune
      // invite n'apparaissait — d'où un jeton introuvable dans les logs comme sur le disque.
      host: true,
      watch: {
        usePolling: true,
        interval: 1000,
      },
      // Autoriser le hostname de NUXT_PUBLIC_SITE_URL (ex: dev.juggling-convention.com)
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
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'i18n-iso-countries',
        'firebase/app',
        'firebase/messaging',
        /*
         * CONSERVÉ après la suppression du plugin `vue-json-viewer.client.ts` : la page
         * `admin/error-logs.vue` importe toujours ce paquet (et sa feuille de style) localement.
         * L'énoncé du lot invitait à le retirer « s'il n'est plus nécessaire au dev » — il l'est
         * encore. Le retirer ne gagnerait rien et imposerait une ré-optimisation de Vite au
         * premier affichage de cette page.
         */
        'vue3-json-viewer',
        '@internationalized/date',
        '@unhead/schema-org/vue',
        'zod',
        'luxon',
        '@fullcalendar/vue3',
        '@fullcalendar/daygrid',
        '@fullcalendar/list',
        '@fullcalendar/interaction',
        // Les vues timeline manquaient à cette liste : leurs classes n'étaient pas pré-bundlées
        // comme celles dont elles héritent, et l'héritage cassait à l'exécution — « Class
        // constructor ResourceTimelineView cannot be invoked without 'new' ». L'exception
        // interrompait l'hydratation, figeant le planning des bénévoles et son menu.
        '@fullcalendar/resource',
        '@fullcalendar/resource-timeline',
        // Même raison pour l'adaptateur luxon, qui donne au calendrier les fuseaux nommés : il
        // étend les classes ci-dessus, et l'héritage casse pareillement s'il n'est pas pré-bundlé.
        '@fullcalendar/luxon3',
        '@fullcalendar/core/locales-all',
        'rehype-sanitize',
        'rehype-stringify',
        'remark-gfm',
        'remark-parse',
        'remark-rehype',
        'unified',
        'unist-util-visit',
        '@nuxt/ui > prosemirror-state',
        '@nuxt/ui > prosemirror-transform',
        '@nuxt/ui > prosemirror-model',
        '@nuxt/ui > prosemirror-view',
        '@nuxt/ui > prosemirror-gapcursor',
        '@tiptap/extension-emoji',
      ],
      exclude: ['node-cron', '@prisma/client'],
    },
  },
  // Désactiver les sourcemaps en production (économie mémoire au build)
  sourcemap: {
    server: false,
    client: process.env.NODE_ENV !== 'production',
  },

  // Layouts et optimisations par route
  routeRules: {
    // Pages de gestion : pas de SSR (utilisateurs authentifiés, pas de SEO)
    '/editions/*/gestion/**': { appLayout: 'edition-dashboard', ssr: false },
    // Pages admin : pas de SSR
    '/admin/**': { ssr: false },
    // Réception d'un fichier de sauvegarde : jusqu'à 100 MB (cf. backupUploadSecurity)
    '/api/admin/backup/restore': backupUploadSecurity,
    '/api/admin/backup/upload': backupUploadSecurity,
    // Uploads de fichiers (affiches, profils, etc.) : le body contient le fichier
    // encodé en base64, ce qui augmente la taille d'environ 33 %. Pour rester
    // cohérent avec MAX_IMAGE_SIZE = 10 MB côté serveur, on autorise 15 MB.
    '/api/files/**': {
      security: {
        requestSizeLimiter: {
          maxRequestSizeInBytes: 15_000_000,
          maxUploadFileRequestInBytes: 15_000_000,
          throwError: true,
        },
      },
    },
  },

  features: {
    // Le CSS n'est plus inliné dans le HTML rendu côté serveur mais servi en feuille externe,
    // donc mise en cache par le navigateur. Mesuré sur la page d'accueil en production :
    // 39 ko de CSS inlinés, soit 23 % du HTML, renvoyés à chaque navigation.
    // Coût : une requête bloquante de plus au tout premier affichage.
    // Gain : ces 39 ko en moins sur chaque page ensuite, et 15 à 23 % de temps de build
    // (nuxt:ssr-styles était le deuxième poste de temps, derrière la protection des imports).
    // Les pages de gestion et d'admin étant déjà en `ssr: false`, elles payaient ce coût de
    // build sans jamais profiter de l'inlining.
    inlineStyles: false,
  },

  experimental: {
    // Améliorer les performances avec la lazy hydration
    lazyHydration: true,
    /*
     * Rechargement sur échec de chargement d'une bribe JavaScript.
     *
     * ⚠️ `'automatic'` NE COUVRAIT QUE LA NAVIGATION, et c'est ce qui a mis des visiteurs devant un
     * « 500 — Failed to fetch dynamically imported module » en pleine page. Le greffon de Nuxt
     * n'agit que depuis `router.onError` : une bribe qui échoue AILLEURS — un composant paresseux,
     * un `import()` dans une page déjà chargée — n'est jamais rattrapée, et l'erreur remonte
     * jusqu'à la page d'erreur.
     *
     * ⚠️⚠️ ET LE CAS LE PLUS COURANT EST LE CHARGEMENT INITIAL. Le greffon `automatic` s'abonne à
     * `router.onError` et vide sa liste d'erreurs à chaque `beforeEach` : une bribe qui échoue en
     * ouvrant la page — avant toute navigation — n'est rattrapée par personne. C'est exactement ce
     * que décrit la capture reçue : l'erreur en pleine page, dès l'arrivée sur le site.
     *
     * 📊 Et le dépôt multiplie les occasions : 22 `await import()` côté client, trois
     * `defineAsyncComponent`, trois `<Lazy…>`, dont plusieurs SANS `try` autour. Sur un téléphone,
     * une coupure réseau d'une seconde suffit.
     *
     * ⚠️ UN `try` AUTOUR DE L'IMPORT NE MET PAS À L'ABRI, contrairement à ce qu'affirmait la
     * première version de ce commentaire au sujet de `useLazyI18n`. Lu dans le helper de Vite :
     * `handlePreloadError` ÉMET `vite:preloadError` puis ne relance l'erreur que si personne n'a
     * appelé `preventDefault`. L'événement part donc avant le `catch` de l'appelant, et Nuxt émet
     * `app:chunkError` quoi qu'il arrive. Conséquence assumée de ce réglage : un import que
     * l'application rattrapait proprement — les traductions d'un domaine, les greffons de
     * FullCalendar — provoque désormais un rechargement au lieu d'une page dégradée. C'est le bon
     * arbitrage dans le cas courant, celui de la bribe retirée par un déploiement : le
     * rechargement RÉPARE, là où la page dégradée reste dégradée. Et la garde ci-dessous borne le
     * cas contraire à un seul rechargement.
     *
     * S'y ajoute la cause de fond : un déploiement retire les anciennes bribes du serveur. Un
     * onglet resté ouvert — cas courant sur mobile — en demande une qui n'existe plus. Le cache de
     * Cloudflare la sert encore là où il l'a gardée, pas ailleurs : d'où des visiteurs touchés et
     * d'autres non, sans logique apparente.
     *
     * `'automatic-immediate'` recharge la route COURANTE dès qu'une bribe échoue, quelle qu'en soit
     * l'origine. Le rechargement récupère un HTML neuf, donc les noms de bribes actuels.
     *
     * 📍 PAS DE BOUCLE À CRAINDRE, vérifié dans `reloadNuxtApp` : un marqueur `nuxt:reload` en
     * `sessionStorage` interdit de recharger deux fois le même chemin en moins de dix secondes.
     * Une bribe durablement inaccessible — bloquée par une extension, par exemple — donne donc UN
     * rechargement, puis la page d'erreur. C'était la seule objection sérieuse à ce réglage.
     *
     * ⚠️⚠️ CE COMPORTEMENT N'EST PAS COUVERT PAR UN TEST AUTOMATIQUE, et c'est un choix assumé
     * après quatre tentatives mesurées. Ce qui s'y oppose, pour qui voudra reprendre :
     *
     *   1. Le chemin n'existe pas en développement. Vite y sert des modules ESM natifs, non
     *      enveloppés dans `__vitePreload` : aucun `vite:preloadError`, donc aucun
     *      `app:chunkError`. Le lot ne peut tourner que sur une application CONSTRUITE, donc en CI.
     *   2. Couper « la première bribe » coupe le script d'entrée : l'application ne démarre pas,
     *      le HTML du serveur reste à l'écran, et les assertions passent à vide devant une page
     *      d'apparence saine.
     *   3. Les bribes sont hachées par leur contenu : tout nom écrit en dur devient faux au premier
     *      changement, et un `page.route` qui ne correspond plus ne coupe rien — vert à vide encore.
     *      Les déduire du build à chaque exécution fonctionne (le composant porte son message
     *      d'erreur, que la minification conserve).
     *   4. Et le mur : sur la dernière tentative, les cinq bribes de FullCalendar étaient bien
     *      demandées APRÈS le clic sur la vue agenda — le bon déclencheur, enfin — mais toutes
     *      servies en 200. `page.route` avait appelé `continue` 400 fois pendant le chargement
     *      initial puis ne s'appliquait plus du tout. Cause non identifiée.
     *
     * Ce qui tient ce réglage, à défaut : la lecture des deux greffons, citée ci-dessus, et celle
     * du helper de Vite. Pas un test.
     *
     * 📍 `restoreState` reste DÉSACTIVÉ : la documentation de Nuxt met en garde contre ses effets
     * de bord, et il exige des clés explicites sur chaque `useState`. Un rechargement perd donc
     * l'état de la page — ce qui reste très au-dessus d'une page d'erreur.
     */
    emitRouteChunkError: 'automatic-immediate',
    // Cache des artefacts de build (accélère les rebuilds)
    buildCache: true,
    // Transitions natives du navigateur entre pages (respecte prefers-reduced-motion)
    viewTransition: true,
    // Prefetching cross-origin via Speculation Rules API
    crossOriginPrefetch: true,
    // Defaults NuxtLink : prefetch au premier signe d'interaction
    defaults: {
      nuxtLink: {
        prefetch: true,
        prefetchOn: { interaction: true },
      },
    },
  },

  // Configuration des modules SEO
  robots: {
    // Pas de `disallow` calculé ici, et c'est le correctif d'un bug silencieux.
    //
    // Cette ligne valait `process.env.NUXT_ENV === 'staging' || 'release' ? ['/'] : []`, avec
    // l'intention de n'autoriser l'indexation que sur le domaine principal. Elle n'a jamais pu
    // s'appliquer : `NUXT_ENV` est lu **au build**, or le build ne reçoit aucune variable
    // — `docker-compose.prod.yml` ne déclare aucun `args:`, et Docker ne transmet pas
    // l'environnement du conteneur à `docker build`. Constaté sur les environnements réels : les
    // `robots.txt` de release et de production étaient identiques, `Allow: /` pour tous.
    //
    // `@nuxtjs/seo` sait le décider à l'exécution : il bloque l'indexation dès que l'environnement
    // du site n'est pas `production`. Il suffit donc de poser `NUXT_SITE_ENV=staging` dans le
    // `stack.env` de release — une variable d'exécution, que celle-ci reçoit bien.
    //
    // Un `disallow: []` explicite est d'ailleurs pire que rien : il affirme « tout est
    // autorisé » là où le module aurait interdit.
    sitemap: '/sitemap.xml',
    debug: false,
  },

  sitemap: {
    // `NUXT_ENV` était testé ici aussi, avec la même intention — désactiver le sitemap hors
    // production — et la même inefficacité : la variable n'atteint jamais le build. Les deux
    // conditions sont retirées plutôt que laissées à faire illusion ; le comportement ne change
    // pas, puisqu'elles ne se déclenchaient pas.
    //
    // Le sitemap reste donc servi sur release. Ce n'est pas un oubli : `enabled` est une option de
    // build, et rien ne permet de la décider à l'exécution. Le levier qui compte est le
    // `robots.txt`, lui décidé à l'exécution — un moteur qui le respecte ne viendra pas lire ce
    // sitemap. `nuxt build` fixant lui-même `NODE_ENV` à `production`, la condition restante est
    // toujours vraie ; elle est gardée pour le cas d'un build lancé autrement.
    enabled: process.env.NODE_ENV === 'production',
    // Exclure certaines routes du sitemap
    exclude: [
      '/admin/**',
      '/register',
      '/logout',
      '/verify-email',
      '/auth/**',
      '/profile',
      '/my-**',
      '/favorites',
      '/notifications',
      '/api/**',
      '/editions/add',
    ],
    // Inclure les routes dynamiques importantes
    sources: [
      '/api/__sitemap__/editions',
      '/api/__sitemap__/carpool',
      '/api/__sitemap__/volunteers',
    ],
    // Définir explicitement les routes autorisées
    urls: [
      {
        loc: '/',
        lastmod: new Date(),
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: '/privacy-policy',
        lastmod: new Date(),
        changefreq: 'monthly',
        priority: 0.3,
      },
    ],
  },

  ogImage: {
    // Active la génération d'images OG seulement si SSR est disponible
    enabled: process.env.NODE_ENV !== 'test',
    defaults: {
      // Utilise le logo comme fallback
      component: 'NuxtSeo',
      width: 1200,
      height: 630,
    },
  },

  schemaOrg: {
    // Active Schema.org
    enabled: true,
  },

  linkChecker: {
    // Active la vérification des liens en dev
    enabled: process.env.NODE_ENV !== 'production',
    excludeLinks: ['mailto:*', 'tel:*'],
  },
})
