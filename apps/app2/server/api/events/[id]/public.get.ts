import { droitsSurEvenement } from '../../../utils/droits-evenement'
import { resoudreEvenement } from '../../../utils/evenement-public'

/**
 * Ce que montre la PAGE PUBLIQUE d'un événement (`/events/<publicId>`), lisible sans connexion.
 *
 * Visible selon la règle de `resoudreEvenement` : tout le monde si l'organisateur a rendu la page
 * publique (ou si la page bénévoles est publique, les candidatures ouvertes, un appel à spectacles
 * en ligne) ; sinon seulement qui est impliqué — l'organisateur y voit alors un aperçu, marqué
 * comme non public. Sinon 404 : l'existence de l'événement ne se devine pas.
 *
 * Rien que des informations publiques : pas d'adresse e-mail, pas de données de compte, pas de
 * chiffres de gestion.
 */
export default defineEventHandler(async (event) => {
  const user = optionalAuth(event)
  const resolu = await resoudreEvenement(
    String(getRouterParam(event, 'id') ?? ''),
    user?.id ?? null
  )
  if (!resolu) throw createError({ status: 404, message: 'Événement introuvable' })

  const e = await prisma.event.findUniqueOrThrow({
    where: { id: resolu.id },
    select: {
      id: true,
      publicId: true,
      name: true,
      description: true,
      location: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      startDate: true,
      endDate: true,
      timezone: true,
      imageUrl: true,
      officialWebsiteUrl: true,
      ticketingUrl: true,
      facebookUrl: true,
      instagramUrl: true,
      status: true,
      archivedAt: true,
      pagePublique: true,
      volunteersEnabled: true,
      artistsEnabled: true,
      volunteerSettings: { select: { pagePublic: true, open: true } },
      showCalls: {
        where: { visibility: { in: ['PUBLIC', 'CLOSED'] } },
        select: { id: true, name: true, visibility: true, deadline: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const droits = user ? await droitsSurEvenement(e.id, user.id) : null
  const reglages = e.volunteerSettings
  return {
    evenement: {
      id: e.id,
      publicId: e.publicId,
      name: e.name,
      description: e.description,
      location: e.location,
      adresse: {
        ligne1: e.addressLine1,
        ligne2: e.addressLine2,
        codePostal: e.postalCode,
        ville: e.city,
        pays: e.country,
      },
      startDate: e.startDate,
      endDate: e.endDate,
      timezone: e.timezone,
      imageUrl: e.imageUrl,
      liens: {
        siteOfficiel: e.officialWebsiteUrl,
        billetterie: e.ticketingUrl,
        facebook: e.facebookUrl,
        instagram: e.instagramUrl,
      },
      annule: e.status === 'CANCELLED',
      archive: !!e.archivedAt,
    },
    /** La page est-elle visible de tous ? Sinon, seul un impliqué la voit (aperçu). */
    estPublique: resolu.estPublic,
    pagePublique: e.pagePublique,
    benevoles:
      e.volunteersEnabled && reglages && (reglages.pagePublic || reglages.open)
        ? { candidaturesOuvertes: reglages.open }
        : null,
    // Les appels listés publiquement, et ceux qui sont clos (visibles, sans candidature). Un appel
    // privé ne se trouve que par son lien direct : il n'est pas listé ici.
    appels: e.artistsEnabled
      ? e.showCalls.map((a) => ({
          id: a.id,
          nom: a.name,
          ouvert: a.visibility === 'PUBLIC',
          dateLimite: a.deadline,
        }))
      : [],
    droits: droits?.voir ? { voir: true, estProprietaire: droits.estProprietaire } : null,
  }
})
