---
description: 'Pipeline complet : i18n, traductions, code review avec corrections, quality-check (lint, tests, commit), puis PR, CI et merge si on est sur une branche'
thinking: false
---

# Pipeline complet de vérification et livraison

Ce skill enchaîne automatiquement toutes les étapes de vérification, correction et livraison du code. Chaque étape doit réussir avant de passer à la suivante. En cas d'échec, le processus s'arrête et signale l'erreur.

## Étape 1 : Correction i18n (`/i18n-fix`)

Lancer la commande `/i18n-fix` pour nettoyer les traductions :

- Supprimer les clés inutilisées
- Ajouter les clés manquantes
- Synchroniser toutes les langues

## Étape 2 : Traduction des [TODO] (`/translate-todos`)

Lancer la commande `/translate-todos` pour traduire toutes les clés marquées [TODO] dans les 12 langues.

Si aucune clé [TODO] n'est trouvée, passer directement à l'étape suivante.

## Étape 3 : Code review (`/code-review`)

Lancer la commande `/code-review` pour analyser les changements en cours.

**Important** : Cette étape est en lecture seule — elle produit un rapport sans modifier le code.

## Étape 4 : Correction des problèmes

Si la code review a relevé des problèmes **critiques** ou **importants** :

- Corriger chaque problème identifié
- Ne PAS corriger les problèmes **mineurs** (suggestions de style, améliorations optionnelles)
- Après les corrections, relancer `/i18n-fix` si de nouvelles clés i18n ont été ajoutées

Si aucun problème critique ou important n'a été trouvé, passer directement à l'étape suivante.

## Étape 5 : Quality check (`/quality-check`)

Lancer la commande `/quality-check` qui enchaîne :

1. `/lint-fix` — Lint et correction automatique
2. `/run-tests` — Exécution des tests
3. `/commit-push` — Commit et push si tout est OK

## Étape 6 : Pull request, CI et merge

**Uniquement si le commit a été fait sur une branche** — vérifier avec `git branch --show-current`.
Si la branche courante est `main`, le travail est déjà sur la branche principale : ne rien faire
de plus et terminer.

1. **Ouvrir la PR** avec `gh pr create --base main`. Le corps explique *pourquoi* le changement
   existe : le problème constaté, ce qui a été prouvé plutôt qu'affirmé, et ce qui reste ouvert.
   Ne pas se contenter d'un résumé du diff, que la PR affiche déjà.

2. **Attendre la CI** en scrutant `gh pr checks <numéro>` jusqu'à ce qu'aucun statut ne soit
   `pending`. Une attente longue se fait en tâche de fond, pas en enchaînant des `sleep`.

3. **Interpréter le verdict** :
   - tout passe → merger avec `gh pr merge <numéro> --squash --delete-branch` ;
   - un échec → **ne pas merger**. Lire le journal du job fautif, diagnostiquer, et distinguer
     une vraie régression d'une attente de test devenue fausse. Corriger, pousser, reprendre à
     l'étape 2.

**Ne jamais déployer** dans ce skill : le déploiement reste une décision explicite de
l'utilisateur, via `/deploy`.

---

**Règle d'arrêt** : Si une étape échoue (erreur i18n non résoluble, tests cassés, CI rouge non
résoluble), le processus s'arrête immédiatement et signale l'erreur à l'utilisateur.
