# Tests du Système de Feedback

Ce document décrit la suite de tests complète pour le système de feedback de l'application Convention de Jonglerie.

## Vue d'ensemble

Le système de feedback permet aux utilisateurs (connectés et anonymes) d'envoyer des retours sur l'application, et aux administrateurs de les gérer depuis une interface dédiée.

## Architecture des tests

### 1. Tests unitaires API (`tests/server/api/feedback/`)

**Fichier**: `tests/server/api/feedback/index.post.test.ts`
- ✅ Tests de création de feedback pour utilisateurs connectés
- ✅ Tests de création de feedback pour utilisateurs anonymes
- ✅ Validation reCAPTCHA pour visiteurs non connectés
- ✅ Validation des données d'entrée (types, longueurs, formats)
- ✅ Gestion des erreurs et cas limites

**Couverture**: 
- Création de feedback avec/sans authentification
- Validation des schémas Zod
- Intégration reCAPTCHA Google v2
- Gestion des erreurs de base de données

### 2. Tests unitaires Admin API (`tests/server/api/admin/feedback/`)

**Fichier**: `tests/server/api/admin/feedback/index.get.test.ts`
- ✅ Tests d'autorisation admin (403 pour non-admin)
- ✅ Récupération paginée des feedbacks
- ✅ Filtres de recherche et tri
- ✅ Calcul des statistiques par type/statut
- ✅ Gestion des erreurs

**Fichier**: `tests/server/api/admin/feedback/resolve.put.test.ts`
- ✅ Résolution/réouverture de feedbacks
- ✅ Ajout de notes d'administration
- ✅ Validation des paramètres (ID, données)
- ✅ Vérification des permissions
- ✅ Gestion des feedbacks inexistants

### 3. Tests d'intégration composant (`tests/components/`)

**Fichier**: `tests/components/FeedbackModal.nuxt.test.ts`
- ✅ Rendu conditionnel selon l'état d'authentification
- ✅ Validation du formulaire côté client
- ✅ Intégration reCAPTCHA pour visiteurs
- ✅ Soumission et gestion des réponses
- ✅ Gestion des erreurs et messages toast
- ✅ Événements de fermeture et réinitialisation

### 4. Tests de page admin (`tests/pages/admin/`)

**Fichier**: `tests/pages/admin/feedback.nuxt.test.ts`
- ✅ Rendu de l'interface d'administration
- ✅ Affichage des statistiques
- ✅ Fonctionnalité de recherche avec debounce
- ✅ Filtres par type et statut
- ✅ Actions de résolution de feedbacks
- ✅ Pagination et navigation
- ✅ Gestion des états de chargement

### 5. Tests d'intégration base de données (`tests/integration/`)

**Fichier**: `tests/integration/feedback.db.test.ts`
- ✅ CRUD complet avec Prisma et MySQL
- ✅ Relations utilisateur <-> feedback
- ✅ Contraintes de base de données
- ✅ Requêtes complexes avec filtres
- ✅ Calculs de statistiques
- ✅ Gestion des utilisateurs supprimés

### 6. Tests de sécurité (`tests/security/`)

**Fichier**: `tests/security/feedback-security.test.ts`
- ✅ Contrôle d'accès et permissions
- ✅ Validation et sanitisation des entrées
- ✅ Prévention injection SQL/NoSQL
- ✅ Sécurité des sessions JWT
- ✅ Validation CAPTCHA
- ✅ Protection des données personnelles (GDPR)

## Types de tests par niveau

### Tests unitaires
- **Cible**: Fonctions isolées et handlers API
- **Mocks**: Base de données (Prisma), services externes
- **Focalisés sur**: Logique métier, validation, cas limites

### Tests d'intégration
- **Cible**: Composants Vue avec leurs dépendances
- **Mocks**: APIs externes, mais composables Nuxt réels
- **Focalisés sur**: Interactions utilisateur, rendu conditionnel

### Tests de base de données
- **Cible**: Requêtes Prisma avec vraie base MySQL
- **Mocks**: Aucun (base de données de test)
- **Focalisés sur**: Intégrité des données, performances

### Tests de sécurité
- **Cible**: Vulnérabilités et vecteurs d'attaque
- **Mocks**: Selon le contexte
- **Focalisés sur**: Authentification, autorisation, validation

