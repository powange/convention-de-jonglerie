import { z } from 'zod'

import { exigerAdministrateur } from '../../../utils/administration'

/**
 * Donne ou retire le statut d'administrateur. On ne se le retire pas à soi-même : Flowvent
 * pourrait se retrouver sans aucun administrateur, et seule la base permettrait d'en refaire un.
 */
const schema = z.object({ isGlobalAdmin: z.boolean() })

export default defineEventHandler(async (event) => {
  const moi = await exigerAdministrateur(event)
  const id = Number(getRouterParam(event, 'id'))
  const corps = schema.safeParse(await readBody(event))
  if (!corps.success || !Number.isInteger(id)) {
    throw createError({ status: 400, message: 'Données invalides' })
  }
  if (id === moi && !corps.data.isGlobalAdmin) {
    throw createError({
      status: 409,
      message: "Vous ne pouvez pas retirer votre propre statut d'administrateur",
    })
  }
  const existe = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!existe) throw createError({ status: 404, message: 'Compte introuvable' })
  const maj = await prisma.user.update({
    where: { id },
    data: { isGlobalAdmin: corps.data.isGlobalAdmin },
    select: { id: true, isGlobalAdmin: true },
  })
  return createSuccessResponse(
    maj,
    maj.isGlobalAdmin ? 'Administrateur ajouté' : 'Administrateur retiré'
  )
})
