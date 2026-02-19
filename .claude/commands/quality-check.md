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

Une fois le commit et push terminés, je génère un résumé des changements au format Discord, prêt à copier-coller. Pour cela :

1. Je récupère le ou les commits qui viennent d'être créés par cette commande (en comparant avec l'état avant le commit)
2. J'analyse le diff de ces commits pour comprendre les changements utilisateur (pas les changements techniques internes)
3. Je rédige un message Discord en français avec le format suivant :
   - Titre avec emoji et date du jour, en **gras** (`**titre**`)
   - Sections thématiques avec emojis en **gras** (`**titre de section**`), regroupant les changements par fonctionnalité
   - Formulation orientée utilisateur final (pas développeur) : expliquer ce que ça change concrètement pour eux
   - Ne PAS mentionner les changements purement techniques (refactoring interne, mises à jour de dépendances, corrections de tests) sauf s'ils impactent l'expérience utilisateur
   - Utiliser le formatage Markdown compatible Discord (**gras**, listes avec -)

---

**Note** : Si une étape échoue, le processus s'arrête et je signale l'erreur.
