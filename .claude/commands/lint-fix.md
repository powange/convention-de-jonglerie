---
description: 'Exécute le linter, corrige automatiquement les erreurs, puis analyse et corrige manuellement les erreurs restantes'
thinking: false
---

# Lint et correction automatique complète

Je vais effectuer un processus de correction optimisé :

1. **Correction automatique**

```bash
npm run lint:fix
```

2. **Analyse des erreurs restantes** (seulement si erreur à la fin de l'étape 1)

```bash
npm run lint
```

3. **Correction manuelle** (si des erreurs persistent)
   Je corrige manuellement les erreurs qui ne peuvent pas être auto-corrigées.

4. **Formatage du code** (TOUJOURS exécuté à la fin)

```bash
npm run format
```
