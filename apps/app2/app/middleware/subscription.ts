// Protège la gestion d'un événement (`/events/:id/gestion/…`). Utilise useRequestFetch pour
// transmettre le cookie de session lors du rendu côté serveur.
//
// La gestion s'ouvre à quiconque la voit (propriétaire, organisateur, administrateur) ; une 404
// (événement introuvable ou invisible pour la personne) renvoie à sa page publique. Tout compte a
// au moins la formule gratuite (décision du 26/11/2026) : aucun abonnement n'est exigé ici. Quand la
// gestion est en LECTURE SEULE (événement archivé, ou propriétaire en surnombre d'événements), le
// serveur refuse les écritures (droits-evenement.ts) et le layout edition-dashboard l'annonce.
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  const ref = String(to.params.id ?? '')
  if (!ref || ref === 'new') return
  try {
    await useRequestFetch()(`/api/events/${encodeURIComponent(ref)}/acces-gestion`)
  } catch {
    return navigateTo(`/events/${ref}`)
  }
})
