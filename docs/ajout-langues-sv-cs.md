# Ajout des langues Suédois (sv) et Tchèque (cs)

**Date:** 19 Octobre 2025

## Résumé

Deux nouvelles langues ont été ajoutées au projet :

- 🇸🇪 **Suédois (sv)** - Svenska
- 🇨🇿 **Tchèque (cs)** - Čeština

Le projet supporte maintenant **13 langues** au total.

## Modifications effectuées

### 1. Structure de fichiers créée

Création des répertoires et fichiers de traduction :

```
i18n/locales/cs/
├── admin.json
├── app.json
├── auth.json
├── common.json
├── components.json
├── edition.json
├── feedback.json
├── notifications.json
├── permissions.json
├── public.json
└── ticketing.json

i18n/locales/sv/
├── admin.json
├── app.json
├── auth.json
├── common.json
├── components.json
├── edition.json
├── feedback.json
├── notifications.json
├── permissions.json
├── public.json
└── ticketing.json
```

**Note:** Les fichiers ont été copiés depuis le français (`fr/`) comme base de travail.

### 2. Configuration Nuxt mise à jour

**Fichier:** `nuxt.config.ts`

Ajout des deux nouvelles locales dans la configuration i18n :

```typescript
{
  code: 'cs',
  name: 'Čeština',
  files: [
    'cs/common.json',
    'cs/notifications.json',
    'cs/components.json',
    'cs/app.json',
    'cs/public.json',
  ],
},
{
  code: 'sv',
  name: 'Svenska',
  files: [
    'sv/common.json',
    'sv/notifications.json',
    'sv/components.json',
    'sv/app.json',
    'sv/public.json',
  ],
},
```

### 3. Interface utilisateur mise à jour

**Fichier:** `app/app.vue`

Ajout des drapeaux dans le sélecteur de langue :

```typescript
const languageConfig = {
  // ... autres langues ...
  cs: { name: 'Čeština', flag: 'fi fi-cz' }, // 🇨🇿 Drapeau tchèque
  sv: { name: 'Svenska', flag: 'fi fi-se' }, // 🇸🇪 Drapeau suédois
}
```

## État actuel des traductions

### ⚠️ Traductions à faire

Les fichiers de traduction **contiennent actuellement le texte français**.
Ils doivent être traduits en suédois et en tchèque.

**Fichiers concernés (22 fichiers au total) :**

- 11 fichiers pour le suédois (`i18n/locales/sv/*.json`)
- 11 fichiers pour le tchèque (`i18n/locales/cs/*.json`)

### Options de traduction

#### Option 1 : Traduction professionnelle (recommandé)

- Faire appel à des traducteurs natifs
- Coût : ~0.08-0.12€/mot
- Estimation : ~2000 mots par langue = 320-480€ par langue
- Délai : 1-2 semaines

#### Option 2 : Traduction automatique + révision

- Utiliser un service de traduction automatique
- Faire réviser par un natif
- Coût : révision ~100-200€
- Délai : quelques jours

#### Option 3 : Traduction communautaire

- Utiliser une plateforme comme Crowdin ou Weblate
- Faire traduire par la communauté de jonglerie
- Coût : Gratuit
- Délai : variable (plusieurs semaines)

## Commandes utiles

### Vérifier la structure i18n

```bash
# Lister toutes les langues disponibles
ls i18n/locales/

# Compter le nombre de clés de traduction
node scripts/check-i18n.js
```

### Utiliser la commande de traduction

Pour marquer les clés à traduire avec `[TODO]` :

```bash
npm run check-translations
```

### Tester les nouvelles langues

```bash
# Démarrer le serveur de développement
npm run dev

# L'application sera accessible sur http://localhost:3000
# Le sélecteur de langue affichera maintenant 13 langues
```

## Prochaines étapes

### 1. Traduction des fichiers (PRIORITAIRE)

**Suédois (sv) - 11 fichiers à traduire :**

- [ ] `i18n/locales/sv/common.json` (~300 clés)
- [ ] `i18n/locales/sv/auth.json` (~50 clés)
- [ ] `i18n/locales/sv/admin.json` (~80 clés)
- [ ] `i18n/locales/sv/app.json` (~40 clés)
- [ ] `i18n/locales/sv/components.json` (~200 clés)
- [ ] `i18n/locales/sv/edition.json` (~150 clés)
- [ ] `i18n/locales/sv/notifications.json` (~100 clés)
- [ ] `i18n/locales/sv/permissions.json` (~30 clés)
- [ ] `i18n/locales/sv/public.json` (~80 clés)
- [ ] `i18n/locales/sv/ticketing.json` (~120 clés)
- [ ] `i18n/locales/sv/feedback.json` (~20 clés)

