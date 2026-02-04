# Intégration HelloAsso - Documentation

## Vue d'ensemble

L'intégration HelloAsso permet de connecter une édition de convention à une billeterie HelloAsso existante. Cette intégration permet de :

- Configurer la liaison avec un formulaire HelloAsso (événement, billetterie, etc.)
- Récupérer automatiquement les tarifs et options configurés sur HelloAsso
- Tester la connexion avant de sauvegarder la configuration
- Gérer les données de billeterie de manière sécurisée (chiffrement des secrets)

## Architecture

### Structure des fichiers

```
server/
├── api/editions/[id]/ticketing/
│   ├── external/
│   │   ├── index.get.ts             # Récupérer la configuration
│   │   ├── index.post.ts            # Sauvegarder la configuration
│   │   └── index.delete.ts          # Supprimer la configuration
│   ├── helloasso/
│   │   ├── test.post.ts             # Tester la connexion
│   │   └── tiers.get.ts             # Récupérer tarifs et options
├── utils/
│   ├── encryption.ts                # Chiffrement/déchiffrement
│   └── editions/ticketing/
│       └── helloasso.ts             # Utilitaire API HelloAsso

app/pages/editions/[id]/gestion/ticketing/
└── external.vue                      # Interface de configuration

prisma/
└── schema.prisma                     # Modèles de données
```

### Modèles de données

```prisma
model ExternalTicketing {
  id         Int      @id @default(autoincrement())
  editionId  Int      @unique
  provider   TicketingProvider
  status     TicketingStatus @default(ACTIVE)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  edition           Edition            @relation(fields: [editionId], references: [id], onDelete: Cascade)
  helloAssoConfig   HelloAssoConfig?
}

model HelloAssoConfig {
  id                 Int      @id @default(autoincrement())
  externalTicketingId Int     @unique
  clientId           String
  clientSecret       String   // Chiffré
  organizationSlug   String
  formType           String
  formSlug           String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  externalTicketing ExternalTicketing @relation(fields: [externalTicketingId], references: [id], onDelete: Cascade)
}
```

## Configuration

### Variables d'environnement

Ajoutez les variables suivantes dans votre fichier `.env` :

```bash
# Chiffrement des données sensibles (obligatoire)
ENCRYPTION_SECRET="your-strong-random-secret-key-min-32-chars"
ENCRYPTION_SALT="your-random-salt-value"

# URL de l'API HelloAsso (optionnel, par défaut: https://api.helloasso.com)
HELLOASSO_API_URL="https://api.helloasso.com"
```

⚠️ **Important** :

- `ENCRYPTION_SECRET` doit faire au minimum 32 caractères
- `ENCRYPTION_SALT` doit être une valeur aléatoire unique
- Ne jamais commiter ces valeurs dans le repository

### Docker Compose

Les variables sont déjà configurées dans `docker-compose.dev.yml` :

```yaml
environment:
  ENCRYPTION_SECRET: '${ENCRYPTION_SECRET:-change-this-to-a-strong-random-secret-key-min-32-chars}'
  ENCRYPTION_SALT: '${ENCRYPTION_SALT:-change-this-salt-to-random-value}'
  HELLOASSO_API_URL: '${HELLOASSO_API_URL:-https://api.helloasso.com}'
```

## Obtenir les credentials HelloAsso

### 1. Créer un compte API HelloAsso

Pour obtenir vos identifiants API HelloAsso, suivez le guide officiel :

