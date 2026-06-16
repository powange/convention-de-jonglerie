# Étape 4 — Création de la 2ᵉ application

> **Statut** : proposition de conception (non implémentée).
> **Date** : 2026-06-15, mise à jour 2026-06-16.
> **Prérequis** : étape 3 ([etape-3-monorepo.md](./etape-3-monorepo.md)) **et étape 0bis** —
> l'étape 0 ayant été livrée en scope réduit, le layer `volunteers` lit encore `Edition`/`Convention`
> (~40 accès). Tant que les champs génériques ne sont pas promus vers `Event` (étape 0bis), le layer
> n'est pas réutilisable par une app sans `Edition`. Voir la section _Avancement_ de
> [modularisation-multi-domaines.md](./modularisation-multi-domaines.md). C'est le **premier vrai
> test** de réutilisation des layers.

## 1. Objectif

Créer `apps/autre-domaine` qui **réutilise** les layers partagés (`core`, `volunteers`, et au fil de
l'eau les autres) et n'écrit que **son modèle de domaine + son habillage**. La base de données et le
déploiement sont **distincts** de l'app jonglerie.

Hypothèse cadrée : nouveau domaine de **forme similaire** (une organisation qui fait des événements
datés avec bénévoles/billetterie/tâches). L'abstraction `Event` (étape 0) suffit donc — pas besoin
d'abstraire au-delà.

## 2. Squelette de l'app

```
apps/autre-domaine/
├── package.json                 # @cdj/app-autre, deps: @cdj/layer-core, @cdj/layer-volunteers
├── nuxt.config.ts               # extends: [core, volunteers] ; branding ; i18n de l'app
├── app.config.ts                # thème Nuxt UI (couleurs, logo)
├── prisma/
│   ├── schema/                  # fragments composés (core + layers) + <domaine>.prisma
│   ├── prisma.config.ts
│   └── migrations/              # migrations PROPRES à la base B
├── app/
│   ├── pages/                   # pages spécifiques au domaine (accueil, branding, pages métier non couvertes par un layer)
│   └── components/              # composants spécifiques au domaine
├── server/
│   ├── plugins/                 # binding des ports (voir §6)
│   └── api/                     # endpoints spécifiques au domaine
├── i18n/locales/{lang}/         # traductions propres au domaine (+ contributions des layers)
└── Dockerfile / docker-compose.*.yml
```

## 3. Le modèle de domaine (équivalent d'`Edition`)

Comme `Edition` côté jonglerie, le nouveau domaine définit **sa** table 1:1 avec `Event` :

```prisma
// apps/autre-domaine/prisma/schema/<domaine>.prisma
model <Domaine> {
  id      Int   @id @default(autoincrement())
  eventId Int   @unique
  event   Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // … champs spécifiques au nouveau domaine (l'équivalent des has*Space/convention côté jonglerie)
}
```

- `Event` (générique) vient du **fragment core** — identique aux deux apps.
- `EventVolunteerSettings` + les 5 modèles bénévoles viennent du **fragment du layer volunteers** —
  identiques aux deux apps.
- Le nouveau domaine **n'a pas** de `Convention` ni de `has*Space` jonglerie : il a les siens.

> Le nom d'affichage des events (que le layer lit via `event.name`, cf. étape 1 §5) est résolu par
> l'app : ici, directement depuis `<Domaine>` / `Event`, sans la mécanique `convention.name`.

## 4. Ce qu'on réutilise vs ce qu'on crée

| Élément                                                                  | 2ᵉ app                             |
| ------------------------------------------------------------------------ | ---------------------------------- |
| `Event`, `User`, auth, notifications, messenger, emails (core)           | **Réutilisé** (layer)              |
| Module bénévole complet (pages `gestion/volunteers/**`, API, planning…)  | **Réutilisé** (layer)              |
| Modèle de domaine (`<Domaine>` 1:1 Event)                                | **Créé**                           |
| Pages d'accueil / vitrine / pages métier propres                         | **Créé**                           |
| Branding (logo, couleurs, nom)                                           | **Créé** (`app.config.ts`, assets) |
| Implémentations des ports (notifications, email, messenger, permissions) | **Créé** (binding, §6)             |
| Base de données, Docker, CI, migrations                                  | **Créé** (séparés)                 |

## 5. Authentification & comptes

Bases séparées ⇒ **comptes distincts par app** (la table `User` a la même _forme_ mais pas les mêmes
_données_). Un utilisateur de la 2ᵉ app n'existe pas dans la base jonglerie, et inversement.

> Un **SSO** (compte unique partagé entre les deux apps) est un **chantier distinct** : il
> nécessiterait un fournisseur d'identité externe (ou une base d'auth partagée), hors périmètre de
> cette étape. À décider séparément.

