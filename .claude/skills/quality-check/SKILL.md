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

## 4. Changelog Discord

Une fois le commit et push terminés, lancer **`/discord-changelog`** sur le ou les commits qui
viennent d'être créés, en lisant son fichier au moment de l'exécuter plutôt qu'en résumant ses
règles de mémoire.

Une réserve, propre à cet enchaînement : `/discord-changelog` n'annonce que ce qui est **déployé
en production**, et `/quality-check` s'arrête au push. Le message produit ici est donc à garder
sous le coude jusqu'à la bascule, ce que le skill signale de lui-même.

---

**Note** : Si une étape échoue, le processus s'arrête et je signale l'erreur.