👉 **[Comment fonctionne l'API HelloAsso ?](https://centredaide.helloasso.com/association?question=comment-fonctionne-l-api-helloasso)**

Ce guide explique comment :

1. Activer l'API pour votre association
2. Créer un client API
3. Obtenir votre **Client ID** et **Client Secret**
4. Gérer les permissions

### 2. Identifier votre formulaire

Pour configurer l'intégration, vous avez besoin de trois informations :

- **Organization Slug** : le slug de votre association (visible dans l'URL)
- **Form Type** : le type de formulaire (Event, Ticketing, Membership, Donation, etc.)
- **Form Slug** : le slug de votre formulaire (visible dans l'URL)

Exemple d'URL HelloAsso :

```
https://www.helloasso.com/associations/juggling-convention/evenements/billeterie-de-test
                                      └─organization-slug─┘ └formType┘ └─form-slug──┘
```

## Utilisation

### Interface utilisateur

#### 1. Accéder à la configuration

1. Allez sur la page de gestion de l'édition : `/editions/{id}/gestion`
2. Cliquez sur "Lier une billeterie externe"
3. Vous arrivez sur la page de configuration HelloAsso

#### 2. Configurer la connexion

Remplissez les champs suivants :

- **Client ID** : Votre Client ID HelloAsso
- **Client Secret** : Votre Client Secret HelloAsso
- **Slug de l'organisation** : Le slug de votre association
- **Type de formulaire** : Sélectionnez le type (Événement, Billetterie, etc.)
- **Slug du formulaire** : Le slug de votre formulaire

#### 3. Tester la connexion

Avant de sauvegarder, cliquez sur "Tester la connexion" pour vérifier que :

- Les credentials sont valides
- Le formulaire est accessible
- Les permissions sont correctes

#### 4. Sauvegarder

Une fois le test réussi, cliquez sur "Enregistrer la configuration".

⚠️ **Note** : Le Client Secret est chiffré avant d'être stocké en base de données.

#### 5. Charger les tarifs et options

Une fois la configuration enregistrée, vous pouvez :

- Cliquer sur "Charger depuis HelloAsso" pour récupérer les tarifs et options
- Visualiser les tarifs disponibles avec leurs prix
- Voir les options configurées (champs personnalisés)

## API

### Endpoints disponibles

#### GET `/api/editions/:id/ticketing/external`

Récupère la configuration de billeterie externe d'une édition.

**Permissions** : Lecture de l'édition

**Réponse** :

```json
{
  "hasConfig": true,
  "config": {
    "id": 1,
    "provider": "HELLOASSO",
    "status": "ACTIVE",
    "helloAssoConfig": {
      "id": 1,
      "clientId": "abc123",
      "organizationSlug": "juggling-convention",
      "formType": "Event",
      "formSlug": "billeterie-2025"
    }
  }
}
```

⚠️ **Note** : Le `clientSecret` n'est jamais retourné par l'API.

#### POST `/api/editions/:id/ticketing/external`

Crée ou met à jour la configuration de billeterie externe.

**Permissions** : Gestion des bénévoles de l'édition

**Body** :

```json
{
  "provider": "HELLOASSO",
  "helloAsso": {
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "organizationSlug": "juggling-convention",
    "formType": "Event",
    "formSlug": "billeterie-2025"
  }
}
```

**Réponse** :

```json
{
  "success": true,
  "message": "Configuration HelloAsso créée",
  "config": { ... }
}
```

#### POST `/api/editions/:id/ticketing/helloasso/test`

Teste la connexion à HelloAsso sans sauvegarder.

**Permissions** : Authentifié

**Body** :

```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "organizationSlug": "juggling-convention",
  "formType": "Event",
  "formSlug": "billeterie-2025"
}
```

**Réponse** :

```json
{
  "success": true,
  "message": "Connexion réussie",
  "form": {
    "name": "Billeterie de test",
    "organizationName": "Juggling Convention",
    "state": "Draft",
    "formType": "Event"
  }
}
```

#### GET `/api/editions/:id/ticketing/helloasso-tiers`

Récupère les tarifs et options depuis HelloAsso.

**Permissions** : Lecture de l'édition

**Réponse** :

```json
{
  "success": true,
  "form": {
    "name": "Billeterie de test",
    "organizationName": "Juggling Convention",
    "state": "Draft"
  },
  "tiers": [
    {
      "id": 1,
      "name": "Pass 3 jours",
      "description": "Accès complet 3 jours",
      "price": 3000,
      "isActive": true
    }
  ],
  "options": [
    {
      "id": 1,
      "name": "Taille de t-shirt",
      "type": "Choice",
      "isRequired": false,
      "choices": ["S", "M", "L", "XL"]
    }
  ]
}
```

⚠️ **Note** : Le prix est en centimes (3000 = 30,00 €).

### Utilisation de l'utilitaire

L'utilitaire `server/utils/editions/ticketing/helloasso.ts` fournit des fonctions réutilisables :

```typescript
import {
  getHelloAssoAccessToken,
  getHelloAssoForm,
  testHelloAssoConnection,
  getHelloAssoTiersAndOptions,
} from '#server/utils/editions/ticketing/helloasso'

// Obtenir un token OAuth2
const token = await getHelloAssoAccessToken({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
})

// Récupérer un formulaire
const form = await getHelloAssoForm(token, {
  organizationSlug: 'juggling-convention',
  formType: 'Event',
  formSlug: 'billeterie-2025',
})

// Tester une connexion
const result = await testHelloAssoConnection(
  { clientId: '...', clientSecret: '...' },
  { organizationSlug: '...', formType: '...', formSlug: '...' }
)

// Récupérer tarifs et options
const data = await getHelloAssoTiersAndOptions(
  { clientId: '...', clientSecret: '...' },
  { organizationSlug: '...', formType: '...', formSlug: '...' }
)
```

## Sécurité

### Chiffrement des secrets

Le `clientSecret` HelloAsso est chiffré avant d'être stocké en base de données :

```typescript
import { encrypt, decrypt } from '#server/utils/encryption'

// Chiffrer un secret
const encrypted = encrypt('my-secret-value')

// Déchiffrer un secret
const decrypted = decrypt(encrypted)
```

**Algorithme** : AES-256-GCM avec authentification

**Clé** : Dérivée de `ENCRYPTION_SECRET` et `ENCRYPTION_SALT` via scrypt

### Bonnes pratiques

1. ✅ **Ne jamais** logger ou exposer le `clientSecret`
2. ✅ **Toujours** chiffrer avant de stocker en base
3. ✅ **Utiliser** des variables d'environnement pour les clés
4. ✅ **Vérifier** les permissions avant chaque opération
5. ✅ **Déchiffrer** uniquement quand nécessaire (lors des appels API)

## Gestion des erreurs

### Erreurs courantes

| Code | Message                         | Cause                      | Solution                               |
| ---- | ------------------------------- | -------------------------- | -------------------------------------- |
| 401  | Identifiants invalides          | Client ID/Secret incorrect | Vérifier les credentials sur HelloAsso |
| 403  | Accès refusé                    | Permissions insuffisantes  | Vérifier les permissions du client API |
| 404  | Formulaire introuvable          | Slug incorrect             | Vérifier organization/form/type slugs  |
| 400  | Configuration HelloAsso requise | Body incomplet             | Fournir tous les champs requis         |

### Gestion dans le code

```typescript
try {
  const result = await testHelloAssoConnection(credentials, formIdentifier)
} catch (error) {
  if (error.statusCode === 401) {
    // Identifiants invalides
  } else if (error.statusCode === 404) {
    // Formulaire introuvable
  }
}
```

## Tests

### Migration de la base de données

```bash
npx prisma migrate dev
```

### Tester manuellement

1. Démarrer l'application en développement
2. Se connecter avec un compte ayant les droits de gestion
3. Créer une édition
4. Configurer HelloAsso avec des credentials valides
5. Tester la connexion
6. Charger les tarifs et options

### Variables de test

Pour les tests, vous pouvez utiliser un environnement de sandbox HelloAsso :

```bash
HELLOASSO_API_URL="https://api.sandbox.helloasso.com"
```

## Limitations et notes

### Limitations actuelles

- ❌ Synchronisation automatique des commandes (à venir)
- ❌ Webhooks HelloAsso (à venir)
- ❌ Mise à jour automatique des tarifs (manuel uniquement)
- ❌ Gestion des remboursements (à venir)

### Notes importantes

- Les tarifs sont en **centimes** (diviser par 100 pour afficher en euros)
- Le `clientSecret` n'est **jamais** retourné par l'API après sauvegarde
- Les options sont dans le champ `extraOptions` de chaque tarif
- Seul le provider `HELLOASSO` est supporté pour le moment

## Support

### Documentation HelloAsso

- [API Documentation](https://api.helloasso.com/v5/swagger/index.html)
- [Guide OAuth2](https://dev.helloasso.com/docs/authentication)
- [Types de formulaires](https://dev.helloasso.com/docs/forms)

### Ressources internes

- Code source : `server/utils/editions/ticketing/helloasso.ts`
- Tests : À venir
- Issues : [GitHub Repository](https://github.com/powange/convention-de-jonglerie/issues)

## Roadmap

### Prochaines fonctionnalités

- [ ] Synchronisation automatique des commandes
- [ ] Webhooks pour les nouveaux achats
- [ ] Gestion des participants (nom, email, etc.)
- [ ] Statistiques de billeterie
- [ ] Export des données
- [ ] Support d'autres providers (Billetweb, Weezevent, etc.)
