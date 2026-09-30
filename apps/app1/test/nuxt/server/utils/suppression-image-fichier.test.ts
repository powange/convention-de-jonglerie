import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * ⚠️ `deleteFile` EST UN AUTO-IMPORT DU MODULE nuxt-file-storage : `file-helpers.ts` l'emploie
 * sans l'importer. Un `vi.mock('nuxt-file-storage')` N'INTERCEPTE DONC RIEN — c'est le même piège
 * que les auto-imports de Nitro, et il ne se signale pas : la fonction n'est liée à nulle part et
 * le test échoue sur une assertion d'appel, comme si le code ne supprimait rien.
 *
 * On la pose sur la globale, dans un `vi.hoisted` : les imports sont remontés au-dessus du corps
 * du module, donc une affectation écrite ici arriverait trop tard.
 */
const deleteFile = vi.hoisted(() => {
  const espion = vi.fn(async () => undefined)
  ;(globalThis as any).deleteFile = espion
  return espion
})

const getConventionForEdit = vi.hoisted(() => vi.fn())
const getEditionForEdit = vi.hoisted(() => vi.fn())

vi.mock('../../../../server/utils/permissions/convention-permissions', () => ({
  getConventionForEdit,
}))
vi.mock('../../../../server/utils/permissions/edition-permissions', () => ({
  getEditionForEdit,
}))

import {
  deleteConventionImage,
  deleteEditionImage,
  deletePhysicalImageFile,
  deleteProfilePicture,
} from '../../../../server/utils/image-deletion'

const prismaMock = (globalThis as any).prisma

/**
 * La suppression d'une image, et le fichier qu'elle laissait derrière.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, ET C'ÉTAIT TOTAL. Les fichiers vivent sous le montage de
 * nuxt-file-storage (`NUXT_FILE_STORAGE_MOUNT`, `/uploads`) ; la suppression les cherchait sous
 * `process.cwd()/public/uploads`. VÉRIFIÉ DANS LE CONTENEUR le 1er octobre 2026 :
 * `public/uploads` N'EXISTE PAS. Le `unlink` échouait donc toujours, l'erreur était avalée en
 * `console.warn`, et la base était mise à jour : l'utilisateur voyait l'image partir, le fichier
 * restait — pour toujours.
 *
 * ⚠️ PIRE POUR LES ÉDITIONS : après une modification, `handleFileUpload` rend un NOM DE FICHIER
 * NU. L'ancien `extractFilePath` exigeait « uploads » ET « conventions » dans l'URL, donc rendait
 * `null` : AUCUNE tentative, pas même celle qui aurait échoué.
 *
 * 📊 MESURÉ SUR LA BASE DE DÉVELOPPEMENT, et c'est ce qui donne l'échelle du défaut :
 * • 30 des 31 images d'édition et 21 des 22 logos sont stockés sous la forme NUE ;
 * • une image d'édition vit dans `editions/<id>/`, un logo dans `conventions/<id>/`, une photo de
 *   profil dans `profiles/<id>/` — c'est ce qui rend le nom nu exploitable ;
 * • 140 des 166 photos de profil sont des URL GOOGLE, et non des fichiers de notre disque.
 */

const LOGO = { id: 1, logo: 'VI6IE0TL.png' }

describe('deletePhysicalImageFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supprime un NOM DE FICHIER NU dans le dossier de la ressource', async () => {
    /*
     * 🔬 LE CAS MAJORITAIRE, et celui qui n'était pas même tenté. Sans le dossier, un nom nu ne
     * désigne rien : c'est `<dossier>/<id>` qui le situe.
     */
    await deletePhysicalImageFile('xW2vdUsf.jpg', { entityId: 5, dossier: 'editions' })

    expect(deleteFile).toHaveBeenCalledWith('xW2vdUsf.jpg', 'editions/5')
  })

  it('supprime un CHEMIN COMPLET en respectant son dossier d’origine', async () => {
    /*
     * ⚠️ Le dossier du chemin l'emporte sur celui de la ressource, et c'est nécessaire : les
     * images posées à la CRÉATION d'une édition vivent sous `conventions/<id>/`, pas sous
     * `editions/<id>/`. Déduire le dossier de la ressource manquerait ces fichiers.
     */
    await deletePhysicalImageFile('/uploads/conventions/43/edition-43-1787390394939-ozi.jpg', {
      entityId: 43,
      dossier: 'editions',
    })

    expect(deleteFile).toHaveBeenCalledWith('edition-43-1787390394939-ozi.jpg', 'conventions/43')
  })

  it('🔬 NE TOUCHE PAS à une URL externe', async () => {
    /*
     * ⚠️⚠️ L'ASSERTION LA PLUS IMPORTANTE DE CE FICHIER. 140 des 166 photos de profil sont des URL
     * Google, posées à la connexion par OAuth. Les passer à `deleteOldFile` lui ferait découper
     * « https://lh3... » comme un chemin et demander une suppression dans un dossier inventé.
     *
     * 📍 L'ancien code s'en protégeait SANS LE SAVOIR : `extractFilePath` exigeait que le nom
     * commence par `profile-`, donc une URL Google ne correspondait à rien. Le remplacer sans
     * reposer cette garde aurait INTRODUIT un défaut en corrigeant l'autre.
     */
    await deletePhysicalImageFile('https://lh3.googleusercontent.com/a/ACg8ocK', {
      entityId: 19,
      dossier: 'profiles',
    })

    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('REFUSE une remontée de dossier', async () => {
    // Rien de légitime ne contient « .. » ; une valeur forgée sortirait du montage.
    await deletePhysicalImageFile('../../etc/passwd', { entityId: 1, dossier: 'profiles' })
    await deletePhysicalImageFile('/uploads/../secret.png', { entityId: 1, dossier: 'editions' })

    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('ne fait rien sans image', async () => {
    await deletePhysicalImageFile(null, { entityId: 1, dossier: 'editions' })

    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('n’ÉCHOUE PAS quand le fichier est déjà absent', async () => {
    /*
     * Un fichier manquant ne doit pas empêcher de retirer l'image de la base : sinon une entrée
     * cassée — celle dont le fichier a disparu — serait impossible à nettoyer, et c'est
     * précisément l'état qu'a produit le défaut pendant des mois.
     */
    deleteFile.mockRejectedValueOnce(new Error('ENOENT'))

    await expect(
      deletePhysicalImageFile('absent.jpg', { entityId: 1, dossier: 'editions' })
    ).resolves.toBeUndefined()
  })
})

describe('deleteConventionImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConventionForEdit.mockResolvedValue(LOGO)
    prismaMock.convention.update.mockResolvedValue({ id: 1, logo: null })
  })

  it('supprime le fichier PUIS met la base à jour', async () => {
    /*
     * 🔬 L'ordre importe : mettre la base à jour d'abord perdrait l'URL, donc le seul moyen de
     * savoir quel fichier supprimer. C'est ainsi que des fichiers se sont accumulés.
     */
    await deleteConventionImage(1, { id: 1 })

    expect(deleteFile).toHaveBeenCalledWith('VI6IE0TL.png', 'conventions/1')
    expect(prismaMock.convention.update).toHaveBeenCalled()
    expect(deleteFile.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.convention.update.mock.invocationCallOrder[0]
    )
  })

  it('refuse quand il n’y a aucune image', async () => {
    getConventionForEdit.mockResolvedValue({ id: 1, logo: null })

    await expect(deleteConventionImage(1, { id: 1 })).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.convention.update).not.toHaveBeenCalled()
  })
})

