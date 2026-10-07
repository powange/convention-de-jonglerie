import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

import {
  canManageArtistsById,
  canManageTreasuryById,
} from '../../utils/permissions/edition-permissions'
import { getAuthSession } from '../../utils/session-helpers'

/** Les domaines de justificatifs, et le droit qui en gouverne la LECTURE. */
type DomaineProtege = 'treasury' | 'artists'

/**
 * Les chemins qui désignent un justificatif, le domaine dont il relève et l'édition concernée.
 *
 * Deux emplacements par domaine : le dossier définitif d'une édition, et le dépôt temporaire
 * d'avant enregistrement. Le second compte autant — un justificatif y séjourne le temps de remplir
 * le formulaire, et il est tout aussi lisible.
 *
 * ⚠️ LE DOMAINE `artists` MANQUAIT, et ses justificatifs partaient donc SANS AUCUNE SESSION. Le
 * commentaire de `treasury-receipt-files.ts` affirmait que les deux domaines « obéissent exactement
 * aux mêmes règles » : c'était vrai de l'écriture, faux de la lecture. Un billet de train porte un
 * nom, une adresse, parfois les derniers chiffres d'une carte, et un nom de fichier à huit
 * caractères n'est pas une protection — c'est exactement ce que dit le commentaire ci-dessous à
 * propos des factures.
 */
function justificatifProtege(path: string): { domaine: DomaineProtege; editionId: number } | null {
  for (const domaine of ['treasury', 'artists'] as const) {
    const definitif = path.match(new RegExp(`^conventions/\\d+/editions/(\\d+)/${domaine}/`))
    if (definitif) return { domaine, editionId: Number(definitif[1]) }

    const temporaire = path.match(new RegExp(`^temp/${domaine}/(\\d+)/`))
    if (temporaire) return { domaine, editionId: Number(temporaire[1]) }
  }

  return null
}

/**
 * Qui peut LIRE un justificatif de ce domaine.
 *
 * 📍 Pour un artiste, deux titres suffisent : gérer les artistes de l'édition, ou être
 * l'artiste de cette édition. Le second est indispensable depuis que l'artiste dépose et relit ses
 * propres justificatifs depuis son espace — sans lui, il ne pourrait plus voir ce qu'il vient
 * d'envoyer. Il ne lui donne pas accès à ceux des autres : il ne connaît que ses propres URL, et
 * `my-payment-info.put.ts` refuse de lui en attacher une qui ne soit pas la sienne.
 */
async function peutLireLeJustificatif(
  domaine: DomaineProtege,
  editionId: number,
  userId: number,
  event: Parameters<typeof canManageTreasuryById>[2]
): Promise<boolean> {
  if (domaine === 'treasury') return canManageTreasuryById(editionId, userId, event)

  if (await canManageArtistsById(editionId, userId, event)) return true

  const sienne = await prisma.editionArtist.findUnique({
    where: { editionId_userId: { editionId, userId } },
    select: { id: true },
  })
  return sienne !== null
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
 * Les justificatifs exigent donc une session ET un droit sur l'édition concernée — les comptes
 * pour une pièce de trésorerie, les artistes (ou le fait d'être l'artiste) pour un billet de train.
 * Les autres dossiers ne changent pas.
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

  const protege = justificatifProtege(path)
  if (protege) {
    const session = await getAuthSession(event)
    const userId = (session?.user as { id?: number } | undefined)?.id
    const autorise = userId
      ? await peutLireLeJustificatif(protege.domaine, protege.editionId, userId, event)
      : false

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
