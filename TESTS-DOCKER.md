# Tests Docker - Convention de Jonglerie

## Vue d'ensemble

Ce projet utilise Docker pour exécuter les tests dans un environnement isolé et reproductible. Plusieurs configurations sont disponibles selon vos besoins.

## Commandes disponibles

### Tests complets (tous les types)

```bash
# Lancer tous les tests (unitaires + intégration + DB)
npm run docker:test

# Nettoyer après les tests
npm run docker:test:clean
```

### Tests unitaires uniquement

```bash
# Lancer uniquement les tests unitaires (rapide, sans DB)
npm run docker:test:unit

# Nettoyer
npm run docker:test:unit:clean
```

### Tests d'intégration avec DB

```bash
# Lancer les tests d'intégration avec base de données
npm run docker:test:integration

# Nettoyer
npm run docker:test:integration:clean
```

### Interface UI pour les tests

```bash
# Lancer Vitest UI (accessible sur http://localhost:5173)
npm run docker:test:ui
```

### Reconstruction des images

```bash
# Reconstruire l'image Docker sans cache
npm run docker:test:rebuild
```

## Structure des tests

- **Tests unitaires** (`docker:test:unit`) : Tests rapides sans dépendances externes
- **Tests d'intégration** (`docker:test:integration`) : Tests avec base de données MySQL
- **Tests complets** (`docker:test`) : Exécute tous les types de tests séquentiellement

## Configuration

### Fichiers Docker

- `Dockerfile.test` : Image de base pour l'environnement de test
- `docker-compose.test-all.yml` : Configuration pour tous les tests
- `docker-compose.test-simple.yml` : Tests unitaires uniquement
- `docker-compose.test-integration.yml` : Tests avec base de données

### Variables d'environnement

Les tests utilisent automatiquement les bonnes variables d'environnement :

- Base de données de test isolée sur le port 3307
- JWT secret de test
- Emails désactivés

## Résolution des problèmes

### Les tests échouent avec "Cannot find module"

Reconstruisez l'image Docker :

```bash
npm run docker:test:rebuild
```

### Port 3307 déjà utilisé

La base de données de test utilise le port 3307. Assurez-vous qu'il est libre ou modifiez le port dans `docker-compose.test-integration.yml`.

### Nettoyer complètement l'environnement

```bash
npm run docker:test:clean
docker volume prune -f
```

## Développement

Pour développer et déboguer les tests :

1. Utilisez `npm run docker:test:ui` pour l'interface graphique
2. Les volumes sont montés pour le hot-reload
3. Les logs complets sont disponibles dans la console Docker
