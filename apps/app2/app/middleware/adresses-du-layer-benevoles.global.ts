/**
 * Les adresses d'événement de Flowvent : `/events/<publicId>/…`, l'identifiant public aléatoire.
 *
 * Deux sortes d'adresses arrivent pourtant avec l'id NUMÉRIQUE :
 * - celles du layer bénévoles, écrites pour app1 (`/editions/12/…`, boutons et liens de ses pages) ;
 * - celles des notifications (`actionUrl`), construites côté serveur avec l'id.
 * Ce middleware les réécrit en adresse publique, sans que la page ne s'affiche entre-temps.
 *
 * Et pour une adresse publique, il résout l'id numérique et range la correspondance dans l'état
 * `identifiants-evenements`, que lit `useEditionId()` (layer bénévoles) : les pages du layer
 * appellent leurs API avec l'id, qu'elles ne trouvent plus dans l'adresse.
 *
 * La résolution passe par GET /api/events/resoudre/:ref, qui applique la règle d'accès : par numéro,
 * seulement pour qui est impliqué. Un échec laisse la page répondre (404).
 */
const ADRESSE_EVENEMENT = /^\/(editions|events)\/([^/?#]+)/
const PAGES_SANS_EVENEMENT = new Set(['new'])

export default defineNuxtRouteMiddleware(async (to) => {
  const m = to.path.match(ADRESSE_EVENEMENT)
  if (!m) return
  const [, prefixe, ref] = m as unknown as [string, string, string]
  if (PAGES_SANS_EVENEMENT.has(ref)) return

  const versId = useState<Record<string, number>>('identifiants-evenements', () => ({}))
  const versPublic = useState<Record<number, string>>('identifiants-publics', () => ({}))
  const numero = /^\d+$/.test(ref)
  const adressePublique = (publicId: string) =>
    to.fullPath.replace(ADRESSE_EVENEMENT, `/events/${publicId}`)

  // Déjà connu : rien à demander.
  if (!numero && prefixe === 'events' && versId.value[ref]) return
  if (numero && versPublic.value[Number(ref)]) {
    return navigateTo(adressePublique(versPublic.value[Number(ref)]!), { replace: true })
  }

  // Au rendu serveur, le cookie de session doit accompagner la requête (sinon : anonyme → 404).
  const recuperer = import.meta.server ? useRequestFetch() : $fetch
  try {
    const { id, publicId } = await recuperer<{ id: number; publicId: string }>(
      `/api/events/resoudre/${encodeURIComponent(ref)}`
    )
    versId.value[publicId] = id
    versPublic.value[id] = publicId
    if (numero || prefixe === 'editions') {
      return navigateTo(adressePublique(publicId), { replace: true })
    }
  } catch {
    // Introuvable ou non accessible : la page affichera son 404. Une ancienne adresse `/editions/`
    // reste réécrite vers `/events/`, pour que ce soit le 404 de Flowvent qui réponde.
    if (prefixe === 'editions') {
      return navigateTo(to.fullPath.replace(/^\/editions\//, '/events/'), { replace: true })
    }
  }
})
