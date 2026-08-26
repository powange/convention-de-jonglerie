import { journeesEntre, versChampLocal, versInstant } from './fuseau-edition'

/**
 * Étendue d'une répétition de créneau bénévole.
 *
 * `EVENEMENT` couvre les journées de l'édition ; `AVEC_MONTAGE` y ajoute le montage et le
 * démontage, quand ils sont déclarés — deux dates facultatives des réglages bénévoles.
 */
export type EtendueRecurrence = 'EVENEMENT' | 'AVEC_MONTAGE'

export interface BornesRecurrence {
  debutEvenement: string | Date
  finEvenement: string | Date
  debutMontage?: string | Date | null
  finDemontage?: string | Date | null
}

export interface CreneauGenere {
  startDateTime: string
  endDateTime: string
}

/**
 * Répète un créneau sur chaque journée de la période retenue, à la même heure.
 *
 * Le calcul passe par les heures murales et non par des additions de 24 heures : un changement
 * d'heure au milieu d'une convention décalerait sinon tous les créneaux suivants d'une heure.
 * `journeesEntre` découpe les journées dans le fuseau de l'édition, pour les mêmes raisons.
 *
 * Un créneau qui finit après minuit — « bar 22 h – 2 h » — garde son débordement sur chaque
 * répétition, y compris la dernière : la dernière soirée se termine comme les autres, et un
 * créneau manquant se remarque moins qu'un créneau en trop.
 *
 * @returns Les créneaux à créer, le premier étant celui de la première journée de la période.
 *   Liste vide si les bornes sont illisibles — l'appelant retombe alors sur le créneau saisi.
 */
export function genererCreneauxRecurrents(
  creneau: { startDateTime: string | Date; endDateTime: string | Date },
  etendue: EtendueRecurrence,
  bornes: BornesRecurrence,
  fuseau?: string | null
): CreneauGenere[] {
  const debut =
    etendue === 'AVEC_MONTAGE' && bornes.debutMontage ? bornes.debutMontage : bornes.debutEvenement
  const fin =
    etendue === 'AVEC_MONTAGE' && bornes.finDemontage ? bornes.finDemontage : bornes.finEvenement

  const journees = journeesEntre(debut, fin, fuseau)
  if (journees.length === 0) return []

  // Heures murales du créneau saisi : c'est ce qui se répète, la date étant remplacée.
  const departLocal = versChampLocal(creneau.startDateTime, fuseau)
  const finLocale = versChampLocal(creneau.endDateTime, fuseau)
  if (!departLocal || !finLocale) return []

  const [journeeDepart, heureDepart] = departLocal.split('T')
  const [journeeFin, heureFin] = finLocale.split('T')
  if (!heureDepart || !heureFin || !journeeDepart || !journeeFin) return []

  // Un créneau de nuit se termine le lendemain : on garde cet écart sur chaque répétition.
  const ecartJours = Math.round(
    (Date.parse(`${journeeFin}T00:00:00Z`) - Date.parse(`${journeeDepart}T00:00:00Z`)) / 86_400_000
  )

  const creneaux: CreneauGenere[] = []
  for (const journee of journees) {
    const startDateTime = versInstant(`${journee}T${heureDepart}`, fuseau)
    const journeeDeFin = decalerJournee(journee, ecartJours)
    const endDateTime = versInstant(`${journeeDeFin}T${heureFin}`, fuseau)
    // Un fuseau inconnu rend une chaîne vide plutôt qu'un instant faux : on n'invente rien.
    if (!startDateTime || !endDateTime) return []
    creneaux.push({ startDateTime, endDateTime })
  }

  return creneaux
}

/** Décale une journée `AAAA-MM-JJ` d'un nombre de jours, sans passer par un fuseau. */
function decalerJournee(journee: string, jours: number): string {
  if (jours === 0) return journee
  const d = new Date(`${journee}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}
