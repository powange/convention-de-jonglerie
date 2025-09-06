# Scripts de Traduction Automatique

Ce dossier contient les scripts pour automatiser les traductions en masse des fichiers i18n.

## 📁 Fichiers

- **`mass-translator.js`** - Script principal de traduction automatique
- **`translation-dictionary.js`** - Dictionnaire de traductions extensible
- **`README-traduction.md`** - Cette documentation

## 🚀 Usage Rapide

### Traduction complète

```bash
node scripts/mass-translator.js
```

### Simulation (sans modification)

```bash
node scripts/mass-translator.js --dry-run
```

### Langues spécifiques

```bash
node scripts/mass-translator.js --lang "en,es,de"
```

### Pattern personnalisé

```bash
node scripts/mass-translator.js --pattern "[NEW]"
```

## 📋 Options Complètes

```bash
node scripts/mass-translator.js [options]

Options:
  --pattern <pattern>  Motif à rechercher (défaut: "[TODO]")
  --dry-run           Simulation sans modification des fichiers
  --lang <codes>      Langues spécifiques séparées par des virgules
  --verbose           Affichage détaillé de chaque traduction
  --help              Afficher l'aide
```

## 🔧 Comment Ajouter de Nouvelles Traductions

### 1. Modifier le dictionnaire

Éditez `translation-dictionary.js` et ajoutez vos traductions dans les catégories appropriées :

```javascript
export const TRANSLATION_DICTIONARY = {
  // Nouvelle catégorie
  monnaie: {
    Euro: {
      en: 'Euro',
      es: 'Euro',
      de: 'Euro',
      it: 'Euro',
      nl: 'Euro',
      pl: 'Euro',
      pt: 'Euro',
      ru: 'Евро',
      uk: 'Євро',
      da: 'Euro',
    },
    Devise: {
      en: 'Currency',
      es: 'Moneda',
      de: 'Währung',
      it: 'Valuta',
      nl: 'Valuta',
      pl: 'Waluta',
      pt: 'Moeda',
      ru: 'Валюта',
      uk: 'Валюта',
      da: 'Valuta',
    },
  },
}
```

### 2. Patterns contextuels

Pour des traductions plus complexes basées sur des patterns :

```javascript
export const CONTEXT_PATTERNS = [
  {
    pattern: /^Le (.+) est invalide$/i,
    getTranslations: (match) => ({
      en: `The ${match[1]} is invalid`,
      es: `El ${match[1]} es inválido`,
      de: `${match[1]} ist ungültig`,
      // ... autres langues
    }),
  },
]
```

## 🌍 Langues Supportées

Le script supporte ces codes de langue :

- `en` - Anglais
- `es` - Espagnol
- `de` - Allemand
- `it` - Italien
- `nl` - Néerlandais
- `pl` - Polonais
- `pt` - Portugais
- `ru` - Russe
- `uk` - Ukrainien
- `da` - Danois

## 📊 Exemples d'Usage

### Vérifier ce qui sera traduit

```bash
# Simulation pour voir les traductions possibles
node scripts/mass-translator.js --dry-run --verbose
```

### Traduction par étapes

```bash
# D'abord les langues principales
node scripts/mass-translator.js --lang "en,es,de,it"

# Ensuite les autres langues
node scripts/mass-translator.js --lang "nl,pl,pt,ru,uk,da"
```

### Traduction de patterns spécifiques

```bash
# Traduire seulement les clés avec [NOUVEAU]
node scripts/mass-translator.js --pattern "[NOUVEAU]"
```

## 🔍 Workflow Recommandé

1. **Analyse** - Lancez avec `--dry-run` pour voir ce qui sera traduit
2. **Test** - Testez sur quelques langues avec `--lang "en,es"`
3. **Application** - Lancez la traduction complète
4. **Vérification** - Vérifiez les résultats avec votre système i18n

## ⚠️ Bonnes Pratiques

- **Toujours tester** avec `--dry-run` d'abord
- **Sauvegarder** vos fichiers de traduction avant traduction en masse
- **Vérifier** les résultats après traduction
- **Étendre** le dictionnaire au fur et à mesure de vos besoins

## 🔄 Mise à Jour du Dictionnaire

Pour maintenir le dictionnaire à jour :

1. Identifiez les termes récurrents dans vos traductions manuelles
2. Ajoutez-les au `translation-dictionary.js`
3. Relancez le script sur les anciens fichiers pour automatiser

## 🐛 Dépannage

### Aucune traduction trouvée

- Vérifiez que le pattern correspond (défaut: `[TODO]`)
- Vérifiez que les termes sont dans le dictionnaire
- Utilisez `--verbose` pour voir les détails

### Erreur de fichier

- Vérifiez que les fichiers JSON sont valides
- Vérifiez les permissions d'écriture

### Traductions incorrectes

- Modifiez le dictionnaire
- Relancez le script sur les fichiers concernés
