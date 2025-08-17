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
- `npm run geocode` - Ajoute les coordonnées GPS aux conventions
- `npm run db:clean-tokens` - Supprime les tokens expirés de la base

## 🧪 Tests unitaires (rapides, sans DB)
- `npm run test` - Mode watch, relance automatiquement
- `npm run test:ui` - Interface graphique dans le navigateur
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