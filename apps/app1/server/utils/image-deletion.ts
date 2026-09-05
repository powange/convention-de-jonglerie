import { promises as fs } from 'fs'
import { join, dirname } from 'path'

import { deleteFromBothLocations } from './copy-to-output'
import { getConventionForEdit } from './permissions/convention-permissions'

import type { Convention, Edition, User } from '#server/types/prisma'

import { isHttpError } from '#server/types/api'

interface OptionsCommunes {
  entityId: number
  useOutputDeletion?: boolean // Utiliser deleteFromBothLocations (pour conventions)
  pathExtraction?: 'convention' | 'edition' | 'profile' // Comment extraire le chemin du fichier
}

/**
 * Le champ portant l'image n'est pas libre : chaque type d'entité a le sien, et les trois
 * seules combinaisons qui existent sont celles-ci. Les déclarer sépare les branches, ce qui
 * permet à Prisma de vérifier chaque mise à jour au lieu de recevoir une clé calculée.
 */
export type ImageDeletionOptions =
  | (OptionsCommunes & { entityType: 'convention'; imageField: 'logo' })
  | (OptionsCommunes & { entityType: 'edition'; imageField: 'imageUrl' })
  | (OptionsCommunes & { entityType: 'user'; imageField: 'profilePicture' })

/**
 * L'utilisateur rendu après suppression est volontairement partiel : ni mot de passe, ni
 * champs privés. Le déclarer évite de promettre un `User` complet qu'on ne rend jamais.
 */
export type UtilisateurSansImage = Pick<
  User,
  'id' | 'email' | 'pseudo' | 'nom' | 'prenom' | 'profilePicture' | 'createdAt' | 'updatedAt'
>

export interface ImageDeletionResult {
  success: boolean
  message: string
  entity: Convention | Edition | UtilisateurSansImage
}

/**
 * Vérifie les permissions pour supprimer l'image d'une convention
 */
export async function checkConventionDeletionPermission(
  conventionId: number,
  user: { id: number; isGlobalAdmin?: boolean }
): Promise<Convention> {
  // Utiliser les mêmes permissions que pour éditer une convention
  const convention = await getConventionForEdit(conventionId, user as any)
  return convention as any
}

/**
 * Vérifie les permissions pour supprimer l'image d'une édition
 */
export async function checkEditionDeletionPermission(
  editionId: number,
  userId: number
): Promise<Edition> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
  })

  if (!edition || edition.creatorId !== userId) {
    throw createError({
      status: 403,
      message: 'Non autorisé à modifier cette édition',
    })
  }

  return edition
}

/**
 * Supprime physiquement le fichier image
 */
export async function deletePhysicalImageFile(
  imageUrl: string | null,
  options: ImageDeletionOptions
): Promise<void> {
  if (!imageUrl) return

  try {
    if (options.useOutputDeletion) {
      // Pour les conventions : utiliser deleteFromBothLocations
      const relativePath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl

      await deleteFromBothLocations(relativePath)
      console.log('Image supprimée des deux emplacements:', relativePath)
    } else {
      // Pour les éditions et profils : suppression directe
      const filePath = extractFilePath(imageUrl, options)
      if (filePath) {
        await fs.unlink(filePath)
        console.log('Image supprimée:', filePath)

        // Pour les éditions : essayer de supprimer le dossier s'il est vide
        if (options.pathExtraction === 'edition' && filePath) {
          try {
            const dirPath = dirname(filePath)
            await fs.rmdir(dirPath)
            console.log("Dossier d'édition supprimé:", dirPath)
          } catch {
            // Le dossier n'est pas vide ou erreur, on ignore
          }
        }
      }
    }
  } catch (error) {
    console.warn('Erreur lors de la suppression du fichier:', error)
    // On continue même si le fichier n'existe pas
  }
}

/**
 * Extrait le chemin du fichier selon le type d'entité
 */
function extractFilePath(imageUrl: string, options: ImageDeletionOptions): string | null {
  const urlParts = imageUrl.split('/')
  const filename = urlParts[urlParts.length - 1]

  // Une URL vide ou finissant par « / » ne porte aucun nom de fichier : rien à extraire.
  if (!filename) return null

  switch (options.pathExtraction) {
    case 'edition': {
      if (urlParts.includes('uploads') && urlParts.includes('conventions')) {
        const folderName = urlParts[urlParts.indexOf('conventions') + 1]
        if (!folderName) break

        // Pour les éditions, le dossier peut être soit l'ID de l'édition, soit l'ID de la convention
        // On vérifie que le nom de fichier commence par 'edition-' et que le dossier correspond
        if (filename.startsWith('edition-') || filename.startsWith('convention-')) {
          return join(process.cwd(), 'public', 'uploads', 'conventions', folderName, filename)
        }
      }
      break
    }
    case 'profile': {
      if (filename && filename.startsWith('profile-')) {
        return join(process.cwd(), 'public', 'uploads', 'profiles', filename)
      }
      break
    }
    case 'convention': {
      // Les conventions utilisent deleteFromBothLocations, pas cette fonction
      break
    }
  }

  return null
}

