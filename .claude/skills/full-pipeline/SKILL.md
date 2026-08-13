---
description: 'Pipeline complet : i18n, traductions, code review avec corrections, quality-check (lint, tests, commit), puis PR, attente de la CI en arrière-plan et merge si elle est verte'
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

2. **Attendre la CI en arrière-plan** — une CI dure de longues minutes : la surveiller au premier
   plan bloquerait la session pour rien.

   ```bash
   gh pr checks <numéro> --watch --fail-fast
   ```

   Lancer cette commande **en tâche de fond** (`run_in_background`), puis rendre la main à
   l'utilisateur en indiquant le numéro de PR et que le merge suivra si la CI passe. Le harness
   réveille la session à la fin de la commande : ne pas enchaîner de `sleep`, ne pas écrire de
   boucle d'attente maison (elle prendrait un 502 passager pour un succès) et ne pas relancer un
   second `--watch` en parallèle.

3. **Interpréter le verdict** au réveil, d'après le code de sortie :
   - `0` (tout est vert) → merger avec `gh pr merge <numéro> --squash --delete-branch`.
     ⚠️ `--delete-branch` bascule la copie locale sur `main` : relever la branche courante avant
     le merge, et y revenir ensuite si le travail continue dessus ;
   - non nul (`--fail-fast` coupe dès le premier échec) → **ne pas merger**. Lire le journal du
     job fautif (`gh run view <id> --log-failed`), diagnostiquer, et distinguer une vraie
     régression d'une attente de test devenue fausse. Corriger, pousser, reprendre à l'étape 2
     avec un nouveau `--watch` en tâche de fond.

**Ne jamais déployer** dans ce skill : le déploiement reste une décision explicite de
l'utilisateur, via `/deploy`.

---

**Règle d'arrêt** : Si une étape échoue (erreur i18n non résoluble, tests cassés, CI rouge non
résoluble), le processus s'arrête immédiatement et signale l'erreur à l'utilisateur.
