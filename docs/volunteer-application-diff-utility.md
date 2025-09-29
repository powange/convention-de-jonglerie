# Utilitaire de Comparaison des Candidatures de Bénévoles

L'utilitaire `volunteer-application-diff.ts` fournit des fonctions pour comparer et détecter les modifications apportées aux candidatures de bénévoles.

## Fonctionnalités

### Types et Interfaces

- **`ApplicationData`** : Interface pour les données d'une candidature
- **`ApplicationChanges`** : Interface pour les résultats de comparaison

### Fonctions Principales

#### `compareApplicationChanges()`

Compare les données avant/après modification et génère un rapport détaillé des changements.

```typescript
import { compareApplicationChanges } from '~/server/utils/volunteer-application-diff'

const changes = await compareApplicationChanges(
  {
    teamPreferences: ['team1', 'team2'],
    dietaryPreference: 'NONE',
    allergies: 'Aucune',
    allergySeverity: null,
  },
  {
    teamPreferences: ['team1', 'team3'],
    dietaryPreference: 'VEGETARIAN',
    allergies: 'Fruits à coque',
    allergySeverity: 'MODERATE',
  }
)

// Résultat :
// {
//   changes: [
//     "Équipes préférées ajoutées : Équipe logistique",
//     "Équipes préférées supprimées : Équipe accueil",
//     "Régime alimentaire modifié : Aucun régime spécial → Végétarien",
//     "Allergies modifiées : \"Aucune\" → \"Fruits à coque\"",
//     "Sévérité des allergies modifiée : Non spécifiée → Modérée"
//   ],
//   hasChanges: true
// }
```

#### `hasApplicationDataChanges()`

Vérifie rapidement si des données ont été modifiées sans analyser les détails.

```typescript
import { hasApplicationDataChanges } from '~/server/utils/volunteer-application-diff'

const hasChanges = hasApplicationDataChanges({
  teamPreferences: ['team1'],
  dietaryPreference: undefined,
  allergies: undefined,
  allergySeverity: undefined,
})
// Résultat : true (car teamPreferences est défini)
```

## Types de Changements Détectés

### 1. Préférences d'Équipes

- **Ajout d'équipes** : "Équipes préférées ajoutées : Équipe logistique, Équipe accueil"
- **Suppression d'équipes** : "Équipes préférées supprimées : Équipe cuisine"
- **Remplacement complet** : Combinaison d'ajouts et suppressions

### 2. Régime Alimentaire

- **Modification** : "Régime alimentaire modifié : Aucun régime spécial → Végétarien"
- **Types supportés** : `NONE`, `VEGETARIAN`, `VEGAN`

### 3. Allergies

- **Modification** : "Allergies modifiées : \"Pollen\" → \"Fruits à coque\""
- **Ajout** : "Allergies ajoutées : \"Lactose\""
- **Suppression** : "Allergies supprimées : \"Gluten\""

### 4. Sévérité des Allergies

- **Modification** : "Sévérité des allergies modifiée : Légère → Sévère"
- **Niveaux supportés** : `LIGHT`, `MODERATE`, `SEVERE`, `CRITICAL`

## Utilisation dans les APIs

### Exemple d'intégration complète

```typescript
// server/api/editions/[id]/volunteers/applications/[applicationId].patch.ts
import {
  compareApplicationChanges,
  hasApplicationDataChanges,
} from '../../../../../utils/volunteer-application-diff'

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.parse(await readBody(event))

  // Vérifier s'il y a des modifications
  if (parsed.status === undefined && hasApplicationDataChanges(parsed)) {
    // Comparer les changements
    const applicationChanges = await compareApplicationChanges(
      {
        teamPreferences: application.teamPreferences,
        dietaryPreference: application.dietaryPreference,
        allergies: application.allergies,
        allergySeverity: application.allergySeverity,
      },
      parsed
    )

    const { changes } = applicationChanges

    // Mettre à jour la base de données
    await updateApplication(parsed)

    // Envoyer notification si nécessaire
    if (changes.length > 0) {
      await sendModificationNotification(changes)
    }
  }
})
```

## Avantages

1. **Séparation des responsabilités** : Logique de comparaison isolée de l'API
2. **Réutilisabilité** : Peut être utilisé dans d'autres endpoints
3. **Testabilité** : Fonctions pures faciles à tester
4. **Maintenabilité** : Code centralisé et organisé
5. **Lisibilité** : Messages de changement clairs et descriptifs

## Intégration avec les Notifications

L'utilitaire s'intègre parfaitement avec le système de notifications pour informer les bénévoles des modifications apportées à leur candidature :

```typescript
if (changes.length > 0) {
  let message = `Votre candidature a été modifiée`
  message += `.\n\nModifications :\n• ${changes.join('\n• ')}`

  await NotificationService.create({
    type: 'INFO',
    title: 'Modification de votre candidature',
    message,
    category: 'volunteer',
  })
}
```

Cet utilitaire assure une gestion cohérente et professionnelle des modifications de candidatures dans toute l'application.
