import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEmailHash } from '#server/utils/email-hash'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { generateVolunteerQrCodeToken } from '#server/utils/token-generator'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  performerIndex: z.number().int().min(0),
  // Si true (défaut), applique aussi les infos de la candidature à l'EditionArtist :
  // dates d'arrivée/départ, accommodationAutonomous (inverse de accommodationNeeded),
  // et append au champ organizerNotes les préférences d'hébergement + ville de départ.
  applyApplicationData: z.boolean().optional().default(true),
})

/**
 * Construit le bloc de notes organisateur depuis la candidature
 * (préférences d'hébergement, ville de départ).
 */
function buildImportedNotes(application: {
  accommodationNotes: string | null
  departureCity: string | null
}): string {
  const lines: string[] = []
  if (application.accommodationNotes?.trim()) {
    lines.push(`Préférences artiste pour l'hébergement : ${application.accommodationNotes.trim()}`)
  }
  if (application.departureCity?.trim()) {
    lines.push(`Ville de départ : ${application.departureCity.trim()}`)
  }
  return lines.join('\n')
}

/**
 * Append le bloc importé aux notes existantes, sauf s'il y est déjà
 * (évite la duplication en cas de re-import).
 */
function mergeOrganizerNotes(existing: string | null | undefined, imported: string): string {
  if (!imported) return existing || ''
  const current = existing?.trim() || ''
  if (current.includes(imported)) return current
  return current ? `${current}\n\n${imported}` : imported
}

interface AdditionalPerformer {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

/**
 * Importe un performer (additionalPerformer) d'une candidature acceptée comme
 * EditionArtist. Si la candidature est liée à un Show, crée aussi le ShowArtist.
 *
 * Idempotent : si l'artiste est déjà importé sur une autre candidature/sans
 * lien spectacle, on peut rappeler l'endpoint pour juste créer le ShowArtist
 * manquant. Si tout est déjà en place, on renvoie 409.
 *
 * - Réutilise un user existant si l'email correspond, sinon crée un user MANUAL
 * - Refuse si la candidature n'est pas ACCEPTED
 * - Permission : canManageArtists
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))
    const applicationId = Number(getRouterParam(event, 'applicationId'))

    if (isNaN(showCallId) || isNaN(applicationId)) {
      throw createError({ status: 400, message: 'Identifiants invalides' })
    }

    const body = await readBody(event)
    const { performerIndex, applyApplicationData } = bodySchema.parse(body)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    const application = await prisma.showApplication.findFirst({
      where: { id: applicationId, showCallId, showCall: { editionId } },
      select: {
        id: true,
        status: true,
        showId: true,
        additionalPerformers: true,
        accommodationNeeded: true,
        accommodationNotes: true,
        departureCity: true,
      },
    })

    if (!application) {
      throw createError({ status: 404, message: 'Candidature introuvable' })
    }

    if (application.status !== 'ACCEPTED') {
      throw createError({
        status: 400,
        message: "L'import n'est possible que pour une candidature acceptée",
      })
    }

    const performers = (application.additionalPerformers || []) as AdditionalPerformer[]
    const performer = performers[performerIndex]
    if (!performer) {
      throw createError({ status: 404, message: 'Performer introuvable à cet index' })
    }

    // Trouver ou créer le user (réutilise par email si déjà présent en base)
    const existingUser = await prisma.user.findUnique({
      where: { email: performer.email },
      select: { id: true },
    })

    let targetUserId: number
    if (existingUser) {
      targetUserId = existingUser.id
    } else {
      const newUser = await prisma.user.create({
        data: {
          email: performer.email,
          emailHash: getEmailHash(performer.email),
          prenom: performer.firstName,
          nom: performer.lastName,
          pseudo: `${performer.firstName.toLowerCase()}_${performer.lastName.toLowerCase()}_${Date.now()}`,
          isEmailVerified: false,
          authProvider: 'MANUAL',
        },
      })
      targetUserId = newUser.id
    }

    // Préparer les champs à appliquer depuis la candidature (si demandé)
    const importedNotes = applyApplicationData ? buildImportedNotes(application) : ''
    const userInclude = {
      user: {
        select: {
          id: true,
          email: true,
          pseudo: true,
          prenom: true,
          nom: true,
          phone: true,
          authProvider: true,
        },
      },
    }

    // Trouver ou créer l'EditionArtist (idempotent)
    let artistCreated = false
    let artistDataApplied = false
    let artist = await prisma.editionArtist.findUnique({
      where: { editionId_userId: { editionId, userId: targetUserId } },
      include: userInclude,
    })

    if (!artist) {
      // Générer un QR token unique (même logique que /api/editions/[id]/artists)
      let qrCodeToken = generateVolunteerQrCodeToken()
      let attempts = 0
      while (attempts < 10) {
        const collision = await prisma.editionArtist.findUnique({ where: { qrCodeToken } })
        if (!collision) break
        qrCodeToken = generateVolunteerQrCodeToken()
        attempts++
      }
      if (attempts === 10) {
        throw createError({ status: 500, message: 'Impossible de générer un token unique' })
      }

      artist = await prisma.editionArtist.create({
        data: {
          editionId,
          userId: targetUserId,
          qrCodeToken,
          ...(applyApplicationData
            ? {
                accommodationAutonomous: !application.accommodationNeeded,
                organizerNotes: importedNotes || null,
              }
            : {}),
        },
        include: userInclude,
      })
      artistCreated = true
      artistDataApplied = applyApplicationData
    } else if (applyApplicationData) {
      // Artiste existant : mettre à jour accommodationAutonomous et append les notes
      const mergedNotes = mergeOrganizerNotes(artist.organizerNotes, importedNotes)
      const notesChanged = mergedNotes !== (artist.organizerNotes || '')
      const accomChanged = artist.accommodationAutonomous === application.accommodationNeeded
      if (notesChanged || accomChanged) {
        artist = await prisma.editionArtist.update({
          where: { id: artist.id },
          data: {
            accommodationAutonomous: !application.accommodationNeeded,
            organizerNotes: mergedNotes || null,
          },
          include: userInclude,
        })
        artistDataApplied = true
      }
    }

    // Si la candidature est liée à un Show et que le lien n'existe pas, le créer
    let showLinkCreated = false
    if (application.showId) {
      const existingLink = await prisma.showArtist.findUnique({
        where: { showId_artistId: { showId: application.showId, artistId: artist.id } },
      })
      if (!existingLink) {
        await prisma.showArtist.create({
          data: { showId: application.showId, artistId: artist.id },
        })
        showLinkCreated = true
      }
    }

    // Rien à faire : l'artiste existe déjà, pas de mise à jour, pas de lien spectacle à créer
    if (!artistCreated && !showLinkCreated && !artistDataApplied) {
      throw createError({
        status: 409,
        message: 'Cet artiste est déjà importé et à jour',
      })
    }

    return createSuccessResponse({ artist, artistCreated, showLinkCreated, artistDataApplied })
  },
  { operationName: 'ImportPerformerAsArtist' }
)
