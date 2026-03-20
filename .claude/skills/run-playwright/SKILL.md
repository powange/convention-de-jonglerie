---
name: run-playwright
description: Exécute les tests E2E Playwright, analyse les échecs et corrige automatiquement
user_invocable: true
---

# Tests E2E Playwright

Lance les tests Playwright, analyse les erreurs et corrige les tests ou le code si nécessaire.

## Processus :

1. **Exécution des tests** — Lance `npx playwright test` et analyse la sortie
2. **Analyse des échecs** — Pour chaque test en échec :
   - Lire le screenshot de l'erreur dans `test-results/` pour comprendre l'état réel de la page
   - Identifier si le problème vient du test (sélecteur incorrect, timing) ou du code applicatif (bug réel)
3. **Correction** — Corriger les tests ou le code selon le diagnostic :
   - **Test cassé** : Adapter les sélecteurs/assertions au DOM réel (visible sur le screenshot)
   - **Bug applicatif** : Corriger le code source
4. **Re-exécution** — Relancer les tests jusqu'à ce que tous passent
5. **Rapport** — Afficher le résultat final (nombre de tests passés/échoués)
6. **Nettoyage** — Supprimer les données E2E créées en BDD et les fichiers d'état :
   ```bash
   npm run db:e2e:clean
   ```

## Commandes :

```bash
# Lancer tous les tests
npx playwright test

# Lancer un fichier spécifique
npx playwright test test/e2e/playwright/homepage.spec.ts
```

## Points importants :

- Les tests se connectent à l'app en cours d'exécution sur `http://localhost:3000`
- Ne PAS utiliser `waitForTimeout()` — préférer `waitForSelector()` ou `toPass()`
- Les screenshots des échecs sont dans `test-results/` — TOUJOURS les lire pour diagnostiquer
- La locale est forcée en `fr-FR` dans la config Playwright
- Ne JAMAIS committer les corrections sans que l'utilisateur le demande (respect de la règle `/commit-push`)
