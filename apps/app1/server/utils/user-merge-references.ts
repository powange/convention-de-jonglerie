/**
 * Inventaire des colonnes qui référencent `User.id`, et primitives pures utilisées par la
 * fusion de comptes (`server/utils/user-merge.ts`).
 *
 * ⚠️ Ce fichier ne doit importer NI Prisma NI aucun utilitaire serveur : il est chargé tel
 * quel par les tests unitaires (projet `unit` de Vitest, qui n'a ni l'alias `#server` ni le
 * `prisma` auto-importé).
 *
 * ⚠️ MAINTENANCE — toute nouvelle relation vers `User` dans `prisma/schema/*.prisma` doit
 * être ajoutée ici, sinon la fusion laissera des lignes rattachées au compte supprimé (et
 * la suppression finale échouera sur une contrainte de clé étrangère). Le DMMF exposé par
 * Prisma 7 à l'exécution est réduit (ni `relationFromFields` ni `uniqueFields`) : cette
 * table ne peut pas être dérivée automatiquement.
 */

/** Regroupement utilisé pour l'aperçu affiché à l'administrateur. */
export type MergeGroup =
  | 'conventions'
  | 'volunteers'
  | 'artists'
  | 'carpool'
  | 'messenger'
  | 'workshops'
  | 'tasks'
  | 'stock'
  | 'posts'
  | 'lostFound'
  | 'notifications'
  | 'treasury'
  | 'misc'

export interface UserReference {
  /** Clé du delegate Prisma (camelCase du modèle), ex. `editionVolunteerApplication`. */
  model: string
  /** Colonne portant l'identifiant utilisateur. */
  field: string
  /**
   * Autres colonnes de la contrainte `@@unique` contenant `field`.
   * Renseigné uniquement quand un conflit est possible entre les deux comptes.
   */
  uniqueWith?: string[]
  group: MergeGroup
  /**
   * `true` pour les colonnes qui stockent un `User.id` sans relation Prisma ni clé
   * étrangère SQL : elles doivent être transférées, mais aucune cascade ne les protège.
   */
  soft?: boolean
}

/**
 * 48 colonnes : 44 relations Prisma + 4 références « molles ».
 * Vérifié contre `prisma/schema/*.prisma`.
 */
export const USER_REFERENCES: UserReference[] = [
  // --- Conventions, éditions et organisateurs ---
  // ConventionOrganizer.userId est traité en premier (cf. MERGE_ORDER plus bas) : écarter
  // le doublon fait disparaître en cascade EditionOrganizer, EditionOrganizerPermission,
  // OrganizerMealSelection et EditionOrganizerHandoutItem, qui portent leurs propres
  // contraintes d'unicité.
  {
    model: 'conventionOrganizer',
    field: 'userId',
    uniqueWith: ['conventionId'],
    group: 'conventions',
  },
  { model: 'conventionOrganizer', field: 'addedById', group: 'conventions' },
  { model: 'convention', field: 'authorId', group: 'conventions' },
  { model: 'edition', field: 'creatorId', group: 'conventions' },
  {
    model: 'conventionClaimRequest',
    field: 'userId',
    uniqueWith: ['conventionId'],
    group: 'conventions',
  },
  { model: 'organizerPermissionHistory', field: 'actorId', group: 'conventions' },
  { model: 'organizerPermissionHistory', field: 'targetUserId', group: 'conventions' },
  { model: 'editionOrganizer', field: 'entryValidatedBy', group: 'conventions', soft: true },

  // --- Bénévolat ---
  {
    model: 'editionVolunteerApplication',
    field: 'userId',
    uniqueWith: ['eventId'],
    group: 'volunteers',
  },
  { model: 'editionVolunteerApplication', field: 'addedById', group: 'volunteers' },
  {
    model: 'editionVolunteerApplication',
    field: 'entryValidatedBy',
    group: 'volunteers',
    soft: true,
  },
  {
    model: 'volunteerAssignment',
    field: 'userId',
    uniqueWith: ['timeSlotId'],
    group: 'volunteers',
  },
  { model: 'volunteerAssignment', field: 'assignedById', group: 'volunteers' },
  { model: 'volunteerComment', field: 'userId', uniqueWith: ['eventId'], group: 'volunteers' },
  { model: 'volunteerNotificationGroup', field: 'senderId', group: 'volunteers' },
  {
    model: 'volunteerNotificationConfirmation',
    field: 'userId',
    uniqueWith: ['volunteerNotificationGroupId'],
    group: 'volunteers',
  },

  // --- Artistes et spectacles ---
  { model: 'artistNotificationGroup', field: 'senderId', group: 'artists' },
  {
    model: 'artistNotificationConfirmation',
    field: 'userId',
    uniqueWith: ['artistNotificationGroupId'],
    group: 'artists',
  },
  { model: 'editionArtist', field: 'userId', uniqueWith: ['editionId'], group: 'artists' },
  { model: 'editionArtist', field: 'entryValidatedBy', group: 'artists' },
  { model: 'editionArtist', field: 'pickupResponsibleId', group: 'artists' },
  { model: 'editionArtist', field: 'dropoffResponsibleId', group: 'artists' },
  { model: 'showApplication', field: 'userId', uniqueWith: ['showCallId'], group: 'artists' },
  { model: 'showApplication', field: 'decidedById', group: 'artists' },
  { model: 'showPreset', field: 'userId', uniqueWith: ['name'], group: 'artists' },
  {
    model: 'showCallSurveyVote',
    field: 'userId',
    uniqueWith: ['showCallId', 'applicationId'],
    group: 'artists',
  },

  // --- Covoiturage ---
  { model: 'carpoolOffer', field: 'userId', group: 'carpool' },
  { model: 'carpoolRequest', field: 'userId', group: 'carpool' },
  { model: 'carpoolComment', field: 'userId', group: 'carpool' },
  { model: 'carpoolRequestComment', field: 'userId', group: 'carpool' },
  { model: 'carpoolPassenger', field: 'userId', uniqueWith: ['carpoolOfferId'], group: 'carpool' },
  { model: 'carpoolPassenger', field: 'addedById', group: 'carpool', soft: true },
  { model: 'carpoolBooking', field: 'requesterId', group: 'carpool' },

  // --- Messagerie ---
  {
    model: 'conversationParticipant',
    field: 'userId',
    uniqueWith: ['conversationId'],
    group: 'messenger',
  },

  // --- Ateliers ---
  { model: 'workshop', field: 'creatorId', group: 'workshops' },
  { model: 'workshopFavorite', field: 'userId', uniqueWith: ['workshopId'], group: 'workshops' },

  // --- Tâches ---
  { model: 'taskAssignment', field: 'userId', uniqueWith: ['taskId'], group: 'tasks' },
  { model: 'taskComment', field: 'userId', group: 'tasks' },

  // --- Stock ---
  { model: 'stockReservation', field: 'userId', group: 'stock' },

  // --- Publications d'édition ---
  { model: 'editionPost', field: 'userId', group: 'posts' },
  { model: 'editionPostComment', field: 'userId', group: 'posts' },

  // --- Objets trouvés ---
  { model: 'lostFoundItem', field: 'userId', group: 'lostFound' },
  { model: 'lostFoundComment', field: 'userId', group: 'lostFound' },

  // --- Notifications ---
  { model: 'notification', field: 'userId', group: 'notifications' },
  { model: 'fcmToken', field: 'userId', uniqueWith: ['token'], group: 'notifications' },

  // --- Divers ---
  // Une avance de trésorerie porte de l'argent dû à la personne : elle doit suivre le compte
  // conservé, pas disparaître dans le fourre-tout.
  { model: 'treasuryEntry', field: 'advancedById', group: 'treasury' },
  { model: 'feedback', field: 'userId', group: 'misc' },
  { model: 'apiErrorLog', field: 'userId', group: 'misc' },
  { model: 'apiErrorLog', field: 'resolvedBy', group: 'misc', soft: true },
  { model: 'apiToken', field: 'createdById', group: 'misc' },
  { model: 'passwordResetToken', field: 'userId', group: 'misc' },
]

