# Lazy Loading des Traductions i18n

## Vue d'ensemble

Le système de traductions a été optimisé pour charger les fichiers de traduction à la demande (lazy loading), réduisant ainsi la taille du bundle initial et améliorant les performances.

## Structure des fichiers

Les traductions sont maintenant organisées par domaine fonctionnel :

```
i18n/locales/
├── en/
│   ├── common.json       # Traductions communes (toujours chargées)
│   ├── components.json   # Composants UI (toujours chargés)
│   ├── app.json          # PWA et services (toujours chargés)
│   ├── public.json       # Pages publiques (toujours chargées)
│   ├── admin.json        # Administration (chargé sur /admin)
│   ├── edition.json      # Éditions et conventions (chargé sur /editions)
│   └── auth.json         # Authentification (chargé sur /auth, /login, etc.)
├── fr/
│   └── ... (même structure)
└── ... (autres langues)
```

## Fichiers chargés par défaut

Ces fichiers sont automatiquement chargés au démarrage de l'application :

- `common.json` : Traductions de base (navigation, footer, erreurs, validation, etc.)
- `components.json` : Composants UI réutilisables
- `app.json` : Configuration PWA et services
- `public.json` : Pages publiques (homepage, SEO, etc.)

## Fichiers chargés à la demande

Ces fichiers sont chargés uniquement lorsque l'utilisateur visite les routes correspondantes :

| Fichier        | Routes                                       | Contenu                                                       |
| -------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `admin.json`   | `/admin/*`                                   | Interface d'administration, feedback                          |
| `edition.json` | `/editions/*`                                | Éditions, conventions, organisateurs, calendrier, covoiturage |
| `auth.json`    | `/auth/*`, `/login`, `/register`, `/profile` | Authentification, profil, permissions                         |

## Middleware de chargement

Le middleware `app/middleware/load-translations.global.ts` gère automatiquement le chargement :

```typescript
// Exemple : visite de /admin
// → Charge automatiquement admin.json pour la langue courante
// → Les traductions sont fusionnées avec celles déjà chargées
// → Le même fichier n'est jamais chargé deux fois
```

**Note technique importante** : Le middleware utilise une map statique d'imports (`translationLoaders`) pour chaque fichier et locale. Cette approche est nécessaire car Vite requiert des chemins d'import statiques pour l'analyse du code. Les imports dynamiques avec des variables ne sont pas supportés.

## Avantages

### Performance

- **Bundle initial réduit** : ~50% de réduction pour les utilisateurs ne visitant pas l'admin
- **Temps de chargement plus rapide** : Moins de JavaScript à parser au démarrage
- **Chargement asynchrone** : Les traductions sont chargées en parallèle de la navigation

### Maintenance

- **Organisation claire** : Séparation logique par domaine fonctionnel
- **Fichiers plus petits** : Plus facile à maintenir et réviser
- **Évolutivité** : Facile d'ajouter de nouveaux domaines

### Utilisation

- **Transparente** : Aucun changement nécessaire dans les composants existants
- **Cache intelligent** : Les traductions chargées restent en mémoire
- **Gestion des erreurs** : Fallback automatique en cas d'échec de chargement

## Ajouter un nouveau domaine

### 1. Modifier le script de séparation

Éditer `scripts/split-i18n.js` :

```javascript
const SPLIT_CONFIG = {
  // ... configuration existante

  // Nouveau domaine
  nouveauDomaine: ['cle1', 'cle2'],
}
```

### 2. Re-générer les fichiers

```bash
node scripts/split-i18n.js
```

### 3. Mettre à jour nuxt.config.ts

Ajouter le nouveau fichier aux locales si nécessaire (optionnel, seulement s'il doit être chargé par défaut).

### 4. Ajouter les loaders statiques

Ajouter les imports pour toutes les locales dans `translationLoaders` :

```typescript
// app/middleware/load-translations.global.ts
const translationLoaders: Record<string, Record<string, () => Promise<any>>> = {
  // ... domaines existants
  nouveauDomaine: {
    en: () => import('~/i18n/locales/en/nouveauDomaine.json'),
    da: () => import('~/i18n/locales/da/nouveauDomaine.json'),
    de: () => import('~/i18n/locales/de/nouveauDomaine.json'),
    es: () => import('~/i18n/locales/es/nouveauDomaine.json'),
    fr: () => import('~/i18n/locales/fr/nouveauDomaine.json'),
    it: () => import('~/i18n/locales/it/nouveauDomaine.json'),
    nl: () => import('~/i18n/locales/nl/nouveauDomaine.json'),
    pl: () => import('~/i18n/locales/pl/nouveauDomaine.json'),
    pt: () => import('~/i18n/locales/pt/nouveauDomaine.json'),
    ru: () => import('~/i18n/locales/ru/nouveauDomaine.json'),
    uk: () => import('~/i18n/locales/uk/nouveauDomaine.json'),
  },
}
```

### 5. Mettre à jour les routes

Si le nouveau domaine doit être chargé sur certaines routes :

```typescript
// app/middleware/load-translations.global.ts
const routeTranslations: Record<string, string[]> = {
  // ... routes existantes
  '/nouvelle-route': ['nouveauDomaine'],
}
```

## Migration depuis l'ancien système

Les anciens fichiers JSON ont été sauvegardés dans `i18n/locales-backup/` et peuvent être supprimés après vérification.

## Tests

Pour tester le chargement :

1. Ouvrir les DevTools → Network
2. Filtrer par "i18n" ou "json"
3. Naviguer vers différentes routes
4. Vérifier que les fichiers sont chargés uniquement quand nécessaire

## Débogage

En cas de clés manquantes :

1. Vérifier dans quel fichier la clé devrait être (voir `scripts/split-i18n.js`)
2. S'assurer que le middleware charge bien le fichier pour la route
3. Vérifier la console pour les erreurs de chargement
4. En dernier recours, ajouter la clé dans `common.json`

## Performance attendues

- **Bundle initial** : ~60KB → ~30KB (traductions)
- **Page admin** : +20KB chargé à la demande
- **Page éditions** : +40KB chargé à la demande
- **Pages auth** : +10KB chargé à la demande