**Tchèque (cs) - 11 fichiers à traduire :**

- [ ] `i18n/locales/cs/common.json` (~300 clés)
- [ ] `i18n/locales/cs/auth.json` (~50 clés)
- [ ] `i18n/locales/cs/admin.json` (~80 clés)
- [ ] `i18n/locales/cs/app.json` (~40 clés)
- [ ] `i18n/locales/cs/components.json` (~200 clés)
- [ ] `i18n/locales/cs/edition.json` (~150 clés)
- [ ] `i18n/locales/cs/notifications.json` (~100 clés)
- [ ] `i18n/locales/cs/permissions.json` (~30 clés)
- [ ] `i18n/locales/cs/public.json` (~80 clés)
- [ ] `i18n/locales/cs/ticketing.json` (~120 clés)
- [ ] `i18n/locales/cs/feedback.json` (~20 clés)

**Total estimé :** ~2340 clés par langue

### 2. Tests

Une fois les traductions effectuées :

```bash
# Vérifier qu'il n'y a pas de clés manquantes
npm run check-i18n

# Vérifier la parité entre les langues
npm run check-translations

# Lancer les tests
npm run test
```

### 3. Documentation

- [ ] Mettre à jour le README.md (nombre de langues supportées)
- [ ] Mettre à jour `codebase_analysis.md`
- [ ] Annoncer les nouvelles langues aux utilisateurs

## Informations techniques

### Drapeaux utilisés

- **Suédois:** `fi fi-se` (drapeau de la Suède 🇸🇪)
- **Tchèque:** `fi fi-cz` (drapeau de la République tchèque 🇨🇿)

La bibliothèque `flag-icons` est déjà installée et configurée.

### Codes ISO

- **Suédois:** `sv` (ISO 639-1)
- **Tchèque:** `cs` (ISO 639-1)

### Ordre d'affichage

Les langues apparaissent dans l'ordre suivant dans le sélecteur :

1. English (en)
2. Dansk (da)
3. Deutsch (de)
4. Español (es)
5. Français (fr)
6. Italiano (it)
7. Nederlands (nl)
8. Polski (pl)
9. Português (pt)
10. Русский (ru)
11. Українська (uk)
12. **Čeština (cs)** ⬅️ NOUVEAU
13. **Svenska (sv)** ⬅️ NOUVEAU

## Support et ressources

### Traducteurs potentiels

**Pour le suédois :**

- Communauté de jonglerie suédoise
- Conventions : Stockholm Juggling Convention, Göteborg Juggling Convention

**Pour le tchèque :**

- Communauté de jonglerie tchèque
- Conventions : Prague Juggling Convention, Brno Juggling Festival

### Services de traduction recommandés

1. **Crowdin** (plateforme de traduction collaborative)
   - https://crowdin.com/
   - Gratuit pour open source

2. **Weblate** (alternative open source à Crowdin)
   - https://weblate.org/

## Exemple de traduction

Voici un exemple de ce qui doit être traduit dans `common.json` :

### Avant (français)

```json
{
  "loading": "Chargement...",
  "save": "Enregistrer",
  "cancel": "Annuler",
  "delete": "Supprimer",
  "edit": "Modifier"
}
```

### Après (suédois)

```json
{
  "loading": "Laddar...",
  "save": "Spara",
  "cancel": "Avbryt",
  "delete": "Ta bort",
  "edit": "Redigera"
}
```

### Après (tchèque)

```json
{
  "loading": "Načítání...",
  "save": "Uložit",
  "cancel": "Zrušit",
  "delete": "Smazat",
  "edit": "Upravit"
}
```

## Notes importantes

1. **Attention aux caractères spéciaux** : Le suédois utilise åäö, le tchèque utilise čěšřžýáíé
2. **Format des dates** : Vérifier les formats de date/heure locaux
3. **Pluralisation** : Le suédois et le tchèque ont des règles de pluralisation différentes du français
4. **Contexte** : Certaines traductions nécessitent le contexte (ex: "convention" peut signifier "événement" ou "accord")

## Validation

Avant de considérer les traductions comme terminées :

- [ ] Toutes les clés sont traduites (aucun texte en français)
- [ ] Les caractères spéciaux s'affichent correctement
- [ ] Les formats de date/heure sont corrects
- [ ] La navigation fonctionne en suédois et tchèque
- [ ] Les emails de notification sont traduits
- [ ] Aucune erreur dans la console du navigateur

---

**Créé par:** Claude Code
**Date:** 19 Octobre 2025
**Langues ajoutées:** Suédois (sv), Tchèque (cs)
**Total langues supportées:** 13
