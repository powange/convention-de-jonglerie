# Système de Logs d'Erreurs API

## Vue d'ensemble

Le système de logs d'erreurs API permet de surveiller, analyser et résoudre les erreurs qui se produisent dans l'application. Il capture automatiquement toutes les erreurs de l'API et les stocke dans la base de données avec des informations contextuelles détaillées.

## Fonctionnalités

### 🔍 **Capture Automatique**

- Intercepte toutes les erreurs HTTP (4xx, 5xx) sur les routes `/api/*`
- Capture les informations de contexte (utilisateur, IP, headers, body)
- Classification automatique par type d'erreur (validation, base de données, auth, etc.)

### 🛡️ **Sécurité et Confidentialité**

- Nettoyage automatique des données sensibles (mots de passe, tokens, etc.)
- Anonymisation des emails (garde seulement le domaine)
- Limitation de la stack trace à 20 lignes
- Headers sensibles masqués (`authorization`, `cookie`, etc.)

### 📊 **Interface d'Administration**

- Dashboard avec statistiques en temps réel
- Filtrage par statut, type d'erreur, chemin API
- Recherche textuelle dans les messages d'erreur
- Pagination et tri des résultats

### ✅ **Gestion des Résolutions**

- Marquer les erreurs comme résolues/non résolues
- Ajouter des notes administrateur
- Suivi des résolutions avec horodatage

## Architecture

### Modèle de Données (`ApiErrorLog`)

```typescript
{
  id: string              // ID unique
  message: string         // Message d'erreur
  statusCode: number      // Code HTTP (400, 500, etc.)
  stack?: string          // Stack trace nettoyée
  errorType?: string      // Type classifié (ValidationError, DatabaseError, etc.)

  // Contexte de la requête
  method: string          // GET, POST, PUT, DELETE
  url: string             // URL complète
  path: string            // Chemin sans query params
  userAgent?: string      // User-Agent du client
  ip?: string             // Adresse IP du client

  // Données de la requête (nettoyées)
  headers?: Json          // Headers HTTP (sans données sensibles)
  body?: Json             // Corps de la requête (sans données sensibles)
  queryParams?: Json      // Paramètres de requête

  // Informations utilisateur
  userId?: number         // ID de l'utilisateur connecté

  // Gestion des résolutions
  resolved: boolean       // Marqué comme résolu
  resolvedBy?: number     // ID de l'admin qui a résolu
  resolvedAt?: DateTime   // Date de résolution
  adminNotes?: string     // Notes administrateur

  // Timestamps
  createdAt: DateTime     // Date de création
  updatedAt: DateTime     // Date de modification
}
```

### Composants

1. **`server/utils/error-logger.ts`** - Utilitaire de logging
2. **`server/plugins/error-logging.ts`** - Plugin global de capture
3. **`server/api/admin/error-logs.get.ts`** - API de consultation
4. **`server/api/admin/error-logs/[id].get.ts`** - Détails d'un log
5. **`server/api/admin/error-logs/[id]/resolve.patch.ts`** - Résolution
6. **`app/pages/admin/error-logs.vue`** - Interface d'administration

## Installation et Configuration

### 1. Migration de la Base de Données

```bash
# Créer et appliquer la migration
npx prisma migrate dev --name add-api-error-logs

# Générer le client Prisma
npx prisma generate
```

### 2. Le plugin est automatiquement chargé

Le plugin `server/plugins/error-logging.ts` est automatiquement chargé par Nuxt et capture toutes les erreurs API.

### 3. Accès à l'Interface Admin

Rendez-vous sur `/admin/error-logs` (réservé aux super-administrateurs).

## Utilisation

### Interface Administrateur

1. **Dashboard** : Statistiques rapides des dernières 24h
2. **Filtres** : Par statut, type d'erreur, chemin API, recherche textuelle
3. **Liste des logs** : Pagination, tri par date/statut/type
4. **Détails** : Clic sur un log pour voir tous les détails
5. **Résolution** : Marquer comme résolu avec notes administrateur

### Classification Automatique

Le système classe automatiquement les erreurs :

