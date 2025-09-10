---
description: 'Exécute le linter, corrige automatiquement les erreurs, puis analyse et corrige manuellement les erreurs restantes'
thinking: false
---

# Lint et correction automatique complète

Je vais effectuer un processus de correction complet en plusieurs étapes :

1. **Correction automatique initiale**

```bash
npm run lint:fix
```

2. **Analyse des erreurs restantes**

```bash
npm run lint
```

3. **Correction manuelle des erreurs** (si nécessaire)
   Je vais analyser les erreurs retournées et les corriger manuellement une par une.

4. **Correction automatique finale**

```bash
npm run lint:fix
```

5. **Formatage du code**

```bash
npm run format
```

Ce processus garantit que tout le code respecte les standards de qualité et de formatage du projet.