## 6. Permissions & ports : le binding propre au domaine

Le layer bénévole consomme les ports (étape 1) ; la 2ᵉ app fournit **ses** implémentations :

- `NotificationPort` / `EmailPort` / `MessengerPort` : délèguent aux services **core** (réutilisés).
- `OrganizerDirectoryPort` (`getVolunteerManagers`, `canManageVolunteers`, `canReadVolunteers`) :
  **implémentation spécifique** si le modèle d'organisateurs du nouveau domaine diffère de
  `ConventionOrganizer`/`EditionOrganizerPermission`. C'est le point d'adaptation principal côté
  permissions.

```ts
// apps/autre-domaine/server/plugins/volunteer-ports.ts
export default defineNitroPlugin(() => {
  setVolunteerPorts({
    notifications: /* core */,
    email:         /* core */,
    messenger:     /* core */,
    organizers: {
      getVolunteerManagers: (eventId) => /* modèle de permissions du nouveau domaine */,
      canManageVolunteers:  (userId, eventId) => /* … */,
      canReadVolunteers:    (userId, eventId) => /* … */,
    },
  })
})
```

## 7. i18n

- Les domaines i18n du layer (`volunteers`, `gestion-volunteers`) sont **fournis par le layer** et
  chargés via le mécanisme de contribution mis en place à l'étape 2 §5 — **rien à retraduire**.
- L'app ajoute ses **propres** domaines (accueil, branding, métier du domaine) dans
  `apps/autre-domaine/i18n/locales/`.
- Choisir le sous-ensemble de langues de la 2ᵉ app (peut différer des 13 de la jonglerie).

## 8. Branding / thème

- `app.config.ts` : couleurs Nuxt UI, logo, nom de l'app.
- Surcharge ciblée possible : un composant du layer peut être **overridé** en plaçant un fichier de
  même chemin dans l'app (mécanique `extends`, l'app gagne). À utiliser avec parcimonie.

## 9. Déploiement en stack Docker séparée

Les deux apps sont **indépendantes au runtime** : le code partagé (layers) est compilé **dans
chaque image au build**, il n'y a aucun couplage d'exécution entre les stacks. La 2ᵉ app se déploie
donc comme une **stack Portainer distincte**, à côté de la stack jonglerie.

### 9.1 Ce qui diffère de la stack jonglerie

En partant du `docker-compose.prod.yml` actuel (jonglerie), tout doit être **distinct** pour éviter
les collisions :

| Aspect                         | Jonglerie (existant)                        | 2ᵉ app (nouveau)                                       |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------ |
| `container_name`               | `convention-db-prod`, `convention-app-prod` | `autre-db-prod`, `autre-app-prod`                      |
| Volume MySQL                   | `mysql_data`                                | `autre_mysql_data`                                     |
| Port DB hôte                   | `3309:3306`                                 | autre port libre, ex. `3310:3306`                      |
| Chemins hôte (uploads/backups) | `…/convention-de-jonglerie-prod/…`          | `…/autre-domaine-prod/…`                               |
| Base / `DATABASE_URL`          | base A (`database-prod`)                    | base B (`autre-db-prod`)                               |
| `stack.env` (Portainer)        | propre                                      | propre                                                 |
| Hostname reverse-proxy         | `jonglerie.…`                               | `autre.…`                                              |
| Réseau                         | `proxy-network` (externe)                   | **même** `proxy-network` (le proxy route par hostname) |

> Le réseau `proxy-network` externe **reste partagé** : c'est le reverse-proxy commun qui aiguille
> vers la bonne app selon le hostname. Tout le reste (conteneurs, volumes, base) est cloisonné.

### 9.2 Exemple `apps/autre-domaine/docker-compose.prod.yml`

```yaml
services:
  database-prod:
    image: mysql:8.0
    container_name: autre-db-prod
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpassword}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-autre_db}
      MYSQL_USER: ${MYSQL_USER:-autre_user}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-autre_password}
    volumes:
      - autre_mysql_data:/var/lib/mysql
    ports:
      - '3310:3306' # port hôte distinct de la jonglerie (3309)
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      timeout: 2s
      interval: 3s
      retries: 15
      start_period: 5s

  app-prod:
    # Option A (recommandée) : image prébuildée tirée d'un registry (voir §9.3)
    image: ${APP_IMAGE:-registry.example.com/cdj/app-autre:latest}
    # Option B (build sur l'hôte) : décommenter, contexte = racine du monorepo
    # build:
    #   context: ../..            # racine monorepo (accès aux layers/)
    #   dockerfile: apps/autre-domaine/Dockerfile
    #   target: runtime
    container_name: autre-app-prod
    restart: unless-stopped
    env_file:
      - stack.env
    environment:
      DATABASE_URL: 'mysql://${MYSQL_USER:-autre_user}:${MYSQL_PASSWORD:-autre_password}@autre-db-prod:3306/${MYSQL_DATABASE:-autre_db}'
      NUXT_HOST: '0.0.0.0'
      NUXT_PORT: '3000'
      NODE_ENV: 'production'
    volumes:
      - /home/powange/docker_workspaces/autre-domaine-prod/backups:/app/backups
      - /home/powange/docker_workspaces/autre-domaine-prod/uploads_data:/app/public/uploads
      - /home/powange/docker_workspaces/autre-domaine-prod/uploads:/uploads
    depends_on:
      database-prod:
        condition: service_healthy

volumes:
  autre_mysql_data:
    driver: local

networks:
  default:
    external: true
    name: proxy-network
```