/**
 * Met à jour l'entité en supprimant l'URL d'image
 */
export async function updateEntityRemoveImage(
  options: ImageDeletionOptions
): Promise<Convention | Edition | UtilisateurSansImage> {
  const where = { id: options.entityId }

  switch (options.entityType) {
    case 'convention':
      return await prisma.convention.update({
        where,
        data: { logo: null },
        include: { author: { select: { id: true, pseudo: true, email: true } } },
      })
    case 'edition':
      return await prisma.edition.update({
        where,
        data: { imageUrl: null },
        include: {
          creator: { select: { id: true, email: true, pseudo: true } },
          favoritedBy: { select: { id: true } },
        },
      })
    case 'user':
      // Sélection spécifique pour les utilisateurs : jamais le mot de passe ni les champs privés
      return await prisma.user.update({
        where,
        data: { profilePicture: null },
        select: {
          id: true,
          email: true,
          pseudo: true,
          nom: true,
          prenom: true,
          profilePicture: true,
          createdAt: true,
          updatedAt: true,
        },
      })
  }
}

/**
 * Fonction principale pour supprimer une image d'entité
 */
export async function handleImageDeletion(
  options: ImageDeletionOptions,
  // Les deux contrôles de permission n'attendent pas la même chose : celui des conventions a
  // besoin du drapeau `isGlobalAdmin`, celui des éditions se contente d'un identifiant. Les
  // appelants passent donc l'un ou l'autre, ce que la signature déclarait à tort comme un
  // simple `number` — le typage mentait sur ce qui circulait vraiment ici.
  auteur: number | { id: number; isGlobalAdmin?: boolean }
): Promise<ImageDeletionResult> {
  const auteurId = typeof auteur === 'number' ? auteur : auteur.id
  const auteurAvecDroits = typeof auteur === 'number' ? { id: auteur } : auteur

  try {
    let imageUrl: string | null = null

    // Vérifier les permissions et récupérer l'entité
    switch (options.entityType) {
      case 'convention': {
        const convention = await checkConventionDeletionPermission(
          options.entityId,
          auteurAvecDroits
        )
        imageUrl = convention.logo
        break
      }
      case 'edition': {
        const edition = await checkEditionDeletionPermission(options.entityId, auteurId)
        imageUrl = edition.imageUrl
        break
      }
      case 'user': {
        // Pour les utilisateurs, récupérer depuis la base pour avoir l'image actuelle
        const utilisateur = await prisma.user.findUnique({
          where: { id: options.entityId },
          select: { profilePicture: true },
        })
        imageUrl = utilisateur?.profilePicture ?? null
        break
      }
    }

    // Vérifier qu'il y a une image à supprimer
    if (!imageUrl) {
      throw createError({
        status: 400,
        message: 'Aucune image à supprimer',
      })
    }

    // Supprimer le fichier physique
    await deletePhysicalImageFile(imageUrl, options)

    // Mettre à jour la base de données
    const updatedEntity = await updateEntityRemoveImage(options)

    return {
      success: true,
      message: 'Image supprimée avec succès',
      entity: updatedEntity,
    }
  } catch (error: unknown) {
    if (isHttpError(error)) {
      throw error
    }

    console.error("Erreur lors de la suppression de l'image:", error)
    throw createError({
      status: 500,
      message: "Erreur serveur lors de la suppression de l'image",
    })
  }
}

/**
 * Fonctions spécialisées pour chaque type d'entité
 */
export async function deleteConventionImage(
  conventionId: number,
  user: { id: number; isGlobalAdmin?: boolean }
) {
  return handleImageDeletion(
    {
      entityType: 'convention',
      entityId: conventionId,
      imageField: 'logo',
      useOutputDeletion: true,
      pathExtraction: 'convention',
    },
    user
  )
}

export async function deleteEditionImage(editionId: number, userId: number) {
  return handleImageDeletion(
    {
      entityType: 'edition',
      entityId: editionId,
      imageField: 'imageUrl',
      useOutputDeletion: false,
      pathExtraction: 'edition',
    },
    userId
  )
}

export async function deleteProfilePicture(userId: number) {
  return handleImageDeletion(
    {
      entityType: 'user',
      entityId: userId,
      imageField: 'profilePicture',
      useOutputDeletion: false,
      pathExtraction: 'profile',
    },
    userId
  )
}
