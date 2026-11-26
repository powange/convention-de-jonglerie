import { resumeAvantage } from '../../../../shared/codes-promo'
import { exigerAdministrateur } from '../../../utils/administration'

/** Le détail d'un code promo : ses réglages, et les comptes qui l'ont utilisé. */
export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ status: 404, message: 'Code introuvable' })
  const code = await prisma.promoCode.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, pseudo: true, email: true } } },
      },
    },
  })
  if (!code) throw createError({ status: 404, message: 'Code introuvable' })
  return { code: { ...code, resume: resumeAvantage(code) } }
})
