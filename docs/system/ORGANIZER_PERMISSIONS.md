# API Permissions Organisateurs & Droits par Édition

Cette documentation décrit le modèle de permissions granulaires appliqué aux organisateurs d'une convention ainsi que le format **per-edition** permettant d'affiner les droits sur des éditions spécifiques.

## Vue d'ensemble

Deux niveaux de droits :

1. Droits globaux (colonnes booléennes sur `ConventionOrganizer`) qui s'appliquent à l'ensemble des éditions de la convention.
2. Droits ciblés par édition (table `EditionOrganizerPermission`) qui octroient `canEdit` et/ou `canDelete` sur une édition précise lorsque les droits globaux étendus (`editAllEditions` / `deleteAllEditions`) ne sont pas accordés.

L'API retourne désormais un format **normalisé** pour chaque organisateur :

```jsonc
{
  "id": 42,
  "title": "Organisateur",
  "addedAt": "2025-08-23T10:11:12.000Z",
  "user": { "id": 7, "pseudo": "alice", "emailHash": "..." },
  "rights": {
    "editConvention": true,
    "deleteConvention": false,
    "manageOrganizers": true,
    "addEdition": true,
    "editAllEditions": false,
    "deleteAllEditions": false,
    "manageVolunteers": false,
    "manageArtists": false,
    "manageMeals": false,
    "manageTicketing": false,
    "manageTasks": false,
  },
  "perEdition": [
    { "editionId": 10, "canEdit": true },
    {
      "editionId": 11,
      "canEdit": true,
      "canDelete": true,
      "canManageVolunteers": true,
      "canManageArtists": true,
      "canManageMeals": false,
      "canManageTicketing": false,
      "canManageTasks": true,
      "canManageStock": false,
    },
  ],
}
```

## Droits globaux disponibles

| Clé `rights`      | Colonne Prisma       | Effet                                                |
| ----------------- | -------------------- | ---------------------------------------------------- |
| editConvention    | canEditConvention    | Modifier les métadonnées de la convention            |
| deleteConvention  | canDeleteConvention  | Supprimer la convention                              |
| manageOrganizers  | canManageOrganizers  | Gérer (créer / modifier / retirer) les organisateurs |
| addEdition        | canAddEdition        | Créer de nouvelles éditions                          |
| editAllEditions   | canEditAllEditions   | Modifier toutes les éditions                         |
| deleteAllEditions | canDeleteAllEditions | Supprimer toutes les éditions                        |
| manageVolunteers  | canManageVolunteers  | Gérer les bénévoles de toutes les éditions           |
| manageArtists     | canManageArtists     | Gérer les artistes de toutes les éditions            |
| manageMeals       | canManageMeals       | Gérer les repas de toutes les éditions               |
| manageTicketing   | canManageTicketing   | Gérer la billetterie de toutes les éditions          |
| manageTasks       | canManageTasks       | Gérer les tâches internes de toutes les éditions     |
| manageStock       | canManageStock       | Gérer le stock matériel de toutes les éditions       |

> Source de vérité : `server/constants/permissions.ts` (constante `ORGANIZER_RIGHTS`).

## Droits par édition (`perEdition`)

Chaque entrée de `perEdition` correspond à un enregistrement dans `EditionOrganizerPermission` :

| Champ               | Type    | Description                                 |
| ------------------- | ------- | ------------------------------------------- |
| editionId           | number  | Identifiant de l'édition ciblée             |
| canEdit             | boolean | Peut modifier cette édition                 |
| canDelete           | boolean | Peut supprimer cette édition                |
| canManageVolunteers | boolean | Peut gérer les bénévoles de cette édition   |
| canManageArtists    | boolean | Peut gérer les artistes de cette édition    |
| canManageMeals      | boolean | Peut gérer les repas de cette édition       |
| canManageTicketing  | boolean | Peut gérer la billetterie de cette édition  |
| canManageTasks      | boolean | Peut gérer les tâches internes de l'édition |
| canManageStock      | boolean | Peut gérer le stock matériel de l'édition   |

Règle de résolution effective (côté serveur, helpers dans `server/utils/permissions/edition-permissions.ts`) :

- Si `rights.editAllEditions` est `true`, `canEdit` ponctuels deviennent redondants (mais peuvent toujours être renvoyés).
- Si `rights.deleteAllEditions` est `true`, `canDelete` ponctuels deviennent redondants.
- Si `rights.manage<Resource>` est `true`, le `canManage<Resource>` ponctuel devient redondant.
- Une entrée sans aucun droit per-edition coché est filtrée à l'enregistrement.

Le créateur de l'édition, l'auteur de la convention et les admins globaux contournent toujours cette logique (ont tous les droits).

## Endpoints

### Lister les organisateurs

