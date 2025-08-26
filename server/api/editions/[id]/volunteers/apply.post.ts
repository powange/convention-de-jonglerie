import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  motivation: z.string().max(1000).optional().nullable(),
  phone: z
    .string()
    .max(30)
    .regex(/^[+0-9 ().-]{6,30}$/)
    .optional(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user)
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })
  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body || {})

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { volunteersOpen: true },
  })
  if (!edition) throw createError({ statusCode: 404, statusMessage: 'Edition introuvable' })
  if (!edition.volunteersOpen)
    throw createError({ statusCode: 400, statusMessage: 'Recrutement fermé' })

  // Vérifier candidature existante
  const existing = await prisma.editionVolunteerApplication.findUnique({
    where: { editionId_userId: { editionId, userId: event.context.user.id } },
    select: { id: true },
  })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Déjà candidat' })

  // Téléphone requis : si pas déjà défini dans user et pas fourni -> erreur
  const user = await prisma.user.findUnique({
    where: { id: event.context.user.id },
    select: { phone: true },
  })
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })

  let finalPhone = user.phone
  if (!finalPhone) {
    if (!parsed.phone) {
      throw createError({ statusCode: 400, statusMessage: 'Téléphone requis' })
    }
    finalPhone = parsed.phone
    // Mise à jour user
    await prisma.user.update({ where: { id: event.context.user.id }, data: { phone: finalPhone } })
  }

  const application = await prisma.editionVolunteerApplication.create({
    data: {
      editionId,
      userId: event.context.user.id,
      motivation: parsed.motivation || null,
      userSnapshotPhone: finalPhone,
    },
    select: { id: true, status: true },
  })
  return { success: true, application }
})
