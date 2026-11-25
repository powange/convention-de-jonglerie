import { exigerAdministrateur } from '../../utils/administration'

/** Les chiffres du tableau de bord d'administration. */
export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const ilYa7Jours = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [
    comptes,
    verifies,
    parFournisseur,
    inscrits7j,
    connectes7j,
    abonnements,
    evenements,
    evenements7j,
    candidatures,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isEmailVerified: true } }),
    prisma.user.groupBy({ by: ['authProvider'], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: ilYa7Jours } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: ilYa7Jours } } }),
    prisma.subscription.count({
      where: { status: 'active', currentPeriodEnd: { gt: new Date() } },
    }),
    prisma.event.count(),
    prisma.event.count({ where: { createdAt: { gte: ilYa7Jours } } }),
    prisma.editionVolunteerApplication.count(),
  ])
  return {
    comptes,
    verifies,
    parFournisseur: Object.fromEntries(parFournisseur.map((p) => [p.authProvider, p._count._all])),
    inscrits7j,
    connectes7j,
    abonnementsActifs: abonnements,
    evenements,
    evenements7j,
    candidatures,
  }
})