- **`ValidationError`** : Erreurs Zod, données invalides
- **`DatabaseError`** : Erreurs Prisma, connexion DB
- **`AuthenticationError`** : Problèmes d'authentification
- **`AuthorizationError`** : Permissions insuffisantes
- **`HttpError`** : Erreurs HTTP génériques
- **`NetworkError`** : Problèmes réseau
- **`FileError`** : Erreurs de fichiers
- **`UnknownError`** : Erreurs non classifiées

### API Endpoints

#### `GET /api/admin/error-logs`

Récupère la liste des logs avec filtres et pagination.

**Paramètres :**

- `page` : Numéro de page (défaut: 1)
- `pageSize` : Taille de page (défaut: 20, max: 100)
- `status` : 'resolved' | 'unresolved'
- `errorType` : Type d'erreur à filtrer
- `path` : Chemin API à filtrer
- `search` : Recherche textuelle

#### `GET /api/admin/error-logs/[id]`

Récupère les détails complets d'un log.

#### `PATCH /api/admin/error-logs/[id]/resolve`

Marque un log comme résolu/non résolu.

**Body :**

```json
{
  "resolved": true,
  "adminNotes": "Erreur corrigée dans la version 1.2.3"
}
```

## Tests et Développement

### Logging Manuel

Pour logger une erreur manuellement dans votre code :

```typescript
import { logApiError } from '@@/server/utils/error-logger'

try {
  // Votre code qui peut échouer
} catch (error) {
  await logApiError({
    error: error as Error,
    statusCode: 500,
    event, // L'event H3 de votre handler
  })
  throw error // Re-lancer l'erreur
}
```

### Wrapper Automatique

Utiliser le wrapper pour capturer automatiquement :

```typescript
import { withErrorLogging } from '@@/server/utils/error-logger'

export default defineEventHandler(
  withErrorLogging(async (event) => {
    // Votre code API
    // Les erreurs seront automatiquement loggées
  })
)
```

## Sécurité et Bonnes Pratiques

### ✅ Ce qui est loggé

- Messages d'erreur
- Stack traces (nettoyées)
- Métadonnées de requête (méthode, URL, IP)
- Paramètres de requête non sensibles
- Headers non sensibles

### ❌ Ce qui n'est PAS loggé

- Mots de passe ou tokens dans le body
- Headers d'authentification
- Cookies de session
- Numéros de téléphone complets
- Emails complets (seulement le domaine)

### Configuration de Sécurité

Les champs sensibles sont définis dans `sanitizeHeaders()` et `sanitizeBody()` :

```typescript
const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'x-session-token']

const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'phone', 'email']
```

## Maintenance

### Nettoyage Automatique

Considérez l'ajout d'un job de nettoyage pour supprimer les anciens logs :

```sql
-- Supprimer les logs résolus de plus de 6 mois
DELETE FROM ApiErrorLog
WHERE resolved = true
AND createdAt < DATE_SUB(NOW(), INTERVAL 6 MONTH);

-- Supprimer les logs non résolus de plus d'un an
DELETE FROM ApiErrorLog
WHERE resolved = false
AND createdAt < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Monitoring

- Surveiller le nombre d'erreurs non résolues
- Alertes sur les pics d'erreurs
- Analyse des tendances par type d'erreur

## Dépannage

### Le plugin ne capture pas les erreurs

1. Vérifiez que le fichier `server/plugins/error-logging.ts` existe
2. Vérifiez que la base de données est connectée
3. Regardez les logs de la console pour des erreurs de logging

### Erreurs de base de données

1. Vérifiez que la migration a été appliquée
2. Vérifiez les permissions de la base de données
3. Le logging continuera dans la console même si la DB échoue

### Performance

Si le logging impacte les performances :

1. Désactivez temporairement dans `server/plugins/error-logging.ts`
2. Optimisez les index de la table `ApiErrorLog`
3. Considérez un système de queue pour le logging asynchrone

## Évolutions Futures

- **Alertes** : Notifications par email/Slack pour les erreurs critiques
- **Graphiques** : Visualisations des tendances d'erreurs
- **Export** : Export CSV/JSON des logs pour analyse externe
- **Intégrations** : Sentry, DataDog, ou autres outils de monitoring
- **API publique** : API pour les développeurs (avec authentification)
