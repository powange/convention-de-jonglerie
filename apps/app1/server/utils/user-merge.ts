/**
 * Fusion de deux comptes utilisateur.
 *
 * Le compte « cible » est conservé, le compte « source » est absorbé puis supprimé.
 * Toutes les lignes rattachées au compte source sont repointées vers le compte cible ;
 * lorsqu'une contrainte d'unicité est déjà satisfaite par le compte cible, la ligne du
 * compte source est écartée (supprimée) — la ligne du compte conservé fait foi.
 *
 * L'inventaire des colonnes concernées vit dans `user-merge-references.ts`, qui doit être
 * tenu à jour à chaque nouvelle relation vers `User`.
 */

import { getEmailHash } from './email-hash'
import { createLogger } from './logger'
import {
  orderedUserReferences,
  splitConflicts,
  USER_IMPLICIT_JOIN_TABLES,
  type MergeGroup,
  type UserReference,
} from './user-merge-references'

import type { PrismaTransaction } from '../types/prisma-helpers'

const log = createLogger('USER-MERGE')

/** Champs de profil que l'administrateur peut arbitrer dans le modal de fusion. */
export const MERGE_ARBITRABLE_FIELDS = [
  // Bloc identifiants : email + emailHash + password + authProvider + isEmailVerified.
  'credentials',
  'pseudo',
  'nom',
  'prenom',
  'phone',
  'pronouns',
  'preferredLanguage',
  'profilePicture',
] as const

export type MergeArbitrableField = (typeof MERGE_ARBITRABLE_FIELDS)[number]

/** `'target'` = garder la valeur du compte conservé, `'source'` = reprendre celle de l'absorbé. */
export type MergeFieldChoice = 'target' | 'source'

export type MergeFieldChoices = Partial<Record<MergeArbitrableField, MergeFieldChoice>>

export interface MergeGroupImpact {
  group: MergeGroup
  /** Nombre de lignes repointées vers le compte conservé. */
  transferred: number
  /** Nombre de lignes du compte absorbé écartées car en doublon. */
  duplicates: number
}

export interface MergeImpact {
  groups: MergeGroupImpact[]
  totalTransferred: number
  totalDuplicates: number
}

/** Colonnes de `User` chargées pour l'arbitrage du profil. */
export const MERGE_USER_SELECT = {
  id: true,
  email: true,
  emailHash: true,
  pseudo: true,
  nom: true,
  prenom: true,
  password: true,
  authProvider: true,
  phone: true,
  pronouns: true,
  preferredLanguage: true,
  profilePicture: true,
  dietaryPreference: true,
  allergies: true,
  allergySeverity: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  isEmailVerified: true,
  isGlobalAdmin: true,
  isVolunteer: true,
  isArtist: true,
  isOrganizer: true,
  createdAt: true,
  lastLoginAt: true,
} as const

type MergeUser = {
  id: number
  email: string
  emailHash: string
  pseudo: string
  nom: string | null
  prenom: string | null
  password: string | null
  authProvider: string
  phone: string | null
  pronouns: string | null
  dietaryPreference: string
  allergies: string | null
  allergySeverity: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  preferredLanguage: string
  profilePicture: string | null
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  isVolunteer: boolean
  isArtist: boolean
  isOrganizer: boolean
  createdAt: Date
  lastLoginAt: Date | null
}

type Delegate = {
  count: (args: unknown) => Promise<number>
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  updateMany: (args: unknown) => Promise<{ count: number }>
  deleteMany: (args: unknown) => Promise<{ count: number }>
}

function delegateFor(client: PrismaTransaction | typeof prisma, model: string): Delegate {
  const delegate = (client as unknown as Record<string, Delegate>)[model]
  if (!delegate?.updateMany) {
    // Signale immédiatement une entrée obsolète de USER_REFERENCES plutôt que de laisser
    // passer silencieusement des lignes non transférées.
    throw createError({
      status: 500,
      message: `Modèle Prisma inconnu dans USER_REFERENCES : « ${model} »`,
    })
  }
  return delegate
}