`GET /api/conventions/:id/organizers`

Réponse: tableau de organisateurs (format normalisé ci-dessus) ordonné par date d'ajout.

### Créer un organisateur

`POST /api/conventions/:id/organizers`

Body (exemples):

```jsonc
{
  "userIdentifier": "alice@example.org", // ou userId
  "title": "Organisateur",
  "rights": { "manageOrganizers": true, "addEdition": true },
  "perEdition": [{ "editionId": 11, "canEdit": true, "canManageVolunteers": true }],
}
```

Notes:

- `rights` absent => tous `false` par défaut.
- `perEdition` absent => tableau vide.
- Les clés inconnues dans `rights` sont ignorées.

### Mettre à jour (full) un organisateur

`PUT /api/conventions/:id/organizers/:organizerId`

Body:

```jsonc
{
  "title": "Co-orga",
  "rights": { "addEdition": true, "editAllEditions": true },
  "perEdition": [],
}
```

Remplace entièrement les droits globaux et la liste perEdition (après nettoyage des entrées vides).

### Patch droits / perEdition

`PATCH /api/conventions/:id/organizers/:organizerId/rights`

Body:

```jsonc
{
  "rights": { "deleteConvention": true },
  "perEdition": [
    { "editionId": 12, "canEdit": true },
    { "editionId": 13, "canManageVolunteers": true },
  ],
  "title": "Responsable contenu",
}
```

Fusion ciblée: seules les clés présentes sont mises à jour; `perEdition` remplace la liste existante.

### Historique des changements

`GET /api/conventions/:id/organizers/history`

Entrées possibles (`changeType`):

- `RIGHTS_UPDATED`
- `PER_EDITIONS_UPDATED`
- `ARCHIVED` / `UNARCHIVED`

### Mes conventions (intégration droits)

`GET /api/conventions/my-conventions`

Chaque convention inclut désormais ses organisateurs avec `rights` et `perEdition` prêts à consommer côté UI.

## Logique côté Frontend

Le front doit :

1. Utiliser `rights.manageOrganizers` pour afficher le panneau de gestion.
2. Vérifier `rights.editConvention` / `rights.deleteConvention` pour boutons correspondants.
3. Pour une édition donnée:
   - Modification autorisée si `rights.editAllEditions` OU entrée `perEdition` `canEdit` sur l'`editionId`.
   - Suppression autorisée si `rights.deleteAllEditions` OU entrée `perEdition` `canDelete`.
   - Gestion bénévoles autorisée si `rights.manageVolunteers` OU entrée `perEdition` `canManageVolunteers`.

Exemple helper:

```ts
function canEditEdition(collab, editionId) {
  return (
    collab.rights.editAllEditions ||
    collab.perEdition?.some((p) => p.editionId === editionId && p.canEdit)
  )
}

function canManageEditionVolunteers(collab, editionId) {
  return (
    collab.rights.manageVolunteers ||
    collab.perEdition?.some((p) => p.editionId === editionId && p.canManageVolunteers)
  )
}

// Pattern générique pour artistes / repas / billetterie / tâches
function canManageEditionResource(collab, editionId, resource) {
  // resource ∈ 'Volunteers' | 'Artists' | 'Meals' | 'Ticketing' | 'Tasks'
  return (
    collab.rights[`manage${resource}`] ||
    collab.perEdition?.some((p) => p.editionId === editionId && p[`canManage${resource}`])
  )
}
```

## Changement par rapport à l'ancien modèle

- Suppression totale des champs legacy dans les réponses (`canEditConvention`, etc.) au profit de l'objet `rights`.
- Les clients doivent cesser toute référence directe aux anciens booléens plats.

## Validation & Nettoyage côté serveur

- Les entrées `perEdition` sont filtrées pour ne conserver que celles où au moins un droit (`canEdit`, `canDelete`, ou `canManageVolunteers`) est `true`.
- Tout `editionId` inexistant provoque une erreur 400.
- Les listes volumineuses (>100 entrées) sont rejetées (sécurité basique anti-abus) si implémenté (à compléter si besoin).

## Bonnes pratiques de consommation

- Cacher les toggles per-edition si le organisateur possède le droit global correspondant.
- Afficher un résumé lisible: ex. `editAllEditions + deleteAllEditions` => "Gestion complète des éditions" (dérivable via un mapping i18n).
- Toujours recharger la liste après une mise à jour pour éviter les décalages de draft.

## Évolutions futures possibles

- Ajout de droits spécifiques (ex: `managePosts`, `manageLostFound`) selon la granularité désirée.
- Pagination / recherche sur liste de organisateurs.
- Audit étendu avec diff JSON des droits.

---

Dernière mise à jour: 2026-05-18 (ajout `manageStock`).
