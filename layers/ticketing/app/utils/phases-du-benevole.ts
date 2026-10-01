/**
 * À quelle PHASE un bénévole est attendu : l'événement, le montage, le démontage.
 *
 * ⚠️ POURQUOI CE REPÈRE EXISTE. Le contrôle d'accès ne retenait que les bénévoles présents
 * PENDANT l'événement. Un bénévole qui a répondu « non » à cette question mais « oui » au montage
 * y était donc introuvable — par son nom comme par son adresse —, alors qu'il se présente bel et
 * bien au guichet. Signalé sur une édition où cinq bénévoles acceptés sont dans ce cas.
 *
 * La règle serveur a été élargie (`benevolePresentSurPlace`), et ces personnes apparaissent
 * désormais. Mais les faire apparaître SANS LE DIRE serait un autre défaut : le guichet croirait
 * avoir devant lui un bénévole attendu pendant l'événement, et ne verrait pas qu'il est là pour
 * une autre raison. D'où ce repère.
 *
 * 📍 PAS DE REPÈRE POUR LE CAS ORDINAIRE : quelqu'un présent pendant l'événement n'a rien de
 * particulier à signaler, et une pastille sur chaque ligne ne se lirait plus. On ne marque que
 * l'exception.
 */

/** Ce qu'il faut d'une candidature pour situer sa présence. */
export interface DisponibilitesDuBenevole {
  /** `null` : la question n'a jamais été posée — la colonne est postérieure à la candidature. */
  eventAvailability?: boolean | null
  setupAvailability?: boolean | null
  teardownAvailability?: boolean | null
}

/** Ce que le repère annonce. `null` : rien à signaler. */
export type PhaseHorsEvenement = 'montage' | 'demontage' | 'montage-demontage'

/**
 * @returns la phase à signaler, ou `null` si la personne est attendue pendant l'événement.
 */
export function phaseHorsEvenement(
  candidature: DisponibilitesDuBenevole | null | undefined
): PhaseHorsEvenement | null {
  if (!candidature) return null

  /*
   * ⚠️ `!== false` ET NON `=== true` : `null` veut dire « on ne lui a pas demandé », et ces
   * candidatures-là sont traitées comme présentes depuis toujours — c'est la règle que
   * `benevoles-presents.ts` protège. Les marquer « montage seulement » les désignerait à tort.
   */
  if (candidature.eventAvailability !== false) return null

  const montage = candidature.setupAvailability === true
  const demontage = candidature.teardownAvailability === true

  if (montage && demontage) return 'montage-demontage'
  if (montage) return 'montage'
  if (demontage) return 'demontage'

  // Ni l'un ni l'autre : le serveur ne devrait pas l'avoir rendu. On ne signale rien plutôt que
  // d'inventer une phase — l'anomalie se verrait de toute façon à son absence de créneaux.
  return null
}
