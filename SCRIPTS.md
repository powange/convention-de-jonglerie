# 📦 Scripts disponibles

## 🚀 Développement

- `npm run dev` - Lance le serveur de développement sur http://localhost:3000
- `npm run build` - Compile l'application optimisée pour la production
- `npm run preview` - Teste la version build localement
- `npm run generate` - Génère un site statique (SSG)

## 🧹 Qualité du code

- `npm run lint` - Vérifie les erreurs et le style du code
- `npm run lint:fix` - Corrige automatiquement les problèmes détectés

## 🛠️ Scripts métier

### Assignation des repas aux bénévoles acceptés

Assigne automatiquement les repas aux bénévoles déjà acceptés qui n'ont pas encore de sélections de repas.

```bash
npm run db:assign-meals
```

**Fonctionnement** :

- Recherche tous les bénévoles avec statut `ACCEPTED`
- Filtre ceux qui n'ont aucune sélection de repas
- Crée automatiquement les sélections selon leurs disponibilités (setup/event/teardown) et dates d'arrivée/départ
- Tous les repas sont cochés par défaut (`accepted=true`)

**Sécurité** :

- Ne modifie jamais les sélections existantes
- Peut être exécuté plusieurs fois sans risque (idempotent)
- En cas d'erreur sur un bénévole, continue avec les suivants

Voir [scripts/README-assign-meals.md](scripts/README-assign-meals.md) pour plus de détails.

### Migration droits collaborateurs

Exécuter une migration douce des anciens rôles vers les nouveaux booléens de droits.

Dry-run (simulation):

```
npx ts-node scripts/migrate-collaborator-rights.ts --dry
```

Appliquer réellement:

```
npx ts-node scripts/migrate-collaborator-rights.ts
```

Règles de mapping:

- ADMINISTRATOR => active tous les droits (edit/delete convention, manageCollaborators, add/edit/delete éditions)
- MODERATOR => addEdition + editAllEditions seulement
- Ne réécrit pas un droit déjà à true
- Crée une entrée history CREATED si aucune n'existe encore
- Confirmation interactive avant application (utiliser --yes ou -y pour bypass)

- `npm run test:run` - Une seule exécution (CI/CD)

## 🗄️ Tests d'intégration (avec vraie DB)

- `npm run test:db` - Tests avec DB en mode watch
- `npm run test:db:run` - Tests avec DB une fois
- `npm run test:setup` - Démarre MySQL + migrations
- `npm run test:teardown` - Arrête et nettoie tout

## 🐳 Aides Docker pour les tests (optionnel)

- `npm run docker:test` - Lance tout le pack de tests dans Docker (base + runner)
- `npm run docker:test:unit` - Lance uniquement les tests unitaires dans Docker
- `npm run docker:test:integration` - Lance uniquement l’intégration DB dans Docker
- `npm run docker:test:ui` - Ouvre l’UI Vitest dans Docker
- `npm run docker:test:clean` - Nettoie les conteneurs/volumes des tests

## ⚙️ Scripts automatiques

- `postinstall` - S'exécute automatiquement après `npm install` pour préparer Nuxt
