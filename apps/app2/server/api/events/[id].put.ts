import { z } from 'zod'

import { fuseauUtilisable, versInstant } from '#core/shared/utils/fuseau-edition'

import { droitsSurEvenement } from '../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../utils/evenement-public'

/**
 * Modifie un événement : nom, description, lieu, dates de début et de fin, fuseau.
 *
 * Les dates arrivent en HORLOGE MURALE (`AAAA-MM-JJTHH:MM`, ce que montre un champ date-heure) et
 * sont ancrées ICI dans le fuseau de l'événement — jamais dans celui du navigateur : un
 * organisateur à Paris qui saisit 10 h pour un événement à Montréal enregistre 10 h à Montréal.
 */
const horloge = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure invalides')
  .nullable()

const schema = z
  .object({
    name: z.string().trim().min(1, "Le nom de l'événement est requis").max(200),
    description: z.string().trim().max(5000).nullable(),
    location: z.string().trim().max(200).nullable(),
    timezone: z.string().refine((f) => !!fuseauUtilisable(f), 'Fuseau horaire inconnu'),
    debut: horloge,
    fin: horloge,
  })
  .refine((d) => !d.debut || !d.fin || d.fin >= d.debut, {
    message: 'La fin doit suivre le début',
    path: ['fin'],
  })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = await idDepuisLaRoute(event)

  const droits = await droitsSurEvenement(id, (user as { id: number }).id)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.modifier)
    throw createError({ status: 403, message: 'Vous ne pouvez pas modifier cet événement' })

  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) {
    throw createError({
      status: 400,
      message: resultat.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  const d = resultat.data

  const evenement = await prisma.event.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      location: d.location || null,
      timezone: d.timezone,
      startDate: d.debut ? new Date(versInstant(d.debut, d.timezone)) : null,
      endDate: d.fin ? new Date(versInstant(d.fin, d.timezone)) : null,
    },
  })
  return createSuccessResponse({ event: evenement }, 'Événement mis à jour')
})
