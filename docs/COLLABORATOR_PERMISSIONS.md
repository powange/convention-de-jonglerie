# API Permissions Collaborateurs & Droits par Édition

Cette documentation décrit le modèle de permissions granulaires appliqué aux collaborateurs d'une convention ainsi que le format **per-edition** permettant d'affiner les droits sur des éditions spécifiques.

## Vue d'ensemble

Deux niveaux de droits :

1. Droits globaux (colonnes booléennes sur `ConventionCollaborator`) qui s'appliquent à l'ensemble des éditions de la convention.
2. Droits ciblés par édition (table `EditionCollaboratorPermission`) qui octroient `canEdit` et/ou `canDelete` sur une édition précise lorsque les droits globaux étendus (`editAllEditions` / `deleteAllEditions`) ne sont pas accordés.

L'API retourne désormais un format **normalisé** pour chaque collaborateur :

```jsonc
{
  "id": 42,
  "title": "Organisateur",
  "addedAt": "2025-08-23T10:11:12.000Z",
  "user": { "id": 7, "pseudo": "alice", "emailHash": "..." },
  "rights": {
    "editConvention": true,
    "deleteConvention": false,
    "manageCollaborators": true,
    "addEdition": true,
    "editAllEditions": false,
    "deleteAllEditions": false,
  },
  "perEdition": [
    { "editionId": 10, "canEdit": true },
    { "editionId": 11, "canEdit": true, "canDelete": true },
  ],
}
```

## Droits globaux disponibles

| Clé `rights`        | Colonne Prisma         | Effet                                                 |
| ------------------- | ---------------------- | ----------------------------------------------------- |
| editConvention      | canEditConvention      | Modifier les métadonnées de la convention             |
| deleteConvention    | canDeleteConvention    | Supprimer la convention                               |
| manageCollaborators | canManageCollaborators | Gérer (créer / modifier / retirer) les collaborateurs |
| addEdition          | canAddEdition          | Créer de nouvelles éditions                           |
| editAllEditions     | canEditAllEditions     | Modifier toutes les éditions                          |
| deleteAllEditions   | canDeleteAllEditions   | Supprimer toutes les éditions                         |

## Droits par édition (`perEdition`)

Chaque entrée de `perEdition` correspond à un enregistrement dans `EditionCollaboratorPermission` :

| Champ     | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| editionId | number  | Identifiant de l'édition ciblée |
| canEdit   | boolean | Peut modifier cette édition     |
| canDelete | boolean | Peut supprimer cette édition    |

Règle de résolution effective :

- Si `rights.editAllEditions` est `true`, `canEdit` ponctuels deviennent redondants (mais peuvent toujours être renvoyés).
- Si `rights.deleteAllEditions` est `true`, `canDelete` ponctuels deviennent redondants.
- Une entrée sans aucun des deux (canEdit/delete) est filtrée à l'enregistrement.

## Endpoints

### Lister les collaborateurs

`GET /api/conventions/:id/collaborators`

Réponse: tableau de collaborateurs (format normalisé ci-dessus) ordonné par date d'ajout.

### Créer un collaborateur

`POST /api/conventions/:id/collaborators`

Body (exemples):

```jsonc
{
  "userIdentifier": "alice@example.org", // ou userId
  "title": "Organisateur",
  "rights": { "manageCollaborators": true, "addEdition": true },
  "perEdition": [{ "editionId": 11, "canEdit": true }],
}
```

Notes:

- `rights` absent => tous `false` par défaut.
- `perEdition` absent => tableau vide.
- Les clés inconnues dans `rights` sont ignorées.

### Mettre à jour (full) un collaborateur

`PUT /api/conventions/:id/collaborators/:collaboratorId`

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

`PATCH /api/conventions/:id/collaborators/:collaboratorId/rights`

Body:

```jsonc
{
  "rights": { "deleteConvention": true },
  "perEdition": [{ "editionId": 12, "canEdit": true }],
  "title": "Responsable contenu",
}
```

Fusion ciblée: seules les clés présentes sont mises à jour; `perEdition` remplace la liste existante.

### Historique des changements

`GET /api/conventions/:id/collaborators/history`

Entrées possibles (`changeType`):

- `RIGHTS_UPDATED`
- `PER_EDITIONS_UPDATED`
- `ARCHIVED` / `UNARCHIVED`

### Mes conventions (intégration droits)

`GET /api/conventions/my-conventions`

Chaque convention inclut désormais ses collaborateurs avec `rights` et `perEdition` prêts à consommer côté UI.

## Logique côté Frontend

Le front doit :

1. Utiliser `rights.manageCollaborators` pour afficher le panneau de gestion.
2. Vérifier `rights.editConvention` / `rights.deleteConvention` pour boutons correspondants.
3. Pour une édition donnée:
   - Modification autorisée si `rights.editAllEditions` OU entrée `perEdition` `canEdit` sur l'`editionId`.
   - Suppression autorisée si `rights.deleteAllEditions` OU entrée `perEdition` `canDelete`.

Exemple helper:

```ts
function canEditEdition(collab, editionId) {
  return (
    collab.rights.editAllEditions ||
    collab.perEdition?.some((p) => p.editionId === editionId && p.canEdit)
  )
}
```

## Changement par rapport à l'ancien modèle

- Suppression totale des champs legacy dans les réponses (`canEditConvention`, etc.) au profit de l'objet `rights`.
- Les clients doivent cesser toute référence directe aux anciens booléens plats.

## Validation & Nettoyage côté serveur

- Les entrées `perEdition` sont filtrées pour ne conserver que celles où `canEdit` ou `canDelete` est `true`.
- Tout `editionId` inexistant provoque une erreur 400.
- Les listes volumineuses (>100 entrées) sont rejetées (sécurité basique anti-abus) si implémenté (à compléter si besoin).

## Bonnes pratiques de consommation

- Cacher les toggles per-edition si le collaborateur possède le droit global correspondant.
- Afficher un résumé lisible: ex. `editAllEditions + deleteAllEditions` => "Gestion complète des éditions" (dérivable via un mapping i18n).
- Toujours recharger la liste après une mise à jour pour éviter les décalages de draft.

## Évolutions futures possibles

- Ajout de droits spécifiques (ex: `managePosts`, `manageLostFound`) selon la granularité désirée.
- Pagination / recherche sur liste de collaborateurs.
- Audit étendu avec diff JSON des droits.

---

Dernière mise à jour: 2025-08-24.