function emptyImpact(): Map<MergeGroup, MergeGroupImpact> {
  return new Map()
}

function addImpact(
  impacts: Map<MergeGroup, MergeGroupImpact>,
  group: MergeGroup,
  transferred: number,
  duplicates: number
) {
  const current = impacts.get(group) ?? { group, transferred: 0, duplicates: 0 }
  current.transferred += transferred
  current.duplicates += duplicates
  impacts.set(group, current)
}

function toImpact(impacts: Map<MergeGroup, MergeGroupImpact>): MergeImpact {
  const groups = [...impacts.values()].filter((g) => g.transferred > 0 || g.duplicates > 0)
  return {
    groups,
    totalTransferred: groups.reduce((sum, g) => sum + g.transferred, 0),
    totalDuplicates: groups.reduce((sum, g) => sum + g.duplicates, 0),
  }
}

/**
 * Calcule, pour une référence donnée, les lignes du compte source à transférer et celles à
 * écarter. Sans contrainte d'unicité, tout est transférable.
 */
async function resolveReference(
  client: PrismaTransaction | typeof prisma,
  ref: UserReference,
  sourceId: number,
  targetId: number
): Promise<{
  transfer: (number | string)[] | null
  transferCount: number
  duplicates: (number | string)[]
}> {
  const delegate = delegateFor(client, ref.model)

  if (!ref.uniqueWith?.length) {
    const transferCount = await delegate.count({ where: { [ref.field]: sourceId } })
    return { transfer: null, transferCount, duplicates: [] }
  }

  const select: Record<string, boolean> = { id: true }
  for (const field of ref.uniqueWith) select[field] = true

  const [sourceRows, targetRows] = await Promise.all([
    delegate.findMany({ where: { [ref.field]: sourceId }, select }),
    delegate.findMany({ where: { [ref.field]: targetId }, select }),
  ])

  const { toTransfer, duplicates } = splitConflicts(
    sourceRows as ({ id: number | string } & Record<string, unknown>)[],
    targetRows,
    ref.uniqueWith
  )

  return { transfer: toTransfer, transferCount: toTransfer.length, duplicates }
}

/**
 * Compte, pour une table de jointure implicite, les lignes transférables et les doublons.
 *
 * Les compteurs de lignes affectées renvoyés par `UPDATE IGNORE` ne conviennent pas : le
 * connecteur MariaDB remonte les lignes *trouvées*, doublons ignorés compris. Ce décompte
 * explicite est donc utilisé aussi bien pour l'aperçu que pour la fusion réelle.
 */
async function countImplicitJoinImpact(
  client: PrismaTransaction | typeof prisma,
  table: string,
  targetId: number,
  sourceId: number
): Promise<{ transferred: number; duplicates: number }> {
  const rows = await client.$queryRawUnsafe<
    { transferred: bigint | number | null; duplicates: bigint | number | null }[]
  >(
    `SELECT
       SUM(CASE WHEN t.A IS NULL THEN 1 ELSE 0 END) AS transferred,
       SUM(CASE WHEN t.A IS NULL THEN 0 ELSE 1 END) AS duplicates
     FROM \`${table}\` s
     LEFT JOIN \`${table}\` t ON t.A = s.A AND t.B = ?
     WHERE s.B = ?`,
    targetId,
    sourceId
  )
  const row = rows[0]
  return {
    transferred: Number(row?.transferred ?? 0),
    duplicates: Number(row?.duplicates ?? 0),
  }
}

/**
 * Aperçu (lecture seule) de la fusion : ce qui serait transféré et ce qui serait écarté.
 */
export async function previewUserMerge(targetId: number, sourceId: number): Promise<MergeImpact> {
  const impacts = emptyImpact()

  for (const ref of orderedUserReferences()) {
    const { transferCount, duplicates } = await resolveReference(prisma, ref, sourceId, targetId)
    addImpact(impacts, ref.group, transferCount, duplicates.length)
  }

  // Favoris et participations : relations many-to-many implicites, comptées en SQL brut.
  for (const table of USER_IMPLICIT_JOIN_TABLES) {
    const { transferred, duplicates } = await countImplicitJoinImpact(
      prisma,
      table,
      targetId,
      sourceId
    )
    addImpact(impacts, 'conventions', transferred, duplicates)
  }

  return toImpact(impacts)
}

