import { z } from 'zod'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

// 3000 : aligné sur showActSchema, pour qu'un numéro reste éditable par le formulaire organisateur.
const MAX = 3000

/**
 * Cible : soit un spectacle STANDARD (`showId`, champ `technicalNeeds`), soit un numéro de cabaret
 * (`actId`, champs `technicalNeeds` + `stageSetup`). Exactement l'un des deux.
 * Les champs `expected*` portent la valeur telle que l'artiste l'a chargée : elle sert à détecter
 * une édition concurrente (organisateur ou autre artiste) et à ne pas écraser en silence.
 */
const schema = z
  .object({
    showId: z.number().int().positive().optional(),
    actId: z.number().int().positive().optional(),
    technicalNeeds: z.string().max(MAX).nullable().default(null),
    stageSetup: z.string().max(MAX).nullable().default(null),
    expectedTechnicalNeeds: z.string().nullable().default(null),
    expectedStageSetup: z.string().nullable().default(null),
  })
  .refine((d) => (d.showId ? !d.actId : !!d.actId), {
    message: 'Fournir soit showId (spectacle standard) soit actId (numéro), mais pas les deux',
  })

// Vide et null sont équivalents (comparaison de conflit + stockage cohérent).
const norm = (v: string | null | undefined) => {
  const t = v?.trim()
  return t ? t : null
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const data = schema.parse(body)

    // L'artiste doit exister sur cette édition (session courante).
    const artist = await prisma.editionArtist.findUnique({
      where: { editionId_userId: { editionId, userId: user.id } },
      select: { id: true },
    })
    if (!artist) {
      throw createError({ status: 404, message: "Vous n'êtes pas artiste pour cette édition" })
    }

    // ── Numéro de cabaret ────────────────────────────────────────────────
    if (data.actId) {
      // L'artiste doit réellement jouer dans ce numéro (lien ShowArtist), d'un spectacle de l'édition.
      const link = await prisma.showArtist.findFirst({
        where: { actId: data.actId, artistId: artist.id, show: { editionId } },
        select: { id: true },
      })
      if (!link) {
        throw createError({ status: 403, message: 'Vous ne participez pas à ce numéro' })
      }

      const act = await prisma.showAct.findUnique({
        where: { id: data.actId },
        select: { technicalNeeds: true, stageSetup: true },
      })
      if (!act) {
        throw createError({ status: 404, message: 'Numéro introuvable' })
      }

      // Conflit : la valeur a changé depuis le chargement → on n'écrase pas, on renvoie l'actuelle.
      if (
        norm(act.technicalNeeds) !== norm(data.expectedTechnicalNeeds) ||
        norm(act.stageSetup) !== norm(data.expectedStageSetup)
      ) {
        return createSuccessResponse({
          conflict: true,
          current: { technicalNeeds: act.technicalNeeds, stageSetup: act.stageSetup },
        })
      }

      const updated = await prisma.showAct.update({
        where: { id: data.actId },
        data: { technicalNeeds: norm(data.technicalNeeds), stageSetup: norm(data.stageSetup) },
        select: { technicalNeeds: true, stageSetup: true },
      })
      return createSuccessResponse({ conflict: false, ...updated })
    }

    // ── Spectacle STANDARD ───────────────────────────────────────────────
    const show = await prisma.show.findFirst({
      where: { id: data.showId, editionId },
      select: { type: true, technicalNeeds: true },
    })
    if (!show) {
      throw createError({ status: 404, message: 'Spectacle introuvable' })
    }
    if (show.type !== 'STANDARD') {
      throw createError({
        status: 400,
        message: "Les besoins techniques d'un cabaret se modifient sur ses numéros",
      })
    }

    const link = await prisma.showArtist.findFirst({
      where: { showId: data.showId, artistId: artist.id },
      select: { id: true },
    })
    if (!link) {
      throw createError({ status: 403, message: 'Vous ne participez pas à ce spectacle' })
    }

    if (norm(show.technicalNeeds) !== norm(data.expectedTechnicalNeeds)) {
      return createSuccessResponse({
        conflict: true,
        current: { technicalNeeds: show.technicalNeeds },
      })
    }

    const updated = await prisma.show.update({
      where: { id: data.showId },
      data: { technicalNeeds: norm(data.technicalNeeds) },
      select: { technicalNeeds: true },
    })
    return createSuccessResponse({ conflict: false, ...updated })
  },
  { operationName: 'UpdateMyShowTechnicalNeeds' }
)
