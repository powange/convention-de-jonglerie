/**
 * Les organisateurs d'un événement Flowvent : leur forme dans l'API, et la garde commune des
 * points qui les gèrent (droit « gérer les organisateurs », cf. droits-evenement.ts).
 */
import type { H3Event } from 'h3'

import { z } from 'zod'

import type { CleDroit, ColonneDroit, Droits } from '../../shared/modules-evenement'

import { DROITS_PAR_DOMAINE, droitsProposes } from '../../shared/modules-evenement'

import { droitsSurEvenement } from './droits-evenement'
import { idDepuisLaRoute } from './evenement-public'
import { estEnAttente } from './invitation'

export const selectionCompte = {
  id: true,
  pseudo: true,
  prenom: true,
  nom: true,
  email: true,
  emailHash: true,
  profilePicture: true,
  updatedAt: true,
  password: true,
  isEmailVerified: true,
} as const

type Compte = {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string | null
  profilePicture: string | null
  updatedAt: Date
  password: string | null
  isEmailVerified: boolean
}

/** Un compte tel que la page l'affiche — l'adresse e-mail seulement pour qui gère. */
export function compteAffiche(c: Compte, avecEmail: boolean) {
  return {
    id: c.id,
    pseudo: c.pseudo,
    prenom: c.prenom,
    nom: c.nom,
    emailHash: c.emailHash,
    profilePicture: c.profilePicture,
    updatedAt: c.updatedAt,
    ...(avecEmail ? { email: c.email } : {}),
    enAttente: estEnAttente(c),
  }
}

export const DROITS_SCHEMA_CLES = DROITS_PAR_DOMAINE.map((d) => d.cle)

/**
 * Les droits reçus par l'API : chaque domaine facultatif (un absent n'est pas touché). Seulement
 * les droits PROPOSÉS — un droit sur un module pas encore porté est ignoré, pas enregistré.
 */
export const schemaDroits = z.object(
  Object.fromEntries(droitsProposes().map((d) => [d.cle, z.boolean().optional()])) as Record<
    CleDroit,
    z.ZodOptional<z.ZodBoolean>
  >
)

/** Les droits d'un organisateur, dans le vocabulaire de l'API (et de la page). */
export function droitsAffiches(o: Record<ColonneDroit, boolean>): Droits {
  return Object.fromEntries(DROITS_PAR_DOMAINE.map((d) => [d.cle, o[d.colonne]])) as Droits
}

/** Et dans celui de la base — seulement les droits fournis. */
export function droitsEnBase(d: Partial<Droits>): Partial<Record<ColonneDroit, boolean>> {
  return Object.fromEntries(
    DROITS_PAR_DOMAINE.filter((def) => d[def.cle] !== undefined).map((def) => [
      def.colonne,
      d[def.cle],
    ])
  )
}

/**
 * L'événement de la route et l'utilisateur, à condition qu'il puisse gérer ses organisateurs.
 * Invisible → 404 ; visible sans ce droit → 403.
 */
export async function exigerGestionDesOrganisateurs(event: H3Event) {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const eventId = await idDepuisLaRoute(event)
  const droits = await droitsSurEvenement(eventId, userId)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.organisateurs) {
    throw createError({ status: 403, message: 'Vous ne pouvez pas gérer les organisateurs' })
  }
  return { eventId, userId }
}

/** La ligne `EditionOrganizer` de la route, appartenant bien à cet événement. */
export async function organisateurDeLaRoute(event: H3Event, eventId: number) {
  const id = Number(getRouterParam(event, 'organisateurId'))
  const ligne = Number.isInteger(id)
    ? await prisma.editionOrganizer.findFirst({
        where: { id, editionId: eventId },
        include: { organizer: { select: { userId: true } } },
      })
    : null
  if (!ligne) throw createError({ status: 404, message: 'Organisateur introuvable' })
  return ligne
}