/**
 * Construit le patch de profil du compte conservé à partir des arbitrages de l'admin.
 *
 * Exportée pour être éprouvée directement : c'est une fonction pure, et la faire passer par
 * `mergeUsers` demanderait de simuler toute une transaction pour vérifier une règle d'arbitrage.
 */
export function buildProfilePatch(
  target: MergeUser,
  source: MergeUser,
  choices: MergeFieldChoices
) {
  const patch: Record<string, unknown> = {}

  if (choices.credentials === 'source') {
    patch.email = source.email
    patch.emailHash = getEmailHash(source.email)
    patch.password = source.password
    patch.authProvider = source.authProvider
    patch.isEmailVerified = source.isEmailVerified
  }

  if (choices.pseudo === 'source') patch.pseudo = source.pseudo

  for (const field of [
    'nom',
    'prenom',
    'phone',
    'pronouns',
    'preferredLanguage',
    'profilePicture',
  ] as const) {
    if (choices[field] === 'source') patch[field] = source[field]
  }

  // Régime, allergies et contact d'urgence ne sont pas arbitrés dans le modal : ils comblent
  // les vides. Si le compte conservé n'a rien et que l'absorbé sait quelque chose, on le
  // reprend — perdre en silence une allergie parce que l'autre fiche était vide serait bien
  // pire qu'un choix par défaut discutable. À l'inverse, on n'écrase jamais une valeur déjà là.
  if (target.dietaryPreference === 'NONE' && source.dietaryPreference !== 'NONE') {
    patch.dietaryPreference = source.dietaryPreference as typeof target.dietaryPreference
  }
  for (const champ of [
    'allergies',
    'allergySeverity',
    'emergencyContactName',
    'emergencyContactPhone',
  ] as const) {
    if (!target[champ] && source[champ]) patch[champ] = source[champ] as never
  }

  // Les casquettes se cumulent : un compte fusionné est bénévole s'il l'était d'un côté.
  patch.isVolunteer = target.isVolunteer || source.isVolunteer
  patch.isArtist = target.isArtist || source.isArtist
  patch.isOrganizer = target.isOrganizer || source.isOrganizer

  // L'ancienneté du compte conservé est celle de la plus ancienne des deux inscriptions.
  if (source.createdAt < target.createdAt) patch.createdAt = source.createdAt

  const lastLogin = [target.lastLoginAt, source.lastLoginAt].filter(Boolean) as Date[]
  if (lastLogin.length) {
    patch.lastLoginAt = new Date(Math.max(...lastLogin.map((d) => d.getTime())))
  }

  return patch
}

export interface MergeUsersParams {
  targetId: number
  sourceId: number
  fieldChoices: MergeFieldChoices
}

export interface MergeUsersResult extends MergeImpact {
  /** Photo de profil du compte absorbé à recopier après commit, le cas échéant. */
  profilePictureToMove: string | null
}

/**
 * Exécute la fusion dans une transaction unique.
 *
 * Ordre des opérations :
 *  1. transfert des lignes (doublons écartés au passage) ;
 *  2. relations many-to-many implicites ;
 *  3. notifications pointant sur le compte absorbé ;
 *  4. suppression du compte absorbé — libère `email` et `pseudo` ;
 *  5. mise à jour du profil du compte conservé avec les arbitrages.
 */
