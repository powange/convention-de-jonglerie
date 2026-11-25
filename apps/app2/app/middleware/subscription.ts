// Protège les fonctionnalités d'organisation. Utilise useRequestFetch pour transmettre le cookie de
// session lors du rendu côté serveur.
//
// Deux cas (décision de l'utilisateur) :
// - la GESTION D'UN ÉVÉNEMENT (`/events/:id/gestion/…`) s'ouvre si l'abonnement du PROPRIÉTAIRE de
//   l'événement est actif — un co-organisateur n'a pas besoin du sien ;
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
      const acces = await recuperer<{ abonnementActif: boolean }>(
        `/api/events/${encodeURIComponent(ref)}/acces-gestion`
      )
      if (!acces.abonnementActif) return navigateTo(`/events/${ref}`)
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
