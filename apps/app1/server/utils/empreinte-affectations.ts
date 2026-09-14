import { createHash } from 'node:crypto'

/**
 * L'empreinte d'un ensemble d'affectations, pour savoir si quelqu'un y a touché.
 *
 * Écrite ici plutôt que dans chacun des deux endpoints qui s'en servent — celui qui applique un
 * calcul et celui qui l'annule. Deux implémentations finiraient par diverger, et le jour où elles
 * divergeraient, l'annulation refuserait ce qu'elle aurait dû accepter, ou l'inverse. C'est la
 * leçon que ce module a apprise plusieurs fois.
 *
 * ⚠️ Elle porte sur les affectations, et sur elles seules. Un créneau ajouté ailleurs dans
 * l'édition ne doit pas empêcher d'annuler un calcul : l'annulation ne touche qu'à ce que le
 * calcul avait écrit.
 */
export function empreinteDesAffectations(
  affectations: { timeSlotId: string; userId: number; source: string }[]
): string {
  const matiere = affectations
    .map((a) => `${a.timeSlotId}:${a.userId}:${a.source}`)
    .sort()
    .join('|')

  return createHash('sha256').update(matiere).digest('hex')
}

/**
 * Les créneaux qu'une annulation modifierait, d'après ce que le calcul avait écrit.
 *
 * L'annulation retire ce qui a été créé et recrée ce qui a été effacé : ce sont exactement ces
 * créneaux-là qu'il faut surveiller, et pas toute l'édition. Surveiller plus large ferait refuser
 * une annulation légitime parce qu'un organisateur a ajouté une affectation à l'autre bout du
 * planning.
 */
export function creneauxConcernes(
  creees: { timeSlotId: string }[],
  effacees: { timeSlotId: string }[]
): string[] {
  return [...new Set([...creees, ...effacees].map((ligne) => ligne.timeSlotId))]
}
