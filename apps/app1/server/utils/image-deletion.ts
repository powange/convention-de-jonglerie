import { deleteOldFile } from './file-helpers'
import { getConventionForEdit } from './permissions/convention-permissions'
import { getEditionForEdit } from './permissions/edition-permissions'

import type { Convention, Edition, User } from '#server/types/prisma'

import { isHttpError } from '#server/types/api'

interface OptionsCommunes {
  entityId: number
  /**
   * Le dossier du montage où vit le fichier, sous `NUXT_FILE_STORAGE_MOUNT`.
   *
   * ⚠️ MESURÉ, PAS DÉDUIT (base de développement, 1er octobre 2026) : une image d'édition vit dans
   * `editions/<id>/`, un logo de convention dans `conventions/<id>/`, une photo de profil dans
   * `profiles/<id>/`. C'est ce que `handleFileUpload` écrit, et ce qui rend le nom de fichier nu
   * exploitable — sans ce dossier, on ne saurait pas où chercher.
   */
  dossier: 'conventions' | 'editions' | 'profiles'
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
 * Vérifie les permissions pour supprimer l'image d'une édition.
 *
 * ⚠️ CE CONTRÔLE N'AUTORISAIT QUE LE CRÉATEUR (`creatorId`), alors que DÉPOSER et REMPLACER la
 * même image passent par `canEditEdition` : l'auteur de la convention, un organisateur avec
 * `editAllEditions`, un droit par édition, un admin global. La page « À propos » affiche donc le
 * bouton de suppression à tous ceux qui ont `canEdit` — et pour eux le clic répondait « Non
 * autorisé à modifier cette édition ». On pouvait remplacer l'affiche, pas la retirer.
 *
 * Et pour une édition IMPORTÉE (`creatorId` nul), personne ne pouvait la supprimer.
 *
 * `getEditionForEdit` porte déjà la règle, avec ses 404 et 403 : on la réemploie au lieu d'en
 * écrire une seconde, puisque c'est précisément leur divergence qui a produit ce défaut.
 */
export async function checkEditionDeletionPermission(
  editionId: number,
  user: { id: number; isGlobalAdmin?: boolean }
): Promise<Edition> {
  return (await getEditionForEdit(editionId, user as never)) as unknown as Edition
}

/**
 * Ce qui n'est PAS un fichier à nous, et qu'il ne faut donc pas tenter de supprimer.
 *
 * ⚠️⚠️ CETTE GARDE EST LA PLUS IMPORTANTE DE CE FICHIER, et le constat ne la mentionnait pas.
 * MESURÉ sur la base de développement le 1er octobre 2026 : 140 des 166 photos de profil sont des
 * URL Google (`https://lh3.googleusercontent.com/...`), posées à la connexion par OAuth. Ce ne
 * sont pas des fichiers de notre disque.
 *
 * Passer une telle valeur à `deleteOldFile` lui ferait découper « https://lh3... » comme un
 * chemin et demander la suppression dans un dossier inventé. Inoffensif par chance, mais c'est
 * exactement le genre de hasard sur lequel on ne construit pas : `..` dans la valeur stockée
 * donnerait un chemin hors du montage.
 *
 * L'ancien code s'en protégeait SANS LE SAVOIR — `extractFilePath` exigeait que le nom commence
 * par `profile-`, donc une URL Google ne correspondait à rien. Le remplacer sans reposer cette
 * garde aurait introduit le défaut en corrigeant l'autre.
 */
function estUnFichierDeNotreStockage(imageUrl: string): boolean {
  // Une adresse externe : OAuth pose l'avatar du fournisseur tel quel.
  if (imageUrl.includes('://')) return false
  // Une remontée de dossier : rien de légitime n'en contient.
  if (imageUrl.includes('..')) return false
  return true
}

/**
 * Supprime physiquement le fichier image.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et c'était total : les fichiers vivent sous le montage de
 * nuxt-file-storage (`NUXT_FILE_STORAGE_MOUNT`, `/uploads`), et cette fonction les cherchait sous
 * `process.cwd()/public/uploads`. VÉRIFIÉ DANS LE CONTENEUR : `public/uploads` N'EXISTE PAS. Le
 * `unlink` échouait donc toujours, l'erreur était avalée en `console.warn`, et la base était mise
 * à jour : l'utilisateur voyait l'image partir, le fichier restait.
 *
 * ⚠️ PIRE POUR LES ÉDITIONS : après une modification, `handleFileUpload` rend un NOM DE FICHIER
 * NU. L'ancien `extractFilePath` exigeait « uploads » ET « conventions » dans l'URL et rendait
 * `null` — donc AUCUNE tentative, pas même celle qui aurait échoué. Mesuré : 30 des 31 images
 * d'édition et 21 des 22 logos sont stockés sous cette forme nue. Le défaut concernait donc la
 * quasi-totalité des images.
 *
 * On délègue à `deleteOldFile`, qui passe par `deleteFile` de nuxt-file-storage — donc par le
 * montage — et qui sait lire les DEUX formes : chemin complet `/uploads/…` ou nom nu sous
 * `<dossier>/<id>`. C'est déjà elle qui supprime l'ancienne image lors d'un REMPLACEMENT, et ce
 * chemin-là fonctionnait : il n'y avait pas de règle à écrire, seulement une à réemployer.
 */
export async function deletePhysicalImageFile(
  imageUrl: string | null,
  options: ImageDeletionOptions
): Promise<void> {
  if (!imageUrl) return

  if (!estUnFichierDeNotreStockage(imageUrl)) {
    console.log('Image non stockée par nous, aucun fichier à supprimer:', imageUrl)
    return
  }

  // `deleteOldFile` avale déjà ses propres erreurs : un fichier absent ne doit pas empêcher de
  // retirer l'image de la base, sans quoi une entrée cassée serait impossible à nettoyer.
  await deleteOldFile(imageUrl, options.entityId, options.dossier, true)
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
  /*
   * Convention ET édition ont maintenant besoin du drapeau `isGlobalAdmin` : leurs deux contrôles
   * passent par une garde de permissions complète. Seule la photo de PROFIL se contente d'un
   * identifiant — on ne supprime que la sienne —, d'où l'union conservée.
   */
  auteur: number | { id: number; isGlobalAdmin?: boolean }
): Promise<ImageDeletionResult> {
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
        const edition = await checkEditionDeletionPermission(options.entityId, auteurAvecDroits)
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
      dossier: 'conventions',
    },
    user
  )
}

export async function deleteEditionImage(
  editionId: number,
  user: { id: number; isGlobalAdmin?: boolean }
) {
  return handleImageDeletion(
    {
      entityType: 'edition',
      entityId: editionId,
      imageField: 'imageUrl',
      dossier: 'editions',
    },
    user
  )
}

export async function deleteProfilePicture(userId: number) {
  return handleImageDeletion(
    {
      entityType: 'user',
      entityId: userId,
      imageField: 'profilePicture',
      dossier: 'profiles',
    },
    userId
  )
}
