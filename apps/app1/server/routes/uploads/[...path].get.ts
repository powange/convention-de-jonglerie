import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

import { canManageTreasuryById } from '../../utils/permissions/edition-permissions'
import { getAuthSession } from '../../utils/session-helpers'

/**
 * Les chemins qui désignent une pièce comptable, et l'édition dont il faut tenir les comptes.
 *
 * Deux emplacements : le dossier définitif d'une édition, et le dépôt temporaire d'avant
 * enregistrement. Le second compte autant — un justificatif y séjourne le temps de remplir le
 * formulaire, et il est tout aussi lisible.
 */
function editionDuJustificatif(path: string): number | null {
  const definitif = path.match(/^conventions\/\d+\/editions\/(\d+)\/treasury\//)
  if (definitif) return Number(definitif[1])

  const temporaire = path.match(/^temp\/treasury\/(\d+)\//)
  if (temporaire) return Number(temporaire[1])

  return null
}

/**
 * Sert les fichiers déposés — affiches d'édition, images de spectacle, justificatifs de trésorerie.
 *
 * Cette route n'est pas sous `/api/`, donc le middleware d'authentification ne la voit pas : tout
 * ce qu'elle sert est public dès qu'on en connaît l'URL. C'est acceptable pour une affiche, qui est
 * faite pour être vue. Ce ne l'est pas pour une pièce comptable : une facture porte un RIB, un
 * remboursement porte le nom d'un bénévole, et l'URL circule — copie d'écran, historique partagé,
 * lien collé dans une discussion.
 *
 * Les justificatifs de trésorerie exigent donc une session ET le droit de gérer les comptes de
 * l'édition concernée. Les autres dossiers ne changent pas.
 *
 * **404 et non 403** en cas de refus : un 403 confirmerait l'existence du fichier, donc celle de
 * l'édition et de sa pièce, à quelqu'un qui n'a pas à le savoir.
 */
export default defineEventHandler(async (event) => {
  // Récupérer le chemin depuis l'URL
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({
      status: 400,
      message: 'Path is required',
    })
  }

  // Protection path traversal
  if (path.includes('..') || path.includes('//')) {
    throw createError({
      status: 403,
      message: 'Access denied',
    })
  }

  const editionAControler = editionDuJustificatif(path)
  if (editionAControler !== null) {
    const session = await getAuthSession(event)
    const userId = (session?.user as { id?: number } | undefined)?.id
    const autorise = userId ? await canManageTreasuryById(editionAControler, userId, event) : false

    if (!autorise) {
      throw createError({ status: 404, message: 'File not found' })
    }
  }

  // Construire le chemin complet du fichier
  // nuxt-file-storage stocke dans le mount configuré
  const uploadDir = process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads'
  const filePath = join(uploadDir, path)

  // Vérifier que le chemin ne sort pas du dossier uploads
  if (!filePath.startsWith(uploadDir)) {
    throw createError({
      status: 403,
      message: 'Access denied',
    })
  }

  // Vérifier que le fichier existe
  try {
    const stats = await stat(filePath)

    if (!stats.isFile()) {
      throw createError({
        status: 404,
        message: 'File not found',
      })
    }

    // Déterminer le type MIME basé sur l'extension
    const ext = path.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'

    switch (ext) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'webp':
        contentType = 'image/webp'
        break
      case 'gif':
        contentType = 'image/gif'
        break
      case 'svg':
        contentType = 'image/svg+xml'
        break
      // Sans ce cas, un justificatif PDF partait en `application/octet-stream` : le navigateur le
      // téléchargeait au lieu de l'afficher, et la visionneuse de la page de trésorerie restait
      // vide.
      case 'pdf':
        contentType = 'application/pdf'
        break
    }

    // Définir les headers
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', stats.size.toString())
    // `private` pour ce qui vient d'être mis derrière un droit : un cache partagé le servirait
    // sinon à quelqu'un qui ne l'a pas.
    setHeader(
      event,
      'Cache-Control',
      editionAControler !== null
        ? 'private, max-age=31536000, immutable'
        : 'public, max-age=31536000, immutable'
    )

    // Retourner le fichier
    return sendStream(event, createReadStream(filePath))
  } catch {
    // Si le fichier n'existe pas, essayer dans public/uploads (ancien système)
    try {
      const publicPath = join(process.cwd(), 'public/uploads', path)
      const publicUploadsDir = join(process.cwd(), 'public/uploads')

      // Protection path traversal sur le fallback
      if (!publicPath.startsWith(publicUploadsDir)) {
        throw createError({ status: 403, message: 'Access denied' })
      }

      const publicStats = await stat(publicPath)

      if (publicStats.isFile()) {
        const ext = path.split('.').pop()?.toLowerCase()
        let contentType = 'application/octet-stream'

        switch (ext) {
          case 'jpg':
          case 'jpeg':
            contentType = 'image/jpeg'
            break
          case 'png':
            contentType = 'image/png'
            break
          case 'webp':
            contentType = 'image/webp'
            break
        }

        setHeader(event, 'Content-Type', contentType)
        setHeader(event, 'Content-Length', publicStats.size.toString())
        setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

        return sendStream(event, createReadStream(publicPath))
      }
    } catch {
      // Fichier non trouvé
    }

    throw createError({
      status: 404,
      message: 'File not found',
    })
  }
})