## Couverture de tests

### Fonctionnalités testées
- [x] Création feedback utilisateurs connectés
- [x] Création feedback utilisateurs anonymes  
- [x] Validation reCAPTCHA pour anonymes
- [x] Interface administration complète
- [x] Résolution/réouverture feedbacks
- [x] Filtrage et recherche avancée
- [x] Statistiques temps réel
- [x] Pagination et navigation
- [x] Gestion des erreurs
- [x] Sécurité et permissions
- [x] Validation des entrées
- [x] Relations base de données

### Scénarios testés
- [x] Utilisateur connecté soumet bug report
- [x] Visiteur anonyme soumet suggestion avec CAPTCHA
- [x] Admin visualise tous les feedbacks
- [x] Admin recherche et filtre feedbacks
- [x] Admin résout feedback avec notes
- [x] Admin rouvre feedback résolu
- [x] Tentatives d'accès non autorisé
- [x] Validation des données malformées
- [x] Gestion des erreurs réseau/serveur

## Lancement des tests

### Tous les tests
```bash
npm run test:run
```

### Tests spécifiques au feedback
```bash
# Tests unitaires API seulement
npm run test -- tests/server/api/feedback/
npm run test -- tests/server/api/admin/feedback/

# Tests composants seulement
npm run test -- tests/components/FeedbackModal.nuxt.test.ts

# Tests intégration seulement
npm run test -- tests/integration/feedback.db.test.ts
npm run test -- tests/pages/admin/feedback.nuxt.test.ts

# Tests sécurité seulement
npm run test -- tests/security/feedback-security.test.ts

# Tous les tests feedback (pattern matching)
npm run test -- --grep "feedback"
```

### Tests avec base de données
```bash
# Démarrer MySQL pour tests
npm run test:db

# Ou avec Docker
docker-compose -f docker-compose.test.yml up -d
npm run test -- tests/integration/feedback.db.test.ts
```

### Mode développement
```bash
# Watch mode pour développer les tests
npm run test -- --watch

# Interface graphique Vitest
npm run test:ui
```

## Environnement de test

### Variables d'environnement requises
```env
# Base de données de test
TEST_DATABASE_URL="mysql://test:test@localhost:3306/juggling_test"

# reCAPTCHA (clés de test Google)
RECAPTCHA_SITE_KEY="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
NUXT_PUBLIC_RECAPTCHA_SITE_KEY="6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"

# JWT pour tests
JWT_SECRET="test-jwt-secret-key"
```

### Configuration Vitest
- **Environment**: `nuxt` pour tests composants
- **Setup**: Mocks Prisma, composables Nuxt
- **Timeout**: 30s pour tests DB
- **Coverage**: Istanbul/c8

## Mocks et utilitaires

### Mocks principaux
- `prismaMock`: Prisma Client simulé
- `$fetch`: Requêtes HTTP simulées  
- `useI18n`, `useToast`, `useAuthStore`: Composables Nuxt
- `grecaptcha`: reCAPTCHA Google

### Données de test
- Utilisateurs: normal, admin, anonyme
- Feedbacks: tous types (BUG, SUGGESTION, GENERAL, COMPLAINT)
- Scénarios: résolus/non résolus, avec/sans notes admin

## Métriques de qualité

### Objectifs de couverture
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 95%
- **Lines**: > 90%

### Performance
- Tests unitaires: < 100ms chacun
- Tests intégration: < 5s chacun  
- Tests DB: < 10s chacun
- Suite complète: < 2min

## Maintenance

### Ajouter de nouveaux tests
1. Identifier la fonctionnalité à tester
2. Choisir le type de test approprié
3. Utiliser les mocks existants
4. Suivre les conventions de nommage
5. Documenter les scénarios complexes

### Debugging
```bash
# Mode verbose
npm run test -- --verbose

# Tests spécifiques
npm run test -- --grep "devrait créer un feedback"

# Mode watch
npm run test:watch
```

### CI/CD
Les tests sont exécutés automatiquement sur:
- Pull requests
- Push sur main
- Release tags

## Ressources

- [Vitest Documentation](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Nuxt Test Utils](https://nuxt.com/docs/getting-started/testing)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)