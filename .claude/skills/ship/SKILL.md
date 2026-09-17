---
description: 'Enchaîne /full-pipeline puis le déploiement : vérifications, PR, CI, merge, puis les deux environnements — en parallèle sans migration, release avant production dès qu’il y en a une'
thinking: false
---

# Livraison de bout en bout

Enchaîne deux skills existants, sans rien réécrire de leur contenu :

1. **`/full-pipeline`** — i18n, traductions, revue, lint, tests, commit, PR, attente de la CI en
   tâche de fond, merge si elle est verte.
2. **`/deploy`** — puis vérification de la bascule. La cible dépend du lot, et c'est la section
   « L'ordre de déploiement » ci-dessous qui tranche : `all` sans migration, `release` puis `prod`
   dès qu'il y en a une.

Suivre chacun de ces skills **intégralement**, dans l'ordre, en lisant leur fichier au moment de
l'exécuter. Ne pas résumer leurs étapes de mémoire : ils évoluent, et c'est leur version courante
qui fait foi.

## L'autorisation de déployer

`/full-pipeline` interdit de déployer, au motif que le déploiement reste une décision explicite de
l'utilisateur. **Invoquer ce skill-ci est cette décision** : elle vaut pour le lot en cours, et
pour lui seul. Un nouveau lot demande une nouvelle invocation.

## Règle d'arrêt

Si `/full-pipeline` s'arrête — i18n non résoluble, tests cassés, CI rouge —, **ne pas déployer**.
Signaler l'échec et attendre. Le déploiement ne s'enchaîne que sur un merge effectivement réalisé.

Vérifier ce point plutôt que de le supposer : `gh pr view <n> --json state` doit rendre `MERGED`,
et `git log origin/main -1` porter le commit attendu. Déclencher un webhook sur un `main` inchangé
reconstruit le même commit et ne livre rien.

## L'ordre de déploiement : la migration décide

La question ne se pose pas à l'utilisateur, elle se tranche sur le contenu du lot.

- **Lot SANS migration** → `/deploy all`, les deux environnements en parallèle. Rien n'est
  construit sur l'hôte, les deux piles tirent la même image déjà publiée : le parallèle ne coûte
  que la répétition, et il n'y a rien à répéter.
- **Lot AVEC migration** → **release d'abord, production ensuite**, toujours. Jamais le parallèle.

### Comment savoir si le lot porte une migration

Le regarder, ne pas s'en souvenir :

```bash
git diff --name-only origin/main...HEAD -- apps/app1/prisma/migrations/
```

Une seule ligne suffit à imposer l'ordre séquentiel.

### Pourquoi c'est une règle et non une préférence

`apps/app1/docker/entrypoint.sh` s'exécute en `set -e` et lance `prisma migrate deploy` avant
Nuxt. Une migration qui échoue fait donc échouer le conteneur — et laisse la base dans l'état
`P3009`, qui bloque **toutes** les migrations suivantes tant qu'on ne l'a pas démêlé à la main.

En parallèle, cet échec frappe les deux environnements **en même temps** : il ne reste alors aucun
endroit où l'avoir vu d'abord. Release en galop d'essai est précisément ce qui rend l'incident
réparable sans que la production soit tombée.

Corollaire utile : `set -e` fait qu'une release **qui répond** prouve que la migration est passée.
C'est le feu vert, et il se constate — il ne se suppose pas.

### Le déroulé séquentiel

1. `/deploy release`, en suivant ce skill-là intégralement.
2. Attendre que l'identifiant de build change sur https://test.juggling-convention.com, puis
   vérifier une page **et** un point d'API qui interroge la base. Une page d'accueil peut répondre
   200 alors que tout ce qui touche la base échoue.
3. La release une fois debout, `/deploy prod`.

Annoncer les deux migrations à l'utilisateur avant de lancer la première : **ce qu'elles font, et
si l'une d'elles détruit des données.** C'est une exigence du `CLAUDE.md`, pas une politesse.

Si l'utilisateur demande explicitement le parallèle malgré une migration, s'exécuter — mais lui
avoir dit une fois ce que cela lui retire.

## Rendre la main

`/full-pipeline` attend la CI en tâche de fond et rend la main entre-temps. Au réveil, reprendre
l'enchaînement là où il s'était arrêté : merge, puis déploiement. Ne pas relancer le pipeline
depuis le début.
