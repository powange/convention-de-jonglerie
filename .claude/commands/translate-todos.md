---
description: 'Diagnostic et traduction des clés [TODO] dans les fichiers de langue'
thinking: false
---

# Diagnostic et traduction des clés [TODO]

## Étape 1: Synchronisation et diagnostic

Exécuter dans l'ordre :

```bash
npm run check-translations -- -f --fill-mode todo
```

```bash
node scripts/translation/list-todo-keys.js
```

Si aucune clé [TODO] n'est trouvée → terminer avec un message de succès.

## Étape 2: Traduire

Écrire un fichier `scripts/translation/translations-all.json` contenant TOUTES les traductions, organisées par langue.

Format du fichier :

```json
{
  "en": {
    "clé.exemple": "English translation"
  },
  "de": {
    "clé.exemple": "Deutsche Übersetzung"
  },
  "es": {
    "clé.exemple": "Traducción en español"
  }
}
```

**Règles de traduction :**

- Inclure les 12 langues : cs, da, de, en, es, it, nl, pl, pt, ru, sv, uk
- Traduire chaque langue avec soin (pas de copie du français)
- Conserver les variables entre accolades telles quelles (ex: `{count}`, `{name}`)
- Utiliser un seul appel Write pour créer le fichier

## Étape 3: Générer les fichiers par langue et appliquer

```bash
node scripts/translation/generate-todo-files.js
```

```bash
node scripts/translation/apply-translations.js
```

## Étape 4: Vérifier

```bash
node scripts/translation/list-todo-keys.js
```

Si des clés [TODO] persistent, reprendre à l'étape 2 pour les clés manquantes.