/**
 * Tables de jointure des relations many-to-many implicites de `User`.
 * Elles n'existent pas comme modèles Prisma : elles sont traitées en SQL brut.
 * La colonne `B` porte l'identifiant utilisateur (`A` référence `Edition.id`).
 */
export const USER_IMPLICIT_JOIN_TABLES = ['_FavoriteEditions', '_AttendingEditions'] as const

/** Ordre de traitement : les modèles listés ici passent avant les autres. */
export const MERGE_PRIORITY_MODELS = ['conventionOrganizer'] as const

export interface ConflictSplit {
  /** Identifiants des lignes du compte absorbé à rattacher au compte conservé. */
  toTransfer: (number | string)[]
  /** Identifiants des lignes du compte absorbé en doublon, donc à supprimer. */
  duplicates: (number | string)[]
}

type Row = Record<string, unknown> & { id: number | string }

/**
 * Sépare les lignes du compte absorbé en « transférables » et « doublons », au regard des
 * lignes déjà détenues par le compte conservé sur la même contrainte d'unicité.
 *
 * @param sourceRows Lignes du compte absorbé, avec `id` et les colonnes de `uniqueWith`.
 * @param targetRows Lignes du compte conservé, avec au moins les colonnes de `uniqueWith`.
 * @param uniqueWith Colonnes complétant la contrainte `@@unique` (hors colonne utilisateur).
 */
export function splitConflicts(
  sourceRows: Row[],
  targetRows: Record<string, unknown>[],
  uniqueWith: string[]
): ConflictSplit {
  const keyOf = (row: Record<string, unknown>) =>
    JSON.stringify(uniqueWith.map((field) => row[field] ?? null))

  const takenKeys = new Set(targetRows.map(keyOf))
  const toTransfer: (number | string)[] = []
  const duplicates: (number | string)[] = []

  for (const row of sourceRows) {
    const key = keyOf(row)
    if (takenKeys.has(key)) {
      duplicates.push(row.id)
    } else {
      // Deux lignes du compte absorbé peuvent aussi entrer en conflit entre elles une fois
      // rattachées au compte conservé : la première gagne, les suivantes sont des doublons.
      takenKeys.add(key)
      toTransfer.push(row.id)
    }
  }

  return { toTransfer, duplicates }
}

/** Trie les références pour que les modèles prioritaires soient traités en premier. */
export function orderedUserReferences(): UserReference[] {
  const priority = (ref: UserReference) =>
    (MERGE_PRIORITY_MODELS as readonly string[]).includes(ref.model) ? 0 : 1
  return [...USER_REFERENCES].sort((a, b) => priority(a) - priority(b))
}
