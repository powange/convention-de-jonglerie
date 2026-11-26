// Protège les fonctionnalités d'organisation. Utilise useRequestFetch pour transmettre le cookie de
// session lors du rendu côté serveur.
//
// Deux cas (décisions de l'utilisateur) :
// - la GESTION D'UN ÉVÉNEMENT (`/events/:id/gestion/…`) s'ouvre à quiconque la voit (propriétaire,
//   organisateur, administrateur). Si l'abonnement du PROPRIÉTAIRE est arrêté, ou que sa formule ne
//   couvre pas le module, elle reste consultable en LECTURE SEULE : le serveur refuse les écritures
//   (droits-evenement.ts) et la gestion l'annonce par un bandeau (layout edition-dashboard) ;
// - ailleurs (créer un événement…), il faut son propre abonnement.
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  const recuperer = useRequestFetch()
  const ref = to.path.startsWith('/events/') ? String(to.params.id ?? '') : ''

  try {
    if (ref && ref !== 'new') {
      // Une 404 (événement introuvable ou invisible pour la personne) renvoie à sa page publique.
      await recuperer(`/api/events/${encodeURIComponent(ref)}/acces-gestion`)
      return
    }
    const status = await recuperer<{ active?: boolean }>('/api/subscription/status')
    if (!status?.active) {
      return navigateTo('/pricing')
    }
  } catch {
    return navigateTo(ref && ref !== 'new' ? `/events/${ref}` : '/pricing')
  }
})
