# Scripts de Traduction

Ce répertoire contient les outils pour gérer les traductions des clés `[TODO]` dans le projet.

## Scripts disponibles

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