describe('deleteEditionImage — qui a le droit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEditionForEdit.mockResolvedValue({ id: 5, imageUrl: 'xW2vdUsf.jpg', creatorId: 99 })
    prismaMock.edition.update.mockResolvedValue({ id: 5, imageUrl: null })
  })

  it('🔬 passe par `getEditionForEdit`, et NON par `creatorId`', async () => {
    /*
     * ⚠️ LE DÉFAUT : le contrôle n'autorisait que le CRÉATEUR, alors que DÉPOSER et REMPLACER la
     * même image passent par `canEditEdition` — auteur de la convention, organisateur avec
     * `editAllEditions`, droit par édition, admin global. La page « À propos » affiche le bouton
     * de suppression à tous ceux qui ont `canEdit` ; pour eux, le clic répondait « Non autorisé à
     * modifier cette édition ». On pouvait remplacer l'affiche, pas la retirer.
     *
     * Ici `creatorId` vaut 99 et le demandeur est 7 : l'ancien contrôle refusait, le nouveau
     * délègue à la garde de permissions — qui, elle, connaît les quatre autres chemins.
     */
    await expect(deleteEditionImage(5, { id: 7 })).resolves.toMatchObject({ success: true })

    expect(getEditionForEdit).toHaveBeenCalledWith(5, { id: 7 })
    expect(deleteFile).toHaveBeenCalledWith('xW2vdUsf.jpg', 'editions/5')
  })

  it('laisse remonter le refus de la garde', async () => {
    // Le 403 et le 404 sont déjà rendus par `getEditionForEdit` : on ne les réécrit pas.
    getEditionForEdit.mockRejectedValue(
      createError({ status: 403, message: "Vous n'avez pas les droits" }) as never
    )

    await expect(deleteEditionImage(5, { id: 7 })).rejects.toMatchObject({ statusCode: 403 })
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('traite une édition IMPORTÉE, sans créateur', async () => {
    /*
     * 📍 Le cas que l'ancien contrôle rendait impossible à tout le monde : `creatorId` nul ne
     * pouvait égaler aucun identifiant, donc l'affiche d'une édition importée était indélébile.
     */
    getEditionForEdit.mockResolvedValue({ id: 5, imageUrl: 'x.jpg', creatorId: null })

    await expect(deleteEditionImage(5, { id: 7 })).resolves.toMatchObject({ success: true })
  })
})

describe('deleteProfilePicture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.update.mockResolvedValue({ id: 19, profilePicture: null })
  })

  it('supprime le fichier d’une photo déposée', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profilePicture: 'profile-19-abc.jpg' })

    await deleteProfilePicture(19)

    expect(deleteFile).toHaveBeenCalledWith('profile-19-abc.jpg', 'profiles/19')
  })

  it('retire un avatar GOOGLE de la base sans chercher de fichier', async () => {
    /*
     * 🔬 Le cas de 140 comptes sur 166. La base doit bien être mise à jour — on retire l'avatar —
     * mais il n'y a aucun fichier à supprimer, et le chercher serait au mieux inutile.
     */
    prismaMock.user.findUnique.mockResolvedValue({
      profilePicture: 'https://lh3.googleusercontent.com/a/ACg8ocK',
    })

    await expect(deleteProfilePicture(19)).resolves.toMatchObject({ success: true })

    expect(deleteFile).not.toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalled()
  })
})