### 9.3 Flux registry / Portainer / webhook (recommandé)

Comme le déploiement actuel passe par un **webhook Portainer**, le modèle « image prébuildée +
registry » colle le mieux : la stack ne **build** pas, elle **pull** son image.

```
push sur main (monorepo)
        │
        ▼
   CI (matrice par app, étape 3 §8)
        │  build de l'image @cdj/app-autre  (contexte = racine monorepo → layers inclus)
        ▼
   Registry (ghcr / registry privé)  →  registry.example.com/cdj/app-autre:latest
        │
        ▼
   Webhook Portainer de la stack B  →  re-pull image + recreate  →  autre-app-prod
        │
        ▼
   entrypoint.sh  →  prisma migrate deploy (base B)  →  node .output/server/index.mjs
```

- **Un webhook par stack** : celui de la jonglerie et celui de la 2ᵉ app sont indépendants
  (le skill `deploy` cible une stack à la fois).
- L'`entrypoint.sh` (inchangé) applique **les migrations de la 2ᵉ app sur la base B** au démarrage.
- Le `Dockerfile` de la 2ᵉ app (étape 3 §7) a pour **contexte la racine du monorepo** afin
  d'embarquer `layers/` ; l'image finale reste autonome (aucun besoin du monorepo au runtime).

### 9.4 Propagation lors d'une mise à jour de layer

Modifier `layers/volunteers` →

1. la CI rebuild **les deux** images (jonglerie + autre) — le code se propage automatiquement ;
2. on **redéploie chaque stack** (deux webhooks) ;
3. on applique **la migration de chaque base** si le schéma du layer a changé (compromis « bases
   séparées », cf. [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) §6).

C'est l'unique coût récurrent : une mise à jour de module = deux redéploiements, **pas** une
réécriture.

### 9.5 Checklist déploiement 2ᵉ stack

- [ ] `docker-compose.prod.yml` propre (noms, volumes, port DB, chemins hôte distincts).
- [ ] `stack.env` propre (secrets, `DATABASE_URL`, hostname proxy).
- [ ] Image publiée au registry par la CI (ou build contexte = racine monorepo).
- [ ] Stack créée dans Portainer + **webhook dédié**.
- [ ] Migrations appliquées sur la base B au premier démarrage (`entrypoint`).
- [ ] Réseau `proxy-network` rejoint + route reverse-proxy vers le hostname de la 2ᵉ app.

## 10. Première boucle de validation (le vrai test)

1. Créer le squelette + `<Domaine>` 1:1 Event + `prisma:compose` → migration initiale (base B).
2. `extends: ['core', 'volunteers']` + binding des ports (§6).
3. Créer un event de test, ouvrir le module bénévole → **il doit fonctionner tel quel** (formulaire,
   équipes, planning, notifications), sans toucher au layer.
4. Tout point de friction révèle un **couplage résiduel** au domaine jonglerie dans le layer → à
   corriger **dans le layer** (et la correction profite aux deux apps : c'est la propagation
   recherchée).

> C'est l'étape qui **valide** toute la démarche : si le module bénévole tourne dans la 2ᵉ app sans
> modification, la frontière `Event`/ports est correcte.

## 11. Checklist

- [ ] `apps/autre-domaine/` créé, `extends: ['core', 'volunteers']`.
- [ ] `<Domaine>` 1:1 `Event` ; `prisma:compose` ; migration initiale sur base B.
- [ ] Binding des ports (notifications/email/messenger via core ; `OrganizerDirectoryPort` propre).
- [ ] `app.config.ts` (branding) + pages/composants spécifiques.
- [ ] i18n : domaines des layers chargés automatiquement ; domaines propres ajoutés.
- [ ] Dockerfile / compose / `DATABASE_URL` / entrypoint propres ; entrée CI.
- [ ] Boucle de validation : module bénévole fonctionnel **sans** modifier le layer.
