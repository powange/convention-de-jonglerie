---
description: "Pipeline complet : i18n, traductions, code review avec corrections, quality-check (lint, tests, commit), puis PR, attente de la CI en arrière-plan et merge si elle est verte"
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

1. **Ouvrir la PR** avec `gh pr create --base main`. Le corps explique _pourquoi_ le changement
   existe : le problème constaté, ce qui a été prouvé plutôt qu'affirmé, et ce qui reste ouvert.
   Ne pas se contenter d'un résumé du diff, que la PR affiche déjà.

2. **Attendre la CI en arrière-plan** — une CI dure de longues minutes : la surveiller au premier
   plan bloquerait la session pour rien.

   ```bash
   until OUT=$(gh pr checks <numéro> 2>&1) \
      && ! echo "$OUT" | grep -qE "pending|skipping|HTTP 5[0-9][0-9]"; do
     sleep 30
   done
   echo "$OUT"
   if echo "$OUT" | grep -q "fail"; then echo "VERDICT: ROUGE"; else echo "VERDICT: VERT"; fi
   ```

   Lancer cette commande **en tâche de fond** (`run_in_background`), puis rendre la main à
   l'utilisateur en indiquant le numéro de PR et que le merge suivra si la CI passe. Le harness
   réveille la session à la fin. Ne pas relancer un second `--watch` en parallèle.

   **Pourquoi cette boucle plutôt que `gh pr checks --watch --fail-fast`** : `--watch` s'interrompt
   et rend le code **0** dès que l'API GitHub renvoie une erreur — un 503 en pleine surveillance
   devient alors indiscernable d'une CI verte. Constaté trois fois en une seule session, sur des
   PR dont des jobs étaient encore en cours. La boucle ci-dessus ne sort que sur un état
   _observé_ : la commande a réussi, et plus aucun job n'est `pending` ni `skipping`. Une erreur
   d'API remet simplement en attente au lieu de conclure.

   `skipping` compte comme une attente : un job sauté l'est parce qu'un autre a échoué, et la
   sortie porte alors un `fail` que la ligne de verdict relèvera.

3. **Interpréter le verdict** au réveil, d'après la ligne `VERDICT:` :
   - **VERT** → merger avec `gh pr merge <numéro> --squash --delete-branch`.
     ⚠️ `--delete-branch` bascule la copie locale sur `main` : relever la branche courante avant
     le merge, et y revenir ensuite si le travail continue dessus ;
   - **ROUGE** → **ne pas merger**. Lire le journal du job fautif
     (`gh run view <id> --log-failed`), diagnostiquer, et distinguer une vraie régression d'une
     attente de test devenue fausse. Corriger, pousser, reprendre à l'étape 2.

   Un échec de `build` mérite une attention particulière : le serveur de développement et la CI
   ne résolvent pas les imports de la même façon. Un chemin relatif erroné peut fonctionner en
   développement, passer le lint et les tests unitaires — qui importent le module directement —
   et ne tomber qu'au build. Après correction d'une erreur de ce genre, vérifier par un vrai
   `npm run build` avant de repousser, plutôt que d'attendre un second aller-retour de CI.

4. **Vérifier que le merge a bien eu lieu**, plutôt que de le supposer :

   ```bash
   gh pr view <numéro> --json state --jq .state   # doit rendre MERGED
   git fetch origin -q && git log origin/main -1  # doit porter le commit attendu
   ```

   L'API peut échouer au moment du merge : lors d'une session, `gh pr merge` a renvoyé un 503
   alors que le merge avait réussi, et l'inverse est tout aussi possible. Seul `origin/main` fait
   foi. Cette vérification conditionne tout déploiement ultérieur — un webhook déclenché sur un
   `main` inchangé reconstruit le même commit et ne livre rien.

**Ne jamais déployer** dans ce skill : le déploiement reste une décision explicite de
l'utilisateur, via `/deploy`.

---

**Règle d'arrêt** : Si une étape échoue (erreur i18n non résoluble, tests cassés, CI rouge non
résoluble), le processus s'arrête immédiatement et signale l'erreur à l'utilisateur.
