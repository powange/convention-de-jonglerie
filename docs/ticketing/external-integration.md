# Intégration avec les Systèmes de Billeterie Externes

Le système supporte l'intégration avec des plateformes de billeterie externes, principalement **HelloAsso**, pour importer automatiquement les commandes, tarifs et options.

## Plateformes Supportées

### HelloAsso (Implémenté)

Plateforme de paiement en ligne pour associations françaises.

**Site** : https://www.helloasso.com

**API** : https://api.helloasso.com/v5

### Autres Plateformes (À venir)

- Billetweb
- Weezevent
- Autre (configuration générique)

## Modèle de Données

### Table `ExternalTicketing`

```prisma
enum ExternalTicketingProvider {
  HELLOASSO
  BILLETWEB
  WEEZEVENT
  OTHER
}

enum ExternalTicketingStatus {
  ACTIVE
  INACTIVE
  ERROR
}

model ExternalTicketing {
  id         String                     @id @default(cuid())
  editionId  Int                        @unique
  provider   ExternalTicketingProvider
  status     ExternalTicketingStatus    @default(ACTIVE)
  lastSyncAt DateTime?
  createdAt  DateTime                   @default(now())
  updatedAt  DateTime                   @updatedAt

  edition          Edition            @relation(...)
  helloAssoConfig  HelloAssoConfig?
  tiers            TicketingTier[]
  options          TicketingOption[]
  orders           TicketingOrder[]

  @@index([editionId])
  @@index([provider])
  @@index([status])
}
```

### Table `HelloAssoConfig`

```prisma
model HelloAssoConfig {
  id                   String   @id @default(cuid())
  externalTicketingId  String   @unique
  clientId             String
  clientSecret         String   // Chiffré avec AES-256-CBC
  organizationSlug     String
  formType             String   // Event, Membership, Donation
  formSlug             String
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  externalTicketing ExternalTicketing @relation(...)

  @@index([externalTicketingId])
}
```

## Configuration HelloAsso

### 1. Créer une Application HelloAsso

**Étapes** :

1. Se connecter sur https://www.helloasso.com
2. Aller dans "Paramètres" → "API et Webhooks"
3. Créer une nouvelle application
4. Noter le **Client ID** et le **Client Secret**

### 2. Créer un Formulaire

HelloAsso utilise des "formulaires" pour les événements.

**Types de formulaires** :

- `Event` : Événements avec billetterie
- `Membership` : Adhésions
- `Donation` : Collecte de dons
- `PaymentForm` : Paiement générique

**URL du formulaire** :

```
https://www.helloasso.com/associations/{organizationSlug}/{formType}/{formSlug}
```

**Exemple** :

```
https://www.helloasso.com/associations/ma-convention/evenements/edition-2024
```

**Extraction** :

- `organizationSlug` : `ma-convention`
- `formType` : `evenements` → `Event`
- `formSlug` : `edition-2024`

### 3. Configurer dans l'Application

Utilisez la page `external.vue` pour configurer :

1. **Provider** : Sélectionner "HelloAsso"
2. **Client ID** : Coller le Client ID
3. **Client Secret** : Coller le Client Secret
4. **Organization Slug** : `ma-convention`
5. **Form Type** : Sélectionner "Event"
6. **Form Slug** : `edition-2024`
7. **Tester la connexion**
8. **Sauvegarder**

## API Routes

### Récupérer la Configuration

**Route** : `GET /api/editions/:id/ticketing/external`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
{
  config: ExternalTicketing & {
    helloAssoConfig: HelloAssoConfig | null
  }
} | null
```

**Note** : Le `clientSecret` est retourné chiffré.

---

### Créer/Modifier la Configuration

**Route** : `POST /api/editions/:id/ticketing/external`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  provider: 'HELLOASSO' | 'BILLETWEB' | 'WEEZEVENT' | 'OTHER'
  clientId: string
  clientSecret: string
  organizationSlug: string
  formType: 'Event' | 'Membership' | 'Donation' | 'PaymentForm'
  formSlug: string
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  provider: z.enum(['HELLOASSO', 'BILLETWEB', 'WEEZEVENT', 'OTHER']),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.enum(['Event', 'Membership', 'Donation', 'PaymentForm']),
  formSlug: z.string().min(1),
})
```

