/**
 * Détection des spectacles qu'un bénévole ne pourra voir sous aucune de leurs représentations.
 *
 * Un spectacle joué plusieurs fois laisse plusieurs occasions de le voir : tant qu'une seule
 * représentation reste libre, le bénévole n'a rien manqué et n'a donc pas à être signalé.
 * L'avertissement ne se déclenche que lorsque *toutes* les représentations tombent pendant
 * ses créneaux.
 *
 * La règle qui décide si un créneau empêche d'assister à une représentation est partagée avec
 * l'assignation automatique : l'algorithme ne doit pas juger acceptable ce que cette page
 * dénonce.
 */
import type { SpectacleProgramme } from '~~/shared/utils/spectacles-visibles'

import { empeche, representationsDe } from '~~/shared/utils/spectacles-visibles'

export type { SpectacleProgramme }

/** Un créneau du planning, avec les bénévoles qui y sont affectés. */
export interface CreneauAvecBenevoles {
  id: string | number
  title?: string | null
  start: string
  end: string
  teamId?: string | null
  assignedVolunteersList?: Array<{ user?: { id?: number } | null } | null> | null
}

export interface CreneauBloquant {
  id: string | number
  title: string
  start: string
  end: string
  teamName: string | null
}

export interface AvertissementSpectacleManque {
  volunteerId: number
  volunteer: any
  show: { id: number; title: string }
  /** Une entrée par représentation, avec le créneau qui l'empêche de la voir. */
  representations: Array<{ startDateTime: string; slot: CreneauBloquant }>
}

const enMillisecondes = (iso: string): number => new Date(iso).getTime()

export function detecterSpectaclesManques(
  spectacles: SpectacleProgramme[],
  creneaux: CreneauAvecBenevoles[],
  nomEquipe: (teamId: string | null | undefined) => string | null = () => null
): AvertissementSpectacleManque[] {
  // Regrouper les créneaux par bénévole : la question se pose bénévole par bénévole.
  const creneauxParBenevole = new Map<
    number,
    Array<{ debut: number; fin: number; brut: CreneauAvecBenevoles; user: any }>
  >()

  for (const creneau of creneaux) {
    if (!creneau?.id) continue
    const debut = enMillisecondes(creneau.start)
    const fin = enMillisecondes(creneau.end)
    // Un créneau aux dates illisibles ne prouve rien : mieux vaut l'ignorer que d'accuser à tort.
    if (Number.isNaN(debut) || Number.isNaN(fin)) continue

    for (const affectation of creneau.assignedVolunteersList || []) {
      const userId = affectation?.user?.id
      if (!userId) continue
      if (!creneauxParBenevole.has(userId)) creneauxParBenevole.set(userId, [])
      creneauxParBenevole.get(userId)!.push({ debut, fin, brut: creneau, user: affectation!.user })
    }
  }

  const avertissements: AvertissementSpectacleManque[] = []

  for (const spectacle of spectacles) {
    const representations = representationsDe(spectacle)

    // Un spectacle sans représentation lisible n'offre rien à manquer.
    if (representations.length === 0) continue

    for (const [volunteerId, creneauxDuBenevole] of creneauxParBenevole) {
      const bloquants: AvertissementSpectacleManque['representations'] = []
      let uneRepresentationLibre = false

      for (const representation of representations) {
        const bloquant = creneauxDuBenevole.find((creneau) =>
          empeche(creneau.debut, creneau.fin, representation)
        )

        if (!bloquant) {
          uneRepresentationLibre = true
          break
        }

        bloquants.push({
          startDateTime: representation.iso,
          slot: {
            id: bloquant.brut.id,
            title: bloquant.brut.title || 'Sans titre',
            start: bloquant.brut.start,
            end: bloquant.brut.end,
            teamName: nomEquipe(bloquant.brut.teamId),
          },
        })
      }

      if (uneRepresentationLibre) continue

      avertissements.push({
        volunteerId,
        volunteer: creneauxDuBenevole[0]!.user,
        show: { id: spectacle.id, title: spectacle.title },
        representations: bloquants,
      })
    }
  }

  return avertissements
}
