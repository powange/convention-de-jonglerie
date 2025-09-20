---
description: 'Diagnostic et traduction des clés [TODO] dans les fichiers de langue'
thinking: false
---

# Préparation pour la traduction des clés [TODO]

```bash
npm run check-translations -- -f --fill-mode todo
```

# Diagnostic et traduction des clés [TODO]

Je vais d'abord faire un diagnostic pour identifier les clés [TODO] à traduire.

## Étape 1: Diagnostic des clés [TODO]

```bash
node scripts/translation/list-todo-keys.js
```

## Étape 2: Configuration des traductions (si nécessaire)

Si des clés [TODO] sont trouvées :

1. **Éditer le template généré** :
   - Fichier créé : `scripts/translation/translations-config.template.json`
   - Remplacer les placeholders par les vraies traductions
   - Renommer en `translations-config.json`

2. **Valider la configuration** :

   ```bash
   node scripts/translation/apply-translations.js --validate
   ```

3. **Appliquer les traductions** :

   ```bash
   node scripts/translation/apply-translations.js
   ```

4. **Vérifier les traductions** :

   ```bash
   node scripts/translation/list-todo-keys.js
   ```

5. **Supprimer le fichier de configuration** :

   ```bash
   rm scripts/translation/translations-config.json
   ```

6. **Supprimer le template** :
   ```bash
   rm scripts/translation/translations-config.template.json
   ```

Le workflow complet automatise la détection, configuration et application des traductions.
