# Scripts de Traduction

Ce répertoire contient les outils pour gérer les traductions des clés `[TODO]` dans le projet.

## Scripts disponibles

### 🏷️ `mark-todo.js` - Marquer des clés comme [TODO]

**Utilisation :**

```bash
# MODE AUTOMATIQUE (recommandé) : Détecte automatiquement les clés modifiées
npm run i18n:mark-todo
# ou
node scripts/translation/mark-todo.js

# MODE MANUEL : Marquer des clés spécifiques
npm run i18n:mark-todo "gestion.ticketing.stats_view_items" "gestion.ticketing.stats_items"
# ou
node scripts/translation/mark-todo.js gestion.ticketing.stats_view_items gestion.ticketing.stats_items

# Avec option --keys
node scripts/translation/mark-todo.js --keys "gestion.ticketing.stats_view_items,gestion.ticketing.stats_items"

# Simulation (dry-run) pour voir ce qui serait modifié
node scripts/translation/mark-todo.js --dry-run

# Langues spécifiques uniquement
node scripts/translation/mark-todo.js --langs "en,de,es" gestion.ticketing.stats_view_items
```

**Fonction :**

- **Mode automatique** : Détecte via `git diff` les clés françaises modifiées (non commitées) et les marque automatiquement comme `[TODO]` dans les autres langues
- **Mode manuel** : Marque des clés spécifiques comme `[TODO]` dans toutes les langues (sauf français)
- Utile quand vous modifiez le **wording** français d'une clé qui existe déjà dans d'autres langues
- Évite de modifier manuellement chaque fichier de langue

**Exemple d'utilisation pratique :**

```bash
# Vous venez de modifier des traductions françaises dans i18n/locales/fr/gestion.json
# Lancez le mode automatique pour détecter et marquer les clés modifiées :
npm run i18n:mark-todo

# Résultat : Le script détecte automatiquement les clés modifiées et les marque
# dans toutes les autres langues comme [TODO]
```

**Résultat :**

```json
// Avant (en/gestion.json)
"stats_view_items": "By participants"

// Après
"stats_view_items": "[TODO] By participants"
```

**Options :**

- `--keys` : Liste de clés séparées par des virgules
- `--langs` : Langues cibles (par défaut : toutes sauf fr)
- `--dry-run` : Simulation sans modification des fichiers
- `--help` : Afficher l'aide

### 📋 `list-todo-keys.js` - Script de diagnostic

**Utilisation :**

```bash
node scripts/translation/list-todo-keys.js
```

**Fonction :**

- Scanne tous les fichiers de langue dans `i18n/locales/`
- Trouve toutes les clés qui commencent par `[TODO]`
- Affiche un rapport détaillé avec statut par langue
- Génère automatiquement un template de configuration `translations-config.template.json`

**Exemple de sortie :**

```
=== CLÉS [TODO] TROUVÉES ===

pages.volunteers.pets:
  ✓ fr: "Animaux de compagnie" (référence)
  ✗ en: "[TODO] Animaux de compagnie"
  ✗ de: "[TODO] Animaux de compagnie"
  ✗ es: "[TODO] Animaux de compagnie"

Total: 1 clés avec [TODO]
Total de traductions nécessaires: 3
```

### ⚡ `apply-translations.js` - Application des traductions

**Utilisation :**

```bash
# Validation seule
node scripts/translation/apply-translations.js --validate

# Application des traductions
node scripts/translation/apply-translations.js

# Aide
node scripts/translation/apply-translations.js --help
```

**Fonction :**

- Applique les traductions depuis `translations-config.json`
- Valide la configuration avant application
- Met à jour tous les fichiers de langue automatiquement
- Affiche un rapport détaillé des modifications

### 🔧 `translate-todos.js` - Script legacy

**Fonction :**

- Script spécialisé pour traduire des clés spécifiques (profils, formulaires)
- **Déprécié** - Utiliser plutôt le workflow avec les nouveaux scripts

## ⚠️ Règle importante : Modification de wording existant

Lorsque vous modifiez le **wording** (libellé) d'une clé française **qui existe déjà dans d'autres langues**, vous devez marquer ces traductions comme obsolètes.

**Exemple :**

```json
// Avant
"stats_view_items": "Par participants"

// Après modification en français
"stats_view_items": "Par billets"
```

**Action recommandée (MODE AUTOMATIQUE) :**

1. Modifier les clés françaises comme souhaité
2. Lancer `npm run i18n:mark-todo` (le script détectera automatiquement les clés modifiées via git diff)

**Ou action manuelle (si nécessaire) :**

1. Modifier la clé française comme souhaité
2. Utiliser `npm run i18n:mark-todo "clé1" "clé2"` pour marquer les clés spécifiques

**Pourquoi ?**

- La commande `npm run check-translations -- -f --fill-mode todo` ne détecte QUE les clés manquantes
- Elle ne peut pas savoir qu'un wording français a changé
- Sans `[TODO]`, les anciennes traductions resteront et seront incorrectes
- Le script `mark-todo.js` en mode automatique détecte les modifications via git et marque automatiquement les clés

**Cas où ce n'est PAS nécessaire :**

- Si la clé n'existe pas encore dans les autres langues (nouvelle clé)
- Dans ce cas, `check-translations` ajoutera automatiquement `[TODO]`

## Workflow recommandé

### Étape 1 : Diagnostic

```bash
node scripts/translation/list-todo-keys.js
```

### Étape 2 : Configuration

1. Éditer le fichier `translations-config.template.json` généré
2. Remplacer les placeholders `"TODO: Traduire en XX"` par les vraies traductions
3. Renommer en `translations-config.json`

### Étape 3 : Validation

```bash
node scripts/translation/apply-translations.js --validate
```

### Étape 4 : Application

```bash
node scripts/translation/apply-translations.js
```

## Structure du fichier de configuration

```json
{
  "translations": {
    "pages.volunteers.pets": {
      "fr": "Animaux de compagnie",
      "en": "Pets",
      "de": "Haustiere",
      "es": "Mascotas",
      "it": "Animali domestici"
    },
    "common.no": {
      "fr": "Non",
      "en": "No",
      "de": "Nein",
      "es": "No",
      "it": "No"
    }
  }
}
```

## Langues supportées

- 🇫🇷 `fr` - Français (langue de référence)
- 🇬🇧 `en` - Anglais
- 🇩🇪 `de` - Allemand
- 🇪🇸 `es` - Espagnol
- 🇮🇹 `it` - Italien
- 🇳🇱 `nl` - Néerlandais
- 🇵🇱 `pl` - Polonais
- 🇵🇹 `pt` - Portugais
- 🇷🇺 `ru` - Russe
- 🇺🇦 `uk` - Ukrainien
- 🇩🇰 `da` - Danois
