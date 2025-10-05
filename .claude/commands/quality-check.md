---
description: 'Lint, tests et commit : processus complet de vérification qualité avant commit'
thinking: false
---

# Vérification qualité complète et commit

Je vais effectuer un processus complet de vérification de la qualité du code avant de committer :

## 1. Lint et correction automatique

D'abord, je lance `/lint-fix` pour corriger tous les problèmes de style et de linting.

## 2. Exécution des tests

Ensuite, je lance `/run-tests` pour vérifier que tous les tests passent.

## 3. Commit et push

Enfin, si tout est OK, je lance `/commit-push` pour committer et pousser les changements.

---

**Note** : Si une étape échoue, le processus s'arrête et je signale l'erreur.
