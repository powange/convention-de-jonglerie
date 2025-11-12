# Système de cache et retry pour le chargement des images

## Problème résolu

Les images de profil provenant de Google (`lh3.googleusercontent.com`) génèrent souvent des erreurs 429 (Too Many Requests) en raison du rate limiting imposé par Google. Cela se produit lorsque :

- Plusieurs utilisateurs ont des photos Google
- Les images sont rechargées fréquemment
- Beaucoup d'avatars sont affichés en même temps (ex: liste de bénévoles)

## Solution implémentée

Un système de cache côté client avec fallback automatique qui :

1. **Détecte les images externes problématiques** (Google, etc.)
2. **Met en cache les résultats** (succès ou échec) dans le localStorage
3. **Utilise un fallback automatique** si l'image échoue
4. **Évite les requêtes répétées** aux URLs qui échouent

## Architecture

### Composable `useImageLoader`

**Fichier :** `app/composables/useImageLoader.ts`

**Fonctionnalités :**

- Cache dans localStorage avec durée de vie de 24h
- Détection automatique des erreurs de chargement
- Fallback immédiat vers une URL alternative
- Nettoyage automatique des entrées expirées

**Structure du cache :**

```typescript
{
  [url: string]: {
    status: 'success' | 'error'
    timestamp: number
    fallbackUrl?: string
  }
}
```

### Composant `UserAvatar`

**Fichier :** `app/components/ui/UserAvatar.vue`

**Modifications :**

- Détection des images externes (non-Gravatar, non-data:)
- Utilisation du `useImageLoader` uniquement pour les images externes
- Génération automatique d'une URL de fallback (initiales ou Gravatar)
- Affichage transparent pour l'utilisateur

## Flux de fonctionnement

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Chargement d'un avatar avec URL Google                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Vérification du cache localStorage                       │
│    - Entrée trouvée et valide (< 24h) ?                    │
└─────────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼ OUI                       ▼ NON
┌───────────────────────┐   ┌─────────────────────────┐
│ Utiliser le résultat  │   │ Essayer de charger      │
│ du cache :            │   │ l'image                 │
│ - success → image     │   └─────────────────────────┘
│ - error → fallback    │               │
└───────────────────────┘               │
                          ┌─────────────┴─────────────┐
                          │                           │
                          ▼ Succès                    ▼ Échec (429, etc.)
              ┌───────────────────────┐   ┌─────────────────────────┐
              │ Afficher l'image      │   │ Afficher le fallback    │
              │ Mettre en cache       │   │ (initiales/Gravatar)    │
              │ (success)             │   │ Mettre en cache (error) │
              └───────────────────────┘   └─────────────────────────┘
```

## Types de fallback

Selon les données de l'utilisateur, le fallback suit cet ordre :

1. **Avatar avec initiales** (si pseudo disponible)
   - SVG généré dynamiquement
   - Couleur basée sur le pseudo
   - Initiales du pseudo/nom

2. **Gravatar** (si emailHash disponible)
   - Service Gravatar avec fallback "mystery person"

3. **Avatar par défaut** (dernier recours)
   - Initiales "?" ou image Gravatar par défaut

## Avantages

✅ **Performance** : Les images qui échouent ne sont pas rechargées pendant 24h
✅ **Expérience utilisateur** : Affichage immédiat du fallback au lieu d'images cassées
✅ **Réduction des erreurs** : Moins d'erreurs 429 visibles dans la console
✅ **Cohérence visuelle** : Les avatars avec initiales sont cohérents avec le design
✅ **Automatique** : Pas besoin de configuration, fonctionne pour toutes les images externes

## Inconvénients et limitations

⚠️ **Les vraies photos Google ne sont pas affichées** : Si une image Google échoue une fois, elle ne sera plus retentée pendant 24h
⚠️ **Dépendance au localStorage** : Ne fonctionne que côté client (pas de SSR pour ce cache)
⚠️ **Espace localStorage** : Le cache peut grossir avec le temps (nettoyage automatique après 24h)

## Améliorations futures possibles

1. **Téléchargement et stockage local** : Lors de l'OAuth Google, télécharger et stocker l'image en local
2. **Proxy via Nuxt Image** : Utiliser un proxy pour mettre en cache les images Google côté serveur
3. **Retry progressif** : Réessayer après quelques heures au lieu de 24h
4. **API de synchronisation** : Job côté serveur pour télécharger les images Google périodiquement

## Configuration

Le cache est configurable dans `app/composables/useImageLoader.ts` :

```typescript
const CACHE_KEY = 'image-load-cache' // Clé localStorage
const CACHE_DURATION = 24 * 60 * 60 * 1000 // Durée de vie : 24h
```

## Tests

Les tests unitaires existants continuent de fonctionner sans modification :

- `test/unit/utils/avatar.test.ts` (15 tests)
- `test/nuxt/components/ui/UserAvatar.test.ts` (4 tests)

Le système de cache est transparent et n'affecte pas le comportement des tests.
