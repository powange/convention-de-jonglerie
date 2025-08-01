# Guide des Tests

## Vue d'ensemble

Le projet utilise Vitest avec plusieurs types de tests :

### 1. Tests unitaires (sans DB)
Tests rapides qui mockent les dépendances externes.

```bash
npm run test        # Mode watch
npm run test:run    # Exécution unique
npm run test:ui     # Interface graphique
```

### 2. Tests d'intégration (avec DB)
Tests avec une vraie base de données MySQL dans Docker.

```bash
# Démarrer manuellement la DB de test
npm run test:setup

# Lancer les tests avec DB
npm run test:db      # Mode watch avec DB
npm run test:db:run  # Exécution unique avec DB

# Arrêter la DB de test
npm run test:teardown
```

## Configuration de la DB de test

### Docker Compose
- Port : 3307 (pour ne pas confliter avec la DB de dev)
- Base : `convention_jonglerie_test`
- Utilisateur : `testuser` / `testpassword`
- Optimisée pour la performance (tmpfs, flush désactivé)

### Environnement
Le fichier `.env.test` contient la configuration :
```env
DATABASE_URL="mysql://testuser:testpassword@localhost:3307/convention_jonglerie_test"
```

### Nettoyage automatique
- La DB est nettoyée entre chaque test
- Les migrations sont appliquées automatiquement
- Les conteneurs sont arrêtés après les tests

## Structure des tests

```
tests/
├── server/           # Tests unitaires API (mockés)
├── components/       # Tests de composants Vue
├── integration/      # Tests avec vraie DB
├── e2e/             # Tests end-to-end
├── setup.ts         # Configuration globale
└── setup-db.ts      # Configuration DB de test
```

## Bonnes pratiques

1. **Tests unitaires** : Pour la logique métier isolée
2. **Tests d'intégration** : Pour vérifier les interactions DB
3. **Isolation** : Chaque test nettoie ses données
4. **Performance** : La DB utilise la RAM (tmpfs)

## Exemples

### Test unitaire (mocké)
```typescript
// tests/server/api/auth/login.test.ts
vi.mock('../../../../server/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}))
```

### Test d'intégration (vraie DB)
```typescript
// tests/integration/auth.db.test.ts
import { prismaTest } from '../setup-db'

const user = await prismaTest.user.create({
  data: { /* ... */ }
})
```

## CI/CD

Pour l'intégration continue :
```yaml
- name: Start test database
  run: npm run test:setup
  
- name: Run all tests
  run: npm run test:db:run
  
- name: Stop test database
  run: npm run test:teardown
```