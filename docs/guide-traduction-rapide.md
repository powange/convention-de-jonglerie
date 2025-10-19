# Guide de traduction rapide - Suédois et Tchèque

## Option recommandée : Script DeepL automatisé

### Étape 1 : Installer DeepL

```bash
npm install --save-dev deepl-node
```

### Étape 2 : Obtenir une clé API DeepL (GRATUIT)

1. Allez sur https://www.deepl.com/pro-api
2. Créez un compte **DeepL API Free**
3. Copiez votre clé API
4. **Limite gratuite : 500 000 caractères/mois** (largement suffisant)

### Étape 3 : Exécuter la traduction

```bash
DEEPL_API_KEY=votre_cle_api_ici node scripts/translate-with-deepl.js
```

**Durée estimée :** 15-20 minutes pour traduire les 22 fichiers

### Résultat attendu

```
🌍 Traduction automatique avec DeepL

Configuration:
  Source: FR (Français)
  Cibles: Suédois, Tchèque
  Fichiers: 11
  Total traductions: 22

============================================================
🇸🇪 TRADUCTION VERS SUÉDOIS (SV)
============================================================

📄 Traduction de common.json vers sv...
  Traduction: calendar.add_to_calendar
  Traduction: calendar.day
  ... [300+ clés]
✅ common.json traduit avec succès

📄 Traduction de auth.json vers sv...
  ... [50+ clés]
✅ auth.json traduit avec succès

[...]

============================================================
🇨🇿 TRADUCTION VERS TCHÈQUE (CS)
============================================================

[Même processus...]

============================================================
✅ TRADUCTION TERMINÉE
============================================================

Prochaines étapes:
1. Vérifier les traductions générées
2. Faire réviser par un locuteur natif si possible
3. Tester l'application: npm run dev
4. Vérifier la parité: npm run check-translations
```

## Alternative : Traduction manuelle par fichier

Si vous préférez traduire manuellement ou réviser les traductions DeepL :

### Fichiers par ordre de priorité

#### 🔴 Priorité 1 (Interface de base)
1. **common.json** (~300 clés) - Boutons, actions, messages communs
2. **app.json** (~40 clés) - Titre app, menu principal
3. **auth.json** (~50 clés) - Connexion, inscription

#### 🟡 Priorité 2 (Fonctionnalités principales)
4. **components.json** (~200 clés) - Textes des composants UI
5. **edition.json** (~150 clés) - Gestion des éditions
6. **public.json** (~80 clés) - Pages publiques

#### 🟢 Priorité 3 (Fonctionnalités avancées)
7. **notifications.json** (~100 clés)
8. **ticketing.json** (~120 clés)
9. **admin.json** (~80 clés)
10. **permissions.json** (~30 clés)
11. **feedback.json** (~20 clés)

### Outils de traduction manuelle

#### Option A : DeepL Web (gratuit)
1. Ouvrir https://www.deepl.com/translator
2. Copier le contenu JSON
3. Traduire par sections
4. Coller dans les fichiers

#### Option B : Google Translate (moins précis)
Même processus mais avec translate.google.com

### Exemple de traduction d'un fichier

**Original (fr/app.json) :**
```json
{
  "title": "Convention de Jonglerie",
  "description": "Trouvez et gérez vos conventions",
  "tagline": "La plateforme collaborative"
}
```

**Suédois (sv/app.json) :**
```json
{
  "title": "Jongleringskongress",
  "description": "Hitta och hantera dina kongresser",
  "tagline": "Den kollaborativa plattformen"
}
```

**Tchèque (cs/app.json) :**
```json
{
  "title": "Žonglovací konvence",
  "description": "Najděte a spravujte své konvence",
  "tagline": "Kolaborativní platforma"
}
```

## Validation des traductions

### Vérifier qu'il n'y a pas de clés manquantes

```bash
npm run check-i18n
```

### Vérifier la parité entre langues

```bash
npm run check-translations
```

