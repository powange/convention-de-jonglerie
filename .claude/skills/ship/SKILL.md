---
description: 'Enchaîne /full-pipeline puis /deploy all : vérifications, PR, CI, merge, et déploiement des deux environnements en parallèle'
thinking: false
---

# Livraison de bout en bout

Enchaîne deux skills existants, sans rien réécrire de leur contenu :

1. **`/full-pipeline`** — i18n, traductions, revue, lint, tests, commit, PR, attente de la CI en
   tâche de fond, merge si elle est verte.
2. **`/deploy all`** — release et production en parallèle, puis vérification de la bascule.

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

## Le cas où il faut s'écarter du parallèle

`/deploy all` déploie les deux environnements en même temps, ce qui **supprime la répétition** que
fournit release. Quand le lot contient une **migration**, le proposer à l'utilisateur avant de
lancer : release en galop d'essai, vérification, puis production. `entrypoint.sh` ayant `set -e`,
voir release répondre prouve que la migration est passée.

S'il maintient le parallèle, s'exécuter — mais l'avoir dit une fois.

## Rendre la main

`/full-pipeline` attend la CI en tâche de fond et rend la main entre-temps. Au réveil, reprendre
l'enchaînement là où il s'était arrêté : merge, puis déploiement. Ne pas relancer le pipeline
depuis le début.
