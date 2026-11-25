/**
 * Identifiant public des événements : les adresses portent `publicId` (aléatoire), le code et le
 * layer bénévoles l'id numérique. Ce module passe de l'un à l'autre, et décide qui le peut.
 *
 * La règle qui ferme l'énumération : par `publicId`, un événement public (page bénévoles publique
 * ou candidatures ouvertes) se trouve — on a reçu le lien ; par NUMÉRO, seuls ceux qui le gèrent
 * ou y ont candidaté le trouvent. Compter 1, 2, 3… ne mène donc plus aux pages publiques des autres.
 */
import type { H3Event } from 'h3'

import { droitsSurEvenement } from './droits-evenement'

export const estUnNumero = (ref: string) => /^\d+$/.test(ref)

export interface EvenementResolu {
  id: number
  publicId: string
  /** Gère, ou a candidaté : peut l'atteindre par son numéro. */
  impliquee: boolean
  /** Page bénévoles publique ou candidatures ouvertes. */
  estPublic: boolean
}

/**
 * L'événement désigné par `ref` (numéro ou identifiant public), s'il est visible de cette
 * personne selon la règle ci-dessus ; sinon `null` (l'appelant répond 404, comme un absent).
 */
export async function resoudreEvenement(
  ref: string,
  userId: number | null
): Promise<EvenementResolu | null> {
  const numero = estUnNumero(ref)
  const evenement = await prisma.event.findUnique({
    where: numero ? { id: Number(ref) } : { publicId: ref },
    select: {
      id: true,
      publicId: true,
      volunteerSettings: { select: { pagePublic: true, open: true } },
    },
  })
  if (!evenement) return null

  let impliquee = false
  if (userId) {
    const droits = await droitsSurEvenement(evenement.id, userId)
    impliquee =
      droits.voir ||
      !!(await prisma.editionVolunteerApplication.findFirst({
        where: { eventId: evenement.id, userId },
        select: { id: true },
      }))
  }
  const s = evenement.volunteerSettings
  const estPublic = !!(s?.pagePublic || s?.open)

  if (!impliquee && (numero || !estPublic)) return null
  return { id: evenement.id, publicId: evenement.publicId, impliquee, estPublic }
}

/**
 * L'id numérique d'un événement désigné dans l'URL (`[id]` = numéro ou identifiant public), pour
 * les points d'API qui vérifient ensuite eux-mêmes les droits. Introuvable → 404.
 */
export async function idDepuisLaRoute(event: H3Event): Promise<number> {
  const ref = String(getRouterParam(event, 'id') ?? '')
  if (!ref) throw createError({ status: 400, message: 'Identifiant invalide' })
  if (estUnNumero(ref)) return Number(ref)
  const trouve = await prisma.event.findUnique({ where: { publicId: ref }, select: { id: true } })
  if (!trouve) throw createError({ status: 404, message: 'Événement introuvable' })
  return trouve.id
}