**Processus** :

1. Chiffre le `clientSecret` avec AES-256-CBC
2. Crée/met à jour `ExternalTicketing`
3. Crée/met à jour `HelloAssoConfig`
4. Définit `status = ACTIVE`

**Réponse** :

```typescript
{
  success: true
  config: ExternalTicketing
}
```

---

### Tester la Connexion

**Route** : `POST /api/editions/:id/ticketing/helloasso/test`

**Permission** : `canAccessEditionData`

**Body** :

```typescript
{
  clientId: string
  clientSecret: string
  organizationSlug: string
  formType: string
  formSlug: string
}
```

**Processus** :

1. Tente une authentification OAuth2
2. Tente de récupérer le formulaire
3. Retourne le résultat

**Réponse (Succès)** :

```typescript
{
  success: true
  message: 'Connexion réussie'
  formName: string
  formUrl: string
}
```

**Réponse (Erreur)** :

```typescript
{
  success: false
  message: 'Erreur: description'
}
```

**Erreurs possibles** :

- `401` : Credentials invalides
- `404` : Formulaire non trouvé
- `500` : Erreur API HelloAsso

---

### Supprimer la Configuration

**Route** : `DELETE /api/editions/:id/ticketing/external`

**Permission** : `canManageEditionVolunteers`

**Processus** :

1. Supprime `ExternalTicketing` (cascade supprime aussi la config HelloAsso)
2. **Ne supprime PAS** les tarifs, options et commandes synchronisés

**Réponse** :

```typescript
{
  success: true
  message: 'Configuration supprimée'
}
```

**Note** : Les données synchronisées (tarifs, options, commandes) restent en base et deviennent "manuelles".

---

## Authentification HelloAsso

### OAuth 2.0 Client Credentials Flow

HelloAsso utilise OAuth 2.0 pour l'authentification.

**Endpoint** : `POST https://api.helloasso.com/oauth2/token`

**Body** :

```
grant_type=client_credentials
&client_id={clientId}
&client_secret={clientSecret}
```

**Réponse** :

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

**Utilisation** :

```typescript
const response = await fetch('https://api.helloasso.com/v5/...', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
```

### Implémentation

**Fichier** : `server/utils/editions/ticketing/helloasso.ts`

```typescript
async function authenticate(clientId: string, clientSecret: string) {
  const response = await fetch('https://api.helloasso.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    throw new Error('Authentication failed')
  }

  const { access_token } = await response.json()
  return access_token
}
```

---

## Synchronisation des Données

### Récupérer les Tarifs et Options

**Route** : `GET /api/editions/:id/ticketing/helloasso/tiers`

**Processus** :

1. Récupère la configuration
2. Déchiffre le `clientSecret`
3. Authentifie avec HelloAsso
4. Récupère le formulaire :
   ```
   GET /v5/organizations/{slug}/forms/{formType}/{formSlug}
   ```
5. Extrait les tarifs (`tiers`) et options (`customFields`)
6. Synchronise en base :
   - Crée/met à jour `TicketingTier`
   - Crée/met à jour `TicketingOption`

**Réponse** :

```typescript
{
  tiers: TicketingTier[]
  options: TicketingOption[]
}
```

### Récupérer les Commandes

**Route** : `GET /api/editions/:id/ticketing/helloasso/orders`

**Processus** :

1. Récupère la configuration
2. Déchiffre le `clientSecret`
3. Authentifie avec HelloAsso
4. Récupère les commandes :
   ```
   GET /v5/organizations/{slug}/forms/{formType}/{formSlug}/orders
   ```
5. Pour chaque commande :
   - Crée/met à jour `TicketingOrder`
   - Pour chaque item :
     - Cherche le tarif correspondant
     - Crée/met à jour `TicketingOrderItem`
     - Génère un QR code si absent

**Réponse** :

```typescript
{
  orders: TicketingOrder[]
  stats: {
    totalOrders: number
    totalItems: number
  }
}
```

---

## Chiffrement des Secrets

