import { exigerAdministrateur } from '../../../utils/administration'
import { isSubscriptionActive } from '../../../utils/subscription'

/** La fiche d'un compte : identité, connexion, abonnement, événements, organisations, candidatures. */
export default defineEventHandler(async (event) => {
  await exigerAdministrateur(event)
  const id = Number(getRouterParam(event, 'id'))
  const compte = Number.isInteger(id)
    ? await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          emailHash: true,
          pseudo: true,
          prenom: true,
          nom: true,
          profilePicture: true,
          updatedAt: true,
          phone: true,
          authProvider: true,
          googleId: true,
          facebookId: true,
          password: true,
          isEmailVerified: true,
          isGlobalAdmin: true,
          createdAt: true,
          lastLoginAt: true,
          subscription: {
            select: {
              plan: true,
              formule: true,
              modules: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
          events: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, publicId: true, name: true, startDate: true, createdAt: true },
          },
          organizers: {
            select: {
              editions: {
                select: { event: { select: { id: true, publicId: true, name: true } } },
              },
            },
          },
          volunteerApplications: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              createdAt: true,
              event: { select: { id: true, publicId: true, name: true } },
            },
          },
        },
      })
    : null
  if (!compte) throw createError({ status: 404, message: 'Compte introuvable' })

  const { password, googleId, facebookId, subscription, organizers, ...reste } = compte
  return {
    ...reste,
    motDePasse: !!password,
    google: !!googleId,
    facebook: !!facebookId,
    abonnement: subscription
      ? { ...subscription, actif: isSubscriptionActive(subscription) }
      : null,
    coOrganise: organizers.flatMap((o) => o.editions.map((e) => e.event)),
  }
})
