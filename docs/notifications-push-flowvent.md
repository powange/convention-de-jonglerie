# Notifications de Flowvent : cloche et push

Flowvent (app2) prévient ses utilisateurs de deux façons, à partir des mêmes notifications :

- **la cloche**, dans l'en-tête du site et dans la barre de la gestion d'un événement ;
- **le push**, sur le téléphone ou l'ordinateur, même Flowvent fermé.

Les notifications sont créées par les modules — échange de créneau, candidature d'artiste, ajout comme
co-organisateur, etc. — via `NotificationService.create` (`apps/app2/server/utils/notification-service.ts`).
Chaque création enregistre la notification (cloche) **et** l'envoie en push aux appareils du compte.

## Pourquoi le Web Push standard, et pas Firebase comme app1

Décision du 28/11/2026. Sur le web, Firebase Cloud Messaging s'appuie lui-même sur le Web Push : il
n'atteint pas plus d'appareils. Le Web Push standard évite :

- un compte Google et un compte de service à gérer par environnement ;
- le passage du contenu en clair chez Google : ici, il est **chiffré de bout en bout**, le service de
  push du navigateur (Google, Mozilla, Apple) le transporte sans pouvoir le lire ;
- le kit Firebase côté navigateur.

Firebase ne redeviendrait intéressant qu'avec de vraies applications natives (Android / iOS).

## Configuration : une paire de clés VAPID par environnement

```bash
npx web-push generate-vapid-keys
```

Dans le `.env` de l'environnement (Portainer pour test et prod, `apps/app2/.env` en dev) :

```env
VAPID_PUBLIC_KEY="…"
VAPID_PRIVATE_KEY="…"       # secret
VAPID_SUBJECT="https://flowvent.org"
```

- **Sans clés**, le push est désactivé sans erreur : la cloche fonctionne, le profil indique que le
  navigateur ne reçoit pas de notifications.
- **Changer de paire** rend caducs tous les abonnements existants : chacun devra réactiver.
- Une paire **différente** par environnement : un abonnement pris sur test ne reçoit rien de la prod.

## Ce que voit l'utilisateur

- **Profil → Notifications** (`/profile/notifications`) : activer sur cet appareil, s'envoyer un test,
  voir et retirer les appareils du compte.
- **Cloche** : tant que l'appareil ne reçoit pas les notifications, un bouton « Activer » en bas de la
  liste. C'est là qu'un bénévole le trouve, dans l'application de son événement.
- **Au toucher**, la notification ouvre sa page — réécrite avec l'identifiant public de l'événement,
  pour s'ouvrir dans l'application de l'événement installée. Son icône est celle de l'application de
  l'événement (icône déposée, sinon l'affiche, sinon Flowvent).
- **À la déconnexion**, l'appareil se désabonne : la personne suivante sur ce téléphone ne reçoit pas
  les notifications de la précédente.

Limites des plateformes (pas de la technologie) : sur iPhone, le push n'existe que pour une
application **installée sur l'écran d'accueil**, sans boutons ni grande image ; Firefox sur
ordinateur n'affiche pas les boutons.

## Pièces

| Rôle                                          | Fichier                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Envoi, contenu d'une notification             | `apps/app2/server/utils/push.ts`                                                  |
| Réception dans le navigateur (service worker) | `apps/app2/server/utils/push-sw.ts`, servi par `server/routes/sw.js.ts`           |
| Abonnements                                   | `apps/app2/server/api/push/` — table `PushSubscription`                           |
| Cloche                                        | `apps/app2/app/components/AppNotifications.vue`, API `server/api/notifications/`  |
| État sur l'appareil                           | `apps/app2/app/composables/usePushNotifications.ts`, `app/plugins/push.client.ts` |

Le service worker prévient aussi les pages ouvertes (`flowvent:push`) : la cloche se met à jour à la
réception, sans attendre sa relecture d'une minute.

## Éprouver le push

Le Chromium de Playwright ne peut pas s'abonner (pas d'accès au service de push de Google), et Firefox
sans interface n'affiche pas de notification. On éprouve donc la chaîne avec **Firefox**, en
rétablissant son service de push (`dom.push.serverURL: wss://push.services.mozilla.com/`), et en
observant le message `flowvent:push` que le service worker envoie aux pages : il prouve que le push est
arrivé et a été déchiffré.
