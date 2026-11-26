# Application installable (PWA) — app1 et Flowvent

Les deux apps s'installent comme une application (écran d'accueil, fenêtre à part) et gardent hors
ligne ce qui a déjà été consulté. Le mécanisme est commun ; seules les règles propres à chaque app
diffèrent.

## Ce qui est commun

| Élément                                                                                                                             | Fichier                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stratégies de cache du service worker (réseau d'abord pour les pages, cache d'abord pour les fichiers à empreinte, tuiles bornées…) | `layers/core/server/socle/cache-hors-ligne-sw.ts`                                                                                        |
| Enregistrement du worker et mise de côté des pages, fichiers et données au fil de la visite                                         | `layers/ui/app/plugins/offline-cache.client.ts`                                                                                          |
| Invitation à installer : bandeau (après 5 s, report de 7 jours, jamais sur un écran de saisie) et entrée de menu                    | `layers/ui/app/components/PWAInstallBanner.vue`, `layers/ui/app/composables/useInvitePwa.ts`, `layers/ui/app/utils/invite-pwa-routes.ts` |

## Ce que chaque app fournit (contrat d'hôte)

- `shared/utils/offline-cache.ts` — lu par le plugin du layer `ui` par `#shared/…` :
  `classifyRequest` (ce que le worker garde), `OFFLINE_CACHES`, `MAX_CACHED_*`,
  `shouldPrecachePage`, `DONNEES_A_CONSERVER`, `serviceWorkerUrl`.
  ⚠️ `classifyRequest` est injectée dans le worker par son SOURCE : aucune constante ni import
  extérieurs.
- Sa route de service worker :
  - app1 : `server/routes/firebase-messaging-sw.js.ts` — cache **et** notifications Firebase (un
    seul worker par portée) ;
  - Flowvent : `server/routes/sw.js.ts` — cache seulement.
- Son manifeste dynamique (`server/api/site.webmanifest.get.ts`) et ses icônes (`public/favicons`).
- Les libellés `pwa.install.*` (Flowvent : `i18n/locales/benevoles.json`).

## Différences

|                                    | app1                       | Flowvent                 |
| ---------------------------------- | -------------------------- | ------------------------ |
| Données publiques gardées d'emblée | liste des éditions         | aucune (données privées) |
| Pages gardées d'office             | accueil, cartes d'éditions | accueil                  |
| Notifications push                 | oui (Firebase)             | non                      |

Le cache n'est actif qu'en production : en développement, les fichiers de build changent à chaque
modification et le figer casserait le rechargement à chaud.
