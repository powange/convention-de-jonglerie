/**
 * La forme d'un créneau de bénévoles rendue au planning, écrite une seule fois.
 *
 * Trois points d'API la produisent — la liste, la création, la modification — et le client ne
 * recharge pas la liste après une écriture : `useVolunteerTimeSlots` REMPLACE le créneau qu'il
 * tient en mémoire par celui qu'il vient de recevoir. Toute différence entre ces trois formes se
 * voit donc immédiatement à l'écran, et disparaît au rechargement de la page — ce qui rend le
 * défaut difficile à croire pour qui le signale.
 *
 * C'est exactement ce qui est arrivé. Déplacer un créneau le renvoyait amputé :
 *
 * - la **photo** de ses bénévoles (ni `profilePicture`, ni `emailHash`, ni `updatedAt`), si bien
 *   que l'avatar retombait sur une adresse Gravatar `inconnu` rendant 404 ;
 * - ses **organisateurs affectés**, absents de la réponse, donc effacés de l'affichage ET du
 *   compteur de places occupées, qui les additionne aux bénévoles ;
 * - son **retard**, dont la mention ⏱️ disparaissait ;
 * - les **pronoms** et l'adresse de courriel.
 *
 * D'où un include et un formatage partagés plutôt que trois copies : la copie avait déjà divergé
 * deux fois sur trois, et rien ne le signalait.
 */

/** Ce qu'il faut connaître d'une personne pour l'afficher sur un créneau. */
const selectionPersonne = {
  id: true,
  pseudo: true,
  nom: true,
  prenom: true,
  pronouns: true,
  emailHash: true,
  profilePicture: true,
  updatedAt: true,
} as const

/**
 * L'`include` Prisma que les trois points d'API partagent.
 *
 * `email` est toujours demandé à la base ; c'est `formaterCreneau` qui décide de le rendre ou
 * non. Le tri se fait au plus près de la lecture : ce n'est pas la forme du créneau.
 */
