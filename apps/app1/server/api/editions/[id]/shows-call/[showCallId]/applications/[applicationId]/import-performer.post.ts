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
        // Champs repris vers le numéro d'un cabaret ou vers un spectacle standard
        // (voir bloc de rattachement)
        showTitle: true,
        showDescription: true,
        showDuration: true,
        technicalNeeds: true,
        stageSetup: true,
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

    // Rattachement au spectacle lié à la candidature (si le lien n'existe pas déjà).
    // - Spectacle STANDARD : lien ShowArtist au niveau du spectacle (actId null).
    // - Spectacle CABARET : la candidature devient un numéro. Tous les performers d'une même
    //   candidature partagent ce numéro, retrouvé par son titre (= showTitle de la candidature).
    //   On ne stocke pas l'id de candidature sur le numéro : l'enregistrement d'un cabaret
    //   recompose (supprime puis recrée) tous ses numéros et effacerait un tel lien ; le titre,
    //   lui, survit à ce cycle.
    let showLinkCreated = false
    let actCreated = false
    let actFieldsFilled = false
    let showTechNeedsAppended = false
    const targetShow = application.showId
      ? await prisma.show.findUnique({
          where: { id: application.showId },
          select: { type: true, technicalNeeds: true },
        })
      : null

    if (application.showId && targetShow?.type === 'CABARET') {
      // Le titre de candidature accepte jusqu'à 200 caractères, mais la colonne ShowAct.title est
      // en varchar(191) : on tronque pour éviter un échec d'insertion, et on réutilise cette même
      // valeur pour le rapprochement par titre (cohérence lookup/création).
      const actTitle = application.showTitle.slice(0, 191)
      const actFieldsSelect = {
        id: true,
        duration: true,
        description: true,
        technicalNeeds: true,
        stageSetup: true,
      } as const
      // Trouver ou créer le numéro correspondant à la candidature (identifié par son titre).
      let act = await prisma.showAct.findFirst({
        where: { showId: application.showId, title: actTitle },
        select: actFieldsSelect,
      })
      if (!act) {
        const lastAct = await prisma.showAct.findFirst({
          where: { showId: application.showId },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
        act = await prisma.showAct.create({
          data: {
            showId: application.showId,
            title: actTitle,
            position: (lastAct?.position ?? -1) + 1,
            duration: application.showDuration,
            description: application.showDescription,
            technicalNeeds: application.technicalNeeds,
            stageSetup: application.stageSetup,
          },
          select: actFieldsSelect,
        })
        actCreated = true
      } else {
        // Numéro déjà présent (réimport, ou autre performer de la candidature) : on complète
        // uniquement ses champs ENCORE VIDES depuis la candidature, sans jamais écraser une
        // saisie manuelle de l'organisateur. Permet de rattraper des infos ajoutées à la
        // candidature après un premier import.
        const isBlank = (v: string | null) => v == null || v.trim() === ''
        const fill: {
          duration?: number
          description?: string
          technicalNeeds?: string
          stageSetup?: string
        } = {}
        if (act.duration == null && application.showDuration != null)
          fill.duration = application.showDuration
        if (isBlank(act.description) && !isBlank(application.showDescription))
          fill.description = application.showDescription
        if (isBlank(act.technicalNeeds) && !isBlank(application.technicalNeeds))
          fill.technicalNeeds = application.technicalNeeds as string
        if (isBlank(act.stageSetup) && !isBlank(application.stageSetup))
          fill.stageSetup = application.stageSetup as string
        if (Object.keys(fill).length > 0) {
          await prisma.showAct.update({ where: { id: act.id }, data: fill })
          actFieldsFilled = true
        }
      }

      // Rattacher l'artiste au numéro s'il n'y est pas déjà.
      const existingActLink = await prisma.showArtist.findFirst({
        where: { showId: application.showId, actId: act.id, artistId: artist.id },
      })
      if (!existingActLink) {
        await prisma.showArtist.create({
          data: { showId: application.showId, actId: act.id, artistId: artist.id },
        })
        showLinkCreated = true
      }
    } else if (application.showId) {
      // findFirst et non findUnique : la clé unique porte désormais aussi actId, et MySQL
      // considère deux NULL comme distincts — l'unicité des liens sans numéro est donc
      // garantie ici, pas par le schéma.
      const existingLink = await prisma.showArtist.findFirst({
        where: { showId: application.showId, actId: null, artistId: artist.id },
      })
      if (!existingLink) {
        await prisma.showArtist.create({
          data: { showId: application.showId, artistId: artist.id },
        })
        showLinkCreated = true
      }

      // Concaténer les besoins techniques de la candidature à ceux du spectacle standard, sans
      // écraser l'existant : le spectacle peut regrouper plusieurs candidatures. Fait quel que
      // soit le choix « appliquer les infos ». Idempotent : on n'ajoute pas deux fois le même
      // texte (plusieurs performers d'une même candidature, ou ré-import).
      const appTechNeeds = application.technicalNeeds?.trim()
      if (appTechNeeds) {
        const current = targetShow?.technicalNeeds ?? ''
        if (!current.includes(appTechNeeds)) {
          await prisma.show.update({
            where: { id: application.showId },
            data: {
              technicalNeeds: current.trim()
                ? `${current.trim()}\n\n${appTechNeeds}`
                : appTechNeeds,
            },
          })
          showTechNeedsAppended = true
        }
      }
    }

    // Rien à faire : l'artiste existe déjà, pas de mise à jour, pas de lien ni de besoins ajoutés
    if (
      !artistCreated &&
      !showLinkCreated &&
      !artistDataApplied &&
      !showTechNeedsAppended &&
      !actFieldsFilled
    ) {
      throw createError({
        status: 409,
        message: 'Cet artiste est déjà importé et à jour',
      })
    }

    return createSuccessResponse({
      artist,
      artistCreated,
      showLinkCreated,
      actCreated,
      actFieldsFilled,
      showTechNeedsAppended,
      artistDataApplied,
    })
  },
  { operationName: 'ImportPerformerAsArtist' }
)