### Tester l'application

```bash
npm run dev
```

Puis changez la langue dans le sélecteur et naviguez dans l'interface.

## Points d'attention

### 1. Caractères spéciaux

**Suédois :** å, ä, ö
- Exemple : "Lägg till" (Ajouter), "Spara" (Enregistrer)

**Tchèque :** č, ě, š, ř, ž, ý, á, í, é, ú, ů
- Exemple : "Přidat" (Ajouter), "Uložit" (Enregistrer)

### 2. Variables dans les traductions

Ne PAS traduire les variables entre accolades :

```json
{
  "welcome": "Bienvenue {name} !"
}
```

Devient en suédois :
```json
{
  "welcome": "Välkommen {name}!"
}
```

⚠️ **{name} reste identique !**

### 3. Pluralisation

Les règles de pluriel diffèrent :

**Français :** 0-1 / 2+
**Suédois :** 1 / autres
**Tchèque :** 1 / 2-4 / 5+

Si vous voyez des clés avec `_one`, `_other`, `_few`, respectez la structure.

### 4. Formats de date

**Suédois :** ÅÅÅÅ-MM-DD (2025-10-19)
**Tchèque :** DD.MM.ÅÅÅÅ (19.10.2025)

Les formats sont gérés par code, mais soyez conscients des différences.

## Estimation des coûts

### DeepL API Free
- **Gratuit** : 500 000 caractères/mois
- Projet estimé : ~60 000 caractères total
- **Coût : 0€** (dans la limite gratuite)

### DeepL API Pro (si dépassement)
- **19,99€/mois** : 1 million caractères
- ou **4,99€ + 20€/million** supplémentaire

### Traduction humaine (alternative)
- **0,08-0,12€/mot**
- Projet estimé : ~2000 mots/langue
- **Coût : 320-480€ par langue**

## Workflow recommandé

```
1. Traduction automatique DeepL
   └─> 22 fichiers traduits en 15-20 min

2. Révision des fichiers prioritaires
   └─> common.json, auth.json, app.json
   └─> Vérifier cohérence terminologique

3. Tests utilisateur
   └─> npm run dev
   └─> Naviguer en sv et cs
   └─> Noter les traductions maladroites

4. Corrections ciblées
   └─> Affiner les traductions problématiques

5. Validation finale
   └─> npm run check-i18n
   └─> npm run check-translations
   └─> npm run test
```

## FAQ

### Q : DeepL est-il gratuit ?
**R :** Oui, jusqu'à 500 000 caractères/mois. Largement suffisant pour ce projet.

### Q : Les traductions DeepL sont-elles bonnes ?
**R :** DeepL est considéré comme le meilleur traducteur automatique, bien meilleur que Google Translate pour les langues européennes.

### Q : Dois-je tout réviser ?
**R :** Au minimum, révisez les 3 fichiers prioritaires (common, auth, app). Le reste peut être utilisé tel quel et corrigé si nécessaire.

### Q : Combien de temps pour tout traduire manuellement ?
**R :** ~15-20 heures par langue = 30-40 heures total. **Pas recommandé.**

### Q : Puis-je demander à la communauté ?
**R :** Oui ! Vous pouvez utiliser Crowdin ou poster sur les forums de jonglerie suédois/tchèques.

## Ressources

### Communautés de jonglerie

**Suède :**
- Stockholm Juggling Convention
- Forum : svenskjonglering.se

**République tchèque :**
- Prague Juggling Convention
- Forum : jonglerovani.cz

### Plateformes de traduction collaborative

- **Crowdin** : https://crowdin.com/ (gratuit pour open source)
- **Weblate** : https://weblate.org/ (alternative open source)
- **Lokalise** : https://lokalise.com/

---

**Temps estimé total avec DeepL : 30-45 minutes**
(15-20 min traduction + 15-25 min révision rapide)

**Qualité attendue : 85-95%**
(suffisant pour usage production, parfait après révision)