export async function mergeUsers({
  targetId,
  sourceId,
  fieldChoices,
}: MergeUsersParams): Promise<MergeUsersResult> {
  return prisma.$transaction(
    async (tx) => {
      const [target, source] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: targetId }, select: MERGE_USER_SELECT }),
        tx.user.findUniqueOrThrow({ where: { id: sourceId }, select: MERGE_USER_SELECT }),
      ])

      const impacts = emptyImpact()

      for (const ref of orderedUserReferences()) {
        const delegate = delegateFor(tx, ref.model)
        const { transfer, transferCount, duplicates } = await resolveReference(
          tx,
          ref,
          sourceId,
          targetId
        )

        if (duplicates.length) {
          await delegate.deleteMany({ where: { id: { in: duplicates } } })
        }

        if (transferCount > 0) {
          // `transfer` est null quand aucune contrainte d'unicité n'est en jeu : on peut
          // repointer toutes les lignes d'un coup.
          const where = transfer ? { id: { in: transfer } } : { [ref.field]: sourceId }
          await delegate.updateMany({ where, data: { [ref.field]: targetId } })
        }

        addImpact(impacts, ref.group, transferCount, duplicates.length)
      }

      // Favoris et participations : `UPDATE IGNORE` repointe ce qui peut l'être, puis le
      // `DELETE` retire les doublons restés en place. Les compteurs sont relevés avant la
      // mutation, les lignes affectées remontées par le connecteur n'étant pas fiables ici.
      for (const table of USER_IMPLICIT_JOIN_TABLES) {
        const counts = await countImplicitJoinImpact(tx, table, targetId, sourceId)
        await tx.$executeRawUnsafe(
          `UPDATE IGNORE \`${table}\` SET B = ? WHERE B = ?`,
          targetId,
          sourceId
        )
        await tx.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE B = ?`, sourceId)
        addImpact(impacts, 'conventions', counts.transferred, counts.duplicates)
      }

      // Notifications dont la cible est le compte absorbé (référence textuelle, sans FK).
      await tx.notification.updateMany({
        where: { entityType: 'User', entityId: String(sourceId) },
        data: { entityId: String(targetId) },
      })

      await tx.user.delete({ where: { id: sourceId } })

      await tx.user.update({
        where: { id: targetId },
        data: buildProfilePatch(target as MergeUser, source as MergeUser, fieldChoices),
      })

      // Seuls les noms de fichiers nus dépendent de l'id utilisateur
      // (`public/uploads/profiles/<userId>/<fichier>`) : les URLs absolues et les chemins
      // `/uploads/...` déjà résolus restent valides tels quels.
      const profilePictureToMove =
        fieldChoices.profilePicture === 'source' &&
        source.profilePicture &&
        !source.profilePicture.includes('/')
          ? source.profilePicture
          : null

      return { ...toImpact(impacts), profilePictureToMove }
    },
    { timeout: 60_000, maxWait: 10_000 }
  )
}

/**
 * Recopie la photo de profil du compte absorbé vers le dossier du compte conservé.
 * À appeler après le commit : les fichiers ne participent pas à la transaction.
 * Les erreurs sont journalisées sans être propagées — la fusion, elle, est acquise.
 */
export async function moveProfilePictureAfterMerge(
  sourceId: number,
  targetId: number,
  fileName: string
): Promise<void> {
  const { copyFile, mkdir } = await import('fs/promises')
  const { join } = await import('path')

  const baseDir = join(process.cwd(), 'public', 'uploads', 'profiles')
  const from = join(baseDir, String(sourceId), fileName)
  const to = join(baseDir, String(targetId), fileName)

  try {
    await mkdir(join(baseDir, String(targetId)), { recursive: true })
    await copyFile(from, to)
    log.info('Photo de profil recopiée', { from, to })
  } catch (error) {
    log.error('Échec de la recopie de la photo de profil', { from, to, error })
  }
}

/**
 * Supprime le dossier d'uploads du compte absorbé, devenu orphelin.
 * Erreurs journalisées et non propagées, pour la même raison.
 */
export async function cleanupMergedUserUploads(sourceId: number): Promise<void> {
  const { rm } = await import('fs/promises')
  const { join } = await import('path')

  const dir = join(process.cwd(), 'public', 'uploads', 'profiles', String(sourceId))
  try {
    await rm(dir, { recursive: true, force: true })
  } catch (error) {
    log.error("Échec du nettoyage du dossier d'uploads", { dir, error })
  }
}
