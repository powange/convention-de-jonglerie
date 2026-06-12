# API publique & tokens d'accès

Cette documentation décrit l'API publique (`/api/public/*`), destinée aux sites
partenaires, ainsi que le système de tokens qui en contrôle l'accès.

## Vue d'ensemble

Les endpoints publics sont authentifiés par un **token d'API** géré depuis
l'administration : **Admin → Tokens d'API publique** (`/admin/api-tokens`,
réservé aux super-admins).

Chaque token peut être **restreint à un sous-ensemble d'endpoints** via son
champ `scopes`. Un même token peut donc donner accès à plusieurs endpoints
publics, ou à un seul, selon les droits cochés à sa création / modification.

## Authentification

Le token peut être transmis de deux façons :

```http
GET /api/public/editions?token=<token>
```

ou via l'en-tête HTTP :

```http
GET /api/public/editions
Authorization: Bearer <token>
```

Réponses d'erreur possibles :

| Statut | Signification                                         |
| ------ | ----------------------------------------------------- |
| `401`  | Token absent, inconnu ou révoqué (`isActive = false`) |
| `403`  | Token valide mais **sans droit** sur cet endpoint     |

À chaque appel réussi, le champ `lastUsedAt` du token est mis à jour.

## Endpoints disponibles

La liste des endpoints publics est centralisée dans **un seul fichier** :
[`server/utils/public-api-endpoints.ts`](../server/utils/public-api-endpoints.ts).

| Clé          | Méthode | Chemin                   | Description                                                                       |
| ------------ | ------- | ------------------------ | --------------------------------------------------------------------------------- |
| `editions`   | `GET`   | `/api/public/editions`   | Liste des éditions publiées à venir (statut `PUBLISHED`, `endDate >= maintenant`) |
| `error-logs` | `GET`   | `/api/public/error-logs` | Erreurs d'API **non résolues** (`resolved = false`), pour la supervision externe  |

### `GET /api/public/error-logs`

Renvoie les erreurs d'API non résolues (équivalent du filtre « non résolues » de
`/admin/error-logs`), pour le monitoring partenaire.

⚠️ **Données exposées volontairement limitées** : l'endpoint étant public, seuls des
champs **non sensibles** sont renvoyés. Sont **exclus** : IP, user-agent, utilisateur
(email/pseudo), corps de requête, en-têtes, stack trace, referer, origine, paramètres
de requête, notes d'admin.

Champs renvoyés par log : `id`, `message`, `statusCode`, `errorType`, `method`,
`path`, `createdAt`.

Paramètres de requête :

| Param    | Défaut | Description                                                                           |
| -------- | ------ | ------------------------------------------------------------------------------------- |
| `limit`  | `100`  | Nombre maximum d'entrées (max `500`)                                                  |
| `cursor` | —      | `id` du dernier log de la page précédente (pagination par curseur)                    |
| `since`  | —      | Date ISO ; ne renvoie que les erreurs créées après cette date (idéal pour du polling) |

Réponse :

```json
{
  "logs": [
    {
      "id": "clx...",
      "message": "…",
      "statusCode": 500,
      "errorType": "DatabaseError",
      "method": "POST",
      "path": "/api/editions",
      "createdAt": "2026-06-12T10:00:00.000Z"
    }
  ],
  "pagination": { "cursor": "clx...", "hasMore": true, "limit": 100, "total": 42 }
}
```

## Modèle de données : `ApiToken`

```prisma
model ApiToken {
  id          Int       @id @default(autoincrement())
  name        String    // libellé du partenaire
  token       String    @unique
  isActive    Boolean   @default(true)
  scopes      Json?     // tableau des clés d'endpoints autorisés ; null = tous
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
  createdById Int?
  createdBy   User?     @relation(fields: [createdById], references: [id])
}
```

### Sémantique du champ `scopes`

- **`null`** → le token a accès à **tous** les endpoints publics.
  C'est la valeur des tokens créés avant l'introduction des scopes
  (rétrocompatibilité : aucun token existant n'est cassé).
- **Tableau de clés** (ex. `["editions"]`) → accès **uniquement** aux endpoints
  listés.
- **Tableau vide** (`[]`) → le token n'a accès à **aucun** endpoint.

Les tokens créés depuis l'administration enregistrent toujours un tableau
explicite (par défaut, tous les endpoints sont cochés).

## Ajouter un nouvel endpoint public

1. **Déclarer** l'endpoint dans le registre
   [`server/utils/public-api-endpoints.ts`](../server/utils/public-api-endpoints.ts) :

   ```ts
   export const PUBLIC_API_ENDPOINTS = [
     { key: 'editions', method: 'GET', path: '/api/public/editions' },
     { key: 'conventions', method: 'GET', path: '/api/public/conventions' }, // nouvel endpoint
   ] as const
   ```

2. **Protéger** l'endpoint avec le helper, en passant sa `key` :

   ```ts
   // server/api/public/conventions.get.ts
   import { wrapApiHandler } from '#server/utils/api-helpers'
   import { requireApiToken } from '#server/utils/public-api-auth'

   export default wrapApiHandler(
     async (event) => {
       await requireApiToken(event, 'conventions')
       // ... logique de l'endpoint (le token est déjà validé et autorisé)
     },
     { operationName: 'GetPublicConventions' }
   )
   ```

3. **Ajouter le libellé i18n** (français) sous
   `admin.api_tokens.endpoints.<key>` dans `i18n/locales/fr/admin.json` :

   ```json
   "endpoints": {
     "editions": "Liste des éditions à venir",
     "conventions": "Liste des conventions"
   }
   ```

L'administration proposera automatiquement le nouvel endpoint dans les cases à
cocher (création et édition d'un token). Les tokens existants avec `scopes = null`
y auront immédiatement accès ; les tokens à scopes explicites devront être
modifiés pour cocher le nouvel endpoint.

## Fichiers concernés

- [`server/utils/public-api-endpoints.ts`](../server/utils/public-api-endpoints.ts) — registre des endpoints
- [`server/utils/public-api-auth.ts`](../server/utils/public-api-auth.ts) — helper `requireApiToken`
- [`server/api/public/`](../server/api/public/) — endpoints publics
- [`server/api/admin/api-tokens/`](../server/api/admin/api-tokens/) — gestion des tokens (CRUD)
- [`app/pages/admin/api-tokens.vue`](../app/pages/admin/api-tokens.vue) — interface d'administration