### Algorithme

**AES-256-CBC** avec clé dérivée de `ENCRYPTION_KEY` (variable d'environnement).

**Fichier** : `server/utils/encryption.ts`

### Fonctions

#### `encrypt(text: string): string`

Chiffre une chaîne et retourne le résultat en format `iv:encrypted`.

```typescript
const encrypted = encrypt(clientSecret)
// Retourne: "1a2b3c4d5e6f:9g8h7i6j5k4l3m2n..."
```

#### `decrypt(encryptedText: string): string`

Déchiffre une chaîne au format `iv:encrypted`.

```typescript
const decrypted = decrypt(encrypted)
// Retourne: clientSecret original
```

### Configuration

**Variable d'environnement** : `ENCRYPTION_KEY`

**Génération** :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Fichier `.env`** :

```
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

## Composants Vue

### Configuration HelloAsso

**Page** : `app/pages/editions/[id]/gestion/ticketing/external.vue`

**Sections** :

#### 1. Configuration Initiale (si non configuré)

```vue
<UCard>
  <h2>Configurer la billeterie externe</h2>

  <UFormField label="Provider">
    <USelect v-model="provider" :options="providers" />
  </UFormField>

  <template v-if="provider === 'HELLOASSO'">
    <UFormField label="Client ID">
      <UInput v-model="clientId" />
    </UFormField>

    <UFormField label="Client Secret">
      <UInput v-model="clientSecret" type="password" />
    </UFormField>

    <UFormField label="Organization Slug">
      <UInput v-model="organizationSlug" />
    </UFormField>

    <UFormField label="Form Type">
      <USelect v-model="formType" :options="formTypes" />
    </UFormField>

    <UFormField label="Form Slug">
      <UInput v-model="formSlug" />
    </UFormField>
  </template>

  <UButton @click="testConnection">
    Tester la connexion
  </UButton>

  <UButton @click="saveConfiguration" color="primary">
    Sauvegarder
  </UButton>
</UCard>
```

#### 2. Gestion (si configuré)

```vue
<UCard>
  <h2>Billeterie HelloAsso</h2>

  <UBadge :color="config.status === 'ACTIVE' ? 'green' : 'red'">
    {{ config.status }}
  </UBadge>

  <p>Dernière synchro: {{ formatDate(config.lastSyncAt) }}</p>

  <UButton @click="syncTiers">
    Synchroniser les tarifs
  </UButton>

  <UButton @click="syncOrders">
    Synchroniser les commandes
  </UButton>

  <UButton @click="editConfiguration">
    Modifier la configuration
  </UButton>

  <UButton @click="deleteConfiguration" color="red">
    Supprimer la configuration
  </UButton>
</UCard>
```

#### 3. Affichage des Tarifs et Options

```vue
<UCard>
  <h3>Tarifs synchronisés</h3>
  <TiersList :tiers="tiers" :read-only="true" />
</UCard>

<UCard>
  <h3>Options synchronisées</h3>
  <OptionsList :options="options" :read-only="true" />
</UCard>
```

#### 4. Affichage des Commandes

```vue
<UCard>
  <h3>Commandes importées</h3>
  <OrdersList :orders="orders" />
</UCard>
```

---

## Cas d'Usage

### 1. Configuration Initiale

```typescript
// 1. Tester la connexion
const testResult = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/test`, {
  method: 'POST',
  body: {
    clientId: 'abc123',
    clientSecret: 'secret456',
    organizationSlug: 'ma-convention',
    formType: 'Event',
    formSlug: 'edition-2024',
  },
})

if (testResult.success) {
  // 2. Sauvegarder la configuration
  await $fetch(`/api/editions/${editionId}/ticketing/external`, {
    method: 'POST',
    body: {
      provider: 'HELLOASSO',
      clientId: 'abc123',
      clientSecret: 'secret456',
      organizationSlug: 'ma-convention',
      formType: 'Event',
      formSlug: 'edition-2024',
    },
  })

  toast.add({ title: 'Configuration sauvegardée' })
}
```

### 2. Synchroniser les Tarifs

```typescript
const { tiers, options } = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/tiers`)