export const inclusionCreneau = {
  team: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
  assignments: {
    include: {
      user: {
        select: {
          ...selectionPersonne,
          email: true,
        },
      },
    },
  },
  // Organisateurs affectés au créneau. Le `_count` ne porte que les bénévoles ; le client
  // additionne les deux pour connaître les places occupées.
  organizerAssignments: {
    select: {
      editionOrganizer: {
        select: {
          id: true,
          organizer: {
            select: {
              user: {
                select: selectionPersonne,
              },
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      assignments: true,
    },
  },
} as const

/** Un créneau tel que Prisma le rend avec `inclusionCreneau`. */
export interface CreneauAvecRelations {
  id: string
  title: string | null
  description: string | null
  startDateTime: Date
  endDateTime: Date
  teamId: string | null
  maxVolunteers: number
  delayMinutes?: number | null
  team: { id: string; name: string; color: string } | null
  assignments: Array<{ user: Record<string, unknown> } & Record<string, unknown>>
  organizerAssignments: Array<{
    editionOrganizer: { id: string | number; organizer: { user: Record<string, unknown> } }
  }>
  _count: { assignments: number }
}

/**
 * Le créneau tel que le planning l'attend.
 *
 * @param slot           un créneau lu avec `inclusionCreneau`
 * @param voitLesEmails  l'appelant a-t-il le droit de lire les adresses en clair ? Par défaut
 *                       non : un oubli doit retirer une donnée, jamais en divulguer une.
 * @param identiteMasquee  masquer l'identité civile des personnes — voir `creneauPseudonymise`.
 */
export function formaterCreneau(
  slot: CreneauAvecRelations,
  voitLesEmails = false,
  identiteMasquee = false
) {
  if (identiteMasquee) return creneauPseudonymise(slot)

  return {
    id: slot.id,
    title: slot.title,
    description: slot.description,
    start: slot.startDateTime.toISOString(),
    end: slot.endDateTime.toISOString(),
    teamId: slot.teamId,
    team: slot.team,
    maxVolunteers: slot.maxVolunteers,
    assignedVolunteers: slot._count.assignments,
    delayMinutes: slot.delayMinutes ?? null,
    // `?? []` sur les deux relations : une réponse amputée valait mieux qu'une erreur 500 au
    // moment de créer un créneau. Ce n'est pas un filet pour la sélection — c'est
    // `inclusionCreneau`, et son test, qui répondent de ce qui est demandé à la base.
    assignments: (slot.assignments ?? []).map((affectation) => {
      const { user, ...reste } = affectation
      const { email, ...personne } = user as Record<string, unknown>
      return {
        ...reste,
        user: voitLesEmails ? { ...personne, email } : personne,
      }
    }),
    organizerAssignments: (slot.organizerAssignments ?? []).map((affectation) => ({
      editionOrganizerId: affectation.editionOrganizer.id,
      user: affectation.editionOrganizer.organizer.user,
    })),
    color: slot.team?.color || '#6b7280',
    resourceId: slot.teamId || 'unassigned',
  }
}

/**
 * Le même créneau, réduit aux pseudonymes.
 *
 * Pour les équipes dont on ne fait PAS partie. On y voit qui tient chaque créneau — sous son
 * pseudo, avec sa photo — sans obtenir son identité civile.
 *
 * Ce n'est pas un demi-masquage arbitraire : le pseudo est ce que la personne a choisi de montrer
 * publiquement, le nom et le prénom ne le sont pas. Garder le premier permet de repérer qu'une
 * même personne tient deux créneaux à la même heure, ou de lui adresser la parole ; retirer les
 * seconds évite de distribuer un annuaire à toute l'édition.
 *
 * Ce qui part : `nom`, `prenom`, `pronouns`, et l'adresse de courriel — cette dernière QUOI QU'IL
 * ARRIVE, même pour qui a le droit de la lire ailleurs. Un organisateur non bénévole y a droit sur
 * ses propres équipes ; les autres ne le regardent pas.
 *
 * Ce qui reste : `pseudo`, `profilePicture`, `emailHash` et `updatedAt` — les trois derniers ne
 * servent qu'à afficher l'avatar, dont le repli Gravatar a besoin de l'empreinte — et `id`, sans
 * lequel le client ne peut ni lister ni reconnaître deux fois la même personne.
 *
 * ⚠️ La coquille est construite de zéro, champ par champ, plutôt que par soustraction. Un champ
 * ajouté un jour à la sélection — un numéro de téléphone, une adresse — ne se retrouverait pas
 * ici par accident : ce qu'on n'énumère pas ne peut pas fuir.
 */
function creneauPseudonymise(slot: CreneauAvecRelations) {
  const pseudonyme = (personne: Record<string, unknown> | undefined | null) => {
    if (!personne) return null
    return {
      id: personne.id,
      pseudo: personne.pseudo,
      profilePicture: personne.profilePicture,
      emailHash: personne.emailHash,
      updatedAt: personne.updatedAt,
    }
  }

  return {
    id: slot.id,
    title: slot.title,
    description: slot.description,
    start: slot.startDateTime.toISOString(),
    end: slot.endDateTime.toISOString(),
    teamId: slot.teamId,
    team: slot.team,
    maxVolunteers: slot.maxVolunteers,
    assignedVolunteers: slot._count.assignments,
    delayMinutes: slot.delayMinutes ?? null,
    // Les longueurs sont conservées : le client calcule les places occupées en additionnant
    // `assignedVolunteers` et la taille d'`organizerAssignments`.
    assignments: (slot.assignments ?? []).map((affectation, index) => ({
      id: `masque-${slot.id}-${index}`,
      user: pseudonyme(affectation.user as Record<string, unknown>),
    })),
    organizerAssignments: (slot.organizerAssignments ?? []).map((affectation, index) => ({
      editionOrganizerId: `masque-orga-${slot.id}-${index}`,
      user: pseudonyme(affectation.editionOrganizer?.organizer?.user),
    })),
    color: slot.team?.color || '#6b7280',
    resourceId: slot.teamId || 'unassigned',
    /** L'écran doit pouvoir dire pourquoi il ne nomme personne. */
    identiteMasquee: true as const,
  }
}