console.log(`${tiers.length} tarifs, ${options.length} options`)
```

### 3. Synchroniser les Commandes

```typescript
const { orders, stats } = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/orders`)

console.log(`${stats.totalOrders} commandes, ${stats.totalItems} participants`)
```

### 4. Modifier la Configuration

```typescript
// Récupérer la config actuelle
const { config } = await $fetch(`/api/editions/${editionId}/ticketing/external`)

// Modifier
await $fetch(`/api/editions/${editionId}/ticketing/external`, {
  method: 'POST',
  body: {
    ...config.helloAssoConfig,
    formSlug: 'edition-2025', // Nouveau slug
  },
})
```

### 5. Supprimer la Configuration

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/external`, { method: 'DELETE' })

toast.add({ title: 'Configuration supprimée' })
```

---

## Bonnes Pratiques

### 1. Tester Avant de Sauvegarder

Utilisez toujours `/helloasso/test` avant de sauvegarder la configuration.

### 2. Synchronisation Régulière

Synchronisez les commandes régulièrement :

- Pendant la période de vente : Toutes les heures
- Le jour J : Toutes les 10-15 minutes

### 3. Gestion des Erreurs

Si la synchronisation échoue :

- Marquez `status = ERROR`
- Loguez l'erreur
- Notifiez les organisateurs

### 4. Sécurité des Secrets

- Ne jamais logger le `clientSecret` en clair
- Toujours le chiffrer avant stockage
- Limiter l'accès aux routes de configuration

### 5. Migration de Formulaire

Si vous changez de formulaire HelloAsso :

1. Synchronisez d'abord les nouvelles commandes
2. Ne supprimez pas l'ancienne configuration tant que les données ne sont pas migrées

---

## Dépannage

### Erreur "Authentication failed"

**Cause** : Credentials invalides
**Solution** : Vérifier le Client ID et Client Secret dans HelloAsso.

### Erreur "Form not found"

**Cause** : Formulaire inexistant ou slug incorrect
**Solution** : Vérifier l'URL du formulaire et extraire les bons slugs.

### Les tarifs ne se synchronisent pas

**Cause** : Le formulaire n'a pas de tarifs définis
**Solution** : Créer des tarifs dans HelloAsso avant de synchroniser.

### Les commandes ne remontent pas

**Causes possibles** :

- Aucune commande n'a été passée
- Filtres de statut (seules les commandes "Processed" sont synchronisées)

**Solution** : Vérifier dans HelloAsso qu'il y a bien des commandes.

### QR codes manquants

**Cause** : Ancien système HelloAsso sans QR codes
**Solution** : Les QR codes sont générés automatiquement lors de la synchronisation s'ils sont absents.

---

## API HelloAsso - Référence

### Endpoints Utilisés

#### Authentification

```
POST https://api.helloasso.com/oauth2/token
```

#### Récupérer un Formulaire

```
GET https://api.helloasso.com/v5/organizations/{slug}/forms/{formType}/{formSlug}
```

**Réponse** :

```json
{
  "formSlug": "edition-2024",
  "title": "Édition 2024",
  "tiers": [
    {
      "id": 123,
      "label": "Adulte",
      "amount": 2500
    }
  ],
  "customFields": [
    {
      "id": "cf_123",
      "name": "Régime alimentaire",
      "type": "ChoiceList"
    }
  ]
}
```

#### Récupérer les Commandes

```
GET https://api.helloasso.com/v5/organizations/{slug}/forms/{formType}/{formSlug}/orders
```

**Query Params** :

- `pageIndex` : Index de la page (défaut: 1)
- `pageSize` : Taille de la page (défaut: 20, max: 100)

**Réponse** : Voir [orders.md](./orders.md#structure-des-données-helloasso)

---

## Voir Aussi

- [Documentation HelloAsso](../helloasso-integration.md) - Intégration complète
- [Tarifs](./tiers.md) - Synchronisation des tarifs
- [Options](./options.md) - Synchronisation des options
- [Commandes](./orders.md) - Synchronisation des commandes
- [Encryption](../../server/utils/encryption.ts) - Utilitaire de chiffrement
